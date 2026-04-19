"""
Reduce JSON size by:
1. Trimming UV precision to 4 decimal places
2. Downsampling Position/BotPosition events (keep every 3rd position event)
3. Keep ALL combat/loot/storm events (they're rare and important)
"""
import json
import os

DATA_DIR = "public/data"
MAPS = ["AmbroseValley", "GrandRift", "Lockdown"]

for map_name in MAPS:
    path = os.path.join(DATA_DIR, f"{map_name}.json")
    if not os.path.exists(path):
        continue
    
    with open(path, 'r') as f:
        events = json.load(f)
    
    original = len(events)
    
    # Separate position events from important events
    positions = []
    important = []
    for e in events:
        if e["evt"] in ("Position", "BotPosition"):
            positions.append(e)
        else:
            important.append(e)
    
    # Downsample positions: keep every 3rd per player per match
    sampled = []
    counter = {}
    for e in positions:
        key = (e["mid"], e["uid"])
        counter[key] = counter.get(key, 0) + 1
        if counter[key] % 3 == 1:  # keep 1st, 4th, 7th, etc.
            sampled.append(e)
    
    # Recombine and sort
    combined = important + sampled
    combined.sort(key=lambda e: (e["mid"], e["ts"]))
    
    # Trim precision
    for e in combined:
        e["u"] = round(e["u"], 4)
        e["v"] = round(e["v"], 4)
        if "y" in e:
            del e["y"]  # not needed for 2D viz
    
    with open(path, 'w') as f:
        json.dump(combined, f, separators=(',', ':'))
    
    new_size = os.path.getsize(path) / (1024 * 1024)
    print(f"{map_name}: {original} -> {len(combined)} events ({new_size:.1f} MB)")

print("\nDone!")