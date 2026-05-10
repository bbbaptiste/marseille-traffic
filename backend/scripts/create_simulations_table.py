"""
Crée (idempotent) la table simulations dans la base voies.
Exécuter une fois : docker compose exec backend python scripts/create_simulations_table.py
"""

import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://voies:voies@localhost:5432/voies")
engine = create_engine(DATABASE_URL)

DDL = """
CREATE TABLE IF NOT EXISTS simulations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT,
    removed_road_ids INT[] NOT NULL,
    hour          INT NOT NULL,
    day_type      TEXT NOT NULL,
    viewport      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    share_token   TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_simulations_share_token ON simulations (share_token);
CREATE INDEX IF NOT EXISTS idx_simulations_created_at  ON simulations (created_at DESC);
"""

with engine.begin() as conn:
    conn.execute(text(DDL))

print("Table simulations créée (ou déjà existante).")
