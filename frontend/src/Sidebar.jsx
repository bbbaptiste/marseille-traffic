import { useState } from 'react'
import TrafficChart from './TrafficChart.jsx'

const HIGHWAY_LABELS = {
  motorway: 'Autoroute', trunk: 'Voie rapide', primary: 'Voie principale',
  secondary: 'Voie secondaire', tertiary: 'Voie tertiaire',
  residential: 'Résidentiel', living_street: 'Zone de rencontre',
  unclassified: 'Non classée', service: 'Voie de service',
}

export default function Sidebar({ road, hour, onClose }) {
  const [peak, setPeak] = useState(null)

  if (!road) return null

  const mobile = window.innerWidth < 640
  const posStyle = mobile
    ? 'bottom-0 left-0 right-0 h-[50vh] rounded-t-2xl'
    : 'top-0 right-0 w-80 h-full'

  const typeLabel = HIGHWAY_LABELS[road.highway_type] ?? road.highway_type ?? '—'

  return (
    <div className={`absolute ${posStyle} bg-gray-900/97 backdrop-blur-md shadow-[-4px_0_24px_rgba(0,0,0,0.4)] z-20 flex flex-col overflow-hidden font-sans`}>
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-4 border-b border-gray-700">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-100 truncate">
            {road.name || 'Route sans nom'}
          </p>
          <span
            className="inline-block mt-1 text-[11px] font-semibold rounded px-2 py-0.5"
            style={{
              color: 'var(--voies-primary)',
              background: 'color-mix(in srgb, var(--voies-primary) 12%, transparent)',
            }}
          >
            {typeLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer le panneau"
          className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none p-1 flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Peak indicator */}
      {peak && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'color-mix(in srgb, var(--voies-primary) 10%, transparent)',
            color: 'var(--voies-primary)',
          }}
        >
          Pointe semaine&nbsp;:{' '}
          <strong>{String(peak.hour).padStart(2, '0')}:00 ({peak.value}&nbsp;%)</strong>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 px-2 pt-4 pb-2">
        <p className="text-[11px] font-semibold text-gray-500 ml-2 mb-2">
          Trafic journalier · {String(hour).padStart(2, '0')}:00
        </p>
        <TrafficChart roadId={road.id} hour={hour} onPeak={setPeak} />
      </div>
    </div>
  )
}
