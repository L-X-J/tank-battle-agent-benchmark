// 玩家坦克：移动（含冰面滑行）、开火（4 级火力）、重生。
import { Tank } from './tank.js';
import { PLAYER, DIR, PLAYER_SPAWN_POINTS, TILE } from '../config.js';
import { moveTank, isOnIce, canTankOccupy } from '../collision.js';
import { bulletFromTank } from './bullet.js';
import { FX, addEffect } from './effects.js';

export class Player extends Tank {
  constructor(game, opts) {
    super(game, {
      kind: 'player',
      type: opts.index === 1 ? 'p1' : 'p2',
      faction: 'player',
      x: opts.x,
      y: opts.y,
      dir: DIR.UP,
      speed: PLAYER.speed,
      hp: 1,
    });
    this.playerIndex = opts.index;
    this.lives = PLAYER.lives;
    this.score = 0;
    this.level = 0; // 火力等级 0..3
    this.bulletsActive = 0;
    this.respawnPending = false;
    this.respawnTimer = 0;
  }
}

export function countBulletsFor(game, ownerId) {
  let n = 0;
  for (const b of game.bullets) {
    if (b.alive && b.ownerId === ownerId) n++;
  }
  return n;
}

export function updatePlayer(game, p) {
  // 玩家死亡后由 PLAYER_RESPAWN 状态统一处理重生（见 game.tickRespawnState）
  if (!p.alive) return;
  p.decrementTimers();
  p.bulletsActive = countBulletsFor(game, p.id);

  const input = game.inputForPlayer(p.playerIndex);

  // —— 移动：受击停顿期间无法移动/开火 ——
  if (p.stun <= 0) {
    let dir = null;
    if (input.up) dir = DIR.UP;
    else if (input.down) dir = DIR.DOWN;
    else if (input.left) dir = DIR.LEFT;
    else if (input.right) dir = DIR.RIGHT;

    if (p.iceLockDir !== null) {
      // 冰面滑行：保持原方向，直到离开冰面或撞墙
      moveTank(game, p, p.iceLockDir, p.speed);
      p.dir = p.iceLockDir;
      if (p.collided) {
        p.iceLockDir = null; // 撞墙停止滑行，允许重新控制方向
      } else if (!isOnIce(game, p)) {
        p.iceLockDir = null;
      }
    } else if (dir !== null) {
      p.dir = dir;
      moveTank(game, p, dir, p.speed);
      if (isOnIce(game, p)) p.iceLockDir = dir; // 进入冰面 → 开始滑行
    }
  }

  // —— 开火 ——
  if (
    input.justFire &&
    p.stun <= 0 &&
    p.fireCooldown <= 0 &&
    p.bulletsActive < PLAYER.maxBullets[p.level]
  ) {
    const bullet = bulletFromTank(game, p, p.dir, PLAYER.bulletSpeed[p.level], p.level >= 3 ? 1 : 0);
    if (bullet) {
      p.fireCooldown = PLAYER.fireCooldown[p.level];
      p.bulletsActive++;
      game.emit('playerFire', { playerIndex: p.playerIndex, level: p.level });
    }
  }
}

/** 重生：出生点被占则稍后重试（PLAYER_RESPAWN 状态保持） */
export function tryRespawnPlayer(game, p) {
  const sp = PLAYER_SPAWN_POINTS[p.playerIndex - 1];
  const x = sp.col * TILE;
  const y = sp.row * TILE;
  if (!canTankOccupy(game, x, y, p)) {
    p.respawnTimer = 10;
    return;
  }
  p.x = x;
  p.y = y;
  p.dir = DIR.UP;
  p.alive = true;
  p.respawnPending = false;
  p.spawnProtect = PLAYER.spawnProtect;
  p.iceLockDir = null;
  p.stun = 0;
  p.fireCooldown = 0;
  addEffect(game, FX.SPAWN, p.cx, p.cy);
  game.emit('playerRespawn', { playerIndex: p.playerIndex });
}
