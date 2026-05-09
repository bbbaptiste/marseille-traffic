import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import TrafficPanel from './TrafficPanel.jsx'
import Sidebar from './Sidebar.jsx'
import Legend from './Legend.jsx'
import StatsBar from './StatsBar.jsx'

const API_BASE = 'http://localhost:8000'

const TRAFFIC_COLOR = [
  'step', ['get', 'traffic_level'],
  '#2ECC71',
  0.3, '#F39C12',
  0.6, '#E74C3C',
  0.8, '#900C3F',
]

const TRAFFIC_WIDTH = [
  'step', ['get', 'traffic_level'],
  2,
  0.3, 3,
  0.6, 4,
  0.8, 5,
]

async function fetchTraffic(hour, dayType) {
  const res = await fetch(`${API_BASE}/api/traffic?hour=${hour}&day_type=${dayType}`)
  return res.json()
}

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const popup = useRef(null)
  const hourRef = useRef(8)

  const [hour, setHour] = useState(8)
  const [dayType, setDayType] = useState('semaine')
  const [mapReady, setMapReady] = useState(false)
  const [selectedRoad, setSelectedRoad] = useState(null)
  const [trafficData, setTrafficData] = useState([])

  useEffect(() => {
    hourRef.current = hour
  }, [hour])

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
        map.current.addLayer({
          id: 'traffic-layer',
          type: 'line',
          source: 'traffic',
          paint: {
            'line-color': TRAFFIC_COLOR,
            'line-width': TRAFFIC_WIDTH,
            'line-color-transition': { duration: 300, delay: 0 },
            'line-width-transition': { duration: 300, delay: 0 },
          },
        })

        setTrafficData(geojson.features ?? [])

        // Hover popup
        map.current.on('mouseenter', 'traffic-layer', (e) => {
          map.current.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties
          const name = props.name || 'Route sans nom'
          const type = props.highway_type || '—'
          const level = Math.round(props.traffic_level * 100)
          const h = String(hourRef.current).padStart(2, '0')
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<div role="tooltip" aria-live="polite"
                style="font-family:sans-serif;font-size:13px;line-height:1.7;color:#f3f4f6;background:#111827;padding:10px 14px;border-radius:8px">
                <strong style="font-size:14px;color:#fff">${name}</strong><br/>
                Type&nbsp;: ${type}<br/>
                Trafic&nbsp;: <strong style="color:#fca5a5">${level}&nbsp;%</strong><br/>
                Heure&nbsp;: ${h}:00
              </div>`
            )
            .addTo(map.current)
        })

        map.current.on('mouseleave', 'traffic-layer', () => {
          map.current.getCanvas().style.cursor = ''
          popup.current.remove()
        })

        // Click: open sidebar on route, close elsewhere
        map.current.on('click', (e) => {
          const features = map.current.queryRenderedFeatures(e.point, { layers: ['traffic-layer'] })
          if (features.length > 0) {
            const p = features[0].properties
            setSelectedRoad({ id: p.id, name: p.name, highway_type: p.highway_type })
            popup.current.remove()
          } else {
            setSelectedRoad(null)
          }
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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <StatsBar features={trafficData} hour={hour} dayType={dayType} />
      <Legend hour={hour} />
      <TrafficPanel
        hour={hour}
        dayType={dayType}
        onHourChange={setHour}
        onDayTypeChange={setDayType}
      />
      <Sidebar
        road={selectedRoad}
        hour={hour}
        onClose={() => setSelectedRoad(null)}
      />
    </div>
  )
}
