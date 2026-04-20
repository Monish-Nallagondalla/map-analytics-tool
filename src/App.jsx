import { useState, useEffect, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import Timeline from './components/Timeline'
import StatsBar from './components/StatsBar'
import QuickActions from './components/QuickActions'
import ApiKeyModal from './components/ApiKeyModal'
import AiChat from './components/AiChat'
import './App.css'

function App() {
  const [config, setConfig] = useState(null)
  const [matches, setMatches] = useState([])
  const [mapData, setMapData] = useState(null)
  const [loadingMap, setLoadingMap] = useState(false)

  // AI state
  const [showModal, setShowModal] = useState(true)
  const [apiKey, setApiKey] = useState(null)
  const [aiProvider, setAiProvider] = useState(null)

  // Filters
  const [selectedMap, setSelectedMap] = useState('AmbroseValley')
  const [selectedDate, setSelectedDate] = useState('all')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showBots, setShowBots] = useState(true)
  const [showHumans, setShowHumans] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState('none')
  const [showPaths, setShowPaths] = useState(true)
  const [timelinePos, setTimelinePos] = useState(1)
  const [markerSize, setMarkerSize] = useState({ events: 1, paths: 1 })
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/data/config.json').then(r => r.json()),
      fetch('/data/matches.json').then(r => r.json()),
    ]).then(([cfg, mtch]) => { setConfig(cfg); setMatches(mtch) })
  }, [])

  useEffect(() => {
    if (!selectedMap) return
    setLoadingMap(true)
    setSelectedMatch(null)
    setTimelinePos(1)
    fetch(`/data/${selectedMap}.json`)
      .then(r => r.json())
      .then(data => { setMapData(data); setLoadingMap(false) })
  }, [selectedMap])

  const filteredMatches = useMemo(() =>
    matches.filter(m =>
      m.map_id === selectedMap && (selectedDate === 'all' || m.date === selectedDate)
    ), [matches, selectedMap, selectedDate])

  const validMatchIds = useMemo(() =>
    new Set(filteredMatches.map(m => m.mid)), [filteredMatches])

  const filteredEvents = useMemo(() => {
    if (!mapData) return []
    return mapData.filter(e => {
      if (selectedDate !== 'all' && !validMatchIds.has(e.mid)) return false
      if (selectedMatch && e.mid !== selectedMatch) return false
      if (!showBots && e.bot) return false
      if (!showHumans && !e.bot) return false
      return true
    })
  }, [mapData, selectedMatch, showBots, showHumans, selectedDate, validMatchIds])

  const timelineEvents = useMemo(() => {
    if (!selectedMatch || timelinePos >= 1) return filteredEvents
    const matchEvts = filteredEvents
    if (matchEvts.length === 0) return filteredEvents
    let minTs = Infinity, maxTs = -Infinity
    for (const e of matchEvts) {
      if (e.ts < minTs) minTs = e.ts
      if (e.ts > maxTs) maxTs = e.ts
    }
    const cutoff = minTs + (maxTs - minTs) * timelinePos
    return matchEvts.filter(e => e.ts <= cutoff)
  }, [filteredEvents, selectedMatch, timelinePos])

  const filterSetters = {
    setHeatmapMode, setShowBots, setShowHumans,
    setShowPaths, setSelectedMatch, setSelectedDate,
  }

  // Modal handlers
  const handleApiSubmit = (key, provider) => {
    setApiKey(key)
    setAiProvider(provider)
    setShowModal(false)
  }

  const handleSkip = () => {
    setShowModal(false)
  }

  if (showModal) {
    return <ApiKeyModal onSubmit={handleApiSubmit} onSkip={handleSkip} />
  }

  if (!config) return <div className="loading">Loading LILA BLACK Analyzer...</div>

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <img src="/lila-logo.png" alt="LILA" className="logo-img" />
          <span className="logo-black">BLACK</span>
          <span className="logo-sub">Map Analytics</span>
        </div>
        <QuickActions setters={filterSetters} />
        <div className="header-search">
          <input
            type="text"
            placeholder="Search match ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (() => {
            const results = matches.filter(m =>
              m.mid.toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 5)
            return results.length > 0 ? (
              <div className="search-results">
                {results.map(m => (
                  <div
                    key={m.mid}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedMap(m.map_id)
                      setSelectedMatch(m.mid)
                      setSearchQuery('')
                      setTimelinePos(1)
                    }}
                  >
                    <span className="search-mid">{m.mid}</span>
                    <span className="search-meta">{m.map_id} · 👤{m.humans} 🤖{m.bots} · {m.date.split('-').reverse().join('/')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="search-results">
                <div className="search-no-result">No matches found</div>
              </div>
            )
          })()}
        </div>
      </header>
      <div className="app-body">
        <Sidebar
          config={config} matches={filteredMatches}
          selectedMap={selectedMap} setSelectedMap={setSelectedMap}
          selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          selectedMatch={selectedMatch} setSelectedMatch={setSelectedMatch}
          showBots={showBots} setShowBots={setShowBots}
          showHumans={showHumans} setShowHumans={setShowHumans}
          heatmapMode={heatmapMode} setHeatmapMode={setHeatmapMode}
          showPaths={showPaths} setShowPaths={setShowPaths}
        />
        <main className="main-content">
          <StatsBar events={timelineEvents} matches={filteredMatches} selectedMatch={selectedMatch} />
          <MapView
            mapId={selectedMap} events={timelineEvents} loading={loadingMap}
            heatmapMode={heatmapMode} showPaths={showPaths}
            selectedMatch={selectedMatch} markerSize={markerSize}
            setMarkerSize={setMarkerSize}
          />
          {selectedMatch && (
            <Timeline
              events={filteredEvents.filter(e => e.mid === selectedMatch)}
              position={timelinePos} setPosition={setTimelinePos}
            />
          )}
        </main>
        {apiKey && (
          <AiChat
            apiKey={apiKey}
            provider={aiProvider}
            events={timelineEvents}
            mapId={selectedMap}
            matchCount={filteredMatches.length}
            setters={filterSetters}
          />
        )}
      </div>
    </div>
  )
}

export default App