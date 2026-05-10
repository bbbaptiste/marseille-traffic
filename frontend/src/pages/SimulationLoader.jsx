import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = 'http://localhost:8000'

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-bg, #111827)' }}
    >
      <div
        className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--voies-primary)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Chargement de la simulation…
      </p>
    </div>
  )
}

function ErrorScreen({ message }) {
  const navigate = useNavigate()
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 p-8"
      style={{ background: 'var(--color-bg, #111827)' }}
    >
      <p className="text-4xl">🗺️</p>
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          {message}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Le lien est peut-être invalide ou la simulation a été supprimée.
        </p>
      </div>
      <button
        onClick={() => navigate('/')}
        className="px-5 py-2.5 rounded-full text-sm font-semibold"
        style={{ background: 'var(--voies-primary)', color: '#fff' }}
      >
        ← Retour à la carte
      </button>
    </div>
  )
}

export default function SimulationLoader() {
  const { shareToken } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/simulations/${shareToken}`)
      .then(r => {
        if (!r.ok) return Promise.reject(r.status)
        return r.json()
      })
      .then(sim => navigate('/', { state: { simulation: sim }, replace: true }))
      .catch(code => setError(code === 404 ? 'Simulation introuvable' : 'Erreur serveur'))
  }, [shareToken, navigate])

  if (error) return <ErrorScreen message={error} />
  return <LoadingScreen />
}
