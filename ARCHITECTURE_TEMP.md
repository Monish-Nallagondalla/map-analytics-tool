# Architecture

## How I Approached This

The first thing I noticed in the data was that only 3 human players killed another human in 796 matches across 5 days. Three. That single number told me more about LILA BLACK than the entire README. This is not a deathmatch. PvP is a rare, high stakes event. The primary combat loop is human vs bot (2,415 bot kills). Any tool I build that treats kills as the main story would be telling the wrong story.

That realization shaped my entire approach. I was not building a generic analytics dashboard. I was building a tool that answers the question every Level Designer asks after a map goes live: "Did players use my map the way I intended?"

I used Claude and ChatGPT as implementation tools throughout this project. Every product decision, feature prioritization, and UX choice was mine. I decided what to build and why. The AI helped me write code faster, the same way a PM works with an engineering team.

## My Process

**Step 1: Understand the data before touching code.**

I wrote exploration scripts to understand what I was working with. The stats surprised me immediately.

Only 3 human PvP kills in 796 matches across 5 days. 2,415 bot kills. 39 storm deaths, all humans, zero bots. These numbers told me LILA BLACK is not a deathmatch game. It is an extraction shooter where the primary combat experience is human vs bot, and the storm is a late game threat that catches humans but never bots.

If I had built a generic kill heatmap without understanding this, it would have shown an almost empty map. The data forced me to rethink what "combat" means in this game.

**Step 2: Think about the Level Designer's daily workflow.**

I put myself in their shoes. They open their map editor, they have placed buildings, cover, loot spawns, extraction points. Now they need answers:

"I placed a high value loot spawn in the northeast corner. Are players actually going there?"
"That chokepoint I designed between buildings. Is it creating interesting fights or just frustration?"
"There is a whole section of the map I spent weeks on. Is anyone even visiting it?"
"The storm is supposed to create urgency. Are players dying to it because the layout makes escape impossible from certain zones?"

Every feature I built maps to one of these questions.

**Step 3: Explore the data, then decide what to visualize.**

I ran analysis scripts on the processed data and found patterns that directly inform level design. 55 to 67 percent of every map is completely unused. Storm deaths cluster in specific quadrants. Bots and humans have moderate path correlation but distinct patterns. These findings shaped which visualizations I prioritized and how I designed the heatmap modes.

**Step 4: Build, test, iterate on UX.**

I tested every feature myself. When bot paths were invisible on the map, I changed the color. When kill markers and death markers looked too similar, I redesigned them with distinct shapes and colors. When the toggle switches did not respond to clicks, I fixed the CSS layering. When the timeline showed 0:00/0:00, I debugged the timestamp math. Every fix came from actually using the tool and noticing what did not work.

## Tech Stack

| Layer | What I Chose | Why |
|-------|-------------|-----|
| Frontend | React + Vite | I needed 12+ interdependent filter states. React handles complex state well. Vite is fast for iteration |
| Rendering | HTML5 Canvas | 28K+ data points per map. SVG would create thousands of DOM nodes. Canvas draws everything in one pass |
| Heatmap | Custom canvas grid with CSS blur | Zero external dependencies. 60 lines of code. Full control over color ramps and grid resolution |
| Data Pipeline | Python (pyarrow + Pillow) to static JSON | Parquet to JSON runs once. No backend server needed. Static files on a CDN are free and fast |
| AI Analyst | Multi provider LLM (Groq, OpenAI, Claude) | Optional chat panel. Works without it. I added this because of my AI engineering background and I believe the future of analytics tools is conversational |
| Hosting | Vercel | Free tier, zero config, instant shareable URL |

## Data Flow

The pipeline runs in two stages.

**Preprocessing (runs once locally):**

1,243 parquet files across 5 day folders go into preprocess.py. It reads every file, decodes the event bytes column to strings, detects bots by checking if user_id is a UUID or numeric, converts world coordinates (x, z) to UV normalized (0 to 1) range, and resizes minimap images to 1024x1024 for web delivery.

optimize.py then downsamples Position events (keeps every 3rd) while preserving all combat, loot, and storm events at full fidelity. This reduced AmbroseValley from 10.4MB to 4.2MB without losing path accuracy.

Output is per map JSON files. The frontend loads only the map you are viewing.

**Frontend (React app):**

On load, it fetches matches.json and config.json. When you select a map, it loads that map's JSON. All filtering happens in memory. No network calls after initial load. Canvas renders paths first, then heatmap overlay, then event markers on top.

## Coordinate Mapping

This was the part they flagged as tricky, and it was.

The README provides scale and origin values per map. The conversion:
u = (x - origin_x) / scale
v = 1 - ((z - origin_z) / scale)

Then pixel_x = u * canvas_width, pixel_y = v * canvas_height.

Three things I caught that could easily go wrong:

**1. The y column is not map Y.** The data has x, y, z columns. The y column is elevation (vertical height in the 3D world). For 2D minimap plotting you use only x and z. Using y would place every point incorrectly and it would look plausible enough that you might not notice.

**2. Minimap images are not 1024x1024.** The README states 1024x1024 but actual sizes are AmbroseValley 4320x4320, GrandRift 2160x2158 (not even square), and Lockdown 9000x9000. I convert to UV space during preprocessing so the tool works at any resolution. If LILA ships higher res minimaps tomorrow, zero code changes needed.

**3. I verified the mapping.** Using the sample coordinates from the README (x=-301.45, z=-355.55 on AmbroseValley), my output produces pixel_x=78, pixel_y=890. The README expects exactly that. I also confirmed 100% of all 28,791 AmbroseValley events fall within bounds (u and v between 0 and 1). Zero out of bounds points.

## Features and the User Questions They Answer

| A Level Designer asks | The feature that answers it |
|----------------------|---------------------------|
| Where do fights happen on my map? | Kill Zones heatmap showing BotKill + Kill density with gaussian spread |
| Where does my map fail players? | Death Zones heatmap plus Storm Death markers (cyan diamonds with glow) |
| Am I wasting map space? | Map Usage overlay showing used zones (green) vs dead zones (red) with utilization percentage |
| How does a typical match play out? | Timeline playback with play, pause, reset. Scrub or auto play through a match watching events appear chronologically |
| Do bots go where humans go? | Player type toggles. Turn off humans, see only bot paths. Flip it. Compare visually |
| Show me only bot exclusive matches | Contains vs Exclusive filter mode. Contains shows matches with bots (may include humans). Exclusive shows matches with only bots |
| Find that one match from Tuesday | Match search bar in the header. Type a partial match ID, results appear, click to jump directly to that match on the correct map |
| Just show me kill hotspots, fast | Quick Actions dropdown with preset Level Designer workflows that trigger multiple filters in one click |
| What should I investigate on this map? | AI Analyst chat panel with preset suggestions generated from actual current data |

## The AI Analyst: Why I Built It

I come from an AI engineering background. I have built multi agent LLM systems, RAG pipelines, and conversational AI products. When I looked at this dashboard with 12+ filter controls, I thought: a Level Designer should not need to learn all of these. They should be able to type "where are bots dying on Lockdown?" and get an answer.

The AI analyst is optional. On first load, you can enter a Groq, OpenAI, or Claude API key, or skip entirely. The dashboard works 100% without it.

What the AI does today: it receives current view context (event counts, selected map, player stats) and answers questions. It can also trigger filter changes through structured output.

What I would build with more time: spatial context. Right now the AI sees aggregate counts, not where on the map things happen. With another sprint I would send the heatmap grid data so the AI could say "the SE quadrant has 40% of all kills but only 20% of map area, this is likely a chokepoint." That is the real value and that is where I would take this product next.

## The Contains vs Exclusive Filter: A Small Detail That Matters

When I toggled "Humans OFF, Bots ON," I expected to see only bot matches. Instead I saw matches like 0f169d20 with 1 human and 6 bots. The filter was showing matches that contain bots, not matches that are exclusively bots.

Both behaviors are useful for different analysis. A designer studying bot pathfinding wants exclusive bot matches (no human interference). A designer studying how bots interact with humans wants mixed matches. So I added a toggle between both modes. It only appears when it is relevant.

This is the kind of detail I care about. Not adding features for the sake of features, but noticing when a feature does not behave the way a user would expect and fixing it.

## Assumptions

| What I Encountered | What I Decided |
|-------------------|----------------|
| Timestamps show 1970 dates | Epoch based match relative times. Used for ordering within matches only. Actual dates from folder names |
| Files have no .parquet extension | Treated all non hidden files as parquet. pyarrow reads by file header not extension |
| February 14 is partial (79 files vs 437 for Feb 10) | Included as is. The tool naturally shows fewer matches for this date |
| 3 human kills in 5 days | Not a bug. LILA BLACK is an extraction shooter. PvP is rare by design. Adjusted all analysis to focus on BotKill |
| GrandRift minimap is 2160x2158 (not square) | Resized to 1024x1024. The 2 pixel difference is imperceptible |
| Position sampling rate unknown | Game server pre samples. I downsampled further (every 3rd) for web performance. Verified paths visually |

## Tradeoffs

| Decision | What I Considered | What I Chose | Why |
|----------|------------------|-------------|-----|
| Data loading | Single mega JSON | Per map JSON files | Users only download the map they are viewing |
| Rendering | SVG elements | Canvas | 28K points would create thousands of DOM nodes |
| Heatmap | heatmap.js library | Custom 60 line grid | Zero dependencies, full control, lighter payload |
| Backend | Flask API | Static files, no backend | Fixed data dump. No real time updates needed. Static hosting is free |
| Minimap size | Original (up to 9000px) | Resized to 1024x1024 | 9000px images are 15MB+. 1024 is sufficient for analysis |
| AI integration | Bundled with API key | Optional with skip button | Tool must work without it. No friction for evaluators |

## What I Would Build Next

If I had one more sprint, I would build side by side match comparison. The data shows AmbroseValley averages 3.2 kills per match but some matches have 12+ kills while others have zero. A Level Designer needs to understand why. Placing two matches next to each other with synced timelines would let them see: was it the player count? The loot distribution? The storm timing? Right now they can look at one match at a time. Comparison is where the real design insights live.

Beyond that: storm path visualization (overlaying storm progression on the map), spatial context for the AI analyst (feeding it heatmap grid data instead of just counts), and player retention funnels (entry to loot to combat to extraction).

If this tool were used in production, I would add a comparison mode for A/B testing map changes. When the Level Design team moves a loot spawn or adds an extraction point, they need to compare player behavior before vs after. The tool already loads data by date. Adding a split view showing "Feb 10-11 (before change) vs Feb 12-14 (after change)" with side by side heatmaps would let the team measure the impact of their changes on map utilization, kill distribution, and storm death rates.

## Time

About 10 to 12 hours total. Data exploration and architecture decisions took 2 hours. Core visualization and coordinate mapping took 4 hours. Filters, timeline, and UX iteration took 3 hours. AI analyst and documentation took the rest.

I focused on fewer features done right rather than more features done halfway.