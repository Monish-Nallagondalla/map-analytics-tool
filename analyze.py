"""
LILA BLACK — Deep Data Analysis
Run once to extract insights for INSIGHTS.md
"""
import json
import os
from collections import defaultdict

DATA_DIR = "public/data"

# Load all data
print("Loading data...")
matches = json.load(open(os.path.join(DATA_DIR, "matches.json")))
maps_data = {}
for m in ["AmbroseValley", "GrandRift", "Lockdown"]:
    path = os.path.join(DATA_DIR, f"{m}.json")
    if os.path.exists(path):
        maps_data[m] = json.load(open(path))

print(f"Loaded {len(matches)} matches across {len(maps_data)} maps\n")

# =============================================
# 1. MAP OVERVIEW
# =============================================
print("=" * 60)
print("1. MAP OVERVIEW")
print("=" * 60)
for map_name, events in maps_data.items():
    map_matches = [m for m in matches if m["map_id"] == map_name]
    evt_counts = defaultdict(int)
    players = set()
    bots = set()
    for e in events:
        evt_counts[e["evt"]] += 1
        if e["bot"]:
            bots.add(e["uid"])
        else:
            players.add(e["uid"])

    print(f"\n--- {map_name} ---")
    print(f"  Matches: {len(map_matches)}")
    print(f"  Total events: {len(events)}")
    print(f"  Unique humans: {len(players)}")
    print(f"  Unique bots: {len(bots)}")
    print(f"  Events breakdown:")
    for evt, count in sorted(evt_counts.items(), key=lambda x: -x[1]):
        print(f"    {evt}: {count}")

    # Kills per match
    kills = evt_counts.get("Kill", 0) + evt_counts.get("BotKill", 0)
    deaths = evt_counts.get("Killed", 0) + evt_counts.get("BotKilled", 0) + evt_counts.get("KilledByStorm", 0)
    print(f"  Kills per match avg: {kills / max(len(map_matches), 1):.1f}")
    print(f"  Deaths per match avg: {deaths / max(len(map_matches), 1):.1f}")
    print(f"  Loot per match avg: {evt_counts.get('Loot', 0) / max(len(map_matches), 1):.1f}")
    print(f"  Storm deaths total: {evt_counts.get('KilledByStorm', 0)}")

# =============================================
# 2. MAP UTILIZATION (% of map actually used)
# =============================================
print("\n" + "=" * 60)
print("2. MAP UTILIZATION")
print("=" * 60)
GRID = 24
for map_name, events in maps_data.items():
    grid = [[0] * GRID for _ in range(GRID)]
    pos_events = [e for e in events if e["evt"] in ("Position", "BotPosition")]

    for e in pos_events:
        gx = min(GRID - 1, max(0, int(e["u"] * GRID)))
        gy = min(GRID - 1, max(0, int(e["v"] * GRID)))
        grid[gy][gx] += 1

    used = sum(1 for row in grid for v in row if v > 0)
    total = GRID * GRID
    pct = (used / total) * 100

    # Find dead zones (zero traffic cells)
    dead_zones = []
    for y in range(GRID):
        for x in range(GRID):
            if grid[y][x] == 0:
                dead_zones.append((x, y))

    # Find hottest cells
    flat = [(grid[y][x], x, y) for y in range(GRID) for x in range(GRID)]
    flat.sort(reverse=True)
    top5 = flat[:5]

    # Concentration: what % of traffic is in top 10% of cells
    all_vals = sorted([grid[y][x] for y in range(GRID) for x in range(GRID)], reverse=True)
    top10_cells = max(1, total // 10)
    top10_traffic = sum(all_vals[:top10_cells])
    total_traffic = sum(all_vals)
    concentration = (top10_traffic / max(total_traffic, 1)) * 100

    print(f"\n--- {map_name} ---")
    print(f"  Map utilization: {pct:.0f}% ({used}/{total} grid cells visited)")
    print(f"  Dead zones: {len(dead_zones)} cells ({len(dead_zones) / total * 100:.0f}% of map)")
    print(f"  Traffic concentration: top 10% of cells contain {concentration:.0f}% of all movement")
    print(f"  Hottest cells (grid x,y → traffic count):")
    for val, x, y in top5:
        quadrant = ""
        if x < GRID // 2 and y < GRID // 2:
            quadrant = "NW"
        elif x >= GRID // 2 and y < GRID // 2:
            quadrant = "NE"
        elif x < GRID // 2 and y >= GRID // 2:
            quadrant = "SW"
        else:
            quadrant = "SE"
        print(f"    ({x},{y}) {quadrant}: {val} events")

# =============================================
# 3. STORM DEATH ANALYSIS
# =============================================
print("\n" + "=" * 60)
print("3. STORM DEATH ANALYSIS")
print("=" * 60)
for map_name, events in maps_data.items():
    storm = [e for e in events if e["evt"] == "KilledByStorm"]
    if not storm:
        print(f"\n--- {map_name}: No storm deaths ---")
        continue

    print(f"\n--- {map_name}: {len(storm)} storm deaths ---")

    # Location clustering
    for e in storm:
        quadrant = ""
        if e["u"] < 0.5 and e["v"] < 0.5:
            quadrant = "NW"
        elif e["u"] >= 0.5 and e["v"] < 0.5:
            quadrant = "NE"
        elif e["u"] < 0.5 and e["v"] >= 0.5:
            quadrant = "SW"
        else:
            quadrant = "SE"
        e["quadrant"] = quadrant

    quad_counts = defaultdict(int)
    for e in storm:
        quad_counts[e["quadrant"]] += 1
    print(f"  By quadrant:")
    for q, c in sorted(quad_counts.items(), key=lambda x: -x[1]):
        print(f"    {q}: {c} ({c / len(storm) * 100:.0f}%)")

    # UV ranges
    u_vals = [e["u"] for e in storm]
    v_vals = [e["v"] for e in storm]
    print(f"  U range: {min(u_vals):.3f} - {max(u_vals):.3f}")
    print(f"  V range: {min(v_vals):.3f} - {max(v_vals):.3f}")

    # Are storm deaths near edges?
    edge_count = sum(1 for e in storm if e["u"] < 0.1 or e["u"] > 0.9 or e["v"] < 0.1 or e["v"] > 0.9)
    print(f"  Near map edge (<10% from border): {edge_count}/{len(storm)} ({edge_count / len(storm) * 100:.0f}%)")

    # Bot vs human storm deaths
    bot_storm = sum(1 for e in storm if e["bot"])
    human_storm = sum(1 for e in storm if not e["bot"])
    print(f"  Human storm deaths: {human_storm}")
    print(f"  Bot storm deaths: {bot_storm}")

# =============================================
# 4. BOT VS HUMAN PATH DIVERGENCE
# =============================================
print("\n" + "=" * 60)
print("4. BOT VS HUMAN PATH DIVERGENCE")
print("=" * 60)
for map_name, events in maps_data.items():
    human_grid = [[0] * GRID for _ in range(GRID)]
    bot_grid = [[0] * GRID for _ in range(GRID)]

    for e in events:
        if e["evt"] not in ("Position", "BotPosition"):
            continue
        gx = min(GRID - 1, max(0, int(e["u"] * GRID)))
        gy = min(GRID - 1, max(0, int(e["v"] * GRID)))
        if e["bot"]:
            bot_grid[gy][gx] += 1
        else:
            human_grid[gy][gx] += 1

    # Cells where only humans go
    human_only = sum(1 for y in range(GRID) for x in range(GRID) if human_grid[y][x] > 0 and bot_grid[y][x] == 0)
    bot_only = sum(1 for y in range(GRID) for x in range(GRID) if bot_grid[y][x] > 0 and human_grid[y][x] == 0)
    both = sum(1 for y in range(GRID) for x in range(GRID) if bot_grid[y][x] > 0 and human_grid[y][x] > 0)
    neither = sum(1 for y in range(GRID) for x in range(GRID) if bot_grid[y][x] == 0 and human_grid[y][x] == 0)

    print(f"\n--- {map_name} ---")
    print(f"  Both visit: {both} cells ({both / (GRID * GRID) * 100:.0f}%)")
    print(f"  Human only: {human_only} cells ({human_only / (GRID * GRID) * 100:.0f}%)")
    print(f"  Bot only: {bot_only} cells ({bot_only / (GRID * GRID) * 100:.0f}%)")
    print(f"  Neither: {neither} cells ({neither / (GRID * GRID) * 100:.0f}%)")

    # Correlation: do bots and humans cluster in the same places?
    human_vals = [human_grid[y][x] for y in range(GRID) for x in range(GRID)]
    bot_vals = [bot_grid[y][x] for y in range(GRID) for x in range(GRID)]
    # Simple correlation
    n = len(human_vals)
    h_mean = sum(human_vals) / n
    b_mean = sum(bot_vals) / n
    cov = sum((human_vals[i] - h_mean) * (bot_vals[i] - b_mean) for i in range(n)) / n
    h_std = (sum((v - h_mean) ** 2 for v in human_vals) / n) ** 0.5
    b_std = (sum((v - b_mean) ** 2 for v in bot_vals) / n) ** 0.5
    corr = cov / (h_std * b_std) if h_std > 0 and b_std > 0 else 0
    print(f"  Path correlation (human vs bot density): {corr:.3f}")
    if corr > 0.7:
        print(f"  → HIGH correlation: bots follow human routes closely")
    elif corr > 0.4:
        print(f"  → MODERATE correlation: some overlap but distinct patterns")
    else:
        print(f"  → LOW correlation: bots and humans use different areas")

# =============================================
# 5. KILL ZONE ANALYSIS
# =============================================
print("\n" + "=" * 60)
print("5. KILL ZONE ANALYSIS")
print("=" * 60)
for map_name, events in maps_data.items():
    kills = [e for e in events if e["evt"] in ("Kill", "BotKill")]
    deaths = [e for e in events if e["evt"] in ("Killed", "BotKilled")]

    if not kills:
        print(f"\n--- {map_name}: No kills ---")
        continue

    kill_grid = [[0] * GRID for _ in range(GRID)]
    for e in kills:
        gx = min(GRID - 1, max(0, int(e["u"] * GRID)))
        gy = min(GRID - 1, max(0, int(e["v"] * GRID)))
        kill_grid[gy][gx] += 1

    # Find kill hotspots
    flat = [(kill_grid[y][x], x, y) for y in range(GRID) for x in range(GRID)]
    flat.sort(reverse=True)
    top_cells = [f for f in flat if f[0] > 0]

    # Concentration
    total_kills = sum(f[0] for f in flat)
    top3_kills = sum(f[0] for f in flat[:3])
    cells_with_kills = len(top_cells)

    print(f"\n--- {map_name}: {len(kills)} kills ---")
    print(f"  Kill spread: {cells_with_kills} cells have at least 1 kill")
    print(f"  Top 3 cells contain: {top3_kills}/{total_kills} kills ({top3_kills / max(total_kills, 1) * 100:.0f}%)")
    print(f"  Top kill zones:")
    for val, x, y in flat[:5]:
        if val == 0:
            break
        q = "NW" if x < GRID // 2 and y < GRID // 2 else "NE" if x >= GRID // 2 and y < GRID // 2 else "SW" if x < GRID // 2 else "SE"
        print(f"    ({x},{y}) {q}: {val} kills")

# =============================================
# 6. LOOT ANALYSIS
# =============================================
print("\n" + "=" * 60)
print("6. LOOT ANALYSIS")
print("=" * 60)
for map_name, events in maps_data.items():
    loot = [e for e in events if e["evt"] == "Loot"]
    pos = [e for e in events if e["evt"] in ("Position", "BotPosition")]

    if not loot:
        print(f"\n--- {map_name}: No loot events ---")
        continue

    loot_grid = [[0] * GRID for _ in range(GRID)]
    pos_grid = [[0] * GRID for _ in range(GRID)]

    for e in loot:
        gx = min(GRID - 1, max(0, int(e["u"] * GRID)))
        gy = min(GRID - 1, max(0, int(e["v"] * GRID)))
        loot_grid[gy][gx] += 1

    for e in pos:
        gx = min(GRID - 1, max(0, int(e["u"] * GRID)))
        gy = min(GRID - 1, max(0, int(e["v"] * GRID)))
        pos_grid[gy][gx] += 1

    # Loot hotspots
    flat = [(loot_grid[y][x], x, y) for y in range(GRID) for x in range(GRID)]
    flat.sort(reverse=True)
    total_loot = sum(f[0] for f in flat)
    top3_loot = sum(f[0] for f in flat[:3])

    print(f"\n--- {map_name}: {len(loot)} loot pickups ---")
    print(f"  Top 3 loot cells: {top3_loot}/{total_loot} ({top3_loot / max(total_loot, 1) * 100:.0f}%)")

    # Are loot hotspots also traffic hotspots?
    loot_cells = [(x, y) for val, x, y in flat[:5] if val > 0]
    for x, y in loot_cells:
        q = "NW" if x < GRID // 2 and y < GRID // 2 else "NE" if x >= GRID // 2 and y < GRID // 2 else "SW" if x < GRID // 2 else "SE"
        traffic = pos_grid[y][x]
        print(f"    ({x},{y}) {q}: {loot_grid[y][x]} loot, {traffic} traffic events — {'HIGH traffic' if traffic > 100 else 'LOW traffic'}")

    # Loot in dead zones (loot exists but minimal traffic)
    loot_in_dead = 0
    for y in range(GRID):
        for x in range(GRID):
            if loot_grid[y][x] > 0 and pos_grid[y][x] < 10:
                loot_in_dead += loot_grid[y][x]
    print(f"  Loot in low-traffic areas (<10 position events): {loot_in_dead}")

# =============================================
# 7. MATCH COMPOSITION ANALYSIS
# =============================================
print("\n" + "=" * 60)
print("7. MATCH COMPOSITION")
print("=" * 60)
for map_name in maps_data:
    map_matches = [m for m in matches if m["map_id"] == map_name]
    human_counts = [m["humans"] for m in map_matches]
    bot_counts = [m["bots"] for m in map_matches]

    solo_human = sum(1 for m in map_matches if m["humans"] == 1 and m["bots"] == 0)
    solo_bot = sum(1 for m in map_matches if m["bots"] > 0 and m["humans"] == 0)
    mixed = sum(1 for m in map_matches if m["humans"] > 0 and m["bots"] > 0)
    multi_human = sum(1 for m in map_matches if m["humans"] > 1)

    print(f"\n--- {map_name}: {len(map_matches)} matches ---")
    print(f"  Solo human (no bots): {solo_human}")
    print(f"  Bot only (no humans): {solo_bot}")
    print(f"  Mixed (humans + bots): {mixed}")
    print(f"  Multi-human matches: {multi_human}")
    print(f"  Avg humans per match: {sum(human_counts) / max(len(human_counts), 1):.1f}")
    print(f"  Avg bots per match: {sum(bot_counts) / max(len(bot_counts), 1):.1f}")
    print(f"  Max humans in one match: {max(human_counts) if human_counts else 0}")
    print(f"  Max bots in one match: {max(bot_counts) if bot_counts else 0}")

# =============================================
# 8. DATE TRENDS
# =============================================
print("\n" + "=" * 60)
print("8. DATE TRENDS")
print("=" * 60)
dates = sorted(set(m["date"] for m in matches))
for d in dates:
    day_matches = [m for m in matches if m["date"] == d]
    total_humans = sum(m["humans"] for m in day_matches)
    total_bots = sum(m["bots"] for m in day_matches)
    maps_played = defaultdict(int)
    for m in day_matches:
        maps_played[m["map_id"]] += 1

    print(f"\n{d}:")
    print(f"  Matches: {len(day_matches)}")
    print(f"  Total human sessions: {total_humans}")
    print(f"  Total bot sessions: {total_bots}")
    print(f"  Maps: {dict(maps_played)}")

# =============================================
# 9. TIMING ANALYSIS (when do events happen in a match?)
# =============================================
print("\n" + "=" * 60)
print("9. MATCH TIMING — When do events happen?")
print("=" * 60)
for map_name, events in maps_data.items():
    # Group by match
    match_events = defaultdict(list)
    for e in events:
        match_events[e["mid"]].append(e)

    kill_pcts = []  # what % through the match do kills happen
    loot_pcts = []
    storm_pcts = []

    for mid, evts in match_events.items():
        if len(evts) < 5:
            continue
        ts_vals = [e["ts"] for e in evts]
        min_ts = min(ts_vals)
        max_ts = max(ts_vals)
        duration = max_ts - min_ts
        if duration == 0:
            continue

        for e in evts:
            pct = (e["ts"] - min_ts) / duration
            if e["evt"] in ("Kill", "BotKill"):
                kill_pcts.append(pct)
            elif e["evt"] == "Loot":
                loot_pcts.append(pct)
            elif e["evt"] == "KilledByStorm":
                storm_pcts.append(pct)

    print(f"\n--- {map_name} ---")
    if kill_pcts:
        avg_kill = sum(kill_pcts) / len(kill_pcts)
        early = sum(1 for p in kill_pcts if p < 0.33) / len(kill_pcts) * 100
        mid = sum(1 for p in kill_pcts if 0.33 <= p < 0.66) / len(kill_pcts) * 100
        late = sum(1 for p in kill_pcts if p >= 0.66) / len(kill_pcts) * 100
        print(f"  Kills timing: avg at {avg_kill * 100:.0f}% of match")
        print(f"    Early (0-33%): {early:.0f}% | Mid (33-66%): {mid:.0f}% | Late (66-100%): {late:.0f}%")
    if loot_pcts:
        avg_loot = sum(loot_pcts) / len(loot_pcts)
        early = sum(1 for p in loot_pcts if p < 0.33) / len(loot_pcts) * 100
        mid = sum(1 for p in loot_pcts if 0.33 <= p < 0.66) / len(loot_pcts) * 100
        late = sum(1 for p in loot_pcts if p >= 0.66) / len(loot_pcts) * 100
        print(f"  Loot timing: avg at {avg_loot * 100:.0f}% of match")
        print(f"    Early (0-33%): {early:.0f}% | Mid (33-66%): {mid:.0f}% | Late (66-100%): {late:.0f}%")
    if storm_pcts:
        avg_storm = sum(storm_pcts) / len(storm_pcts)
        print(f"  Storm deaths timing: avg at {avg_storm * 100:.0f}% of match")
    else:
        print(f"  No storm deaths on this map")

print("\n" + "=" * 60)
print("ANALYSIS COMPLETE")
print("=" * 60)