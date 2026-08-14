// 连续碰撞系统（与渲染帧率无关，全部在逻辑坐标中计算）。
// 坦克移动：按 1px 子步扫掠，撞墙即停，不会穿墙。
// 子弹移动：按 1px 子步扫掠，高速子弹不会穿透 8px 薄墙。
// 碰撞处理顺序固定为：地图 → 坦克 → 敌对子弹（确定性）。
import { T, TILE, BULLET, DIR_X, DIR_Y, FIELD_W, FIELD_H } from './config.js';
import { cellAt, blocksBullet, isSolidForTank, quadIndexAt } from './map.js';

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function tanksOverlap(a, b) {
  return rectsOverlap(a.x, a.y, 32, 32, b.x, b.y, 32, 32);
}

/** 坦克 (x,y) 为左上角，占 32×32；检查地图与其它坦克 */
export function canTankOccupy(game, x, y, ignoreTank) {
  if (x < 0 || y < 0 || x + 32 > FIELD_W || y + 32 > FIELD_H) return false;
  const c0 = x >> 4;
  const r0 = y >> 4;
  const c1 = (x + 31) >> 4;
  const r1 = (y + 31) >> 4;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolidForTank(cellAt(game.map, c, r))) return false;
    }
  }
  for (const t of game.tanksAll()) {
    if (t === ignoreTank || !t.alive) continue;
    if (rectsOverlap(x, y, 32, 32, t.x, t.y, 32, 32)) return false;
  }
  return true;
}

/**
 * 坦克沿方向扫掠移动 distance 像素（支持小数速度，累积余量）。
 * 返回实际移动的像素数；tank.collided 标记是否撞到障碍。
 */
export function moveTank(game, tank, dir, distance) {
  tank.moveAccum += distance;
  let steps = Math.floor(tank.moveAccum + 1e-9);
  tank.moveAccum -= steps;
  const dx = DIR_X[dir];
  const dy = DIR_Y[dir];
  let moved = 0;
  while (steps > 0) {
    if (!canTankOccupy(game, tank.x + dx, tank.y + dy, tank)) break;
    tank.x += dx;
    tank.y += dy;
    moved++;
    steps--;
  }
  tank.collided = steps > 0; // 仍有剩余步数 = 被障碍挡住
  return moved;
}

/** 坦克压在冰面上（任一角格为冰） */
export function isOnIce(game, tank) {
  const c0 = tank.x >> 4;
  const r0 = tank.y >> 4;
  const c1 = (tank.x + 31) >> 4;
  const r1 = (tank.y + 31) >> 4;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (cellAt(game.map, c, r) === T.ICE) return true;
    }
  }
  return false;
}

/** 子弹矩形覆盖的格中第一个阻挡子弹的地形；无则返回 null */
export function bulletHitsMap(game, x, y) {
  const x0 = Math.floor(x - BULLET.half);
  const y0 = Math.floor(y - BULLET.half);
  const x1 = Math.floor(x + BULLET.half - 1e-6);
  const y1 = Math.floor(y + BULLET.half - 1e-6);
  for (let r = y0 >> 4; r <= y1 >> 4; r++) {
    for (let c = x0 >> 4; c <= x1 >> 4; c++) {
      const code = cellAt(game.map, c, r);
      if (blocksBullet(code)) return { col: c, row: r, code };
    }
  }
  return null;
}

/**
 * 子弹扫掠移动（1px 子步）。
 * 返回 {col,row,code} 表示击中地形，{outOfBounds:true} 表示飞出地图，null 表示继续飞行。
 */
export function moveBullet(game, bullet) {
  bullet.moveAccum += bullet.speed;
  let steps = Math.floor(bullet.moveAccum + 1e-9);
  bullet.moveAccum -= steps;
  const dx = DIR_X[bullet.dir];
  const dy = DIR_Y[bullet.dir];
  while (steps-- > 0) {
    bullet.x += dx;
    bullet.y += dy;
    const hit = bulletHitsMap(game, bullet.x, bullet.y);
    if (hit) return hit;
  }
  if (
    bullet.x < -BULLET.half ||
    bullet.y < -BULLET.half ||
    bullet.x >= FIELD_W + BULLET.half ||
    bullet.y >= FIELD_H + BULLET.half
  ) {
    return { outOfBounds: true };
  }
  return null;
}

/** 子弹 vs 坦克：使用 30×30 内缩判定框（手感更好且确定） */
export function bulletHitsTank(bullet, tank) {
  return rectsOverlap(
    bullet.x - BULLET.half,
    bullet.y - BULLET.half,
    BULLET.size,
    BULLET.size,
    tank.x + 1,
    tank.y + 1,
    30,
    30
  );
}

export function bulletHitsBullet(a, b) {
  return rectsOverlap(a.x - BULLET.half, a.y - BULLET.half, BULLET.size, BULLET.size,
    b.x - BULLET.half, b.y - BULLET.half, BULLET.size, BULLET.size);
}

/** 子弹命中砖墙时对应的 8×8 子块索引 */
export function brickQuadFor(bullet, hit) {
  return quadIndexAt(bullet.x - hit.col * TILE, bullet.y - hit.row * TILE);
}
