// 敌人 AI：方向评分系统 + 周期性决策 + 卡死检测 + 对齐开火 + 单类型 BFS 路径搜索。
// 决策节奏因类型而异并带随机抖动；BFS 只在决策时刻执行（受决策间隔限制），
// 绝不每帧对全部敌人做全图搜索。所有随机性来自 game.rng（确定性）。
import { DIR, DIR_X, DIR_Y, TILE } from './config.js';
import { moveTank, isOnIce } from './collision.js';
import { bfsPathToNearest } from './pathfind.js';
import { bulletFromTank } from './entities/bullet.js';

const BASE_CX = 12.5 * TILE; // 基地中心
const BASE_CY = 24.5 * TILE;

export function updateEnemy(game, e) {
  if (!e.alive) return;
  if (game.freezeTimer > 0) return; // 时钟冻结：不决策、不移动、不开火、计时器不推进
  e.decrementTimers();

  // 卡死检测：位置长时间不变视为卡住
  if (e.lastX === e.x && e.lastY === e.y) e.stuckFrames++;
  else {
    e.stuckFrames = 0;
    e.lastX = e.x;
    e.lastY = e.y;
  }

  e.decisionTimer--;
  const forceDecide = e.decisionTimer <= 0 || e.collided || e.stuckFrames > 40;
  if (forceDecide) {
    e.decisionTimer = game.rng.int(e.cfg.decideMin, e.cfg.decideMax);
    decideEnemy(game, e);
  }

  moveEnemy(game, e);
  maybeFire(game, e);
}

function moveEnemy(game, e) {
  if (e.iceLockDir !== null) {
    moveTank(game, e, e.iceLockDir, e.speed);
    e.dir = e.iceLockDir;
    if (e.collided) e.iceLockDir = null;
    else if (!isOnIce(game, e)) e.iceLockDir = null;
  } else {
    moveTank(game, e, e.dir, e.speed);
    if (isOnIce(game, e)) e.iceLockDir = e.dir;
  }
}

function decideEnemy(game, e) {
  const cfg = e.cfg;
  // 火力手：一定概率执行一次网格 BFS，直奔最近玩家或基地附近
  if (cfg.pathfind && game.rng.chance(0.7)) {
    const path = bfsPathToNearest(game, e.x >> 4, e.y >> 4, (c, r) => isTargetCell(game, c, r));
    if (path && path.length > 1) {
      e.path = path;
      e.pathIndex = 1;
      e.dir = dirTowardsCell(e, path[1]);
      return;
    }
  }
  // 沿既有路径继续
  if (e.path && e.pathIndex < e.path.length) {
    if (centerReachedCell(e, e.path[e.pathIndex])) e.pathIndex++;
    if (e.pathIndex < e.path.length) {
      e.dir = dirTowardsCell(e, e.path[e.pathIndex]);
      return;
    }
    e.path = null;
  }
  // 方向评分
  e.dir = scoredDirection(game, e, pickTarget(game, e));
}

/** 目标格：任一存活玩家的格，或基地附近格 */
function isTargetCell(game, c, r) {
  for (const p of game.players) {
    if (p.alive && (p.x >> 4) === c && (p.y >> 4) === r) return true;
  }
  return Math.max(Math.abs(c - 12), Math.abs(r - 24)) <= 2;
}

function dirTowardsCell(e, cell) {
  const tx = cell.col * TILE + 8;
  const ty = cell.row * TILE + 8;
  const dx = tx - e.cx;
  const dy = ty - e.cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? DIR.RIGHT : DIR.LEFT;
  return dy >= 0 ? DIR.DOWN : DIR.UP;
}

function centerReachedCell(e, cell) {
  const tx = cell.col * TILE + 8;
  const ty = cell.row * TILE + 8;
  return Math.abs(e.cx - tx) < 8 && Math.abs(e.cy - ty) < 8;
}

/** 方向评分：朝目标靠近得高分，保持当前方向防抖动，随机扰动防同步 */
function scoredDirection(game, e, target) {
  const tx = target.cx;
  const ty = target.cy;
  let bestDir = e.dir;
  let bestScore = -Infinity;
  const cur = Math.abs(e.cx - tx) + Math.abs(e.cy - ty);
  for (let d = 0; d < 4; d++) {
    let score = game.rng.next() * 6;
    if (d === e.dir) score += 10;
    const nx = e.x + DIR_X[d] * 16;
    const ny = e.y + DIR_Y[d] * 16;
    const nxt = Math.abs(nx + 16 - tx) + Math.abs(ny + 16 - ty);
    score += (cur - nxt) * 4;
    if (score > bestScore) {
      bestScore = score;
      bestDir = d;
    }
  }
  return bestDir;
}

/** 目标选择：概率朝玩家，否则朝基地（经典双目标策略） */
function pickTarget(game, e) {
  const alive = game.players.filter((p) => p.alive);
  if (alive.length > 0 && game.rng.chance(alive.length === 1 ? 0.55 : 0.7)) {
    let nearest = alive[0];
    let best = Infinity;
    for (const p of alive) {
      const d = Math.abs(p.cx - e.cx) + Math.abs(p.cy - e.cy);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    return { cx: nearest.cx, cy: nearest.cy };
  }
  return { cx: BASE_CX, cy: BASE_CY };
}

function maybeFire(game, e) {
  if (e.fireCooldown > 0) return;
  let bullets = 0;
  for (const b of game.bullets) {
    if (b.alive && b.ownerId === e.id) bullets++;
  }
  if (bullets >= 1) return; // 每个敌人同时最多 1 发子弹
  const aligned = alignedWithAnyTarget(game, e);
  const chance = aligned ? e.cfg.fireChanceAligned : e.cfg.fireChanceRandom;
  if (!game.rng.chance(chance)) return;
  const bullet = bulletFromTank(game, e, e.dir, e.cfg.bulletSpeed, 0);
  if (bullet) {
    e.fireCooldown = e.cfg.fireCooldown;
    game.emit('enemyFire', { type: e.type });
  }
}

/** 与任一玩家或基地大致对齐（同列/同行且朝向正确，误差 ≤ 6px） */
function alignedWithAnyTarget(game, e) {
  const targets = [];
  for (const p of game.players) {
    if (p.alive) targets.push({ cx: p.cx, cy: p.cy });
  }
  targets.push({ cx: BASE_CX, cy: BASE_CY });
  for (const t of targets) {
    const dx = t.cx - e.cx;
    const dy = t.cy - e.cy;
    if (e.dir === DIR.UP && Math.abs(dx) <= 6 && dy < 0) return true;
    if (e.dir === DIR.DOWN && Math.abs(dx) <= 6 && dy > 0) return true;
    if (e.dir === DIR.LEFT && Math.abs(dy) <= 6 && dx < 0) return true;
    if (e.dir === DIR.RIGHT && Math.abs(dy) <= 6 && dx > 0) return true;
  }
  return false;
}

// ————— DEMO 模式：AI 自动控制玩家坦克 —————
export function controlDemoPlayer(game, p) {
  const demo = game.demoInput;
  let nearest = null;
  let best = Infinity;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = Math.abs(e.cx - p.cx) + Math.abs(e.cy - p.cy);
    if (d < best) {
      best = d;
      nearest = e;
    }
  }
  demo.fire = false;
  demo.decideTimer = (demo.decideTimer ?? 0) - 1;
  if (nearest) {
    const dx = nearest.cx - p.cx;
    const dy = nearest.cy - p.cy;
    // 主动瞄准：先把垂直于炮口的偏移收敛到 6px 以内，然后对齐开火
    let dir;
    if (Math.abs(dx) <= 6) dir = dy > 0 ? DIR.DOWN : DIR.UP;
    else if (Math.abs(dy) <= 6) dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    else dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
    const aligned =
      (dir === DIR.UP && Math.abs(dx) <= 6 && dy < 0) ||
      (dir === DIR.DOWN && Math.abs(dx) <= 6 && dy > 0) ||
      (dir === DIR.LEFT && Math.abs(dy) <= 6 && dx < 0) ||
      (dir === DIR.RIGHT && Math.abs(dy) <= 6 && dx > 0);
    if (aligned && game.rng.chance(0.6)) demo.fire = true;
    if (demo.decideTimer <= 0 || p.collided) {
      demo.decideTimer = 40;
      demo.dir = dir;
    }
  } else {
    // 无敌人：随机巡逻（撞墙后重新决策）
    if (demo.decideTimer <= 0 || p.collided) {
      demo.decideTimer = 60;
      demo.dir = game.rng.int(0, 3);
    }
  }
  if (demo.dir === null || demo.dir === undefined) demo.dir = DIR.UP;
  // 写入稳定视图对象（game.computeInputEdges 在此基础上计算"刚按下"沿）
  const view = game.demoInputView;
  view.up = demo.dir === DIR.UP;
  view.down = demo.dir === DIR.DOWN;
  view.left = demo.dir === DIR.LEFT;
  view.right = demo.dir === DIR.RIGHT;
  view.fire = !!demo.fire;
}
