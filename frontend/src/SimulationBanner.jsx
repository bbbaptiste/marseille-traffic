export default function SimulationBanner({ visible, deletedCount }) {
  if (!visible) return null

  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-3 py-2 px-4 text-sm font-semibold select-none"
      style={{
        background: 'color-mix(in srgb, var(--road-removed) 18%, transparent)',
        borderBottom: '1.5px solid color-mix(in srgb, var(--road-removed) 40%, transparent)',
        color: 'var(--road-removed)',
        backdropFilter: 'blur(8px)',
        animation: 'slide-up 0.2s ease forwards',
      }}
      role="alert"
      aria-live="polite"
    >
      <span aria-hidden="true" style={{ fontSize: 16 }}>🚧</span>
      Mode simulation actif — cliquez sur les routes à supprimer
      {deletedCount > 0 && (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ background: 'var(--road-removed)', color: '#fff' }}
        >
          {deletedCount} supprimée{deletedCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
