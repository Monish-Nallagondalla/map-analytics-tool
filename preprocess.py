"""
LILA BLACK - Data Preprocessor
Reads all parquet files, converts to optimized JSON for web frontend.
Run once: python preprocess.py
"""

import pyarrow.parquet as pq
import pandas as pd
import os
import json
from PIL import Image
from collections import defaultdict

# === CONFIG ===
DATA_ROOT = os.path.join("..", "player_data", "player_data")
OUTPUT_DIR = "public/data"
MINIMAP_OUTPUT = "public/minimaps"
MINIMAP_SIZE = 1024  # resize all minimaps to this

MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

MINIMAP_FILES = {
    "AmbroseValley": "AmbroseValley_Minimap.png",
    "GrandRift":     "GrandRift_Minimap.png",
    "Lockdown":      "Lockdown_Minimap.jpg",
}

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]
DATE_MAP = {
    "February_10": "2026-02-10",
    "February_11": "2026-02-11",
    "February_12": "2026-02-12",
    "February_13": "2026-02-13",
    "February_14": "2026-02-14",
}

# === HELPERS ===

def is_bot(user_id: str) -> bool:
    """Bot user_ids are short numeric strings, humans are UUIDs."""
    return '-' not in user_id

def world_to_uv(x, z, map_id):
    """Convert world coordinates to UV (0-1 range) for minimap overlay."""
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    return round(u, 5), round(1 - v, 5)  # flip v for image space

def ts_to_ms(ts_val):
    """Convert timestamp to integer milliseconds for sorting/playback."""
    if pd.isna(ts_val):
        return 0
    try:
        return int(ts_val.timestamp() * 1000)
    except:
        return 0

# === MAIN ===

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(MINIMAP_OUTPUT, exist_ok=True)

    # 1. Resize minimaps
    print("=== Resizing minimaps ===")
    minimap_src = os.path.join(DATA_ROOT, "minimaps")
    for map_id, filename in MINIMAP_FILES.items():
        src = os.path.join(minimap_src, filename)
        dst = os.path.join(MINIMAP_OUTPUT, f"{map_id}.png")
        img = Image.open(src)
        print(f"  {map_id}: {img.size} -> ({MINIMAP_SIZE}, {MINIMAP_SIZE})")
        img = img.resize((MINIMAP_SIZE, MINIMAP_SIZE), Image.LANCZOS)
        img.save(dst, "PNG")
    print()

    # 2. Read all parquet files
    print("=== Reading parquet files ===")
    all_events = []  # list of dicts
    match_meta = defaultdict(lambda: {
        "map_id": None, "date": None,
        "humans": set(), "bots": set(),
        "event_counts": defaultdict(int),
        "min_ts": float('inf'), "max_ts": 0
    })

    errors = 0
    for day in DAYS:
        day_path = os.path.join(DATA_ROOT, day)
        if not os.path.isdir(day_path):
            continue
        files = [f for f in os.listdir(day_path) if not f.startswith('.')]
        print(f"  {day}: {len(files)} files")

        for fname in files:
            fpath = os.path.join(day_path, fname)
            try:
                df = pq.read_table(fpath).to_pandas()
                df['event'] = df['event'].apply(
                    lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
                )
            except Exception as e:
                errors += 1
                continue

            if df.empty:
                continue

            uid = str(df['user_id'].iloc[0])
            mid_raw = str(df['match_id'].iloc[0])
            # Clean match_id - remove .nakama-0 suffix for cleaner IDs
            mid = mid_raw.replace('.nakama-0', '')
            map_id = str(df['map_id'].iloc[0])
            bot = is_bot(uid)
            date = DATE_MAP.get(day, day)

            # Update match metadata
            meta = match_meta[mid]
            meta["map_id"] = map_id
            meta["date"] = date
            if bot:
                meta["bots"].add(uid)
            else:
                meta["humans"].add(uid)

            for _, row in df.iterrows():
                evt = row['event']
                ts = ts_to_ms(row['ts'])

                meta["event_counts"][evt] += 1
                meta["min_ts"] = min(meta["min_ts"], ts)
                meta["max_ts"] = max(meta["max_ts"], ts)

                u, v = world_to_uv(row['x'], row['z'], map_id)

                all_events.append({
                    "mid": mid,
                    "uid": uid,
                    "bot": bot,
                    "evt": evt,
                    "u": u,
                    "v": v,
                    "ts": ts,
                    "y": round(float(row['y']), 1),  # elevation, kept for reference
                })

    print(f"  Total events: {len(all_events)}")
    print(f"  Errors: {errors}")
    print()

    # 3. Build match index
    print("=== Building match index ===")
    matches_index = []
    for mid, meta in match_meta.items():
        matches_index.append({
            "mid": mid,
            "map_id": meta["map_id"],
            "date": meta["date"],
            "humans": len(meta["humans"]),
            "bots": len(meta["bots"]),
            "events": dict(meta["event_counts"]),
            "duration_ms": meta["max_ts"] - meta["min_ts"] if meta["max_ts"] > meta["min_ts"] else 0,
        })

    # Sort by date then match id
    matches_index.sort(key=lambda m: (m["date"], m["mid"]))
    print(f"  Total matches: {len(matches_index)}")

    # Count per map
    map_counts = defaultdict(int)
    for m in matches_index:
        map_counts[m["map_id"]] += 1
    for map_id, count in map_counts.items():
        print(f"  {map_id}: {count} matches")
    print()

    # 4. Split events by map and write JSON
    print("=== Writing output files ===")

    # Write match index
    with open(os.path.join(OUTPUT_DIR, "matches.json"), 'w') as f:
        json.dump(matches_index, f)
    print(f"  matches.json ({len(matches_index)} matches)")

    # Group events by map
    events_by_map = defaultdict(list)
    for evt in all_events:
        map_id = None
        for m in matches_index:
            if m["mid"] == evt["mid"]:
                map_id = m["map_id"]
                break
        if map_id:
            events_by_map[map_id].append(evt)

    # This grouping is slow - optimize with a lookup dict
    mid_to_map = {m["mid"]: m["map_id"] for m in matches_index}
    events_by_map = defaultdict(list)
    for evt in all_events:
        map_id = mid_to_map.get(evt["mid"])
        if map_id:
            events_by_map[map_id].append(evt)

    for map_id, events in events_by_map.items():
        # Sort by match then timestamp
        events.sort(key=lambda e: (e["mid"], e["ts"]))
        outpath = os.path.join(OUTPUT_DIR, f"{map_id}.json")
        with open(outpath, 'w') as f:
            json.dump(events, f)
        size_mb = os.path.getsize(outpath) / (1024 * 1024)
        print(f"  {map_id}.json: {len(events)} events ({size_mb:.1f} MB)")

    # 5. Write map config for frontend
    with open(os.path.join(OUTPUT_DIR, "config.json"), 'w') as f:
        json.dump({
            "maps": list(MAP_CONFIG.keys()),
            "mapConfig": MAP_CONFIG,
            "dates": list(DATE_MAP.values()),
        }, f)
    print(f"  config.json")

    print("\n=== Done! ===")
    print(f"Output in: {OUTPUT_DIR}/")
    print(f"Minimaps in: {MINIMAP_OUTPUT}/")


if __name__ == "__main__":
    main()
    