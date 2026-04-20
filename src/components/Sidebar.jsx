import { useState } from 'react'

export default function Sidebar({
  config, matches,
  selectedMap, setSelectedMap,
  selectedDate, setSelectedDate,
  selectedMatch, setSelectedMatch,
  showBots, setShowBots,
  showHumans, setShowHumans,
  heatmapMode, setHeatmapMode,
  showPaths, setShowPaths,
}) {
  const [filterMode, setFilterMode] = useState('contains')
  const [minBots, setMinBots] = useState(0)
  const [minEvents, setMinEvents] = useState(0)
  const [minHumans, setMinHumans] = useState(0)

  const heatmapOptions = [
    { key: 'none', label: 'Off' },
    { key: 'kills', label: 'Kill Zones' },
    { key: 'deaths', label: 'Death Zones' },
    { key: 'traffic', label: 'Traffic' },
    { key: 'utilization', label: 'Map Usage' },
  ]

  const filteredMatches = matches.filter(m => {
    if (showHumans && showBots) { /* no player filter */ }
    else if (!showHumans && !showBots) return false
    else if (filterMode === 'contains') {
      if (showHumans && !showBots && m.humans <= 0) return false
      if (!showHumans && showBots && m.bots <= 0) return false
    } else {
      if (showHumans && !showBots && (m.humans <= 0 || m.bots > 0)) return false
      if (!showHumans && showBots && (m.bots <= 0 || m.humans > 0)) return false
    }

    if (m.bots < minBots) return false
    if (m.humans < minHumans) return false
    const totalEvents = Object.values(m.events || {}).reduce((a, b) => a + b, 0)
    if (totalEvents < minEvents) return false
    return true
  })

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <h3>Map</h3>
        <select value={selectedMap} onChange={e => setSelectedMap(e.target.value)}>
          {config.maps.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="sidebar-section">
        <h3>Date</h3>
        <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
          <option value="all">All Dates</option>
          {config.dates.map(d => (
            <option key={d} value={d}>{d.split('-').reverse().join('/')}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-section">
        <h3>Filter by Player Type</h3>
        <ToggleRow label="Humans" checked={showHumans} onChange={setShowHumans} />
        <ToggleRow label="Bots" checked={showBots} onChange={setShowBots} />
        {!(showHumans && showBots) && (showHumans || showBots) && (
          <div className="filter-mode">
            <button
              className={`filter-mode-btn ${filterMode === 'contains' ? 'active' : ''}`}
              onClick={() => setFilterMode('contains')}
            >Contains</button>
            <button
              className={`filter-mode-btn ${filterMode === 'exclusive' ? 'active' : ''}`}
              onClick={() => setFilterMode('exclusive')}
            >Exclusive</button>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <h3>Display</h3>
        <ToggleRow label="Show Paths" checked={showPaths} onChange={setShowPaths} />
      </div>

      <div className="sidebar-section">
        <h3>Heatmap</h3>
        <div className="heatmap-buttons">
          {heatmapOptions.map(opt => (
            <button
              key={opt.key}
              className={`heatmap-btn ${heatmapMode === opt.key ? 'active' : ''}`}
              onClick={() => setHeatmapMode(opt.key)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Match Filters</h3>
        <div className="slider-row">
          <span className="slider-label">Min Humans</span>
          <input type="range" min="0" max="5" step="1" value={minHumans}
            onChange={e => setMinHumans(parseInt(e.target.value))}
            className="size-slider" />
          <span className="slider-value">{minHumans}</span>
        </div>
        <div className="slider-row">
          <span className="slider-label">Min Bots</span>
          <input type="range" min="0" max="15" step="1" value={minBots}
            onChange={e => setMinBots(parseInt(e.target.value))}
            className="size-slider" />
          <span className="slider-value">{minBots}</span>
        </div>
        <div className="slider-row">
          <span className="slider-label">Min Events</span>
          <input type="range" min="0" max="100" step="5" value={minEvents}
            onChange={e => setMinEvents(parseInt(e.target.value))}
            className="size-slider" />
          <span className="slider-value">{minEvents}</span>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Matches ({filteredMatches.length})</h3>
        {selectedMatch && (
          <button className="heatmap-btn" onClick={() => setSelectedMatch(null)} style={{ marginBottom: 4 }}>
            ← All Matches
          </button>
        )}
        <div className="match-list">
          {filteredMatches.map(m => {
            const dateFormatted = m.date.split('-').reverse().join('/')
            return (
              <div
                key={m.mid}
                className={`match-item ${selectedMatch === m.mid ? 'active' : ''}`}
                onClick={() => setSelectedMatch(m.mid === selectedMatch ? null : m.mid)}
              >
                <div className="match-id" title={m.mid}>{m.mid}</div>
                <div className="match-info">
                  <span>👤{m.humans}</span>
                  <span>🤖{m.bots}</span>
                  <span>#{Object.values(m.events || {}).reduce((a, b) => a + b, 0)}</span>
                  <span>{dateFormatted}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <label>{label}</label>
      <div className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider"></span>
      </div>
    </div>
  )
}