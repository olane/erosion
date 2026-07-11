# Erosion — Design Plan

## Resources

### Primary Resources

| Resource | Gathered By | Spent On |
|---|---|---|
| **Food** | Farms, Fishing Docks, Advanced Farms | Population consumption (1 / person / day) |
| **Materials** | Quarries, Lumber Camps, Deep Quarries | Building construction costs |
| **Science** | Town Hall, Workshop | Unlocking tech tree nodes |

### Pseudo-Resources

| Resource | Gained By | Lost / Consumed By |
|---|---|---|
| **Population** | Excess food + available housing capacity | Starvation (food = 0), erosion destroying houses |
| **Housing Capacity** | Town Hall (+5), Houses (+5 each) | Erosion destroying Town Hall or Houses |
| **Storage Capacity** | Town Hall (base 100/100), Warehouses (+100 each) | Erosion destroying Town Hall or Warehouses |
| **Workforce** | Derived from Population | Each production building requires 1–2 pop to operate |

---

## Core Loop (per game-day tick)

1. **Consume food** — 1 food per population. If food < pop, food hits 0 and pop declines.
2. **Produce resources** — each active building produces its yield (food / materials / science) based on the tile type it occupies. A building is active only if workforce requirements are met.
3. **Population change** — if food > 0 and pop < housing capacity, pop grows by 1 every ~2 days. If food = 0, pop declines by 1 every ~2 days. If pop = 0, game over (lose condition defined later).
4. **Check workforce** — if total pop < sum of all building pop requirements, disable buildings until requirements are met. Disable priority: newest building first. Disabled buildings produce nothing.
5. **Enforce storage caps** — food and materials above their caps are discarded (overflow lost).
6. **Erosion tick** — existing erosion system runs every 5 real-time seconds. Buildings on eroded tiles are destroyed. Eroded Town Halls, Houses, and Warehouses reduce population/housing/storage caps accordingly.

---

## Tile Types (revised)

Yield is no longer stored on tiles. Tiles carry only physical/gameplay properties.

| Tile | Color | Erodible | Erosion Resist | Buildable |
|---|---|---|---|---|
| Deep Water | `0x1a3a6b` | no | — | no |
| Shallow Water | `0x2b6ca3` | no | — | no |
| Sand | `0xd4c5a9` | yes | 1 | yes |
| Grassland | `0x4a8c3f` | yes | 2 | yes |
| Forest | `0x2d5a1e` | yes | 4 | yes |
| Rocky | `0x6b6b6b` | yes | 8 | yes |
| Rubble | `0x8b7355` | yes | 2 | yes |

### Erosion Transition (unchanged)

```
Rock → Rubble → Sand → Shallow Water → (stops)
Forest → Sand → Shallow Water → (stops)
Grass → Sand → Shallow Water → (stops)
```

---

## Building Types

### Tier 0 (no science unlock)

| Building | Cost (mat) | Pop Req | Pop Cap | Storage | Produces (per day, by tile type) | Notes |
|---|---|---|---|---|---|---|
| **Town Hall** | Free (1 initial) | 0 | 5 | F:100 M:100 | Science: 1 | Anchor building, enables adjacency |
| **Farm** | 10 | 1 | 0 | — | Food: Grass 3, Forest 1, Sand 1 | |
| **Quarry** | 10 | 1 | 0 | — | Materials: Rock 4, Rubble 3 | |
| **Lumber Camp** | 10 | 1 | 0 | — | Materials: Forest 3, Grass 1 | |
| **Fishing Dock** | 15 | 1 | 0 | — | Food: ShallowWater 5, Sand 2 | Must be adjacent to water |
| **House** | 15 | 0 | 5 | — | — | |

### Tier 1 (15 science to unlock each node)

| Building | Cost (mat) | Pop Req | Pop Cap | Storage | Produces (per day, by tile type) | Notes |
|---|---|---|---|---|---|---|
| **Sea Wall** | 20 | 1 | 0 | — | — | Must be coastal. Slows erosion on itself and adjacent tiles. |
| **Workshop** | 20 | 2 | 0 | — | Science: 2 | |
| **Warehouse** | 15 | 1 | 0 | F:+100 M:+100 | — | Stackable |

### Tier 2 (40 science to unlock each node)

| Building | Cost (mat) | Pop Req | Pop Cap | Storage | Effect |
|---|---|---|---|---|---|
| **Lighthouse** | 40 | 2 | 0 | — | Slows erosion on all coastal tiles within radius 3 |
| **Advanced Farm** | 25 | 2 | 0 | — | Food: Grass 5, Forest 2, Sand 2 |
| **Deep Quarry** | 25 | 2 | 0 | — | Materials: Rock 6, Rubble 4 |

---

## Tech Tree

```
Tier 1 (15 science each):
  Coastal Engineering  →  Sea Wall
  Craftsmanship        →  Workshop
  Logistics            →  Warehouse

Tier 2 (40 science each, requires any Tier 1 node unlocked):
  Beacon               →  Lighthouse
  Advanced Agriculture  →  Advanced Farm
  Deep Mining           →  Deep Quarry
```

---

## Population Mechanics

- **Capacity**: Town Hall (+5) + sum of all Houses (+5 each).
- **Requirements**: Each production building has a pop requirement (1–2). These stack.
- **Growth**: While food > 0 and pop < capacity, gain 1 pop every ~2 game-days.
- **Decline**: While food = 0, lose 1 pop every ~2 game-days.
- **Workforce shortfall**: If pop < total building pop requirements, disable the newest building(s) first until requirements are met. Disabled buildings produce nothing. Player sees a warning in the HUD.

---

## Resource Caps & Overflow

- Base storage (Town Hall): 100 food, 100 materials.
- Each Warehouse: +100 food capacity, +100 materials capacity.
- If production would exceed cap, the excess is discarded.
- If erosion destroys a Town Hall or Warehouse, the cap drops. If the cap drops below the current stockpile, the excess is immediately lost.

---

## HUD Additions

- **Resource bar**: current/max food, materials, science.
- **Population**: current / capacity, shown with a workforce indicator (e.g. "pop 8/15, workforce 6/7" or a red warning if short).
- **Tech panel**: available tech nodes, their costs, and a button to unlock.
- **Build panel**: building type cycle (B key), shows cost and pop requirement for each option.
- **Day counter**: already exists, remains.

---

## Implementation Order (rough)

1. Add resource tracking to game state (food, materials, science, pop, caps).
2. Refactor tile configs — remove `foodYield` / `materialYield`.
3. Add yield tables to building configs.
4. Implement daily production/consumption tick (integrate with TimeSystem).
5. Implement population growth/decline mechanics.
6. Implement workforce check and building disable logic.
7. Add new building types and their placement rules.
8. Add tech tree data and unlock logic.
9. Add Sea Wall / Lighthouse erosion reduction to ErosionSystem.
10. Update HUD with resource bar, pop display, tech panel, build costs.
11. Add Fishing Dock adjacency-to-water requirement.
12. Balance pass on all numbers.
