import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#111111',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    roundPixels: true,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    const gm = game.scene.getScene('GameScene') as GameScene | null;
    gm?.gameTime.cycleSpeed();
  }
});
