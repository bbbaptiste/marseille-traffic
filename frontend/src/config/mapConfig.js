// =============================================================
// VOIES — mapConfig.js
// Constantes couleur pour MapLibre (WebGL) et Recharts (SVG).
// Ces contextes ne peuvent pas lire les CSS custom properties.
// Toutes les valeurs *mirrorent* voies-design-system.css.
// =============================================================

// -------------------------------------------------------------
// Couleurs trafic — miroir des tokens --traffic-*
// -------------------------------------------------------------
export const TRAFFIC_COLORS = {
  low:      '#4CAF50', // --traffic-low      fluide   0.0–0.3
  mid:      '#FF9800', // --traffic-mid      modéré   0.3–0.6
  high:     '#F44336', // --traffic-high     dense    0.6–0.8
  critical: '#B71C1C', // --traffic-critical saturé   0.8–1.0
}

// -------------------------------------------------------------
// Config paint MapLibre — couche traffic-layer
// Extraite de App.jsx et centralisée ici.
// -------------------------------------------------------------
export const TRAFFIC_PAINT = {
  'line-color': [
    'step', ['get', 'traffic_level'],
    TRAFFIC_COLORS.low,
    0.3, TRAFFIC_COLORS.mid,
    0.6, TRAFFIC_COLORS.high,
    0.8, TRAFFIC_COLORS.critical,
  ],
  'line-width': [
    'step', ['get', 'traffic_level'],
    2,
    0.3, 3,
    0.6, 4,
    0.8, 5,
  ],
  'line-color-transition': { duration: 300, delay: 0 },
  'line-width-transition': { duration: 300, delay: 0 },
}

// -------------------------------------------------------------
// Recharts — couleurs des lignes du graphique
// -------------------------------------------------------------
export const CHART_COLORS = {
  semaine: '#F44336', // --traffic-high (rouge — charge semaine)
  weekend: '#3498DB', // bleu neutre — pas de token trafic, défini ici
}

// -------------------------------------------------------------
// Recharts — chrome du graphique (grille, axes, tooltip)
// Les attributs SVG ne supportent pas les CSS vars.
// Valeurs alignées avec la palette dark du design system.
// -------------------------------------------------------------
export const CHART_STYLE = {
  grid:      '#374151', // border sombre (~color-border dark)
  tick:      '#9ca3af', // texte muted sombre
  reference: '#6b7280', // ligne référence heure courante
  tooltip: {
    bg:     '#111827', // surface très sombre
    border: '#374151',
    text:   '#e5e7eb', // texte clair
    item:   '#d1d5db', // texte secondaire clair
  },
}
