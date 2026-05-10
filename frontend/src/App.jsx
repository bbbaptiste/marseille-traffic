import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'maplibre-gl/dist/maplibre-gl.css'
import TrafficPanel from './TrafficPanel.jsx'
import Sidebar from './Sidebar.jsx'
import Legend from './Legend.jsx'
import StatsBar from './StatsBar.jsx'
import SimulationBanner from './SimulationBanner.jsx'
import SimulationToolbar from './SimulationToolbar.jsx'
import ComparisonView from './ComparisonView.jsx'
import SaveSimulationModal from './SaveSimulationModal.jsx'
import Toast from './Toast.jsx'
import { TRAFFIC_PAINT } from './config/mapConfig.js'
import { DELETED_ROAD_PAINT, DRAW_STYLES } from './config/simulationConfig.js'
import { useDeleteSimulation } from './hooks/useDeleteSimulation.js'

const API_BASE = 'http://localhost:8000'

async function fetchTraffic(hour, dayType) {
  const res = await fetch(`${API_BASE}/api/traffic?hour=${hour}&day_type=${dayType}`)
  return res.json()
}

export default function App() {
  const { state } = useLocation()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const popup = useRef(null)
  const drawRef = useRef(null)
  const hourRef = useRef(8)
  const simulationModeRef = useRef(false)
  const drawModeActiveRef = useRef(false)
  const trafficDataRef = useRef([])
  const pendingSimRef = useRef(state?.simulation ?? null)

  const [hour, setHour] = useState(8)
  const [dayType, setDayType] = useState('semaine')
  const [mapReady, setMapReady] = useState(false)
  const [selectedRoad, setSelectedRoad] = useState(null)
  const [trafficData, setTrafficData] = useState([])
  const [simulationMode, setSimulationMode] = useState(false)
  const [drawModeActive, setDrawModeActive] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [simulationResult, setSimulationResult] = useState(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const { deletedRoadIds, deletedCount, toggleRoadDeleted, clearDeletion, selectRoadsInPolygon, loadDeletion } =
    useDeleteSimulation(map, mapReady)

  // Sync refs for stale-closure safety inside map event listeners
  useEffect(() => { hourRef.current = hour }, [hour])
  useEffect(() => { simulationModeRef.current = simulationMode }, [simulationMode])
  useEffect(() => { drawModeActiveRef.current = drawModeActive }, [drawModeActive])
  useEffect(() => { trafficDataRef.current = trafficData }, [trafficData])

  // Restore simulation passed via router state (from /sim/:token or SimulationList duplicate)
  useEffect(() => {
    if (!mapReady || !pendingSimRef.current) return
    const sim = pendingSimRef.current
    pendingSimRef.current = null
    loadDeletion(sim.removed_road_ids)
    setSimulationMode(true)
    if (sim.viewport?.center && sim.viewport?.zoom) {
      map.current?.flyTo({ center: sim.viewport.center, zoom: sim.viewport.zoom })
    }
  }, [mapReady])

  useEffect(() => {
    if (map.current) return

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '220px',
    })

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [5.3698, 43.2965],
      zoom: 12,
    })

    map.current.addControl(new maplibregl.NavigationControl())

    map.current.on('load', async () => {
      try {
        const geojson = await fetchTraffic(hourRef.current, 'semaine')

        map.current.addSource('traffic', { type: 'geojson', data: geojson })

        // Normal traffic layer
        map.current.addLayer({
          id: 'traffic-layer',
          type: 'line',
          source: 'traffic',
          paint: TRAFFIC_PAINT,
        })

        // Deleted roads layer — initially matches nothing
        map.current.addLayer({
          id: 'traffic-layer-deleted',
          type: 'line',
          source: 'traffic',
          paint: DELETED_ROAD_PAINT,
          filter: ['==', ['get', 'id'], -1],
        })

        // Draw control (renders above all map layers)
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          styles: DRAW_STYLES,
        })
        map.current.addControl(draw)
        drawRef.current = draw

        setTrafficData(geojson.features ?? [])

        // Hover popup
        const showPopup = (e, isDeleted) => {
          map.current.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties
          const name = props.name || 'Route sans nom'
          const type = props.highway_type || '—'
          const level = Math.round(props.traffic_level * 100)
          const h = String(hourRef.current).padStart(2, '0')
          const deletedBadge = isDeleted
            ? `<br/><span style="color:var(--road-removed);font-size:11px;font-weight:600">● Supprimée (simulation)</span>`
            : ''
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<div role="tooltip" aria-live="polite"
                style="font-family:sans-serif;font-size:13px;line-height:1.7;
                       color:var(--color-text);background:var(--color-overlay);
                       padding:10px 14px;border-radius:8px">
                <strong style="font-size:14px;color:var(--color-text)">${name}</strong><br/>
                Type&nbsp;: ${type}<br/>
                Trafic&nbsp;: <strong style="color:var(--traffic-high)">${level}&nbsp;%</strong><br/>
                Heure&nbsp;: ${h}:00${deletedBadge}
              </div>`
            )
            .addTo(map.current)
        }

        map.current.on('mouseenter', 'traffic-layer', (e) => showPopup(e, false))
        map.current.on('mouseenter', 'traffic-layer-deleted', (e) => showPopup(e, true))

        map.current.on('mouseleave', 'traffic-layer', () => {
          map.current.getCanvas().style.cursor = ''
          popup.current.remove()
        })
        map.current.on('mouseleave', 'traffic-layer-deleted', () => {
          map.current.getCanvas().style.cursor = ''
          popup.current.remove()
        })

        // Click handler — mode-aware
        map.current.on('click', (e) => {
          if (drawModeActiveRef.current) return

          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ['traffic-layer', 'traffic-layer-deleted'],
          })

          if (!features.length) {
            if (!simulationModeRef.current) setSelectedRoad(null)
            return
          }

          const p = features[0].properties
          popup.current.remove()

          if (simulationModeRef.current) {
            toggleRoadDeleted(p.id)
          } else {
            setSelectedRoad({ id: p.id, name: p.name, highway_type: p.highway_type })
          }
        })

        // Draw events
        map.current.on('draw.create', (e) => {
          selectRoadsInPolygon(e.features[0], trafficDataRef.current)
          draw.changeMode('simple_select', { featureIds: [e.features[0].id] })
          setDrawModeActive(false)
        })

        map.current.on('draw.modechange', (e) => {
          if (e.mode === 'simple_select') setDrawModeActive(false)
        })

        setMapReady(true)
      } catch (err) {
        console.warn('Traffic data unavailable:', err.message)
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Refresh traffic data on hour/dayType change
  useEffect(() => {
    if (!mapReady) return
    const t = setTimeout(async () => {
      try {
        const geojson = await fetchTraffic(hour, dayType)
        map.current?.getSource('traffic')?.setData(geojson)
        setTrafficData(geojson.features ?? [])
      } catch (err) {
        console.warn('Failed to update traffic:', err.message)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [hour, dayType, mapReady])

  function handleToggleSimulation() {
    if (simulationMode) {
      setSimulationMode(false)
      clearDeletion()
      drawRef.current?.deleteAll()
      setDrawModeActive(false)
    } else {
      setSimulationMode(true)
      setSelectedRoad(null)
    }
  }

  function handleActivateDraw() {
    if (drawModeActive) {
      drawRef.current?.changeMode('simple_select')
      setDrawModeActive(false)
    } else {
      drawRef.current?.changeMode('draw_polygon')
      setDrawModeActive(true)
    }
  }

  function handleClear() {
    clearDeletion()
    drawRef.current?.deleteAll()
  }

  async function handleViewImpact() {
    if (deletedCount === 0 || simulating) return
    setSimulating(true)
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removed_road_ids: [...deletedRoadIds],
          hour,
          day_type: dayType,
        }),
      })
      const data = await res.json()
      setSimulationResult(data)
      setComparisonMode(true)
    } catch (err) {
      console.warn('Simulation failed:', err.message)
    } finally {
      setSimulating(false)
    }
  }

  function handleExitComparison() {
    setComparisonMode(false)
    setSimulationResult(null)
  }

  if (comparisonMode && simulationResult) {
    return (
      <ComparisonView
        beforeFeatures={trafficData}
        afterGeoJSON={simulationResult}
        hour={hour}
        initialCenter={map.current ? [map.current.getCenter().lng, map.current.getCenter().lat] : [5.3698, 43.2965]}
        initialZoom={map.current?.getZoom() ?? 12}
        onExit={handleExitComparison}
      />
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      <SimulationBanner visible={simulationMode} deletedCount={deletedCount} />

      <StatsBar features={trafficData} hour={hour} dayType={dayType} />
      <Legend hour={hour} simulationMode={simulationMode} />

      <TrafficPanel
        hour={hour}
        dayType={dayType}
        onHourChange={setHour}
        onDayTypeChange={setDayType}
      />

      <SimulationToolbar
        simulationMode={simulationMode}
        deletedCount={deletedCount}
        drawModeActive={drawModeActive}
        simulating={simulating}
        onToggleSimulation={handleToggleSimulation}
        onActivateDraw={handleActivateDraw}
        onClear={handleClear}
        onViewImpact={handleViewImpact}
        onSave={() => setSaveModalOpen(true)}
      />

      {saveModalOpen && (
        <SaveSimulationModal
          deletedRoadIds={deletedRoadIds}
          hour={hour}
          dayType={dayType}
          viewport={map.current ? {
            center: [map.current.getCenter().lng, map.current.getCenter().lat],
            zoom: map.current.getZoom(),
          } : {}}
          onClose={() => setSaveModalOpen(false)}
          onSaved={(sim) => {
            setSaveModalOpen(false)
            setToast({ shareUrl: `${window.location.origin}/sim/${sim.share_token}` })
          }}
        />
      )}

      {toast && (
        <Toast shareUrl={toast.shareUrl} onClose={() => setToast(null)} />
      )}

      <Sidebar
        road={selectedRoad}
        hour={hour}
        onClose={() => setSelectedRoad(null)}
      />
    </div>
  )
}
