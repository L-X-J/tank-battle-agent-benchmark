// 道具系统：6 种道具的生成、过期、拾取与效果。
import {
  POWERUP,
  POWERUP_TYPES,
  POWERUP_WEIGHTS,
  T,
  TILE,
  COLS,
  ROWS,
  BASE_WALL_CELLS,
} from '../config.js';
import { addEffect, FX } from './effects.js';
import { rectsOverlap } from '../collision.js';
import { cellAt, setCell } from '../map.js';
import { bfs } from '../pathfind.js';

export function spawnPowerup(game, type, x, y) {
  game.powerup = { type, x, y, life: POWERUP.life, maxLife: POWERUP.life };
  game.emit('powerupSpawn', { type, x, y });
  return game.powerup;
}

export function updatePowerup(game) {
  const pu = game.powerup;
  if (!pu) return;
  pu.life--;
  if (pu.life <= 0) {
    game.powerup = null;
    return;
  }
  for (const p of game.players) {
    if (!p.alive) continue;
    if (rectsOverlap(pu.x - 8, pu.y - 8, 16, 16, p.x, p.y, 32, 32)) {
      applyPowerup(game, p, pu.type);
      game.powerup = null;
      return;
    }
  }
}

export function applyPowerup(game, player, type) {
  switch (type) {
    case 'star':
      player.level = Math.min(3, player.level + 1);
      break;
    case 'shield':
      player.shield = POWERUP.shieldDuration;
      break;
    case 'clock':
      game.freezeTimer = POWERUP.clockDuration; // 重复拾取刷新时长
      game.emit('clock', {});
      break;
    case 'shovel': {
      // 重复拾取只刷新时长，不破坏墙体状态（快照只在效果未激活时更新）
      if (game.shovelTimer <= 0) {
        game.baseWallSnapshot = BASE_WALL_CELLS.map((c) => cellAt(game.map, c.col, c.row));
        for (const c of BASE_WALL_CELLS) {
          if (cellAt(game.map, c.col, c.row) === T.BRICK) {
            setCell(game.map, c.col, c.row, T.STEEL);
          }
        }
      }
      game.shovelTimer = POWERUP.shovelDuration;
      break;
    }
    case 'grenade': {
      const killed = [];
      for (const e of [...game.enemies]) {
        if (!e.alive) continue;
        e.alive = false;
        e.hp = 0;
        addEffect(game, FX.EXPLOSION_S, e.cx, e.cy);
        killed.push(e);
      }
      game.creditEnemyKills(player.playerIndex, killed, { byGrenade: true });
      game.emit('grenade', { playerIndex: player.playerIndex, count: killed.length });
      break;
    }
    case 'life':
      player.lives++;
      game.emit('extraLife', { playerIndex: player.playerIndex });
      break;
    default:
      return;
  }
  player.score += POWERUP.pickupScore;
  game.stats.powerups[`p${player.playerIndex}`]++;
  addEffect(game, FX.SCORE, player.cx, player.cy - 20, { text: `+${POWERUP.pickupScore}` });
  addEffect(game, FX.POP, player.cx, player.cy);
  game.emit('powerupPickup', { type, playerIndex: player.playerIndex });
}

/**
 * 在敌人被击毁位置附近寻找合法掉落点：
 * 空地/草丛/冰面、无实体重叠、且从敌人一侧可达（避免掉进封闭死区）。
 * 新道具直接替换旧道具（同一时间最多一个）。
 */
export function tryDropPowerup(game, cx, cy) {
  for (let radius = 1; radius <= 6; radius++) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const col = game.rng.int(
        Math.max(1, (cx >> 4) - radius),
        Math.min(COLS - 2, (cx >> 4) + radius)
      );
      const row = game.rng.int(
        Math.max(1, (cy >> 4) - radius),
        Math.min(ROWS - 2, (cy >> 4) + radius)
      );
      const code = cellAt(game.map, col, row);
      if (code !== T.EMPTY && code !== T.GRASS && code !== T.ICE) continue;
      const x = col * TILE + 8;
      const y = row * TILE + 8;
      if (game.tanksAll().some((t) => t.alive && rectsOverlap(x - 8, y - 8, 16, 16, t.x, t.y, 32, 32))) {
        continue;
      }
      if (!bfs(game, col, row, (c, r) => r <= 1, { brickReachable: true })) continue;
      const type = POWERUP_TYPES[game.rng.weightedIndex(POWERUP_WEIGHTS)];
      return spawnPowerup(game, type, x, y);
    }
  }
  return null;
}
