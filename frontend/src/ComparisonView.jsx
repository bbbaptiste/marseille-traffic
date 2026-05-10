import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { TRAFFIC_PAINT } from './config/mapConfig.js'

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
}

const REMOVED_PAINT = {
  'line-color': '#6b7280',
  'line-width': 2,
  'line-opacity': 0.3,
  'line-dasharray': [4, 3],
}

// Halo amber — mirrors --road-impacted: #FFB300
const HALO_COLOR = '#FFB300'

function buildFC(features) {
  return { type: 'FeatureCollection', features }
}

function MapLabel({ text, color }) {
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-bold shadow-lg select-none"
      style={
        color
          ? { background: color, color: '#fff' }
          : { background: 'rgba(17,24,39,0.88)', color: '#d1d5db', backdropFilter: 'blur(6px)' }
      }
    >
      {text}
    </div>
  )
}

export default function ComparisonView({
  beforeFeatures,
  afterGeoJSON,
  hour,
  initialCenter,
  initialZoom,
  onExit,
}) {
  const beforeRef = useRef(null)
  const afterRef = useRef(null)
  const mapBefore = useRef(null)
  const mapAfter = useRef(null)
  const isSyncing = useRef(false)
  const animRef = useRef(null)

  // --- Summary stats ---
  const stats = useMemo(() => {
    const beforeMap = new Map(beforeFeatures.map(f => [f.properties.id, f.properties.traffic_level]))
    const removed = afterGeoJSON.features.filter(f => f.properties.removed)
    const impacted = afterGeoJSON.features.filter(f => f.properties.impacted)

    let totalDelta = 0
    let maxDelta = 0
    let mostImpacted = null

    for (const f of impacted) {
      const delta = f.properties.traffic_level - (beforeMap.get(f.properties.id) ?? 0)
      totalDelta += delta
      if (delta > maxDelta) {
        maxDelta = delta
        mostImpacted = f.properties
      }
    }

    return {
      removed: removed.length,
      impacted: impacted.length,
      avgDelta: impacted.length > 0 ? Math.round((totalDelta / impacted.length) * 100) : 0,
      mostImpacted,
    }
  }, [beforeFeatures, afterGeoJSON])

  // --- Map initialization ---
  useEffect(() => {
    const center = initialCenter ?? [5.3698, 43.2965]
    const zoom = initialZoom ?? 12

    function makeMap(container) {
      return new maplibregl.Map({
        container,
        style: OSM_STYLE,
        center,
        zoom,
        attributionControl: false,
      })
    }

    mapBefore.current = makeMap(beforeRef.current)
    mapAfter.current = makeMap(afterRef.current)

    // Sync: when one map moves, the other follows
    function syncFrom(source, target) {
      if (isSyncing.current) return
      isSyncing.current = true
      target.jumpTo({
        center: source.getCenter(),
        zoom: source.getZoom(),
        bearing: source.getBearing(),
        pitch: source.getPitch(),
      })
      isSyncing.current = false
    }

    mapBefore.current.on('move', () => syncFrom(mapBefore.current, mapAfter.current))
    mapAfter.current.on('move', () => syncFrom(mapAfter.current, mapBefore.current))

    // --- Before map ---
    mapBefore.current.on('load', () => {
      mapBefore.current.addSource('traffic', { type: 'geojson', data: buildFC(beforeFeatures) })
      mapBefore.current.addLayer({ id: 'traffic-layer', type: 'line', source: 'traffic', paint: TRAFFIC_PAINT })
    })

    // --- After map ---
    mapAfter.current.on('load', () => {
      mapAfter.current.addSource('traffic', { type: 'geojson', data: afterGeoJSON })

      // Halo underneath the main traffic line
      mapAfter.current.addLayer({
        id: 'impacted-halo',
        type: 'line',
        source: 'traffic',
        filter: ['==', ['get', 'impacted'], true],
        paint: { 'line-color': HALO_COLOR, 'line-width': 9, 'line-opacity': 0.25, 'line-blur': 4 },
      })

      // Normal + impacted roads (traffic_level already reflects simulation)
      mapAfter.current.addLayer({
        id: 'traffic-layer-after',
        type: 'line',
        source: 'traffic',
        filter: ['!=', ['get', 'removed'], true],
        paint: TRAFFIC_PAINT,
      })

      // Removed roads on top (greyed out)
      mapAfter.current.addLayer({
        id: 'removed-roads',
        type: 'line',
        source: 'traffic',
        filter: ['==', ['get', 'removed'], true],
        paint: REMOVED_PAINT,
      })

      // Animate halo
      let t = 0
      function animateHalo() {
        t += 0.045
        const s = 0.5 + 0.5 * Math.sin(t)
        mapAfter.current?.setPaintProperty('impacted-halo', 'line-opacity', 0.15 + 0.3 * s)
        mapAfter.current?.setPaintProperty('impacted-halo', 'line-width', 6 + 7 * s)
        animRef.current = requestAnimationFrame(animateHalo)
      }
      animRef.current = requestAnimationFrame(animateHalo)
    })

    return () => {
      cancelAnimationFrame(animRef.current)
      mapBefore.current?.remove()
      mapAfter.current?.remove()
      mapBefore.current = null
      mapAfter.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const h = String(hour).padStart(2, '0')

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row bg-gray-950 overflow-hidden">
      {/* ── Before map ── */}
      <div className="relative h-[50%] md:h-full md:flex-1 min-h-0">
        <MapLabel text={`Avant · ${h}:00`} />
        <div ref={beforeRef} className="w-full h-full" />
      </div>

      {/* ── Separator ── */}
      <div className="w-full h-px md:w-px md:h-full bg-gray-600/70 flex-shrink-0" />

      {/* ── After map ── */}
      <div className="relative h-[50%] md:h-full md:flex-1 min-h-0">
        <MapLabel text="Après simulation" color="#9C27B0" />
        <div ref={afterRef} className="w-full h-full" />
      </div>

      {/* ── Summary panel ── */}
      {stats.removed > 0 && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs select-none whitespace-nowrap"
          style={{
            background: 'rgba(17,24,39,0.93)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slide-up 0.25s ease forwards',
          }}
        >
          <StatItem
            color="var(--road-removed)"
            label="Supprimées"
            value={stats.removed}
          />
          <Sep />
          <StatItem
            color="#FFB300"
            label="Impactées"
            value={stats.impacted}
          />
          <Sep />
          <StatItem
            color="var(--traffic-high)"
            label="Congestion moyenne"
            value={`+${stats.avgDelta}%`}
          />
          {stats.mostImpacted && (
            <>
              <Sep />
              <span className="text-gray-400">
                Plus impactée&nbsp;:&nbsp;
                <span className="font-semibold text-gray-100">
                  {stats.mostImpacted.name || 'Route sans nom'}
                </span>
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Exit button ── */}
      <button
        onClick={onExit}
        className="absolute top-3 right-3 z-30 px-4 py-2 rounded-full text-xs font-semibold transition-colors duration-150"
        style={{
          background: 'rgba(17,24,39,0.88)',
          color: '#d1d5db',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(6px)',
        }}
      >
        ✕ Quitter la comparaison
      </button>
    </div>
  )
}

function StatItem({ color, label, value }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-gray-400">{label}&nbsp;:</span>
      <span className="font-bold text-gray-100">{value}</span>
    </span>
  )
}

function Sep() {
  return <span className="hidden sm:block w-px h-3 bg-gray-700" />
}
