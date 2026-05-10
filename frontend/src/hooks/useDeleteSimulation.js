import { useState, useCallback, useEffect } from 'react'
import booleanIntersects from '@turf/boolean-intersects'

// Compute polygon bounding box without a turf dependency
function getPolygonBbox(polygonFeature) {
  const coords = polygonFeature.geometry.coordinates[0]
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  return [minLng, minLat, maxLng, maxLat]
}

// True if any coordinate of a road linestring falls inside the bbox
function roadTouchesBbox(feature, minLng, minLat, maxLng, maxLat) {
  const { type, coordinates } = feature.geometry
  const lines = type === 'MultiLineString' ? coordinates : [coordinates]
  for (const line of lines) {
    for (const [lng, lat] of line) {
      if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) return true
    }
  }
  return false
}

export function useDeleteSimulation(map, mapReady) {
  const [deletedRoadIds, setDeletedRoadIds] = useState(new Set())

  // Sync MapLibre layer filters whenever deletedRoadIds changes
  useEffect(() => {
    if (!mapReady || !map.current) return
    const m = map.current
    if (!m.getLayer('traffic-layer') || !m.getLayer('traffic-layer-deleted')) return

    const ids = [...deletedRoadIds]
    if (ids.length === 0) {
      m.setFilter('traffic-layer', null)
      m.setFilter('traffic-layer-deleted', ['==', ['get', 'id'], -1])
    } else {
      m.setFilter('traffic-layer', ['!', ['in', ['get', 'id'], ['literal', ids]]])
      m.setFilter('traffic-layer-deleted', ['in', ['get', 'id'], ['literal', ids]])
    }
  }, [deletedRoadIds, mapReady])

  const toggleRoadDeleted = useCallback((roadId) => {
    setDeletedRoadIds(prev => {
      const next = new Set(prev)
      if (next.has(roadId)) next.delete(roadId)
      else next.add(roadId)
      return next
    })
  }, [])

  const clearDeletion = useCallback(() => {
    setDeletedRoadIds(new Set())
  }, [])

  const selectRoadsInPolygon = useCallback((polygonFeature, trafficData) => {
    // Defer to next task so the browser can finish rendering the polygon first
    setTimeout(() => {
      const [minLng, minLat, maxLng, maxLat] = getPolygonBbox(polygonFeature)

      // Bbox pre-filter: reduces 26k features to ~50–300 candidates
      const candidates = trafficData.filter(f =>
        roadTouchesBbox(f, minLng, minLat, maxLng, maxLat)
      )

      // Full geometric intersection only on candidates
      const hits = candidates
        .filter(f => { try { return booleanIntersects(polygonFeature, f) } catch { return false } })
        .map(f => f.properties.id)

      if (hits.length === 0) return
      setDeletedRoadIds(prev => {
        const next = new Set(prev)
        hits.forEach(id => next.add(id))
        return next
      })
    }, 0)
  }, [])

  const loadDeletion = useCallback((ids) => {
    setDeletedRoadIds(new Set(ids))
  }, [])

  return {
    deletedRoadIds,
    deletedCount: deletedRoadIds.size,
    toggleRoadDeleted,
    clearDeletion,
    selectRoadsInPolygon,
    loadDeletion,
  }
}
