import { useRef, useEffect, useState, useCallback } from 'react'

const EVENT_CONFIG = {
  Kill:          { color: '#ff2d2d', label: 'Kill',        shape: 'crosshair' },
  BotKill:       { color: '#ff2d2d', label: 'Bot Kill',    shape: 'crosshair' },
  Killed:        { color: '#ffffff', label: 'Death',       shape: 'x',         strokeColor: '#ff6b6b' },
  BotKilled:     { color: '#ffffff', label: 'Bot Death',   shape: 'x',         strokeColor: '#ff6b6b' },
  KilledByStorm: { color: '#00f5ff', label: 'Storm Death', shape: 'diamond' },
  Loot:          { color: '#ffcc00', label: 'Loot',        shape: 'dot' },
}

const HEATMAP_FILTERS = {
  kills: e => ['Kill', 'BotKill'].includes(e.evt),
  deaths: e => ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.evt),
  traffic: e => ['Position', 'BotPosition'].includes(e.evt),
  utilization: e => ['Position', 'BotPosition'].includes(e.evt),
}

const DEFAULT_EVENT_SETTINGS = {
  Kill: { visible: true, size: 1 },
  BotKill: { visible: true, size: 1 },
  Killed: { visible: true, size: 1 },
  BotKilled: { visible: true, size: 1 },
  KilledByStorm: { visible: true, size: 1.3 },
  Loot: { visible: true, size: 0.7 },
}


function LegendIcon({ shape, color, strokeColor, visible }) {
  const opacity = visible ? 1 : 0.25
  const sz = 16
  const c = sz / 2

  return (
    <svg width={sz} height={sz} style={{ opacity, flexShrink: 0 }}>
      {shape === 'crosshair' && (
        <>
          <circle cx={c} cy={c} r={4} fill="none" stroke={color} strokeWidth="1.5" />
          <line x1={0} y1={c} x2={sz} y2={c} stroke={color} strokeWidth="1.5" />
          <line x1={c} y1={0} x2={c} y2={sz} stroke={color} strokeWidth="1.5" />
        </>
      )}
      {shape === 'x' && (
        <>
          <line x1={3} y1={3} x2={13} y2={13} stroke={strokeColor || color} strokeWidth="2.5" />
          <line x1={13} y1={3} x2={3} y2={13} stroke={strokeColor || color} strokeWidth="2.5" />
          <line x1={3} y1={3} x2={13} y2={13} stroke="#ffffff" strokeWidth="1.2" />
          <line x1={13} y1={3} x2={3} y2={13} stroke="#ffffff" strokeWidth="1.2" />
        </>
      )}
      {shape === 'diamond' && (
        <polygon points={`${c},1 ${sz-1},${c} ${c},${sz-1} 1,${c}`} fill={color} stroke="#fff" strokeWidth="0.8" />
      )}
      {shape === 'dot' && (
        <circle cx={c} cy={c} r={4} fill={color} />
      )}
    </svg>
  )
}


export default function MapView({ mapId, events, loading, heatmapMode, showPaths, selectedMatch, markerSize, setMarkerSize }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [mapImg, setMapImg] = useState(null)
  const [canvasSize, setCanvasSize] = useState(700)
  const [legendOpen, setLegendOpen] = useState(true)
  const [eventSettings, setEventSettings] = useState(DEFAULT_EVENT_SETTINGS)

  // Zoom & pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [mapId])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setMapImg(img)
    img.src = `/minimaps/${mapId}.png`
  }, [mapId])

  // Responsive canvas size — fill available height
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const size = Math.floor(Math.min(rect.width, rect.height))
        setCanvasSize(Math.max(400, size))
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(prev => Math.min(8, Math.max(1, prev * (e.deltaY > 0 ? 0.9 : 1.1))))
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [zoom, pan])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    })
  }, [isPanning])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const toggleEventVisible = (key) => {
    setEventSettings(prev => ({ ...prev, [key]: { ...prev[key], visible: !prev[key].visible } }))
  }

  const setEventSize = (key, val) => {
    setEventSettings(prev => ({ ...prev, [key]: { ...prev[key], size: val } }))
  }

  // === DRAW ===
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapImg) return
    const ctx = canvas.getContext('2d')
    const size = canvasSize
    canvas.width = size
    canvas.height = size
    ctx.clearRect(0, 0, size, size)
    ctx.save()

    const offsetX = (size - size * zoom) / 2 + pan.x
    const offsetY = (size - size * zoom) / 2 + pan.y
    ctx.translate(offsetX, offsetY)
    ctx.scale(zoom, zoom)

    ctx.drawImage(mapImg, 0, 0, size, size)

    if (!events || events.length === 0) { ctx.restore(); return }

    // Heatmap
    if (heatmapMode !== 'none' && HEATMAP_FILTERS[heatmapMode]) {
      const heatEvents = events.filter(HEATMAP_FILTERS[heatmapMode])
      if (heatmapMode === 'utilization') {
        drawUtilizationMap(ctx, heatEvents, size)
      } else {
        drawHeatmap(ctx, heatEvents, size)
      }
    }

    // Paths
    if (showPaths) {
      const byPlayer = {}
      events.forEach(e => {
        if (e.evt !== 'Position' && e.evt !== 'BotPosition') return
        if (!byPlayer[e.uid]) byPlayer[e.uid] = []
        byPlayer[e.uid].push(e)
      })

      const pw = markerSize.paths

      Object.values(byPlayer).forEach(evts => {
        if (evts.length < 2) return
        evts.sort((a, b) => a.ts - b.ts)
        const isBot = evts[0].bot

        ctx.beginPath()
        ctx.strokeStyle = isBot ? '#7b68ff' : 'rgba(46, 213, 115, 0.55)'
        ctx.globalAlpha = isBot ? 0.45 : 0.6
        ctx.lineWidth = (isBot ? 0.8 : 1.4) * pw
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.moveTo(evts[0].u * size, evts[0].v * size)
        for (let i = 1; i < evts.length; i++) {
          ctx.lineTo(evts[i].u * size, evts[i].v * size)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      })
    }

    // Event markers
    events.forEach(e => {
      if (e.evt === 'Position' || e.evt === 'BotPosition') return
      const cfg = EVENT_CONFIG[e.evt]
      const settings = eventSettings[e.evt]
      if (!cfg || !settings || !settings.visible) return

      const px = e.u * size
      const py = e.v * size
      const s = 5 * settings.size * markerSize.events

      ctx.save()
      if (cfg.shape === 'crosshair') {
        // Bright red crosshair with glow
        ctx.shadowColor = cfg.color
        ctx.shadowBlur = 6
        ctx.strokeStyle = cfg.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px, py, s, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(px - s * 1.5, py); ctx.lineTo(px + s * 1.5, py)
        ctx.moveTo(px, py - s * 1.5); ctx.lineTo(px, py + s * 1.5)
        ctx.stroke()
        ctx.shadowBlur = 0
      } else if (cfg.shape === 'x') {
        // White X with colored outline — clearly different from kills
        ctx.strokeStyle = cfg.strokeColor || cfg.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s)
        ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s)
        ctx.stroke()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s)
        ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s)
        ctx.stroke()
      } else if (cfg.shape === 'diamond') {
        // Cyan diamond with glow
        ctx.shadowColor = cfg.color
        ctx.shadowBlur = 10
        ctx.fillStyle = cfg.color
        ctx.beginPath()
        ctx.moveTo(px, py - s * 1.2)
        ctx.lineTo(px + s * 1.2, py)
        ctx.lineTo(px, py + s * 1.2)
        ctx.lineTo(px - s * 1.2, py)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.shadowBlur = 0
      } else if (cfg.shape === 'dot') {
        // Golden dot with glow
        ctx.shadowColor = cfg.color
        ctx.shadowBlur = 4
        ctx.fillStyle = cfg.color
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.arc(px, py, s * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
      }
      ctx.restore()
    })

    ctx.restore()
  }, [mapImg, events, canvasSize, heatmapMode, showPaths, eventSettings, markerSize, zoom, pan])

  useEffect(() => { draw() }, [draw])

  return (
    <div className="map-container" ref={containerRef}>
      {loading && <div className="map-loading">Loading map data...</div>}
      <div className="map-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="map-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        />
      </div>

      {/* Zoom */}
      <div className="zoom-controls">
        <button onClick={() => setZoom(p => Math.min(8, p * 1.3))}>+</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>⌂</button>
        <button onClick={() => setZoom(p => Math.max(1, p / 1.3))}>−</button>
      </div>

{/* Floating Legend */}
      <div className={`floating-legend ${legendOpen ? 'open' : 'closed'}`}>
        <div className="legend-header" onClick={() => setLegendOpen(!legendOpen)}>
          <span>Legend</span>
          <span className="legend-toggle">{legendOpen ? '▾' : '▸'}</span>
        </div>
        {legendOpen && (
          <div className="legend-body">
<div className="legend-group">
              <div className="legend-row">
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="rgba(46,213,115,0.7)" strokeWidth="2"/></svg>
                <span>Human path</span>
              </div>
              <div className="legend-row">
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#7b68ff" strokeWidth="2"/></svg>
                <span>Bot path</span>
              </div>
              <div className="legend-row">
                <span className="legend-event-label" style={{ marginLeft: 2 }}>Thickness</span>
                <input
                  type="range" min="0.3" max="3" step="0.1"
                  value={markerSize.paths}
                  onChange={e => setMarkerSize(prev => ({ ...prev, paths: parseFloat(e.target.value) }))}
                  className="legend-size-slider"
                />
              </div>
            </div>
            <div className="legend-divider"></div>
            {Object.entries(EVENT_CONFIG).map(([key, cfg]) => {
              const s = eventSettings[key]
              return (
                <div key={key} className={`legend-event-row ${s.visible ? '' : 'dimmed'}`}>
                  <div
                    className="legend-event-toggle"
                    onClick={() => toggleEventVisible(key)}
                    title={s.visible ? 'Click to hide' : 'Click to show'}
                  >
                    <LegendIcon shape={cfg.shape} color={cfg.color} strokeColor={cfg.strokeColor} visible={s.visible} />
                    <span className="legend-event-label">{cfg.label}</span>
                    <span className="legend-vis-indicator">{s.visible ? '👁' : '—'}</span>
                  </div>
                  <input
                    type="range" min="0.3" max="2.5" step="0.1"
                    value={s.size}
                    onChange={e => setEventSize(key, parseFloat(e.target.value))}
                    className="legend-size-slider"
                    title="Marker size"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// === HEATMAP ===
function drawHeatmap(ctx, events, size) {
  if (events.length === 0) return
  const gs = 32, cs = size / gs
  const grid = Array(gs).fill(null).map(() => Array(gs).fill(0))

  events.forEach(e => {
    const gx = Math.floor(e.u * gs), gy = Math.floor(e.v * gs)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = gx + dx, ny = gy + dy
      if (nx >= 0 && nx < gs && ny >= 0 && ny < gs)
        grid[ny][nx] += (Math.abs(dx) + Math.abs(dy)) === 0 ? 1 : 0.3
    }
  })

  let mx = 0
  grid.forEach(r => r.forEach(v => { if (v > mx) mx = v }))
  if (mx === 0) return

  const off = document.createElement('canvas')
  off.width = size; off.height = size
  const oc = off.getContext('2d')

  for (let y = 0; y < gs; y++) for (let x = 0; x < gs; x++) {
    if (grid[y][x] === 0) continue
    const i = Math.pow(grid[y][x] / mx, 0.6)
    let r, g, b
    if (i < 0.4) { r = 0; g = Math.floor(200 * i / 0.4); b = 0 }
    else if (i < 0.7) { const t = (i - 0.4) / 0.3; r = Math.floor(255 * t); g = 200; b = 0 }
    else { const t = (i - 0.7) / 0.3; r = 255; g = Math.floor(200 * (1 - t)); b = 0 }
    oc.fillStyle = `rgba(${r},${g},${b},${0.3 + i * 0.55})`
    oc.fillRect(x * cs, y * cs, cs, cs)
  }

  ctx.save(); ctx.filter = 'blur(12px)'; ctx.globalAlpha = 0.85
  ctx.drawImage(off, 0, 0); ctx.restore()
  ctx.save(); ctx.globalAlpha = 0.3; ctx.drawImage(off, 0, 0); ctx.restore()
}

// === MAP UTILIZATION ===
function drawUtilizationMap(ctx, events, size) {
  if (events.length === 0) return
  const gs = 24, cs = size / gs
  const grid = Array(gs).fill(null).map(() => Array(gs).fill(0))

  events.forEach(e => {
    const gx = Math.floor(e.u * gs), gy = Math.floor(e.v * gs)
    if (gx >= 0 && gx < gs && gy >= 0 && gy < gs) grid[gy][gx]++
  })

  let used = 0, mx = 0
  grid.forEach(r => r.forEach(v => { if (v > mx) mx = v; if (v > 0) used++ }))
  if (mx === 0) return

  for (let y = 0; y < gs; y++) for (let x = 0; x < gs; x++) {
    const px = x * cs, py = y * cs
    if (grid[y][x] === 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; ctx.fillRect(px, py, cs, cs)
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)'; ctx.strokeRect(px, py, cs, cs)
    } else {
      const i = Math.pow(grid[y][x] / mx, 0.5)
      ctx.fillStyle = `rgba(46, 213, 115, ${0.1 + i * 0.4})`; ctx.fillRect(px, py, cs, cs)
    }
  }

  const pct = ((used / (gs * gs)) * 100).toFixed(0)
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(10, 10, 170, 44)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(10, 10, 170, 44)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif'
  ctx.fillText(`Map Usage: ${pct}%`, 20, 38)
  ctx.restore()
}