export default function SimulationToolbar({
  simulationMode,
  deletedCount,
  drawModeActive,
  simulating,
  onToggleSimulation,
  onActivateDraw,
  onClear,
  onViewImpact,
}) {
  return (
    <div className="absolute top-4 right-14 z-10 flex flex-col items-end gap-2">
      <button
        onClick={onToggleSimulation}
        aria-pressed={simulationMode}
        className="px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-all duration-150 select-none"
        style={
          simulationMode
            ? { background: 'var(--road-removed)', color: '#fff', boxShadow: '0 2px 12px rgba(156,39,176,0.35)' }
            : { background: 'var(--color-overlay)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }
        }
      >
        {simulationMode ? '✕ Quitter la simulation' : 'Simuler une suppression'}
      </button>

      {simulationMode && (
        <div
          className="flex flex-col gap-2 p-3 rounded-2xl min-w-[210px]"
          style={{
            background: 'var(--color-overlay)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-popup)',
            animation: 'slide-up 0.2s ease forwards',
          }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              {deletedCount}
            </span>{' '}
            route{deletedCount !== 1 ? 's' : ''} sélectionnée{deletedCount !== 1 ? 's' : ''}
          </p>

          <button
            onClick={onActivateDraw}
            aria-pressed={drawModeActive}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150"
            style={
              drawModeActive
                ? { background: 'var(--road-removed)', color: '#fff' }
                : {
                    background: 'color-mix(in srgb, var(--road-removed) 10%, transparent)',
                    color: 'var(--road-removed)',
                    border: '1.5px solid color-mix(in srgb, var(--road-removed) 40%, transparent)',
                  }
            }
          >
            {drawModeActive ? '✏️ Dessiner le polygone…' : 'Sélection par zone'}
          </button>

          {deletedCount > 0 && (
            <>
              <button
                onClick={onViewImpact}
                disabled={simulating}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                style={{
                  background: simulating
                    ? 'color-mix(in srgb, var(--voies-primary) 30%, transparent)'
                    : 'var(--voies-primary)',
                  color: '#fff',
                  opacity: simulating ? 0.7 : 1,
                  cursor: simulating ? 'wait' : 'pointer',
                }}
              >
                {simulating ? 'Calcul en cours…' : '📊 Voir l\'impact'}
              </button>

              <button
                onClick={onClear}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150"
                style={{
                  background: 'color-mix(in srgb, var(--traffic-high) 10%, transparent)',
                  color: 'var(--traffic-high)',
                  border: '1.5px solid color-mix(in srgb, var(--traffic-high) 40%, transparent)',
                }}
              >
                Effacer la sélection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
