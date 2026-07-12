import Phaser from 'phaser';
import { HEX_SIZE } from '../constants.ts';
import type { BuildOption, TileIcon } from './types.ts';

export class WorldUI {
  onBuildingSelected: ((buildingType: number, q: number, r: number) => void) | null = null;
  onPaletteClosed: (() => void) | null = null;

  private scene: Phaser.Scene;
  private axialToWorld: (q: number, r: number) => { x: number; y: number };

  private container: Phaser.GameObjects.Container;
  private iconContainer: Phaser.GameObjects.Container;
  private iconGfx: Phaser.GameObjects.Graphics;
  private iconTexts: Phaser.GameObjects.Text[] = [];

  private paletteContainer: Phaser.GameObjects.Container;
  private paletteBg: Phaser.GameObjects.Graphics;
  private paletteButtons: Phaser.GameObjects.Graphics[] = [];
  private paletteTexts: Phaser.GameObjects.Text[] = [];
  private paletteVisible = false;
  private paletteQ = 0;
  private paletteR = 0;

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

    this.paletteContainer = scene.add.container(0, 0);
    this.paletteContainer.setDepth(101);
    this.paletteBg = scene.add.graphics();
    this.paletteContainer.add(this.paletteBg);
    this.paletteContainer.setVisible(false);
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

    const iconR = 9;
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

        const fontSize = icon.size === 'medium' ? '10px' : '8px';
        const txt = this.scene.add.text(cx, y + yOff, icon.text, {
          fontFamily: 'Courier New',
          fontSize,
          color: `#${icon.color.toString(16).padStart(6, '0')}`,
          align: 'center',
        });
        txt.setOrigin(0.5, 0.5);
        this.iconContainer.add(txt);
        this.iconTexts.push(txt);

        cx += iconR * 2 + 2;
      }
    }
  }

  // ---- Build palette ----

  isPaletteVisible(): boolean {
    return this.paletteVisible;
  }

  getPaletteTile(): { q: number; r: number } | null {
    return this.paletteVisible ? { q: this.paletteQ, r: this.paletteR } : null;
  }

  showBuildPalette(q: number, r: number, options: BuildOption[]): void {
    this.hideBuildPalette();

    this.paletteQ = q;
    this.paletteR = r;

    const { x, y } = this.axialToWorld(q, r);
    const btnW = 110;
    const btnH = 42;
    const gap = 3;
    const pad = 5;
    const totalH = options.length * (btnH + gap) - gap + pad * 2;

    const px = x + HEX_SIZE + 6;
    const py = y - totalH / 2;

    this.paletteBg.fillStyle(0x1a1a2e, 0.93);
    this.paletteBg.fillRoundedRect(px, py, btnW + pad * 2, totalH, 6);
    this.paletteBg.lineStyle(1, 0x445577, 0.9);
    this.paletteBg.strokeRoundedRect(px, py, btnW + pad * 2, totalH, 6);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const by = py + pad + i * (btnH + gap);

      const gfx = this.scene.add.graphics();
      this.drawPaletteButton(gfx, px + pad, by, btnW, btnH, opt, false);

      gfx.setInteractive(
        new Phaser.Geom.Rectangle(px + pad, by, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );

      gfx.on('pointerover', () => {
        if (opt.allowed) {
          this.drawPaletteButton(gfx, px + pad, by, btnW, btnH, opt, true);
        }
        this.scene.input.setDefaultCursor(opt.allowed ? 'pointer' : 'default');
      });
      gfx.on('pointerout', () => {
        this.drawPaletteButton(gfx, px + pad, by, btnW, btnH, opt, false);
        this.scene.input.setDefaultCursor('default');
      });
      gfx.on('pointerdown', () => {
        if (opt.allowed && this.onBuildingSelected) {
          this.onBuildingSelected(opt.buildingType, q, r);
        }
      });

      const nameTxt = this.scene.add.text(px + pad + 5, by + 3, opt.name, {
        fontFamily: 'Courier New',
        fontSize: '10px',
        color: opt.allowed ? '#ffffff' : '#888888',
      });

      const yieldParts: string[] = [];
      if (opt.yields.food) yieldParts.push(`F${opt.yields.food > 0 ? '+' : ''}${opt.yields.food}`);
      if (opt.yields.materials)
        yieldParts.push(`M${opt.yields.materials > 0 ? '+' : ''}${opt.yields.materials}`);
      if (opt.yields.science)
        yieldParts.push(`S${opt.yields.science > 0 ? '+' : ''}${opt.yields.science}`);
      if (opt.yields.population)
        yieldParts.push(`P${opt.yields.population > 0 ? '+' : ''}${opt.yields.population}`);
      const yieldStr = yieldParts.join(' ') || 'no yield';

      const yieldTxt = this.scene.add.text(px + pad + 5, by + 16, yieldStr, {
        fontFamily: 'Courier New',
        fontSize: '8px',
        color: opt.allowed ? '#aaccaa' : '#666666',
      });

      const blockStr = opt.blockReason ?? (opt.cost > 0 ? `${opt.cost}m` : 'free');
      const costTxt = this.scene.add.text(px + pad + 5, by + 28, blockStr, {
        fontFamily: 'Courier New',
        fontSize: '8px',
        color: opt.allowed ? (opt.canAfford ? '#ccaa66' : '#cc6666') : '#aa4444',
      });

      this.paletteContainer.add(gfx);
      this.paletteContainer.add(nameTxt);
      this.paletteContainer.add(yieldTxt);
      this.paletteContainer.add(costTxt);

      this.paletteButtons.push(gfx);
      this.paletteTexts.push(nameTxt, yieldTxt, costTxt);
    }

    this.paletteContainer.setVisible(true);
    this.paletteVisible = true;
  }

  hideBuildPalette(): void {
    this.paletteButtons.forEach((b) => b.destroy());
    this.paletteButtons = [];
    this.paletteTexts.forEach((t) => t.destroy());
    this.paletteTexts = [];
    this.paletteBg.clear();
    this.paletteContainer.setVisible(false);
    this.paletteVisible = false;
    this.scene.input.setDefaultCursor('default');
  }

  private drawPaletteButton(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    opt: BuildOption,
    hover: boolean,
  ): void {
    gfx.clear();
    if (hover && opt.allowed) {
      gfx.fillStyle(0x3a3a6e, 1);
    } else if (!opt.allowed) {
      gfx.fillStyle(0x222233, 0.5);
    } else {
      gfx.fillStyle(0x2a2a4e, 0.85);
    }
    gfx.fillRoundedRect(x, y, w, h, 4);

    if (hover && opt.allowed) {
      gfx.lineStyle(1, 0x6688cc, 0.8);
      gfx.strokeRoundedRect(x, y, w, h, 4);
    }
  }

  // ---- Lifecycle ----

  destroy(): void {
    this.clearTileIcons();
    this.hideBuildPalette();
    this.paletteContainer.destroy();
    this.iconContainer.destroy();
    this.container.destroy();
  }
}
