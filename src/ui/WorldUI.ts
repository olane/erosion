import Phaser from 'phaser';
import { HEX_SIZE } from '../constants.ts';
import type { TileIcon } from './types.ts';

export interface BuildCyclerState {
  name: string;
  detail: string;
  valid: boolean;
  costStr: string;
}

export class WorldUI {
  // Selection -> "Build" button.
  onBuildStart: ((q: number, r: number) => void) | null = null;
  // Cycler controls.
  onCyclePrev: (() => void) | null = null;
  onCycleNext: (() => void) | null = null;
  onBuildConfirm: (() => void) | null = null;

  private scene: Phaser.Scene;
  private axialToWorld: (q: number, r: number) => { x: number; y: number };

  private container: Phaser.GameObjects.Container;
  private iconContainer: Phaser.GameObjects.Container;
  private iconGfx: Phaser.GameObjects.Graphics;
  private iconTexts: Phaser.GameObjects.Text[] = [];

  // Shared container for the build button and the build cycler (mutually
  // exclusive states of the same tile selection).
  private buildContainer: Phaser.GameObjects.Container;
  private buildObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    axialToWorld: (q: number, r: number) => { x: number; y: number },
  ) {
    this.scene = scene;
    this.axialToWorld = axialToWorld;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    this.iconContainer = scene.add.container(0, 0);
    this.container.add(this.iconContainer);
    this.iconGfx = scene.add.graphics();
    this.iconContainer.add(this.iconGfx);

    this.buildContainer = scene.add.container(0, 0);
    this.buildContainer.setDepth(101);
  }

  // ---- Tile icons ----

  clearTileIcons(): void {
    this.iconGfx.clear();
    this.iconTexts.forEach((t) => t.destroy());
    this.iconTexts = [];
  }

  showTileIcons(icons: TileIcon[]): void {
    this.clearTileIcons();

    const byTile = new Map<string, TileIcon[]>();
    for (const icon of icons) {
      const key = `${icon.q},${icon.r}`;
      if (!byTile.has(key)) byTile.set(key, []);
      byTile.get(key)!.push(icon);
    }

    const iconR = 11;
    const yOff = -(HEX_SIZE * 0.7);

    for (const [, group] of byTile) {
      const q = group[0].q;
      const r = group[0].r;
      const { x, y } = this.axialToWorld(q, r);

      const totalW = group.length * (iconR * 2 + 2) - 2;
      let cx = x - totalW / 2 + iconR;

      for (const icon of group) {
        this.iconGfx.fillStyle(icon.bgColor, 0.85);
        this.iconGfx.fillCircle(cx, y + yOff, iconR);

        const fontSize = icon.size === 'medium' ? '12px' : '10px';
        const txt = this.scene.add.text(cx, y + yOff, icon.text, {
          fontFamily: 'Courier New',
          fontSize,
          color: `#${icon.color.toString(16).padStart(6, '0')}`,
          align: 'center',
          resolution: window.devicePixelRatio,
        });
        txt.setOrigin(0.5, 0.5);
        this.iconContainer.add(txt);
        this.iconTexts.push(txt);

        cx += iconR * 2 + 2;
      }
    }
  }

  // ---- Build entry button ----

  clearBuildUI(): void {
    this.buildObjects.forEach((o) => o.destroy());
    this.buildObjects = [];
    this.scene.input.setDefaultCursor('default');
  }

  showBuildButton(q: number, r: number): void {
    this.clearBuildUI();

    const { x, y } = this.axialToWorld(q, r);
    const w = 88;
    const h = 32;
    const px = x + HEX_SIZE + 6;
    const py = y - h / 2;

    this.button(px, py, w, h, '➕ Build', '#ffffff', 0x2a2a4e, 0x6688cc, true, () => {
      if (this.onBuildStart) this.onBuildStart(q, r);
    });
  }

  // ---- Build cycler ----

  showBuildCycler(q: number, r: number, state: BuildCyclerState): void {
    this.clearBuildUI();

    const { x, y } = this.axialToWorld(q, r);
    const w = 178;
    const pad = 8;
    const gap = 6;
    const rowH = 28;
    const bodyH = 60;
    const totalH = bodyH + rowH + pad;

    const px = x + HEX_SIZE + 6;
    const py = y - totalH / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.94);
    bg.fillRoundedRect(px, py, w, totalH, 6);
    bg.lineStyle(1, 0x445577, 0.9);
    bg.strokeRoundedRect(px, py, w, totalH, 6);
    this.buildContainer.add(bg);
    this.buildObjects.push(bg);

    this.label(px + pad, py + 7, state.name, '12px', '#ffffff');
    this.label(
      px + pad,
      py + 26,
      state.detail,
      '10px',
      state.valid ? '#aaccaa' : '#dd8888',
      w - pad * 2,
    );
    this.label(px + pad, py + 42, state.costStr, '10px', state.valid ? '#ccaa66' : '#888888');

    // Controls row: [<]  [ Build ]  [>]
    const arrowW = 30;
    const rowY = py + bodyH;
    const confirmW = w - pad * 2 - arrowW * 2 - gap * 2;

    this.button(px + pad, rowY, arrowW, rowH, '◀', '#ffffff', 0x2a2a4e, 0x6688cc, true, () => {
      if (this.onCyclePrev) this.onCyclePrev();
    });

    const confirmX = px + pad + arrowW + gap;
    this.button(
      confirmX,
      rowY,
      confirmW,
      rowH,
      'Build',
      state.valid ? '#ffffff' : '#777777',
      state.valid ? 0x2a4e2a : 0x222233,
      state.valid ? 0x44aa44 : 0x333344,
      state.valid,
      () => {
        if (state.valid && this.onBuildConfirm) this.onBuildConfirm();
      },
    );

    const nextX = confirmX + confirmW + gap;
    this.button(nextX, rowY, arrowW, rowH, '▶', '#ffffff', 0x2a2a4e, 0x6688cc, true, () => {
      if (this.onCycleNext) this.onCycleNext();
    });
  }

  // ---- Shared helpers ----

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    textColor: string,
    fill: number,
    hoverFill: number,
    enabled: boolean,
    onClick: () => void,
  ): void {
    const gfx = this.scene.add.graphics();
    const draw = (bg: number) => {
      gfx.clear();
      gfx.fillStyle(bg, enabled ? 0.95 : 0.6);
      gfx.fillRoundedRect(x, y, w, h, 4);
      gfx.lineStyle(1, enabled ? 0x6688cc : 0x333344, 0.8);
      gfx.strokeRoundedRect(x, y, w, h, 4);
    };
    draw(fill);

    const txt = this.scene.add.text(x + w / 2, y + h / 2, text, {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: textColor,
      resolution: window.devicePixelRatio,
    });
    txt.setOrigin(0.5, 0.5);

    if (enabled) {
      gfx.setInteractive(
        new Phaser.Geom.Rectangle(x, y, w, h),
        Phaser.Geom.Rectangle.Contains,
      );
      gfx.on('pointerover', () => {
        draw(hoverFill);
        this.scene.input.setDefaultCursor('pointer');
      });
      gfx.on('pointerout', () => {
        draw(fill);
        this.scene.input.setDefaultCursor('default');
      });
      gfx.on('pointerdown', onClick);
    }

    this.buildContainer.add(gfx);
    this.buildContainer.add(txt);
    this.buildObjects.push(gfx, txt);
  }

  private label(
    x: number,
    y: number,
    text: string,
    fontSize: string,
    color: string,
    wordWrapWidth?: number,
  ): void {
    const txt = this.scene.add.text(x, y, text, {
      fontFamily: 'Courier New',
      fontSize,
      color,
      resolution: window.devicePixelRatio,
      ...(wordWrapWidth ? { wordWrap: { width: wordWrapWidth } } : {}),
    });
    this.buildContainer.add(txt);
    this.buildObjects.push(txt);
  }

  // ---- Lifecycle ----

  destroy(): void {
    this.clearTileIcons();
    this.clearBuildUI();
    this.buildContainer.destroy();
    this.iconContainer.destroy();
    this.container.destroy();
  }
}
