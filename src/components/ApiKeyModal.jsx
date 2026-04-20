import { useState } from 'react'

export default function ApiKeyModal({ onSubmit, onSkip }) {
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState('groq')

  const providers = [
    { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
    { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { id: 'anthropic', label: 'Claude', placeholder: 'sk-ant-...' },
  ]

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <img src="/lila-logo.png" alt="LILA" className="modal-logo" />
        <h1 className="modal-title">BLACK <span>Map Analytics</span></h1>
        <p className="modal-desc">
          Level design intelligence powered by player telemetry data.
        </p>

        <div className="modal-divider"></div>

        <div className="modal-section">
          <h3>AI Analyst (Optional)</h3>
          <p className="modal-hint">Add an API key to enable natural language queries about player behavior.</p>

          <div className="provider-tabs">
            {providers.map(p => (
              <button
                key={p.id}
                className={`provider-tab ${provider === p.id ? 'active' : ''}`}
                onClick={() => setProvider(p.id)}
              >{p.label}</button>
            ))}
          </div>

          <input
            type="password"
            className="modal-input"
            placeholder={providers.find(p => p.id === provider).placeholder}
            value={key}
            onChange={e => setKey(e.target.value)}
          />

          <button
            className="modal-btn primary"
            disabled={!key.trim()}
            onClick={() => onSubmit(key.trim(), provider)}
          >
            Launch with AI Analyst
          </button>
        </div>

        <button className="modal-btn secondary" onClick={onSkip}>
          Skip — Open Dashboard Only
        </button>
      </div>
    </div>
  )
}