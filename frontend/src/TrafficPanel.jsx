export default function TrafficPanel({ hour, dayType, onHourChange, onDayTypeChange }) {
  const formatted = `${String(hour).padStart(2, '0')}:00`

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl px-7 py-3.5 flex items-center gap-6 select-none min-w-[360px]">
      <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Heure</span>
      <span className="text-2xl font-bold text-gray-100 min-w-[52px] text-center tabular-nums">
        {formatted}
      </span>
      <input
        type="range"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => onHourChange(Number(e.target.value))}
        className="w-40 cursor-pointer accent-[var(--voies-primary)]"
        aria-label={`Heure de simulation, valeur actuelle : ${formatted}`}
      />
      <div
        className="flex rounded-lg overflow-hidden border border-[var(--voies-primary)]"
      >
        <button
          onClick={() => onDayTypeChange('semaine')}
          className="px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150"
          style={
            dayType === 'semaine'
              ? { background: 'var(--voies-primary)', color: '#fff' }
              : { background: 'transparent', color: 'var(--voies-primary)' }
          }
        >
          Semaine
        </button>
        <button
          onClick={() => onDayTypeChange('weekend')}
          className="px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150"
          style={
            dayType === 'weekend'
              ? { background: 'var(--voies-primary)', color: '#fff' }
              : { background: 'transparent', color: 'var(--voies-primary)' }
          }
        >
          Week-end
        </button>
      </div>
    </div>
  )
}
