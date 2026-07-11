import Phaser from 'phaser';
import { hexKey, getHexVertices, getNeighbors } from './HexUtils.ts';
import {
  TileType,
  TILE_CONFIGS,
  EROSION_TRANSITION,
  Zone,
  ZONE_TILES,
} from '../data/tiles.ts';
import { MAP_RADIUS, HEX_SIZE, SEA_LEVEL } from '../constants.ts';
import type { AxialCoords } from './HexUtils.ts';

export interface TileData {
  q: number;
  r: number;
  tileType: TileType;
  zone: Zone;
  erosionProgress: number;
  buildingId: string | null;
  graphics: Phaser.GameObjects.Graphics;
}

export class GameMap {
  tiles: Map<string, TileData> = new Map();
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  onTileSelect: ((info: string) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.generate();
    this.render();
  }

  generate(): void {
    this.tiles.clear();

    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
      const rMin = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
      const rMax = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
      for (let r = rMin; r <= rMax; r++) {
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
        const key = hexKey(q, r);

        const coastRing = MAP_RADIUS - SEA_LEVEL;

        let zone: Zone;
        let tileType: TileType;

        if (dist > coastRing) {
          zone = Zone.OCEAN;
          tileType = TileType.WATER;
        } else if (dist === coastRing) {
          zone = Zone.COAST;
          tileType = this.pickTileType(zone);
        } else if (dist >= coastRing - 2) {
          zone = Zone.LOWLAND;
          tileType = this.pickTileType(zone);
        } else if (dist >= 1) {
          zone = Zone.HIGHLAND;
          tileType = this.pickTileType(zone);
        } else {
          zone = Zone.PEAK;
          tileType = TileType.ROCK;
        }

        this.tiles.set(key, {
          q,
          r,
          tileType,
          zone,
          erosionProgress: 0,
          buildingId: null,
          graphics: null as unknown as Phaser.GameObjects.Graphics,
        });
      }
    }
  }

  private pickTileType(zone: Zone): TileType {
    const options = ZONE_TILES[zone];
    return options[Math.floor(Math.random() * options.length)];
  }

  private render(): void {
    const hexBorder = 0x333333;
    const hexBorderAlpha = 0.4;

    for (const [, tile] of this.tiles) {
      const gfx = this.scene.add.graphics();
      this.drawHex(gfx, tile.q, tile.r, tile.tileType, hexBorder, hexBorderAlpha);
      const { x, y } = this.axialToWorld(tile.q, tile.r);
      gfx.setInteractive(
        new Phaser.Geom.Polygon(
          getHexVertices(x, y, HEX_SIZE - 1).flatMap((v) => [v.x, v.y]),
        ),
        Phaser.Geom.Polygon.Contains,
      );
      gfx.on('pointerover', () => {
        gfx.setAlpha(0.8);
      });
      gfx.on('pointerout', () => {
        gfx.setAlpha(1);
      });
      gfx.on('pointerdown', () => {
        this.onTileClick(tile.q, tile.r);
      });
      tile.graphics = gfx;
      this.container.add(gfx);
    }
  }

  private drawHex(
    gfx: Phaser.GameObjects.Graphics,
    q: number,
    r: number,
    tileType: TileType,
    borderColor: number,
    borderAlpha: number,
  ): void {
    const config = TILE_CONFIGS[tileType];
    const { x, y } = this.axialToWorld(q, r);
    const vertices = getHexVertices(x, y, HEX_SIZE);

    gfx.clear();
    gfx.fillStyle(config.color, 1);
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) {
      gfx.lineTo(vertices[i].x, vertices[i].y);
    }
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(1, borderColor, borderAlpha);
    gfx.beginPath();
    gfx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) {
      gfx.lineTo(vertices[i].x, vertices[i].y);
    }
    gfx.closePath();
    gfx.strokePath();
  }

  axialToWorld(q: number, r: number): { x: number; y: number } {
    const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = HEX_SIZE * ((3 / 2) * r);
    return { x, y };
  }

  refreshTile(q: number, r: number): void {
    const key = hexKey(q, r);
    const tile = this.tiles.get(key);
    if (!tile) return;

    const hexBorder = tile.erosionProgress > 0 ? 0xff4444 : 0x333333;
    const hexBorderAlpha = tile.erosionProgress > 0 ? 0.8 : 0.4;
    this.drawHex(tile.graphics, q, r, tile.tileType, hexBorder, hexBorderAlpha);

    if (tile.erosionProgress > 0) {
      const pct = tile.erosionProgress / 100;
      tile.graphics.fillStyle(0xff0000, pct * 0.3);
      const { x, y } = this.axialToWorld(q, r);
      const vertices = getHexVertices(x, y, HEX_SIZE);
      tile.graphics.beginPath();
      tile.graphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < 6; i++) tile.graphics.lineTo(vertices[i].x, vertices[i].y);
      tile.graphics.closePath();
      tile.graphics.fillPath();
    }
  }

  getErodibleNeighbors(q: number, r: number): TileData[] {
    const neighbors = getNeighbors(q, r);
    const result: TileData[] = [];
    for (const n of neighbors) {
      const key = hexKey(n.q, n.r);
      const tile = this.tiles.get(key);
      if (tile && TILE_CONFIGS[tile.tileType].erodible) {
        result.push(tile);
      }
    }
    return result;
  }

  getWaterNeighbors(q: number, r: number): TileData[] {
    const neighbors = getNeighbors(q, r);
    const result: TileData[] = [];
    for (const n of neighbors) {
      const key = hexKey(n.q, n.r);
      const tile = this.tiles.get(key);
      if (
        tile &&
        (tile.tileType === TileType.WATER ||
          tile.tileType === TileType.SHALLOW_WATER)
      ) {
        result.push(tile);
      }
    }
    return result;
  }

  isCoastal(q: number, r: number): boolean {
    return this.getWaterNeighbors(q, r).length > 0;
  }

  private onTileClick(q: number, r: number): void {
    const key = hexKey(q, r);
    const tile = this.tiles.get(key);
    if (!tile) return;

    const config = TILE_CONFIGS[tile.tileType];
    const coastal = this.isCoastal(q, r);
    const info =
      `(${q},${r}) ${config.name}  |  ` +
      `Erosion ${tile.erosionProgress.toFixed(0)}%  |  ` +
      `${coastal ? 'Coastal' : 'Inland'}  |  ` +
      `Food ${config.foodYield}  Mat ${config.materialYield}`;
    // eslint-disable-next-line no-console
    console.log(info);
    if (this.onTileSelect) this.onTileSelect(info);
  }

  centerPosition(): { x: number; y: number } {
    return this.axialToWorld(0, 0);
  }

  worldPixelBounds(): { x: number; y: number; width: number; height: number } {
    const corners = [
      this.axialToWorld(-MAP_RADIUS, 0),
      this.axialToWorld(MAP_RADIUS, 0),
      this.axialToWorld(0, -MAP_RADIUS),
      this.axialToWorld(0, MAP_RADIUS),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const pad = HEX_SIZE * 2;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
