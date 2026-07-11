# Erosion

A hex-tile-based city survival game built with Phaser 3 and TypeScript. The sea constantly erodes the coastline — forcing you to retreat inland while balancing the need for coastal resources.

## Core Concept

**The Tension**: The coast offers fishing, trade, salvage, and defensive depth. But it's disappearing. Every tile has a countdown. Build too far inland and you starve. Build too close to the sea and you drown.

**Erosion Mechanic**: Land tiles adjacent to water gradually degrade through a chain (Rock → Rubble → Grass → Beach → Shallow Water → Deep Water). Buildings on eroded tiles are lost. Sea walls and reinforced foundations can slow it — but nothing stops it forever.

**Time**: Real-time with pause and speed controls (0x, 1x, 2x, 4x). Buildings take time to construct. Resources tick per second of game time.

## Tech Stack

| Layer | Choice |
|---|---|
| Rendering | **Phaser 3** (WebGL/Canvas 2D game framework) |
| Language | **TypeScript** |
| Build | **Vite** (zero-config, fast HMR) |
| Grid | **Pointy-top hexagons** using axial coordinates |
| State | Plain TypeScript objects — no ECS library needed yet |
| UI | Phaser text objects overlaid on the canvas |

## Project Structure

```
src/
  main.ts              Entry point, Phaser config
  constants.ts         Tile size, map radius, erosion timings
  scenes/
    GameScene.ts       Main game scene — wires everything together
  map/
    HexUtils.ts        Hex math: axial coords, pixel conversion, neighbors, rings
    GameMap.ts         Grid state, tile data, rendering, click handling
  systems/
    TimeSystem.ts      Game clock with pause/speed controls
    ErosionSystem.ts   Periodic erosion tick — checks water-adjacent tiles
  data/
    tiles.ts           Tile types, colors, yields, erosion transitions
  ui/
    GameUI.ts          HUD: day counter, speed/pause controls
```

## Usage

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Click tiles to inspect them. Use the speed/pause UI buttons or press Space to cycle speeds.

## Architecture Notes

- **Map** is stored as a `Map<string, TileData>` keyed by axial coordinate `"q,r"`. No 2D array — axial coordinates make neighbor math trivial.
- **Erosion** runs on a fixed interval (configurable in `constants.ts`: `EROSION_CHECK_INTERVAL`). Each tick, every water-adjacent land tile gains erosion progress. When progress hits 100%, the tile degrades one step.
- **Rendering** uses individual `Phaser.GameObjects.Graphics` per tile (drawn as hex polygons). For the current map size (~170 tiles at radius 7), this is fine. At larger maps, a single batched Graphics object or `RenderTexture` would be needed.
- **Coordinates**: Axial (q, r) throughout — stored, neighbors, distances. Converted to pixel space only at render time.
