export default function StatsBar({ features, hour, dayType }) {
  if (!features.length) return null

  const saturated = features.filter(f => f.properties.traffic_level > 0.8).length
  const avg = Math.round(
    features.reduce((s, f) => s + f.properties.traffic_level, 0) / features.length * 100
  )
  const label = dayType === 'semaine' ? 'Semaine' : 'Week-end'

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-6 shadow-xl text-sm select-none whitespace-nowrap">
      <span className="text-gray-400 font-medium">
        {String(hour).padStart(2, '0')}:00 · {label}
      </span>
      <span className="w-px h-4 bg-gray-700" />
      <span className={saturated > 0 ? 'text-[var(--traffic-critical)] font-semibold' : 'text-gray-400'}>
        🔴 <span className="font-bold text-gray-100">{saturated}</span> saturée{saturated > 1 ? 's' : ''}
      </span>
      <span className="w-px h-4 bg-gray-700" />
      <span className="text-gray-300">
        Moy. <span className="font-bold text-gray-100">{avg}&nbsp;%</span>
      </span>
    </div>
  )
}
