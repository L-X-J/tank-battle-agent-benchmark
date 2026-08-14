// 测试公共工具：构造游戏实例、自定义地图、推进状态等。
import { Game } from '../src/game.js';
import { STATE, setState } from '../src/state-machine.js';
import { parseAscii } from '../src/map.js';
import { COLS, ROWS, TILE, PLAYER_SPAWN_POINTS } from '../src/config.js';

export function makeGame(opts = {}) {
  const g = new Game({ seed: opts.seed ?? 777 });
  g.startGame({
    mode: opts.mode ?? '1p',
    stage: opts.stage ?? 1,
    seed: opts.seed ?? 777,
    play: true,
  });
  return g;
}

export function stepToPlaying(g, max = 600) {
  let n = 0;
  while (g.state !== STATE.PLAYING && n++ < max) g.step();
  return g.state === STATE.PLAYING;
}

export function stepUntil(g, pred, max = 6000) {
  let n = 0;
  while (!pred(g) && n++ < max) g.step();
  return pred(g);
}

/** 用构建函数生成 26×26 ASCII 地图 */
export function makeAscii(build) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  build(grid);
  return grid.map((r) => r.join('')).join('\n');
}

/**
 * 放置一辆"闲置敌人"：不移动、不开火、无敌。
 * 用于清场后保持关卡未完成（避免队列清空立即触发过关），并保证 PLAYING 状态持续。
 */
export function addIdleEnemy(g) {
  const id = g.spawnEnemy('scout', { x: 0, y: 384 });
  if (id === null) return g.enemies.find((e) => e.alive) ?? null;
  const e = g.enemies.find((x) => x.id === id);
  e.speed = 0;
  e.fireCooldown = 1_000_000;
  e.spawnProtect = 999999;
  return e;
}

/** 加载自定义地图并清场（无敌人、无子弹、无道具、无冻结） */
export function loadCustomMap(g, ascii) {
  g.levelData = { id: g.stage, name: 'TEST-MAP', ascii, enemies: [], carriers: [] };
  g.map = parseAscii(ascii);
  g.brickDamage = new Uint8Array(COLS * ROWS);
  g.resetStageEntities();
  g.spawnQueue = [];
  g.spawnCooldown = 0;
  g.freezeTimer = 0;
  g.shovelTimer = 0;
  g.baseWallSnapshot = null;
  g.baseAlive = true;
  setState(g, STATE.PLAYING);
  for (const p of g.players) {
    const sp = PLAYER_SPAWN_POINTS[p.playerIndex - 1];
    p.x = sp.col * TILE;
    p.y = sp.row * TILE;
    p.dir = 0;
    p.alive = true;
    p.respawnPending = false;
    p.spawnProtect = 0; // 单元测试默认无保护，便于伤害类用例
    p.shield = 0;
    p.iceLockDir = null;
    p.stun = 0;
    p.fireCooldown = 0;
  }
  addIdleEnemy(g);
  return g;
}

/** 将玩家停放到指定位置并清除保护状态 */
export function parkPlayer(g, index = 1, x, y, dir = 0) {
  const p = g.players[index - 1];
  p.x = x;
  p.y = y;
  p.dir = dir;
  p.alive = true;
  p.spawnProtect = 0;
  p.shield = 0;
  p.stun = 0;
  p.fireCooldown = 0;
  p.iceLockDir = null;
  p.respawnPending = false;
  return p;
}

/** 清空场上敌人与子弹（保留玩家） */
export function clearField(g) {
  g.clearActiveEnemies();
  g.spawnQueue = [];
  g.bullets = [];
  g.powerup = null;
  g.freezeTimer = 0;
}

/** 递归检查所有数字均为有限值（无 NaN / Infinity） */
export function isFiniteDeep(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(isFiniteDeep);
  if (v && typeof v === 'object') return Object.values(v).every(isFiniteDeep);
  return true;
}
