import { useState, useRef, useEffect } from 'react'

const SYSTEM_PROMPT = `You are an AI analyst for LILA BLACK, an extraction shooter game. You help Level Designers understand player behavior using telemetry data.

You will receive current dashboard context (selected map, event counts, match info). Answer questions about player behavior, suggest areas to investigate, and provide actionable insights.

Keep responses concise (2-4 sentences). Use specific numbers when available. Think like a game analyst advising a level designer.

When suggesting filter changes, output a JSON block like:
\`\`\`filters
{"heatmap":"kills","showBots":false,"showHumans":true}
\`\`\`
Valid filter keys: heatmap (none/kills/deaths/traffic/utilization), showBots (bool), showHumans (bool), showPaths (bool)`

function buildContext(events, mapId, matches) {
  const evtCounts = {}
  events.forEach(e => { evtCounts[e.evt] = (evtCounts[e.evt] || 0) + 1 })

  const humans = new Set(events.filter(e => !e.bot).map(e => e.uid)).size
  const bots = new Set(events.filter(e => e.bot).map(e => e.uid)).size

  return `Current view: ${mapId} | ${matches} matches | ${humans} humans, ${bots} bots | Events: ${JSON.stringify(evtCounts)}`
}

async function callLLM(messages, apiKey, provider) {
  let url, headers, body

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    body = { model: 'llama-3.1-8b-instant', messages, max_tokens: 300, temperature: 0.3 }
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions'
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    body = { model: 'gpt-4o-mini', messages, max_tokens: 300, temperature: 0.3 }
  } else if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages'
    headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    const sysMsg = messages.find(m => m.role === 'system')?.content || ''
    const userMsgs = messages.filter(m => m.role !== 'system')
    body = { model: 'claude-sonnet-4-20250514', system: sysMsg, messages: userMsgs, max_tokens: 300 }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.content[0].text
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json()
  if (data.error) throw new Error(data.error?.message || 'API error')
  return data.choices[0].message.content
}

export default function AiChat({ apiKey, provider, events, mapId, matchCount, setters }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `I'm your AI analyst for ${mapId}. Ask me about player behavior, kill zones, storm deaths, bot patterns — anything you see on the map.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const prevMapRef = useRef(mapId)

  // Reset chat when map changes
  useEffect(() => {
    if (mapId !== prevMapRef.current) {
      prevMapRef.current = mapId
      setMessages([
        { role: 'assistant', text: `Switched to ${mapId}. What would you like to know about player behavior on this map?` }
      ])
    }
  }, [mapId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const applyFilters = (text) => {
    const match = text.match(/```filters\s*\n?([\s\S]*?)\n?```/)
    if (!match) return
    try {
      const filters = JSON.parse(match[1])
      if (filters.heatmap) setters.setHeatmapMode(filters.heatmap)
      if (filters.showBots !== undefined) setters.setShowBots(filters.showBots)
      if (filters.showHumans !== undefined) setters.setShowHumans(filters.showHumans)
      if (filters.showPaths !== undefined) setters.setShowPaths(filters.showPaths)
    } catch (e) { /* ignore parse errors */ }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const context = buildContext(events, mapId, matchCount)
      const llmMessages = [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + context },
        ...messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) !== 0).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
        { role: 'user', content: userMsg },
      ]

      const response = await callLLM(llmMessages, apiKey, provider)
      applyFilters(response)

      // Clean filter blocks from display
      const cleanResponse = response.replace(/```filters[\s\S]*?```/g, '').trim()
      setMessages(prev => [...prev, { role: 'assistant', text: cleanResponse }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}. Check your API key.` }])
    }
    setLoading(false)
  }
  const getSuggestions = () => {
    const evtCounts = {}
    events.forEach(e => { evtCounts[e.evt] = (evtCounts[e.evt] || 0) + 1 })
    
    const suggestions = [
      `Summarize player activity on ${mapId}`,
      `What are the top combat zones?`,
    ]
    
    if (evtCounts['KilledByStorm'] > 0)
      suggestions.push(`Why are ${evtCounts['KilledByStorm']} players dying to storm?`)
    if (evtCounts['BotKill'] > 0)
      suggestions.push(`Analyze bot vs human combat patterns`)
    if (evtCounts['Loot'] > 0)
      suggestions.push(`Are loot locations driving player movement?`)
    
    suggestions.push(`What should a level designer fix first?`)
    
    return suggestions
  }
  return (
    <div className="ai-chat">
      <div className="ai-chat-header">
        <span>🤖 AI Analyst</span>
        <span className="ai-provider-badge">{provider}</span>
      </div>
    <div className="ai-chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && <div className="ai-msg assistant ai-typing">Analyzing...</div>}
        {!loading && messages.length <= 1 && (
          <div className="ai-suggestions">
            {getSuggestions().map((s, i) => (
              <button key={i} className="ai-suggestion" onClick={() => { setInput(s); }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="ai-chat-input">
        <input
          type="text"
          placeholder="Ask about player behavior..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>→</button>
      </div>
    </div>
  )
}