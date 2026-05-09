import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const API_BASE = 'http://localhost:8000'

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    if (map.current) return

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
      const b = map.current.getBounds()
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`

      try {
        const res = await fetch(`${API_BASE}/api/roads?bbox=${bbox}`)
        const geojson = await res.json()

        map.current.addSource('roads', { type: 'geojson', data: geojson })
        map.current.addLayer({
          id: 'roads-layer',
          type: 'line',
          source: 'roads',
          paint: {
            'line-color': '#888888',
            'line-width': 1.5,
          },
        })
      } catch (err) {
        console.warn('Roads not yet available:', err.message)
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
}
