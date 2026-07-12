import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.ts';
import { setNoiseSeed, getNoiseSeed } from './map/Noise.ts';

// Allow ?seed=123 in URL for reproducible maps
const params = new URLSearchParams(window.location.search);
const urlSeed = params.get('seed');
if (urlSeed) {
  setNoiseSeed(parseInt(urlSeed, 10));
}
console.log(`Map seed: ${getNoiseSeed()}`);

// Render at the display's native pixel density. Phaser's RESIZE scale mode
// binds the canvas backing store to the CSS size and ignores devicePixelRatio,
// which makes the canvas blurry on HiDPI/Retina screens. Instead we drive the
// scale manager manually: the game (and canvas backing store) is sized in
// physical pixels, while `zoom = 1 / dpr` keeps the CSS display size equal to
// the window. CameraController folds `dpr` back into the camera zoom so the
// on-screen scale of the world is unchanged.
const dpr = window.devicePixelRatio || 1;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth * dpr,
  height: window.innerHeight * dpr,
  backgroundColor: '#111111',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: 1 / dpr,
    autoRound: true,
  },
  render: {
    roundPixels: true,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth * dpr, window.innerHeight * dpr);
});
