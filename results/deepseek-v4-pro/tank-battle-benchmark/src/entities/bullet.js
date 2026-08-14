// 子弹实体：6×6 判定框，1px 子步扫掠移动（见 collision.moveBullet）。
import { BULLETS_MAX, DIR_X, DIR_Y } from '../config.js';

export function spawnBullet(game, opts) {
  if (game.bullets.length >= BULLETS_MAX) return null;
  const b = {
    id: game.nextId(),
    faction: opts.faction,
    x: opts.x,
    y: opts.y,
    dir: opts.dir,
    speed: opts.speed,
    power: opts.power ?? 0, // 0 普通 / 1 穿甲（可摧毁钢墙）
    ownerId: opts.ownerId ?? null,
    playerIndex: opts.playerIndex ?? null, // 击杀归属玩家
    bornFrame: game.frame,
    moveAccum: 0,
    alive: true,
  };
  game.bullets.push(b);
  return b;
}

/** 从坦克炮口发射：枪口偏移 19px，保证初始位置在坦克判定框外 */
export function bulletFromTank(game, tank, dir, speed, power = 0) {
  const cx = tank.x + 16 + DIR_X[dir] * 19;
  const cy = tank.y + 16 + DIR_Y[dir] * 19;
  return spawnBullet(game, {
    faction: tank.faction,
    x: cx,
    y: cy,
    dir,
    speed,
    power,
    ownerId: tank.id,
    playerIndex: tank.playerIndex ?? null,
  });
}
