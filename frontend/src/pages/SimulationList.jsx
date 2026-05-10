import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = 'http://localhost:8000'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SimulationList() {
  const navigate = useNavigate()
  const [simulations, setSimulations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/simulations`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setSimulations(data))
      .catch(() => setError('Impossible de charger les simulations.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: 'var(--color-bg, #111827)' }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              Simulations sauvegardées
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              20 dernières simulations
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-overlay)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            ← Carte
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex justify-center py-16">
            <div
              className="w-8 h-8 rounded-full border-4 animate-spin"
              style={{ borderColor: 'var(--voies-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--traffic-high)' }}>
            {error}
          </p>
        )}

        {!loading && !error && simulations.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Aucune simulation sauvegardée pour l'instant.
          </p>
        )}

        {simulations.map(sim => (
          <div
            key={sim.id}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: 'var(--color-surface, #1f2937)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <h2 className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                  {sim.name}
                </h2>
                {sim.description && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {sim.description}
                  </p>
                )}
              </div>
              <span
                className="text-[10px] font-mono flex-shrink-0 px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--voies-primary) 12%, transparent)',
                  color: 'var(--voies-primary)',
                }}
              >
                {sim.share_token}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                <span className="font-semibold" style={{ color: 'var(--road-removed)' }}>
                  {sim.removed_road_ids.length}
                </span>{' '}
                route{sim.removed_road_ids.length !== 1 ? 's' : ''} supprimée{sim.removed_road_ids.length !== 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span>{String(sim.hour).padStart(2, '0')}:00</span>
              <span>·</span>
              <span>{sim.day_type === 'semaine' ? 'Semaine' : 'Week-end'}</span>
              <span>·</span>
              <span>{formatDate(sim.created_at)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => navigate(`/sim/${sim.share_token}`)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold flex-1 transition-colors"
                style={{ background: 'var(--voies-primary)', color: '#fff' }}
              >
                Ouvrir
              </button>
              <button
                onClick={() => navigate('/', { state: { simulation: sim } })}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: 'color-mix(in srgb, var(--voies-primary) 10%, transparent)',
                  color: 'var(--voies-primary)',
                  border: '1.5px solid color-mix(in srgb, var(--voies-primary) 40%, transparent)',
                }}
              >
                Dupliquer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
