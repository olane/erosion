# Hex Grids & Axial Coordinates

## Why hexes?

Hex grids have one edge type and one neighbor distance. On a square grid, diagonal neighbors are further away than orthogonal ones — hexes don't have that ambiguity. Every neighbor is the same distance away, and every edge is the same length. This makes movement, adjacency, and area-of-effect calculations uniform.

## The three coordinate systems

There are three common ways to address a hex:

### 1. Offset (column, row)

Like a checkerboard — hexes are arranged in rows, and every other row is shifted half a tile sideways.

```
Row 0:  [0,0] [1,0] [2,0] [3,0]
Row 1:    [0,1] [1,1] [2,1] [3,1]
Row 2:  [0,2] [1,2] [2,2] [3,2]
```

Simple to render and store in a 2D array, but neighbor math is ugly — you need different lookup tables for even and odd rows.

### 2. Axial (q, r)

The one this project uses. Each hex is identified by two coordinates `(q, r)`. A hidden third coordinate `s` is always `-q - r`, so `q + r + s = 0`.

```
       (0,-2)
   (-1,-1) (0,-1) (1,-1)
(-2,0) (-1,0) (0,0) (1,0) (2,0)
   (-1,1) (0,1) (1,1)
       (0,2)
```

Neighbor math becomes dead simple — every neighbor is a constant offset:

```
E:  (+1,  0)
NE: (+1, -1)
NW: ( 0, -1)
W:  (-1,  0)
SW: (-1, +1)
SE: ( 0, +1)
```

### 3. Cube (q, r, s)

Same as axial but you carry all three coordinates explicitly. `q + r + s = 0` always holds. Useful for some algorithms (rounding, distance) but redundant for storage.

## Pixel conversion

To draw hexes, you convert axial to screen coordinates. For **pointy-top** hexes (the ones we use):

```
x = size * (√3 * q  +  √3/2 * r)
y = size * (3/2 * r)
```

To convert a pixel click back to a hex (for mouse interaction):

```
q = (√3/3 * x  -  1/3 * y) / size
r = (2/3 * y) / size
```

Then round the fractional result to the nearest hex.

## Distance

In axial coords, distance is simple:

```
distance = (|dq| + |dr| + |ds|) / 2
```

where `dq = a.q - b.q`, `dr = a.r - b.r`, `ds = -dq - dr`.

For the center hex to ring N, distance = N.

## Why this project uses axial

| Reason | Benefit |
|---|---|
| Neighbors | 6 constant offsets. No conditionals for even/odd. |
| Distances | One formula, always correct. |
| Storage | `Map<"q,r", TileData>` — sparse, easy to serialize. |
| Rings | `getNeighbors()` + distance check gives you circular regions instantly. |
| Erosion | "Is water-adjacent?" = iterate the 6 neighbors, check type. Trivial. |

## The map layout

A hex "ring" is all tiles at distance N from center. Ring 0 is 1 tile, ring 1 is 6 tiles, ring 2 is 12, ring 3 is 18, etc. For a map of radius R, the total tile count is:

```
1 + 6 + 12 + ... + 6R = 3R² + 3R + 1
```

| Radius | Tiles |
|---|---|
| 5 | 91 |
| 6 | 127 |
| 7 | 169 |
| 8 | 217 |
| 10 | 331 |

Our map uses radius 7 → 169 tiles, divided into concentric zones from center outward:

```
Ring 0         PEAK     (1 tile, always rock)
Rings 1-2      HIGHLAND (rock/forest)
Rings 3-4      LOWLAND  (grass/forest)
Ring 5         COAST    (beach)
Rings 6-7      OCEAN    (deep water)
```

Erosion always moves inward — the coast ring degrades to water, exposing the lowland ring as the new coast.
