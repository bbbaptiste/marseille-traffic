// Mirrors --road-removed: #9C27B0 from voies-design-system.css
export const SIMULATION_COLORS = {
  removed: '#9C27B0',
  polygon: '#EF5350',
}

export const DELETED_ROAD_PAINT = {
  'line-color': SIMULATION_COLORS.removed,
  'line-width': 4,
  'line-opacity': 0.4,
  'line-dasharray': [3, 3],
}

// Custom draw styles — replaces Mapbox defaults to avoid Mapbox sprite URLs
export const DRAW_STYLES = [
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: { 'fill-color': '#EF5350', 'fill-opacity': 0.15 },
  },
  {
    id: 'gl-draw-polygon-stroke',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: { 'line-color': '#EF5350', 'line-width': 2, 'line-dasharray': [4, 2] },
  },
  {
    id: 'gl-draw-point-vertex',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
    paint: { 'circle-radius': 5, 'circle-color': '#EF5350' },
  },
]
