const LEVELS = [
  { color: '#2ECC71', label: 'Fluide', range: '< 30 %' },
  { color: '#F39C12', label: 'Modéré', range: '30–60 %' },
  { color: '#E74C3C', label: 'Dense', range: '60–80 %' },
  { color: '#900C3F', label: 'Saturé', range: '> 80 %' },
]

export default function Legend({ hour }) {
  const formatted = `${String(hour).padStart(2, '0')}:00`

  return (
    <div className="absolute bottom-24 left-4 z-10 bg-gray-900/90 backdrop-blur rounded-xl p-4 shadow-xl text-gray-100 text-xs select-none min-w-[160px]">
      <p className="font-semibold text-gray-300 mb-2 text-[11px] uppercase tracking-wide">
        Niveau de trafic
      </p>
      <ul className="space-y-1.5">
        {LEVELS.map(({ color, label, range }) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-200">{label}</span>
            <span className="ml-auto text-gray-500">{range}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-2 border-t border-gray-700 text-gray-400 flex justify-between">
        <span>Heure active</span>
        <span className="font-bold text-gray-200">{formatted}</span>
      </div>
    </div>
  )
}
