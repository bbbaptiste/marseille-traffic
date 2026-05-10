import { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000'

export default function SaveSimulationModal({ deletedRoadIds, hour, dayType, viewport, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)   // {share_token, id}
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          removed_road_ids: [...deletedRoadIds],
          hour,
          day_type: dayType,
          viewport: viewport ?? {},
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail?.[0]?.msg ?? data.detail ?? 'Erreur serveur')
      }
      const data = await res.json()
      setSaved(data)
      onSaved?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const shareUrl = saved ? `${window.location.origin}/?sim=${saved.share_token}` : null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: 'var(--color-surface, #1f2937)',
          boxShadow: 'var(--shadow-popup)',
          border: '1px solid var(--color-border)',
          animation: 'bounce-in 0.3s ease forwards',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            Sauvegarder la simulation
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {!saved ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Nom <span style={{ color: 'var(--traffic-high)' }}>*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Ex : Fermeture Prado heure de pointe"
                required
                className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'var(--color-bg, #111827)',
                  border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--voies-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
              />
              <span className="text-[10px] text-right" style={{ color: 'var(--color-text-muted)' }}>
                {name.length}/100
              </span>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Description <span className="font-normal">(optionnel)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contexte, notes…"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none transition-colors"
                style={{
                  background: 'var(--color-bg, #111827)',
                  border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--voies-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
              />
            </div>

            {/* Summary */}
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--road-removed)' }}>
                {deletedRoadIds.size}
              </span>{' '}
              route{deletedRoadIds.size !== 1 ? 's' : ''} supprimée{deletedRoadIds.size !== 1 ? 's' : ''} ·{' '}
              {String(hour).padStart(2, '0')}:00 · {dayType === 'semaine' ? 'Semaine' : 'Week-end'}
            </p>

            {error && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--traffic-high) 12%, transparent)', color: 'var(--traffic-high)' }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-150"
                style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150"
                style={{
                  background: (!name.trim() || saving) ? 'color-mix(in srgb, var(--voies-primary) 40%, transparent)' : 'var(--voies-primary)',
                  color: '#fff',
                  cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        ) : (
          /* Success state */
          <div className="flex flex-col gap-4">
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'color-mix(in srgb, var(--voies-primary) 12%, transparent)', color: 'var(--voies-primary)' }}
            >
              ✓ Simulation sauvegardée
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Lien de partage
              </p>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-mono outline-none"
                  style={{
                    background: 'var(--color-bg, #111827)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-colors"
                  style={{ background: 'var(--voies-primary)', color: '#fff' }}
                  title="Copier le lien"
                >
                  Copier
                </button>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                Token : <span className="font-mono font-bold">{saved.share_token}</span>
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: 'var(--voies-primary)', color: '#fff' }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
