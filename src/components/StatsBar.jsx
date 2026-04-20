export default function StatsBar({ events, matches, selectedMatch }) {
  const stats = {
    matches: selectedMatch ? 1 : matches.length,
    players: new Set(events.filter(e => !e.bot).map(e => e.uid)).size,
    bots: new Set(events.filter(e => e.bot).map(e => e.uid)).size,
    kills: events.filter(e => e.evt === 'Kill' || e.evt === 'BotKill').length,
    deaths: events.filter(e => e.evt === 'Killed' || e.evt === 'BotKilled' || e.evt === 'KilledByStorm').length,
    loot: events.filter(e => e.evt === 'Loot').length,
    stormDeaths: events.filter(e => e.evt === 'KilledByStorm').length,
  }

  return (
    <div className="stats-bar">
      {selectedMatch && (
        <div className="stat-item match-id-stat">
          <span className="stat-value" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
            {selectedMatch}
          </span>
          <span className="stat-label">Match ID</span>
        </div>
      )}
      <div className="stat-item">
        <span className="stat-value">{stats.matches}</span>
        <span className="stat-label">Matches</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{stats.players}</span>
        <span className="stat-label">Humans</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{stats.bots}</span>
        <span className="stat-label">Bots</span>
      </div>
      <div className="stat-item">
        <span className="stat-value" style={{ color: 'var(--red)' }}>{stats.kills}</span>
        <span className="stat-label">Kills</span>
      </div>
      <div className="stat-item">
        <span className="stat-value" style={{ color: 'var(--orange)' }}>{stats.deaths}</span>
        <span className="stat-label">Deaths</span>
      </div>
      <div className="stat-item">
        <span className="stat-value" style={{ color: 'var(--yellow)' }}>{stats.loot}</span>
        <span className="stat-label">Loot</span>
      </div>
      <div className="stat-item">
        <span className="stat-value" style={{ color: 'var(--cyan)' }}>{stats.stormDeaths}</span>
        <span className="stat-label">Storm Deaths</span>
      </div>
    </div>
  )
}