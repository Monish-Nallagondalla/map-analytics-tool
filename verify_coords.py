"""
Verify coordinate mapping using the README's sample data point.
"""

# README example: AmbroseValley, x=-301.45, z=-355.55
# Expected from README: pixel_x=78, pixel_y=890 (at 1024x1024)

MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

# Test with README sample
x, z = -301.45, -355.55
cfg = MAP_CONFIG["AmbroseValley"]

u = (x - cfg["origin_x"]) / cfg["scale"]
v = (z - cfg["origin_z"]) / cfg["scale"]
v_flipped = 1 - v

pixel_x = u * 1024
pixel_y = v_flipped * 1024

print("=== Coordinate Verification ===")
print(f"\nInput: x={x}, z={z} on AmbroseValley")
print(f"Config: scale={cfg['scale']}, origin=({cfg['origin_x']}, {cfg['origin_z']})")
print(f"\nStep 1 — UV:")
print(f"  u = ({x} - {cfg['origin_x']}) / {cfg['scale']} = {u:.4f}")
print(f"  v = ({z} - {cfg['origin_z']}) / {cfg['scale']} = {v:.4f}")
print(f"  v_flipped = 1 - {v:.4f} = {v_flipped:.4f}")
print(f"\nStep 2 — Pixel (1024x1024):")
print(f"  pixel_x = {u:.4f} * 1024 = {pixel_x:.0f}")
print(f"  pixel_y = {v_flipped:.4f} * 1024 = {pixel_y:.0f}")
print(f"\nREADME expected: pixel_x=78, pixel_y=890")
print(f"Our result:      pixel_x={pixel_x:.0f}, pixel_y={pixel_y:.0f}")
print(f"Match: {'✓ YES' if abs(pixel_x - 78) < 2 and abs(pixel_y - 890) < 2 else '✗ NO'}")

# Also verify with actual data from our JSON
import json, os
data = json.load(open(os.path.join("public", "data", "AmbroseValley.json")))

# Find the coordinate ranges to sanity check
u_vals = [e["u"] for e in data]
v_vals = [e["v"] for e in data]
print(f"\n=== Data Sanity Check (AmbroseValley) ===")
print(f"UV ranges:")
print(f"  u: {min(u_vals):.4f} to {max(u_vals):.4f}")
print(f"  v: {min(v_vals):.4f} to {max(v_vals):.4f}")

in_bounds = sum(1 for e in data if 0 <= e["u"] <= 1 and 0 <= e["v"] <= 1)
out_bounds = len(data) - in_bounds
print(f"  In bounds (0-1): {in_bounds}/{len(data)} ({in_bounds/len(data)*100:.1f}%)")
print(f"  Out of bounds: {out_bounds}")

if out_bounds > 0:
    oob = [e for e in data if e["u"] < 0 or e["u"] > 1 or e["v"] < 0 or e["v"] > 1]
    print(f"  Sample OOB points:")
    for e in oob[:3]:
        print(f"    u={e['u']:.4f}, v={e['v']:.4f}, evt={e['evt']}")