# Map Analytics Tool

A browser based player telemetry visualization tool for Level Designers to analyze player behavior across LILA BLACK's three maps.

**Live URL:** https://map-analytics-tool.vercel.app

## Features Walkthrough

### Map Visualization
Open the tool and you see AmbroseValley loaded by default with all player paths rendered on the minimap. Human paths are green, bot paths are purple. The map fills available screen space and supports scroll to zoom (up to 8x) with click and drag panning.

### Event Markers
Six event types rendered with distinct shapes and colors:
- Kill and Bot Kill: red crosshair with glow
- Death and Bot Death: white X with red outline
- Storm Death: cyan diamond with glow
- Loot: golden dot

Each event type can be toggled on/off and resized independently through the floating legend panel (bottom right of map). Click the legend header to collapse or expand it.

### Filtering
- **Map selector:** Switch between AmbroseValley, GrandRift, and Lockdown
- **Date filter:** Filter by specific date (dd/mm/yyyy format) or view all dates
- **Player type filter:** Toggle humans and bots independently. This filters both the match list and map content. Choose between "Contains" mode (matches with selected type) and "Exclusive" mode (matches with only that type)
- **Match selection:** Click any match in the sidebar to isolate it. Full match IDs are visible and scrollable. Each match shows player composition at a glance (e.g. 👤1 🤖6 ⚡45 10/02/2026 means 1 human, 6 bots, 45 events, played on 10th Feb 2026)
- **Match filters:** Slider controls to filter matches by minimum human count, bot count, and event count. Useful for isolating high activity or specific composition matches

### Match Search
Search bar in the top right header. Type any part of a match ID to find it instantly. Clicking a result auto switches to the correct map and selects the match.

### Heatmap Overlays
Five heatmap modes available in the sidebar:
- **Kill Zones:** BotKill and Kill event density
- **Death Zones:** All death events including storm deaths
- **Traffic:** Position event density showing player movement patterns
- **Map Usage:** Grid overlay showing utilized zones (green) vs dead zones (red) with a utilization percentage displayed on the map

### Timeline Playback
Select any match to activate the timeline bar at the bottom. Controls:
- Play: auto plays from current position to end
- Pause: stops playback
- Reset: returns to start
- Scrub: drag the slider to any point in the match
- Shows percentage progress and event count (visible/total)

### Quick Actions
### Quick Actions
Dropdown in the header with preset Level Designer workflows:
- "Where are the kill hotspots?" activates Kill Zones heatmap
- "Show me dead zones" activates Map Usage overlay
- "Where do players die to storm?" activates Death Zones heatmap with paths hidden
- "How do bots navigate?" toggles to bots only with paths visible
- "Show human player routes" toggles to humans only with paths visible
- "High traffic areas" activates Traffic density heatmap
- "Reset all filters" returns everything to defaults

### AI Analyst (Optional)
On first load, you can enter an API key for Groq, OpenAI, or Claude to enable a chat panel. The AI receives current dashboard context and can answer questions about player behavior. Preset suggestions are generated from actual current data. Skip button bypasses this entirely and the full dashboard works without it.

## Tech Stack

- **Frontend:** React 19 + Vite
- **Rendering:** HTML5 Canvas
- **Data Pipeline:** Python (pyarrow, Pillow)
- **Hosting:** Vercel
- **AI (optional):** Groq / OpenAI / Claude API

## Setup (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.8+ (for preprocessing only)

### Install and Run

```bash
git clone https://github.com/Monish-Nallagondalla/map-analytics-tool.git
cd lila-black-analytics
npm install
npm run dev
```

Open http://localhost:5173

### Preprocessing (only needed if regenerating data from raw parquet files)

```bash
pip install pyarrow Pillow
python preprocess.py
python optimize.py
```

This reads parquet files from the player_data directory, converts to optimized JSON, and resizes minimap images. Output goes to public/data/ and public/minimaps/.

### Environment Variables

No environment variables required. The AI analyst feature uses client side API calls with user provided keys (entered at runtime, not stored).

### Build for Production

```bash
npm run build
```

Output is in the dist/ folder, ready for static hosting.

## Project Structure

```
lila-viz/
├── public/
│   ├── data/                  # Processed JSON (per map events + match index)
│   ├── minimaps/              # Resized minimap images (1024x1024)
│   ├── lila-logo.png
│   └── favicon.png
├── src/
│   ├── components/
│   │   ├── MapView.jsx        # Canvas rendering, zoom/pan, legend
│   │   ├── Sidebar.jsx        # Filters, match list
│   │   ├── Timeline.jsx       # Playback controls
│   │   ├── StatsBar.jsx       # Match statistics
│   │   ├── QuickActions.jsx   # Preset workflows
│   │   ├── ApiKeyModal.jsx    # AI key entry
│   │   └── AiChat.jsx         # AI analyst panel
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── preprocess.py              # Parquet to JSON pipeline
├── optimize.py                # Data size optimization
├── analyze.py                 # Data analysis script
├── verify_coords.py           # Coordinate mapping verification
├── ARCHITECTURE.md
├── INSIGHTS.md
└── README.md
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): System design decisions, data flow, coordinate mapping approach, assumptions, and tradeoffs
- [INSIGHTS.md](./INSIGHTS.md): Three data driven insights about player behavior with supporting evidence and actionable recommendations
