# Simulation de Trafic Urbain — Marseille

Application full-stack de simulation de trafic urbain sur Marseille.

## Stack

| Couche     | Technologie                        |
|------------|------------------------------------|
| Frontend   | React 18 + Vite + MapLibre GL JS   |
| Backend    | FastAPI (Python 3.12)              |
| Base de données | PostgreSQL 16 + PostGIS 3.4  |
| Orchestration | Docker Compose                  |

## Démarrage rapide

```bash
docker compose up --build
```

### Services exposés

| Service    | URL                              |
|------------|----------------------------------|
| Carte      | http://localhost:5173            |
| API health | http://localhost:8000/health     |
| PostgreSQL | localhost:5432                   |

### Identifiants PostgreSQL

```
Host:     localhost
Port:     5432
Database: voies
User:     voies
Password: voies
```

## Structure du projet

```
.
├── docker-compose.yml
├── README.md
├── frontend/          # React + Vite + MapLibre GL JS
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── App.jsx    # Carte Marseille (lat: 43.2965, lng: 5.3698, zoom: 12)
├── backend/           # FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py        # GET /health
└── db/
    └── init.sql       # Active l'extension PostGIS
```

## Vérification

```bash
# Santé de l'API
curl http://localhost:8000/health
# → {"status":"ok"}

# Version PostGIS
psql -h localhost -U voies -d voies -c "SELECT PostGIS_Version();"
```
