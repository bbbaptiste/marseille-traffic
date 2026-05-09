import logging
import os
import sys

import osmnx as ox
from geoalchemy2.elements import WKTElement
from shapely.geometry import MultiLineString
from shapely.ops import linemerge
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.road import Base, Road

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voies:voies@localhost:5432/voies")


def _scalar(value):
    """Return first element if list, None if nan-like, else value as-is."""
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None:
        return None
    s = str(value)
    return None if s in ("nan", "None", "") else s


def _normalize_geom(geom):
    """Ensure geometry is a single LineString."""
    if isinstance(geom, MultiLineString):
        merged = linemerge(geom)
        if isinstance(merged, MultiLineString):
            return max(merged.geoms, key=lambda g: g.length)
        return merged
    return geom


def main():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()

    Base.metadata.create_all(engine, checkfirst=True)
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_roads_geometry ON roads USING gist (geometry)"
        ))
        conn.commit()

    logger.info("Downloading Marseille road network from OSM (network_type=drive)...")
    G = ox.graph_from_place("Marseille, France", network_type="drive")
    _, edges = ox.graph_to_gdfs(G)
    edges = edges.reset_index()
    logger.info(f"Downloaded {len(edges)} edges from OSM")

    roads = []
    skipped = 0
    for _, row in edges.iterrows():
        geom = row.get("geometry")
        if geom is None or geom.is_empty:
            skipped += 1
            continue
        geom = _normalize_geom(geom)

        length = row.get("length")
        roads.append(
            Road(
                from_node_id=int(row["u"]),
                to_node_id=int(row["v"]),
                name=_scalar(row.get("name")),
                highway_type=_scalar(row.get("highway")),
                length_m=float(length) if length is not None else None,
                geometry=WKTElement(geom.wkt, srid=4326),
            )
        )

    with Session(engine) as session:
        session.execute(text("TRUNCATE TABLE roads RESTART IDENTITY"))
        session.commit()
        session.bulk_save_objects(roads)
        session.commit()

    logger.info(f"Imported {len(roads)} road segments into PostGIS ({skipped} skipped)")


if __name__ == "__main__":
    main()
