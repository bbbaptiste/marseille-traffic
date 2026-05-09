# Modèle de trafic synthétique pour Marseille
#
# Trois groupes de voies basés sur le highway_type OSM :
#
#   principale  : motorway, trunk, primary (et variantes *_link)
#                 → double pointe semaine (7-9h pic 1.0, 17-19h pic 1.0)
#                 → pic unique weekend (11-14h, max 0.85)
#
#   secondaire  : secondary, tertiary (et variantes *_link)
#                 → double pointe atténuée semaine (max 0.80)
#                 → pic unique doux weekend (max 0.75)
#
#   residentiel : residential, living_street, unclassified, service, autres
#                 → actif 9-19h semaine (plateau ~0.65), creux la nuit
#                 → plateau 10-19h weekend (max 0.70)
#
# Bruit : N(0, 0.05) par arc et par heure, coupé à [0.0, 1.0].
# Reproductibilité : seed numpy fixée à l'appel ou via env TRAFFIC_SEED.

import logging
import os
import sys

import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.traffic_level import Base, TrafficLevel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voies:voies@localhost:5432/voies")

PROFILES = {
    "principale": {
        "semaine": [
            0.10, 0.10, 0.10, 0.10, 0.15, 0.35,  # 0–5
            0.65, 0.95, 1.00, 0.70, 0.55, 0.55,  # 6–11
            0.60, 0.55, 0.55, 0.60, 0.75, 0.95,  # 12–17
            1.00, 0.90, 0.70, 0.50, 0.30, 0.15,  # 18–23
        ],
        "weekend": [
            0.10, 0.10, 0.10, 0.10, 0.10, 0.15,  # 0–5
            0.20, 0.30, 0.45, 0.60, 0.75, 0.85,  # 6–11
            0.85, 0.80, 0.75, 0.70, 0.65, 0.60,  # 12–17
            0.55, 0.50, 0.40, 0.35, 0.25, 0.15,  # 18–23
        ],
    },
    "secondaire": {
        "semaine": [
            0.05, 0.05, 0.05, 0.05, 0.10, 0.25,  # 0–5
            0.45, 0.75, 0.80, 0.65, 0.50, 0.50,  # 6–11
            0.55, 0.50, 0.50, 0.55, 0.65, 0.78,  # 12–17
            0.80, 0.70, 0.55, 0.40, 0.25, 0.10,  # 18–23
        ],
        "weekend": [
            0.05, 0.05, 0.05, 0.05, 0.05, 0.10,  # 0–5
            0.15, 0.25, 0.38, 0.50, 0.65, 0.73,  # 6–11
            0.75, 0.70, 0.65, 0.60, 0.55, 0.50,  # 12–17
            0.45, 0.38, 0.30, 0.25, 0.15, 0.08,  # 18–23
        ],
    },
    "residentiel": {
        "semaine": [
            0.05, 0.05, 0.05, 0.05, 0.05, 0.10,  # 0–5
            0.20, 0.38, 0.45, 0.55, 0.60, 0.63,  # 6–11
            0.65, 0.60, 0.58, 0.55, 0.58, 0.62,  # 12–17
            0.55, 0.45, 0.35, 0.25, 0.15, 0.08,  # 18–23
        ],
        "weekend": [
            0.05, 0.05, 0.05, 0.05, 0.05, 0.05,  # 0–5
            0.10, 0.20, 0.35, 0.50, 0.62, 0.68,  # 6–11
            0.70, 0.68, 0.65, 0.60, 0.55, 0.50,  # 12–17
            0.45, 0.38, 0.30, 0.20, 0.13, 0.08,  # 18–23
        ],
    },
}

_PRINCIPALE = {"motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"}
_SECONDAIRE = {"secondary", "tertiary", "secondary_link", "tertiary_link"}


def get_profile(highway_type: str | None) -> str:
    if highway_type in _PRINCIPALE:
        return "principale"
    if highway_type in _SECONDAIRE:
        return "secondaire"
    return "residentiel"


def main():
    seed = int(os.getenv("TRAFFIC_SEED", "42"))
    rng = np.random.default_rng(seed)

    engine = create_engine(DATABASE_URL)

    Base.metadata.create_all(engine, checkfirst=True)
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_traffic_hour_day"
            " ON traffic_levels (hour, day_type)"
        ))
        conn.commit()

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, highway_type FROM roads ORDER BY id")).fetchall()

    road_ids = [r.id for r in rows]
    highway_types = [r.highway_type for r in rows]
    n = len(road_ids)
    logger.info(f"Generating traffic levels for {n} roads...")

    day_types = ["semaine", "weekend"]
    noise = rng.normal(0, 0.05, (n, 24, 2))

    records = []
    for i, (road_id, hw) in enumerate(zip(road_ids, highway_types)):
        profile = get_profile(hw)
        for d, day_type in enumerate(day_types):
            base_curve = PROFILES[profile][day_type]
            for h in range(24):
                level = float(np.clip(base_curve[h] + noise[i, h, d], 0.0, 1.0))
                records.append({
                    "road_id": road_id,
                    "hour": h,
                    "day_type": day_type,
                    "traffic_level": level,
                })

    BATCH = 50_000
    with Session(engine) as session:
        session.execute(text("TRUNCATE TABLE traffic_levels"))
        session.commit()
        for start in range(0, len(records), BATCH):
            session.execute(TrafficLevel.__table__.insert(), records[start : start + BATCH])
            session.commit()

    logger.info(f"Inserted {len(records)} rows into traffic_levels")


if __name__ == "__main__":
    main()
