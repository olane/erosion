# Erosion

A hex-tile-based city survival game built with Phaser 3 and TypeScript. The sea constantly erodes the coastline — forcing you to retreat inland while balancing the need for coastal resources.

## Core Concept

**The Tension**: The coast offers fishing, trade, salvage, and defensive depth. But it's disappearing. Every tile has a countdown. Build too far inland and you starve. Build too close to the sea and you drown.

**Erosion Mechanic**: Land tiles adjacent to water gradually degrade through a chain (Rock → Rubble → Grass → Beach → Shallow Water → Deep Water). Buildings on eroded tiles are lost. Sea walls and reinforced foundations can slow it — but nothing stops it forever.

**Time**: Real-time with pause and speed controls. Buildings take time to construct. Resources tick per second of game time.

**Play online:** [olane.github.io/erosion](https://olane.github.io/erosion/)

## Usage

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Click tiles to inspect them. Use the speed/pause UI buttons or press Space to cycle speeds.

## Architecture Notes

- **Map** is stored as a `Map<string, TileData>` keyed by axial coordinate `"q,r"`.
- **Erosion** runs on a fixed interval (configurable in `constants.ts`: `EROSION_CHECK_INTERVAL`). Each tick, every water-adjacent land tile gains erosion progress. When progress hits 100%, the tile degrades one step.
- **Rendering** uses individual `Phaser.GameObjects.Graphics` per tile (drawn as hex polygons). For the current map size (~170 tiles at radius 7), this is fine. At larger maps, a single batched Graphics object or `RenderTexture` would be needed.
- **Coordinates**: Axial (q, r) throughout — stored, neighbors, distances. Converted to pixel space only at render time.
