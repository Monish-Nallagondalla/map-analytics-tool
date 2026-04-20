markdown# Architecture — LILA BLACK Map Analytics

## Tech Stack & Rationale

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite | Fast dev iteration, component model suits complex filter state, Vite gives instant HMR |
| Rendering | HTML5 Canvas | Direct pixel control for paths, markers, and heatmaps on minimap overlay — DOM-based SVG would choke on 28K+ data points |
| Heatmap | Custom canvas grid | Lightweight, no dependency. 32×32 grid with gaussian spread + CSS blur gives smooth visual without pulling in a heavy lib |
| Data format | Pre-processed JSON | Parquet → JSON conversion runs once offline. Frontend loads per-map JSON files on demand — no backend server needed |
| Hosting | Vercel | Zero-config static deploy, free tier, instant shareable URL |
| Preprocessing | Python (pyarrow + Pillow) | Native parquet support, image resizing for minimaps — runs once locally |

## Data Flow
1,243 parquet files (89K events)
↓
preprocess.py (Python)

Reads all files across 5 day folders
Decodes event bytes to strings
Detects bots (numeric user_id vs UUID)
Converts world coords (x, z) → UV (0-1 range)
Groups by map, outputs per-map JSON
Resizes minimaps to 1024×1024
↓
optimize.py
Downsamples Position events (keep every 3rd)
Preserves ALL combat/loot/storm events
Strips elevation data, trims UV precision
Reduces AmbroseValley from 10.4MB → 4.2MB
↓
public/data/
├── AmbroseValley.json (28K events, 4.2MB)
├── GrandRift.json (3K events, 0.4MB)
├── Lockdown.json (9K events, 1.3MB)
├── matches.json (796 match metadata entries)
└── config.json (map configs, dates)
↓
React app loads per-map JSON on demand
Canvas renders paths + markers + heatmap on minimap


## Coordinate Mapping

This was the trickiest part. The README provides world-to-minimap conversion with `scale` and `origin` per map.

**Step 1 — World to UV (0-1 normalized):**
u = (x - origin_x) / scale
v = (z - origin_z) / scale

**Step 2 — UV to pixel (flipped Y for image space):**
pixel_x = u * canvas_width
pixel_y = (1 - v) * canvas_height

**Critical detail:** The `y` column in the data is elevation/height, NOT a 2D coordinate. Only `x` and `z` are used for map plotting. Missing this would place every point incorrectly.

**Critical detail 2:** The README states minimaps are 1024×1024, but actual image sizes differ significantly (AmbroseValley: 4320×4320, Lockdown: 9000×9000). By converting to UV (0-1) space in preprocessing and multiplying by canvas size at render time, the tool works at any resolution. All minimaps are resized to 1024×1024 for consistent web delivery.

The Y-flip `(1 - v)` is applied during preprocessing so the frontend always plots `(u, v)` directly — no coordinate math at render time.

## Assumptions & Ambiguity

| Ambiguity | Assumption Made |
|-----------|----------------|
| Timestamps show 1970-01-21 dates | These are epoch-based match-relative times, not wall-clock. Used for ordering within a match only. Actual dates derived from folder names (February_10 → 2026-02-10) |
| Files have no `.parquet` extension | Treated all files in day folders as parquet — pyarrow reads them correctly |
| Bot detection | README confirms: UUID = human, numeric = bot. Used `-` character check in user_id |
| February 14 partial day | Included as-is, no special handling needed |
| Human Kill events extremely rare (only 3) | PvP is rare in this game — BotKill (2,415) is the primary combat event. Heatmaps and insights focus on bot combat, not PvP |
| Position sampling rate | Events are pre-sampled by the game. Downsampled further (every 3rd) for web performance while maintaining path shape |

## Major Tradeoffs

| Decision | Option A | Option B (Chosen) | Rationale |
|----------|----------|-------------------|-----------|
| Data loading | Single mega JSON | Per-map JSON files | Per-map loads only what's needed. GrandRift users don't download AmbroseValley data |
| Rendering | SVG/DOM elements | Canvas | 28K+ data points would create thousands of DOM nodes. Canvas handles this in a single draw call |
| Heatmap lib | heatmap.js / deck.gl | Custom grid + blur | Zero dependencies, full control over color scale, 50 lines of code vs pulling a 200KB library |
| Backend | Express/Flask API | Static files (no backend) | Data is fixed (5-day dump), no real-time updates needed. Static hosting = free, fast, zero maintenance |
| Minimap resolution | Original sizes (up to 9000px) | Resized to 1024×1024 | 9000px images are 15MB+. 1024px is sufficient for analysis and loads in <1s |
| Position downsampling | Keep all (61K for AmbroseValley) | Keep every 3rd (28K) | Paths still visually accurate, payload drops 60%. Combat events preserved at full fidelity |