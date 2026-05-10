"""
Moteur de simulation de suppression de routes.

Hypothèses de simplification documentées :
- Le volume de trafic est proportionnel à traffic_level (pas de comptage véhicule réel).
- Tout le trafic de la route supprimée est redirigé (pas de suppression de trajets).
- Le poids des arcs est calculé une seule fois avant redistribution ; il n'est pas mis
  à jour de façon itérative après chaque redirection (modèle statique, non dynamique).
- Les arcs parallèles entre deux mêmes nœuds ne sont pas modélisés (DiGraph, un arc max
  par paire de nœuds).
- Les restrictions de virage (turn restrictions OSM) sont ignorées.
- La redistribution est uniforme : chaque arc d'un chemin alternatif reçoit la même
  fraction du trafic, indépendamment de sa longueur.
"""

import json
import logging
import time
from itertools import islice

import networkx as nx
from sqlalchemy import text

logger = logging.getLogger(__name__)


def load_base_graph(engine):
    """
    Construit un DiGraph depuis la table roads.
    Appelé une seule fois au démarrage — résultat mis en cache dans main.py.

    Retourne (G, road_id_to_edge) où :
      G               : DiGraph, nœuds = OSM node IDs, arcs = routes
      road_id_to_edge : {road_id: (from_node_id, to_node_id)}
    """
    G = nx.DiGraph()
    road_id_to_edge = {}

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, from_node_id, to_node_id, length_m FROM roads")
        ).fetchall()

    for row in rows:
        u, v = row.from_node_id, row.to_node_id
        length = row.length_m or 10.0
        G.add_edge(u, v, road_id=row.id, length_m=length, weight=1.0)
        road_id_to_edge[row.id] = (u, v)

    logger.info(
        "Graph loaded: %d nodes, %d edges",
        G.number_of_nodes(),
        G.number_of_edges(),
    )
    return G, road_id_to_edge


def run_simulation(base_graph, road_id_to_edge, engine, removed_road_ids, hour, day_type, k=3):
    """
    Recalcule la distribution du trafic après suppression de routes.

    Algorithme :
      1. Charge traffic_level(hour, day_type) pour tous les arcs.
      2. Copie le graphe ; poids = length_m / max(1 - traffic_level, 0.05).
      3. Retire les arcs supprimés.
      4. Pour chaque arc supprimé avec traffic T :
           - Trouve jusqu'à k chemins alternatifs (Yen's algorithm via NetworkX).
           - Chaque arc de chaque chemin reçoit T / (k * nb_arcs_du_chemin).
      5. Plafonne à 1.0 et construit le GeoJSON de réponse.

    Retourne (features: list[dict], elapsed_s: float).
    """
    t0 = time.perf_counter()

    # --- Charger le trafic de base ---
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

    traffic_map = {row.id: row.traffic_level for row in rows}

    # --- Copier le graphe et appliquer les poids de congestion ---
    G = base_graph.copy()
    for u, v, data in G.edges(data=True):
        tl = traffic_map.get(data["road_id"], 0.0)
        data["traffic_level"] = tl
        data["weight"] = data["length_m"] / max(1.0 - tl, 0.05)

    # --- Retirer les arcs supprimés ---
    removed_ids = set(removed_road_ids)
    removed_edge_data = []

    for road_id in removed_ids:
        if road_id not in road_id_to_edge:
            continue
        u, v = road_id_to_edge[road_id]
        if not G.has_edge(u, v):
            continue
        edge_copy = dict(G[u][v])
        # Parallel edges with same (u,v) overwrite each other in DiGraph;
        # always use the traffic_level from the actual road we're removing.
        edge_copy["traffic_level"] = traffic_map.get(road_id, 0.0)
        edge_copy["road_id"] = road_id
        removed_edge_data.append((u, v, edge_copy))
        G.remove_edge(u, v)

    # --- Redistribuer le trafic sur les alternatives ---
    delta = {}  # {road_id: float} surplus à ajouter

    for u, v, edata in removed_edge_data:
        T = edata.get("traffic_level", 0.0)
        if T <= 0:
            continue

        paths = []
        try:
            for path in islice(nx.shortest_simple_paths(G, u, v, weight="weight"), k):
                paths.append(path)
        except Exception as exc:
            logger.debug("No path for road %s (%s→%s): %s", road_id, u, v, exc)

        n_paths = len(paths)
        if n_paths == 0:
            continue

        for path in paths:
            n_edges = len(path) - 1
            if n_edges == 0:
                continue
            share = T / (n_paths * n_edges)
            for i in range(n_edges):
                pu, pv = path[i], path[i + 1]
                if G.has_edge(pu, pv):
                    rid = G[pu][pv]["road_id"]
                    delta[rid] = delta.get(rid, 0.0) + share

    # --- Construire le GeoJSON de réponse ---
    impacted_ids = set(delta.keys())
    features = []

    for row in rows:
        new_level = min(traffic_map[row.id] + delta.get(row.id, 0.0), 1.0)
        features.append({
            "type": "Feature",
            "geometry": json.loads(row.geom_json),
            "properties": {
                "id": row.id,
                "name": row.name,
                "highway_type": row.highway_type,
                "length_m": row.length_m,
                "traffic_level": round(new_level, 4),
                "removed": row.id in removed_ids,
                "impacted": row.id in impacted_ids,
            },
        })

    elapsed = time.perf_counter() - t0
    return features, elapsed
