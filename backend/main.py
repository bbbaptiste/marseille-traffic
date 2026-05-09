import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voies:voies@localhost:5432/voies")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="Marseille Traffic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
