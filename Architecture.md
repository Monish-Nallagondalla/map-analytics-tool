# Architecture — LILA BLACK Map Analytics

## My Approach

Before writing a single line of code, I asked myself two questions: **Who is my user?** and **What decision does this tool help them make?**

The user is a Level Designer. They've spent weeks placing buildings, cover objects, loot spawns, and extraction points. The map went live. Now they need to know — **did players use the map the way I intended?**

That reframing shaped every decision I made. I wasn't building a data dashboard. I was building a tool that answers: *"Where did my map succeed, and where did it fail?"*

---

## First Impressions of the Data

Before touching the codebase, I explored the raw data stats. Four things jumped out immediately:

1. **Only 3 human PvP kills in 5 days.** Three. In 796 matches. This told me LILA BLACK isn't a deathmatch — it's an extraction shooter where PvP is rare and high-stakes. Every feature I built had to respect that context.

2. **2,415 BotKills vs 3 human Kills.** Bot combat IS the combat experience. Any "kill heatmap" that only tracks PvP would show an almost empty map. I made BotKill the primary combat metric.

3. **Only 39 storm deaths across all maps.** That's a small number, but it's the most important number for a Level Designer. Every storm death means a player couldn't escape in time — that's a map layout problem, not a player skill problem.

4. **Minimap images don't match the README spec.** The README says 1024×1024. Actual sizes: AmbroseValley is 4320×4320, Lockdown is 9000×9000. This was either an oversight or a deliberate test. Either way, hardcoding 1024 would break coordinate mapping silently — everything would render, just in the wrong place.

---

## Tech Stack — Why These Choices

| What | Choice | Why (honest reason) |
|------|--------|---------------------|
| Frontend | React + Vite | I needed 12+ interdependent filter states (map, date, player type, heatmap mode, event toggles, zoom, timeline position). React's state model handles this cleanly. Vite because it's fast and I had 10 hours, not 10 days |
| Rendering | HTML5 Canvas | 28K events on AmbroseValley. I tried thinking through SVG — that's 28,000 DOM nodes for one map. Canvas draws it all in a single pass with zero layout cost |
| Heatmap | Custom 32×32 grid + CSS blur | I considered heatmap.js and deck.gl. Both are 200KB+ libraries for one feature. I wrote 60 lines of grid accumulation + gaussian spread that does exactly what I need and nothing I don't |
| Data pipeline | Python → static JSON | The data is a fixed 5-day dump. There's no real-time feed, no database updates. A backend server would add complexity, cost, and a failure point — all for zero benefit. Static JSON on a CDN is faster, free, and can't go down |
| AI Analyst | Multi-provider LLM (optional) | I come from an AI engineering background. I knew I could add a natural language query layer that sends current dashboard context to an LLM. But I also knew it shouldn't be a gate — the tool works fully without it. The API key modal has a Skip button for exactly this reason |
| Hosting | Vercel | Free, zero-config, gives me a shareable URL in 2 minutes. No reason to overcomplicate this |

---

## How Data Flows
1,243 parquet files (89K events across 5 days)
│
▼
preprocess.py
├── Read all files, decode event bytes
├── Detect bots (UUID vs numeric user_id)
├── Convert world (x, z) → UV (0–1 range)
├── Tag each file with date from folder name
└── Resize minimaps to 1024×1024 for web
│
▼
optimize.py
├── Downsample Position events (every 3rd)
├── Keep ALL combat/loot/storm events
└── AmbroseValley: 10.4MB → 4.2MB
│
▼
public/data/ (per-map JSON)
│
▼
React app loads on demand
Canvas renders: paths → heatmap → markers
Filters applied in-memory (no re-fetch)

**Why per-map JSON instead of one big file?** A designer analyzing Lockdown shouldn't wait for AmbroseValley's 4.2MB to download. Each map loads independently.

**Why downsample positions but keep all combat events?** Positions are 85%+ of the data — they draw paths. Keeping every 3rd still produces smooth, accurate paths. But a Kill event or Storm Death? Those are rare and critical. Losing even one would corrupt the analysis.

---

## Coordinate Mapping — The Tricky Part

The README gives scale + origin per map. The conversion is:
UV:     u = (x - origin_x) / scale
v = 1 - (z - origin_z) / scale     ← Y-flip for image space
Pixel:  px = u × canvas_width
py = v × canvas_height

### Three things I caught:

**1. `y` is elevation, not map Y.** The parquet has `x`, `y`, `z`. For a 2D minimap, you use `x` and `z`. The `y` column is vertical height in the 3D world. Using it for mapping would place every single point wrong, and it would look plausible enough that you might not notice.

**2. Image sizes don't match documentation.** The README says 1024×1024. Reality: AmbroseValley is 4320×4320, GrandRift is 2160×2158 (not even square), Lockdown is 9000×9000. My fix: convert everything to UV (0-1) space during preprocessing. The frontend multiplies by canvas size at render time. This makes the tool resolution-independent — if LILA ships 8K minimaps tomorrow, zero code changes.

**3. The Y-flip is applied once, during preprocessing.** This eliminates a class of bugs where the flip gets applied twice or forgotten in one code path. The frontend simply plots `(u, v)` directly.

**Verification:** I validated using the sample coordinates from the README (x=-301.45, z=-355.55 on AmbroseValley). The plotted point lands in the correct map region.

---

## Features I Built — And Why Each One Exists

Every feature maps to a Level Designer's actual question:

| Level Designer asks... | Feature that answers it |
|------------------------|------------------------|
| "Where do fights happen?" | Kill Zones heatmap — shows BotKill + Kill density |
| "Where does my map fail players?" | Death Zones heatmap + Storm Death markers (cyan diamonds with glow) |
| "Am I wasting map space?" | Map Usage overlay — grid shows used (green) vs dead zones (red) with utilization percentage |
| "How does a typical match play out?" | Timeline playback — scrub or auto-play through a match, watching events appear chronologically |
| "Do bots go where humans go?" | Player type filter (Humans/Bots toggles) — toggle each independently, compare paths visually |
| "Show me only bot-exclusive matches" | Contains vs Exclusive filter mode — "Contains" shows matches with bots (may include humans), "Exclusive" shows bot-only matches |
| "Find that one match from Tuesday" | Match search bar — search by match ID, auto-switches to correct map |
| "Just show me kill hotspots, fast" | Quick Actions dropdown — preset level designer workflows that trigger multiple filters in one click |
| "What should I investigate?" | AI Analyst — optional LLM chat that analyzes current view context and suggests areas of concern |

### The "Contains vs Exclusive" filter — why it exists

When I toggled "Bots ON, Humans OFF," I expected to see only bot matches. Instead I saw matches like `0f169d20` with 👤1 🤖6 — a human was in there. The filter was showing matches that *contain* bots, not matches that are *exclusively* bots.

Both behaviors are useful. A designer studying bot pathfinding wants exclusive bot matches. A designer studying how bots interact with humans wants mixed matches. So I added a toggle between both modes. It only appears when it's relevant (when one player type is deselected).

### The AI Analyst — why I built it, and what I'd do differently

I added an optional AI chat panel because I come from an AI engineering background and I believe the future of analytics tools is conversational. A Level Designer shouldn't need to learn 12 filter controls — they should be able to type "where are bots dying on Lockdown?" and get an answer.

**What works today:** The AI receives current view context (event counts, map, player stats) and can answer summary questions. It can also trigger filter changes via structured output — "let me switch to the kill heatmap for you."

**What I'd build with more time:** The current AI sees aggregate counts, not spatial data. Given another sprint, I'd send the heatmap grid data (which zones are hot/cold) so the AI could say "the northeast quadrant of AmbroseValley has 40% of all kills but only 15% of the map area — this is a chokepoint worth investigating." That's the real value: spatial reasoning, not just counting.

The AI is behind an optional API key gate (Groq/OpenAI/Claude) with a Skip button. The tool is 100% functional without it. I didn't want the AI to be a gimmick that blocks usage.

---

## Assumptions & Ambiguity

| What I encountered | What I decided |
|-------------------|----------------|
| Timestamps show 1970-01-21 dates | Epoch-based match-relative time (~1.77B ms). Used for ordering within matches only. Actual dates from folder names |
| Files have no `.parquet` extension | Treated all non-hidden files as parquet. pyarrow reads by file header, not extension |
| February 14 is a partial day (79 files vs 437 for Feb 10) | Included as-is. The tool naturally shows fewer matches for this date |
| 3 human Kill events in 5 days | Not a data error — LILA BLACK is an extraction shooter. PvP is rare by design. Adjusted all analysis to focus on BotKill as primary combat metric |
| Position sampling rate is unknown | Assumed game-server-side sampling. Downsampled further (every 3rd) for web. Visual path accuracy verified manually |
| GrandRift minimap is 2160×2158 (not square) | Resized to 1024×1024. The 2px height difference is imperceptible |

---

## Major Tradeoffs

| Decision | Considered | Chose | Why |
|----------|-----------|-------|-----|
| One JSON vs per-map | Single file simpler to manage | Per-map files | Users only download what they need. AmbroseValley users don't wait for Lockdown data |
| SVG vs Canvas | SVG gives free interactivity (hover, click) | Canvas | 28K+ points. Canvas draws in one pass. SVG would create 28K DOM nodes |
| Library heatmap vs custom | heatmap.js is battle-tested | Custom 60-line grid | Zero dependency, full control, lighter payload. For a 32×32 grid, a library is overkill |
| Backend vs static | Backend enables real-time queries | Static JSON | Fixed data dump. Static = free hosting, no maintenance, no failure points |
| AI bundled vs optional | Bundled AI is a smoother UX | Optional with Skip | No cost to evaluators. Tool works fully without API key. Respects user choice |
| Strict vs flexible player filter | Simple on/off toggle | Contains + Exclusive modes | Both modes serve different analysis needs. Toggle appears contextually |

---

## What I'd Build Next

Given more time, in priority order:

1. **Side-by-side match comparison** — "Why did this match have 12 kills and this one had 2 on the same map?" Place two canvas views next to each other with synced timeline
2. **Storm path visualization** — Overlay the storm's progression on the map. Correlate storm death locations with storm timing to identify zones where extraction is geometrically impossible
3. **Player retention funnel** — Entry → Loot → Combat → Extract/Die. Show where in this funnel players drop off per map region
4. **Spatial AI context** — Feed the AI analyst heatmap grid data, not just event counts, enabling spatial reasoning about map zones
5. **Per-weapon kill analysis** — If weapon data were added to the telemetry, overlay weapon effectiveness by zone to inform cover placement

---

## Time Spent

~10-12 hours total across data exploration, architecture decisions, implementation, and iteration. The assignment suggested 10-15 hours. I focused on getting fewer features right rather than more features half-working.

The preprocessing pipeline (parquet → optimized JSON) took about 1 hour. The core visualization (canvas rendering, coordinate mapping, heatmaps) took about 4 hours. Filters, timeline, and UX polish took about 3 hours. The AI analyst and documentation took the remaining time.