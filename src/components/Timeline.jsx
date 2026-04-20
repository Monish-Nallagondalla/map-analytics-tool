import { useState, useRef, useEffect } from 'react'

export default function Timeline({ events, position, setPosition }) {
  const [playing, setPlaying] = useState(false)
  const animRef = useRef(null)

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    let lastTime = null
    const step = (timestamp) => {
      if (!lastTime) lastTime = timestamp
      const delta = (timestamp - lastTime) / 1000
      lastTime = timestamp

      setPosition(prev => {
        const next = prev + delta * 0.05 // 20 sec full playback
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })

      animRef.current = requestAnimationFrame(step)
    }

    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [playing, setPosition])

  // 🔥 NEW: percentage instead of time
  const pct = Math.round(position * 100)

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span className="timeline-label">
          Match Timeline — {pct}%
        </span>

        <div className="timeline-controls">
          <button
            className="timeline-btn"
            onClick={() => {
              setPosition(0)
              setPlaying(false)
            }}
          >
            ↻
          </button>

          <button
            className="timeline-btn"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <button
            className="timeline-btn"
            onClick={() => {
              setPosition(1)
              setPlaying(false)
            }}
          >
            ⏭
          </button>
        </div>
      </div>

      <input
        type="range"
        className="timeline-slider"
        min="0"
        max="1"
        step="0.001"
        value={position}
        onChange={e => {
          setPosition(parseFloat(e.target.value))
          setPlaying(false)
        }}
      />
    </div>
  )
}