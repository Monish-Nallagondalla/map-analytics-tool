# Insights

Three things I learned about LILA BLACK using the tool I built.

## Insight 1: Bots Have Perfect Storm Awareness. Humans Do Not.

### What caught my eye

While exploring storm death markers across all three maps, I noticed every cyan diamond on the map belonged to a human player. I toggled the player type filter to isolate bots. Zero bot storm deaths. Across all maps, all dates, all 796 matches. Not a single bot has ever died to the storm.

### The evidence

Total storm deaths across all maps: 39. Human storm deaths: 39. Bot storm deaths: 0.

This is not a small sample issue. There are 461 bot session files in the dataset. Bots participate in combat (2,415 BotKill events, 700 BotKilled events). They move around the map (21,712 BotPosition events). They are active participants in matches. But they never die to the storm.

Additionally, storm deaths happen at exactly 100% of match time across all three maps. Players are not dying mid match to storm pressure. They are dying at the very last moment, suggesting the storm closes too fast in the endgame for humans to react.

### What is actionable

This pattern suggests bots have access to storm timing or boundary information that human players do not, or their pathfinding automatically avoids the storm zone. Either way, it creates an asymmetric experience.

**Metrics affected:** Bot believability score, storm death rate, late game player frustration.

**Actionable items:**
1. Add storm vulnerability to bot AI so that a percentage of bots die to storm at rates comparable to humans. This makes bot behavior feel more realistic.
2. Investigate storm pacing in the final 10% of match time. If deaths cluster at 100%, the closing speed may be too aggressive for players to extract safely.
3. Consider adding storm proximity warnings or visual cues that give human players the same awareness bots apparently have.

### Why a Level Designer should care

If bots always escape the storm, they are not creating late game encounters in storm zones. The storm is supposed to force convergence and create tension. But if bots path out perfectly while humans get caught, the storm is only punishing real players. That is a map experience problem, not a player skill problem.

---

## Insight 2: More Than Half of Every Map is Never Visited

### What caught my eye

When I switched the heatmap to Map Usage mode, the red zones (dead space) were immediately striking. On every map, the majority of the surface area has zero player traffic. I expected 20 to 30 percent unused space. The actual numbers are much worse.

### The evidence

Map utilization measured on a 24x24 grid (576 cells per map):

AmbroseValley: 45% utilized. 319 cells (55%) have zero traffic.
GrandRift: 36% utilized. 368 cells (64%) have zero traffic.
Lockdown: 33% utilized. 387 cells (67%) have zero traffic.

Traffic concentration is also extreme. On all three maps, the top 10% of grid cells contain 61 to 66% of all player movement. Players are clustering in a small portion of the available space and ignoring the rest.

Lockdown is the worst case. It is described as a "smaller, close quarters map" but 67% of it is dead space. That means the close quarters experience is happening in only one third of the map.

### What is actionable

**Metrics affected:** Map utilization percentage, player coverage, development ROI on map geometry.

**Actionable items:**
1. Identify the specific dead zones on each map using the Map Usage overlay. Cross reference with loot spawn locations. If there is loot in dead zones, either the loot is not valuable enough or the path to reach it is too risky.
2. On AmbroseValley, loot in low traffic areas accounts for only 38 pickups out of 9,955 total. That means loot placed in dead zones is almost never collected. Consider relocating those spawns to medium traffic areas to pull players into underused parts of the map.
3. For Lockdown specifically, evaluate whether the dead zones are intentionally out of bounds (map boundary geometry) or designed spaces that players are choosing to skip. If the latter, adding points of interest or cover in those areas could distribute player traffic more evenly.

### Why a Level Designer should care

Every dead zone represents design effort that produces zero player experience. If a designer spent time building geometry, placing objects, and lighting an area that nobody visits, that is development time that could have been spent improving the 33 to 45 percent of the map that players actually use. This metric (map utilization percentage) is something a Level Designer can track over time and report to their lead as a concrete measure of map design effectiveness.

---

## Insight 3: Lockdown's NE Quadrant is a Storm Death Trap

### What caught my eye

Storm deaths are rare (39 total across all maps), which makes their distribution significant. When I filtered for storm deaths on Lockdown and looked at the map, the cyan diamonds clustered heavily in one area.

### The evidence

Lockdown has 17 storm deaths. By quadrant:

NE quadrant: 10 deaths (59%)
SW quadrant: 3 deaths (18%)
SE quadrant: 2 deaths (12%)
NW quadrant: 2 deaths (12%)

A sample of 17 storm deaths is small enough that this should be treated as a directional signal, not a definitive conclusion. But the 59% concentration in one quadrant is unlikely to be random (expected even distribution would be 25% per quadrant). With more data, this pattern either confirms or dissolves. Either way, it is worth monitoring.

59% of storm deaths on Lockdown happen in the northeast quadrant. This is not random distribution. For comparison, AmbroseValley's storm deaths split evenly between NW (35%) and SW (35%) with no single quadrant dominating.

None of the Lockdown storm deaths occur near map edges (0% within 10% of border). Players are dying to storm in the interior of the NE quadrant, not at the map boundary. This suggests they are getting caught in the middle of that zone with no viable extraction path when the storm closes.

Cross referencing with kill data: the NE quadrant also contains 2 of Lockdown's top 5 kill zones (cells 13,6 and 12,6 with 130 and 128 traffic events respectively). Players are going to the NE for combat and loot, but the storm catches them before they can extract.

### What is actionable

**Metrics affected:** Storm death rate by zone, NE quadrant survival rate, extraction success rate.

**Actionable items:**
1. Review extraction point placement relative to the NE quadrant. If the nearest extraction is far from this high traffic combat zone, players face an impossible choice between engaging and extracting safely.
2. Consider adding an extraction point closer to the NE zone, or adjusting storm direction/timing to give NE players a viable escape window.
3. Add cover or movement shortcuts (ziplines, tunnels, paths) from the NE quadrant toward the nearest extraction point to reduce travel time under storm pressure.

### Why a Level Designer should care

When 59% of storm deaths happen in one quadrant, the storm is not creating equal pressure across the map. It is punishing players who go to one specific area. If that area also happens to be a high combat, high traffic zone (which the data confirms), then the map is luring players into a location where they are likely to die to environment, not to gameplay. That is a level design problem that can be fixed with extraction point placement or storm pacing adjustments.

---

## How I Found These Insights

I built this tool with the intent that a Level Designer could discover these patterns visually, without writing code. The Map Usage heatmap immediately shows dead zones. The storm death markers with player type filtering reveal the bot immunity pattern. The per quadrant clustering is visible when you zoom into Lockdown with only storm deaths enabled.

I also ran analysis scripts on the processed data to get exact numbers, percentages, and quadrant breakdowns. The tool shows you where to look. The numbers confirm what you see.

The combination of visual exploration and quantitative validation is what makes these insights actionable rather than anecdotal.
