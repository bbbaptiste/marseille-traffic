import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CHART_COLORS, CHART_STYLE } from './config/mapConfig.js'

const API_BASE = 'http://localhost:8000'

function fmtHour(h) {
  return String(h).padStart(2, '0') + 'h'
}

export default function TrafficChart({ roadId, hour, onPeak }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (roadId == null) return
    setLoading(true)

    Promise.all([
      fetch(`${API_BASE}/api/traffic/daily?road_id=${roadId}&day_type=semaine`).then(r => r.json()),
      fetch(`${API_BASE}/api/traffic/daily?road_id=${roadId}&day_type=weekend`).then(r => r.json()),
    ]).then(([semaine, weekend]) => {
      const merged = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        semaine: Math.round((semaine[h]?.traffic_level ?? 0) * 100),
        weekend: Math.round((weekend[h]?.traffic_level ?? 0) * 100),
      }))
      setData(merged)
      const peak = merged.reduce(
        (max, d) => d.semaine > max.val ? { val: d.semaine, hour: d.hour } : max,
        { val: 0, hour: 0 }
      )
      onPeak?.({ hour: peak.hour, value: peak.val })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [roadId])

  if (loading) {
    return <p className="px-6 py-4 text-xs text-gray-500">Chargement…</p>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
        <XAxis
          dataKey="hour"
          tickFormatter={fmtHour}
          tick={{ fontSize: 10, fill: CHART_STYLE.tick }}
          interval={3}
          axisLine={{ stroke: CHART_STYLE.grid }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 10, fill: CHART_STYLE.tick }}
          width={36}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: CHART_STYLE.tooltip.bg, border: `1px solid ${CHART_STYLE.tooltip.border}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: CHART_STYLE.tooltip.text }}
          itemStyle={{ color: CHART_STYLE.tooltip.item }}
          formatter={(v, name) => [`${v}%`, name === 'semaine' ? 'Semaine' : 'Week-end']}
          labelFormatter={fmtHour}
        />
        <Legend
          formatter={name => (
            <span style={{ color: CHART_STYLE.tooltip.item, fontSize: 11 }}>
              {name === 'semaine' ? 'Semaine' : 'Week-end'}
            </span>
          )}
          iconType="line"
        />
        <ReferenceLine x={hour} stroke={CHART_STYLE.reference} strokeDasharray="4 2" strokeWidth={1.5} />
        <Line type="monotone" dataKey="semaine" stroke={CHART_COLORS.semaine} dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="weekend" stroke={CHART_COLORS.weekend} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
