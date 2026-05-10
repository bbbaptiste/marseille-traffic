import json
import logging
import os
import random
import string
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from simulator import load_base_graph, run_simulation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voies:voies@localhost:5432/voies")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="Marseille Traffic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Graph loaded once at startup — shared across all simulate requests
_base_graph = None
_road_id_to_edge = {}


@app.on_event("startup")
async def startup_event():
    global _base_graph, _road_id_to_edge
    try:
        _base_graph, _road_id_to_edge = load_base_graph(engine)
    except Exception as exc:
        logger.warning("Graph load failed at startup: %s", exc)


class SimulateRequest(BaseModel):
    removed_road_ids: list[int]
    hour: int
    day_type: str


class SaveSimulationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    removed_road_ids: list[int] = Field(..., min_length=1)
    hour: int
    day_type: str
    viewport: dict = Field(default_factory=dict)

    @field_validator("removed_road_ids")
    @classmethod
    def max_roads(cls, v):
        if len(v) > 500:
            raise ValueError("max 500 routes supprimées par simulation")
        return v

    @field_validator("hour")
    @classmethod
    def valid_hour(cls, v):
        if not 0 <= v <= 23:
            raise ValueError("hour must be 0–23")
        return v

    @field_validator("day_type")
    @classmethod
    def valid_day_type(cls, v):
        if v not in ("semaine", "weekend"):
            raise ValueError("day_type must be semaine or weekend")
        return v


def _generate_share_token(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choices(alphabet, k=length))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/roads")
def get_roads(bbox: str):
    try:
        parts = bbox.split(",")
        if len(parts) != 4:
            raise ValueError
        minx, miny, maxx, maxy = map(float, parts)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="bbox must be minx,miny,maxx,maxy")

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, name, highway_type, length_m, from_node_id, to_node_id,
                           ST_AsGeoJSON(geometry) AS geom_json
                    FROM roads
                    WHERE ST_Intersects(
                        geometry,
                        ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
                    )
                """),
                {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy},
            ).fetchall()
    except (ProgrammingError, OperationalError):
        return {"type": "FeatureCollection", "features": []}

    features = [
        {
            "type": "Feature",
            "geometry": json.loads(row.geom_json),
            "properties": {
                "id": row.id,
                "name": row.name,
                "highway_type": row.highway_type,
                "length_m": row.length_m,
                "from_node_id": row.from_node_id,
                "to_node_id": row.to_node_id,
            },
        }
        for row in rows
    ]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/traffic")
def get_traffic(hour: int, day_type: str):
    if not 0 <= hour <= 23:
        raise HTTPException(status_code=400, detail="hour must be between 0 and 23")
    if day_type not in ("semaine", "weekend"):
        raise HTTPException(status_code=400, detail="day_type must be semaine or weekend")

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT r.id, r.name, r.highway_type, r.length_m,
                           t.traffic_level,
                           ST_AsGeoJSON(r.geometry) AS geom_json
                    FROM roads r
                    JOIN traffic_levels t ON t.road_id = r.id
                    WHERE t.hour = :hour AND t.day_type = :day_type
                """),
                {"hour": hour, "day_type": day_type},
            ).fetchall()
    except (ProgrammingError, OperationalError):
        return {"type": "FeatureCollection", "features": []}

    features = [
        {
            "type": "Feature",
            "geometry": json.loads(row.geom_json),
            "properties": {
                "id": row.id,
                "name": row.name,
                "highway_type": row.highway_type,
                "length_m": row.length_m,
                "traffic_level": row.traffic_level,
            },
        }
        for row in rows
    ]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/traffic/daily")
def get_traffic_daily(road_id: int, day_type: str):
    if day_type not in ("semaine", "weekend"):
        raise HTTPException(status_code=400, detail="day_type must be semaine or weekend")

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT hour, traffic_level
                    FROM traffic_levels
                    WHERE road_id = :road_id AND day_type = :day_type
                    ORDER BY hour
                """),
                {"road_id": road_id, "day_type": day_type},
            ).fetchall()
    except (ProgrammingError, OperationalError):
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not rows:
        raise HTTPException(status_code=404, detail=f"No traffic data for road_id={road_id}")

    return [{"hour": r.hour, "traffic_level": round(r.traffic_level, 4)} for r in rows]


@app.post("/api/simulate")
def simulate(body: SimulateRequest):
    if _base_graph is None:
        raise HTTPException(status_code=503, detail="Graph not loaded — retry in a moment")
    if not 0 <= body.hour <= 23:
        raise HTTPException(status_code=400, detail="hour must be between 0 and 23")
    if body.day_type not in ("semaine", "weekend"):
        raise HTTPException(status_code=400, detail="day_type must be semaine or weekend")
    if not body.removed_road_ids:
        raise HTTPException(status_code=400, detail="removed_road_ids must not be empty")

    try:
        features, elapsed = run_simulation(
            _base_graph,
            _road_id_to_edge,
            engine,
            body.removed_road_ids,
            body.hour,
            body.day_type,
        )
    except Exception as exc:
        logger.exception("Simulation error: %s", exc)
        raise HTTPException(status_code=500, detail="Simulation failed")

    meta = {"elapsed_s": round(elapsed, 3), "removed_count": len(body.removed_road_ids)}
    if elapsed > 2.0:
        meta["warning"] = f"Calcul lent ({elapsed:.1f}s) — réduire le nombre de routes supprimées"

    logger.info(
        "Simulation: %d routes supprimées, %d impactées, %.3fs",
        len(body.removed_road_ids),
        sum(1 for f in features if f["properties"].get("impacted")),
        elapsed,
    )

    return {"type": "FeatureCollection", "features": features, "meta": meta}


# ---------------------------------------------------------------------------
# Simulations — persistance et partage
# ---------------------------------------------------------------------------

def _row_to_simulation(row) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "description": row.description,
        "removed_road_ids": row.removed_road_ids,
        "hour": row.hour,
        "day_type": row.day_type,
        "viewport": row.viewport,
        "created_at": row.created_at.isoformat(),
        "share_token": row.share_token,
    }


@app.post("/api/simulations", status_code=201)
def create_simulation(body: SaveSimulationRequest):
    # Retry on the very unlikely share_token collision (max 3 attempts)
    for attempt in range(3):
        token = _generate_share_token()
        try:
            with engine.begin() as conn:
                row = conn.execute(
                    text("""
                        INSERT INTO simulations
                            (name, description, removed_road_ids, hour, day_type, viewport, share_token)
                        VALUES
                            (:name, :description, :removed_road_ids, :hour, :day_type, CAST(:viewport AS jsonb), :share_token)
                        RETURNING id, name, description, removed_road_ids, hour, day_type,
                                  viewport, created_at, share_token
                    """),
                    {
                        "name": body.name,
                        "description": body.description,
                        "removed_road_ids": body.removed_road_ids,
                        "hour": body.hour,
                        "day_type": body.day_type,
                        "viewport": json.dumps(body.viewport),
                        "share_token": token,
                    },
                ).fetchone()
            logger.info("Simulation saved: %s (token=%s)", body.name, token)
            return _row_to_simulation(row)
        except Exception as exc:
            if "unique" in str(exc).lower() and attempt < 2:
                continue  # token collision, retry
            logger.exception("Failed to save simulation: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to save simulation")


@app.get("/api/simulations/{share_token}")
def get_simulation(share_token: str):
    if len(share_token) > 32:
        raise HTTPException(status_code=400, detail="Invalid share token")
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT id, name, description, removed_road_ids, hour, day_type,
                           viewport, created_at, share_token
                    FROM simulations
                    WHERE share_token = :token
                """),
                {"token": share_token},
            ).fetchone()
    except (OperationalError, ProgrammingError):
        raise HTTPException(status_code=503, detail="Database unavailable")

    if row is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return _row_to_simulation(row)


@app.get("/api/simulations")
def list_simulations():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, name, description, removed_road_ids, hour, day_type,
                           viewport, created_at, share_token
                    FROM simulations
                    ORDER BY created_at DESC
                    LIMIT 20
                """),
            ).fetchall()
    except (OperationalError, ProgrammingError):
        raise HTTPException(status_code=503, detail="Database unavailable")

    return [_row_to_simulation(r) for r in rows]
