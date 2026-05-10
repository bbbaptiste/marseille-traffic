import json
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
