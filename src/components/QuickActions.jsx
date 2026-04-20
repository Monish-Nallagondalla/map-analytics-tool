const ACTIONS = [
  {
    label: '🎯 Where are the kill hotspots?',
    apply: (s) => { s.setHeatmapMode('kills') },
    desc: 'Kill Zones heatmap',
  },
  {
    label: '🗺️ Show me dead zones',
    apply: (s) => { s.setHeatmapMode('utilization') },
    desc: 'Map Usage overlay — red = unused areas',
  },
  {
    label: '🌀 Where do players die to storm?',
    apply: (s) => { s.setHeatmapMode('deaths'); s.setShowPaths(false) },
    desc: 'Death Zones heatmap, paths hidden',
  },
  {
    label: '🤖 How do bots navigate?',
    apply: (s) => { s.setShowHumans(false); s.setShowBots(true); s.setShowPaths(true); s.setHeatmapMode('none') },
    desc: 'Bots only, paths visible',
  },
  {
    label: '👤 Show human player routes',
    apply: (s) => { s.setShowHumans(true); s.setShowBots(false); s.setShowPaths(true); s.setHeatmapMode('none') },
    desc: 'Humans only, paths visible',
  },
  {
    label: '🔥 High traffic areas',
    apply: (s) => { s.setHeatmapMode('traffic') },
    desc: 'Traffic density heatmap',
  },
  {
    label: '↺ Reset all filters',
    apply: (s) => {
      s.setShowHumans(true); s.setShowBots(true); s.setShowPaths(true)
      s.setHeatmapMode('none'); s.setSelectedMatch(null); s.setSelectedDate('all')
    },
    desc: 'Back to defaults',
  },
]

export default function QuickActions({ setters }) {
  const handleSelect = (e) => {
    const idx = parseInt(e.target.value)
    if (isNaN(idx)) return
    ACTIONS[idx].apply(setters)
    e.target.value = ''
  }

  return (
    <div className="quick-actions">
      <select onChange={handleSelect} defaultValue="">
        <option value="" disabled>Quick Actions...</option>
        {ACTIONS.map((a, i) => (
          <option key={i} value={i}>{a.label}</option>
        ))}
      </select>
    </div>
  )
}