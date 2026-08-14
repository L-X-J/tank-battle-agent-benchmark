// 浏览器入口：组装 Game / Renderer / Loop / Input / Audio / Storage / Debug API。
import { Game } from './game.js';
import { createRenderer } from './renderer.js';
import { createInput, ACTION_KEYS } from './input.js';
import { createAudioSystem } from './audio.js';
import { Loop } from './loop.js';
import { GAME_VERSION } from './config.js';
import { STATE } from './state-machine.js';
import { hashSeed } from './rng.js';

const canvas = document.getElementById('game');

// 浏览器游玩使用随机种子；自动化测试通过 debug API 显式传入 seed。
const game = new Game({ seed: hashSeed(`${Date.now()}-${Math.floor(performance.now())}`) });
const renderer = createRenderer(canvas);
const input = createInput();
const audio = createAudioSystem(game);
game.on((type, data) => audio.onEvent(type, data));

let debugOverlay = false;
const ui = { debug: false, fps: 60, paused: false };

const ACTION_CODES = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter',
  'KeyP', 'KeyR', 'Escape',
]);

function isActionKey(code) {
  return ACTION_CODES.has(code);
}

function routeActions() {
  const edges = input.consumeEdges();
  for (const code of edges) {
    // DEMO 进行中（或 DEMO 的结算画面）：按任意主要操作键返回菜单
    const demoActive =
      game.mode === 'demo' &&
      (game.inGameplay() ||
        game.state === STATE.GAME_OVER ||
        game.state === STATE.VICTORY ||
        game.state === STATE.SCORE_SUMMARY ||
        game.state === STATE.STAGE_CLEAR);
    if (demoActive && !isSystemKey(code) && isActionKey(code)) {
      game.quitToMenu();
      continue;
    }
    if (game.state === STATE.MAIN_MENU) {
      if (code === 'ArrowUp' || code === 'KeyW') game.menuMove(-1);
      else if (code === 'ArrowDown' || code === 'KeyS') game.menuMove(1);
      else if (code === 'Enter' || code === 'Space') game.menuSelect();
      else if (code === 'KeyM') game.toggleSound();
    } else if (game.state === STATE.HELP) {
      if (code === 'ArrowRight' || code === 'KeyD') game.helpNext();
      else if (code === 'ArrowLeft' || code === 'KeyA') game.helpPrev();
      else if (code === 'Escape' || code === 'Enter') game.menuBack();
      else if (code === 'KeyM') game.toggleSound();
    } else if (code === 'KeyM') {
      game.toggleSound();
    } else {
      switch (code) {
        case 'KeyP':
          game.pauseToggle('user');
          break;
        case 'KeyR':
          game.restartStage();
          break;
        case 'Escape':
          game.quitToMenu();
          break;
        case 'F2':
          debugOverlay = !debugOverlay;
          break;
        case 'BracketLeft':
          game.adjustVolume(-0.1);
          break;
        case 'BracketRight':
          game.adjustVolume(0.1);
          break;
        case 'Enter':
        case 'Space':
          game.advance();
          break;
        default:
          break;
      }
    }
  }
}

function isSystemKey(code) {
  return code === 'KeyM' || code === 'F2' || code === 'BracketLeft' || code === 'BracketRight';
}

function syncKeyboardState() {
  game.input.p1.up = input.state.p1.up;
  game.input.p1.down = input.state.p1.down;
  game.input.p1.left = input.state.p1.left;
  game.input.p1.right = input.state.p1.right;
  game.input.p1.fire = input.state.p1.fire;
  game.input.p2.up = input.state.p2.up;
  game.input.p2.down = input.state.p2.down;
  game.input.p2.left = input.state.p2.left;
  game.input.p2.right = input.state.p2.right;
  game.input.p2.fire = input.state.p2.fire;
}

const loop = new Loop({
  step: () => {
    syncKeyboardState();
    routeActions();
    game.step();
  },
  render: () => {
    audio.update();
    ui.debug = debugOverlay;
    ui.fps = loop.fps;
    ui.paused = game.state === STATE.PAUSED;
    renderer.render(game, ui);
  },
});

// —— 窗口失焦自动暂停（重新获得焦点后不自动恢复，必须由用户按 P）——
window.addEventListener('blur', () => {
  if (game.state === STATE.PLAYING) game.pauseToggle('blur');
});
document.addEventListener('visibilitychange', () => {
  audio.onVisibility(document.hidden);
  if (document.hidden && game.state === STATE.PLAYING) game.pauseToggle('blur');
});

// —— 音频：首次用户交互后才创建/恢复 AudioContext ——
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });

// —— 鼠标操作主菜单（悬停高亮 + 点击选择）——
canvas.addEventListener('mousemove', (e) => {
  if (game.state !== STATE.MAIN_MENU) return;
  const pos = renderer.logicalFromClient(e.clientX, e.clientY);
  const idx = renderer.hitTestMenu(pos.x, pos.y, game);
  if (idx !== null && idx !== game.menu.index) {
    game.menu.index = idx;
    game.emit('menuMove', { index: idx });
  }
});
canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (game.state !== STATE.MAIN_MENU) return;
  const pos = renderer.logicalFromClient(e.clientX, e.clientY);
  const idx = renderer.hitTestMenu(pos.x, pos.y, game);
  if (idx !== null) {
    game.menu.index = idx;
    game.menuSelect();
  }
});

// —— 窗口缩放重新适配 ——
window.addEventListener('resize', () => renderer.fit());
window.addEventListener('beforeunload', () => game.updateSave({}));

// —— 调试接口（?debug=1 时暴露）——
if (new URLSearchParams(location.search).get('debug') === '1') {
  window.__TANK_BATTLE_TEST__ = {
    version: GAME_VERSION,
    startGame: (options) => game.startGame(options || {}),
    resetGame: () => game.resetGame(),
    pauseGame: () => game.pauseGame(),
    resumeGame: () => game.resumeGame(),
    stepFrames: (frameCount) => game.stepFrames(frameCount),
    setPlayerInput: (playerId, inputState) => game.setPlayerInput(playerId, inputState),
    getSnapshot: () => game.getSnapshot(),
    spawnEnemy: (type, position) => game.spawnEnemy(type, position),
    spawnPowerUp: (type, position) => game.spawnPowerUp(type, position),
    damageTank: (entityId, amount) => game.damageTank(entityId, amount),
    destroyBase: () => game.destroyBase(),
    clearActiveEnemies: () => game.clearActiveEnemies(),
    // 额外接口（仅调试模式）：直接访问 Game 实例，供自动化验收脚本使用
    getInternals: () => game,
  };
  console.info('[STEEL FRONT] debug API ready at window.__TANK_BATTLE_TEST__');
}

loop.start();
