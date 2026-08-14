// 碰撞测试：坦克与地形/边界/坦克、子弹与地形/子弹、连续碰撞（扫掠）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, makeAscii, loadCustomMap, parkPlayer } from './helpers.js';
import { spawnBullet } from '../src/entities/bullet.js';
import { DIR, T, TILE, FIELD_W, FIELD_H } from '../src/config.js';
import { cellAt } from '../src/map.js';

function wallMap(ch) {
  return makeAscii((g) => {
    for (let c = 10; c <= 15; c++) g[12][c] = ch;
  });
}

test('坦克不能穿过砖墙', () => {
  const g = makeGame({ seed: 1 });
  stepToPlaying(g);
  loadCustomMap(g, wallMap('#'));
  parkPlayer(g, 1, 12 * TILE, 10 * TILE, DIR.DOWN);
  g.setPlayerInput(1, { down: true });
  g.stepFrames(120);
  assert.equal(g.players[0].y, 12 * TILE - 32); // 停在墙上方
  g.setPlayerInput(1, {});
});

test('坦克不能穿过钢墙', () => {
  const g = makeGame({ seed: 2 });
  stepToPlaying(g);
  loadCustomMap(g, wallMap('S'));
  parkPlayer(g, 1, 12 * TILE, 10 * TILE, DIR.DOWN);
  g.setPlayerInput(1, { down: true });
  g.stepFrames(120);
  assert.equal(g.players[0].y, 12 * TILE - 32);
});

test('坦克不能进入水面', () => {
  const g = makeGame({ seed: 3 });
  stepToPlaying(g);
  loadCustomMap(g, wallMap('W'));
  parkPlayer(g, 1, 12 * TILE, 10 * TILE, DIR.DOWN);
  g.setPlayerInput(1, { down: true });
  g.stepFrames(120);
  assert.equal(g.players[0].y, 12 * TILE - 32);
});

test('坦克可以进入草丛', () => {
  const g = makeGame({ seed: 4 });
  stepToPlaying(g);
  loadCustomMap(g, wallMap('G'));
  parkPlayer(g, 1, 12 * TILE, 10 * TILE, DIR.DOWN);
  g.setPlayerInput(1, { down: true });
  g.stepFrames(120);
  assert.ok(g.players[0].y >= 12 * TILE); // 已进入草丛区域
});

test('坦克可以进入冰面并松开按键后继续滑行', () => {
  const g = makeGame({ seed: 5 });
  stepToPlaying(g);
  const ascii = makeAscii((gr) => {
    for (let r = 8; r <= 11; r++) for (let c = 10; c <= 15; c++) gr[r][c] = 'I';
  });
  loadCustomMap(g, ascii);
  parkPlayer(g, 1, 12 * TILE, 7 * TILE, DIR.DOWN);
  g.setPlayerInput(1, { down: true });
  g.stepFrames(15);
  const releasedY = g.players[0].y;
  assert.ok(g.players[0].iceLockDir === DIR.DOWN || releasedY > 7 * TILE);
  g.setPlayerInput(1, {}); // 松开按键
  g.stepFrames(200);
  assert.equal(g.players[0].y, 12 * TILE); // 滑行直到完全离开冰面
  assert.equal(g.players[0].iceLockDir, null);
});

test('子弹可以穿过水面', () => {
  const g = makeGame({ seed: 6 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    for (let c = 10; c <= 15; c++) gr[8][c] = 'W';
  }));
  const b = spawnBullet(g, { faction: 'player', x: 200, y: 7 * TILE, dir: DIR.DOWN, speed: 4 });
  assert.ok(b);
  g.stepFrames(30);
  assert.ok(g.bullets.some((x) => x.id === b.id)); // 仍存活（穿过了水面）
});

test('普通子弹只破坏砖墙的一个 8×8 子块', () => {
  const g = makeGame({ seed: 7 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    gr[10][10] = '#';
  }));
  const b = spawnBullet(g, { faction: 'player', x: 10 * TILE, y: 10 * TILE + 4, dir: DIR.RIGHT, speed: 4 });
  g.step();
  assert.equal(g.bullets.length, 0); // 子弹被消耗
  assert.equal(g.brickDamage[10 * 26 + 10], 0b0001); // 仅左上子块损坏
  assert.equal(cellAt(g.map, 10, 10), T.BRICK); // 整格仍为砖墙
});

test('普通子弹不能摧毁钢墙', () => {
  const g = makeGame({ seed: 8 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    gr[10][10] = 'S';
  }));
  spawnBullet(g, { faction: 'player', x: 10 * TILE, y: 10 * TILE + 4, dir: DIR.RIGHT, speed: 4 });
  g.stepFrames(4);
  assert.equal(cellAt(g.map, 10, 10), T.STEEL);
  assert.equal(g.bullets.length, 0);
});

test('穿甲弹可以摧毁钢墙', () => {
  const g = makeGame({ seed: 9 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    gr[10][10] = 'S';
  }));
  spawnBullet(g, { faction: 'player', x: 10 * TILE, y: 10 * TILE + 4, dir: DIR.RIGHT, speed: 6, power: 1 });
  g.stepFrames(4);
  assert.equal(cellAt(g.map, 10, 10), T.EMPTY);
});

test('敌对阵营子弹相撞后互相抵消', () => {
  const g = makeGame({ seed: 10 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii(() => {}));
  spawnBullet(g, { faction: 'player', x: 200, y: 200, dir: DIR.RIGHT, speed: 4 });
  spawnBullet(g, { faction: 'enemy', x: 212, y: 200, dir: DIR.LEFT, speed: 4 });
  g.stepFrames(4);
  assert.equal(g.bullets.length, 0);
});

test('高速子弹不会穿透 8px 砖墙（扫掠碰撞）', () => {
  const g = makeGame({ seed: 11 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    gr[10][10] = '#';
  }));
  spawnBullet(g, { faction: 'player', x: 10 * TILE, y: 10 * TILE + 4, dir: DIR.RIGHT, speed: 6 });
  g.step();
  assert.equal(g.bullets.length, 0);
  assert.ok(g.brickDamage[10 * 26 + 10] !== 0);
});

test('坦克之间互相阻挡且不重叠', () => {
  const g = makeGame({ seed: 12, mode: '2p' });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii(() => {}));
  const p1 = parkPlayer(g, 1, 128, 200, DIR.RIGHT);
  const p2 = parkPlayer(g, 2, 168, 200, DIR.LEFT);
  g.setPlayerInput(1, { right: true });
  g.stepFrames(90);
  assert.equal(p1.x, 168 - 32); // 停在 P2 左侧
  assert.ok(p1.x + 32 <= p2.x);
});

test('坦克不能离开地图边界', () => {
  const g = makeGame({ seed: 13 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii(() => {}));
  parkPlayer(g, 1, 128, 384, DIR.UP);
  g.setPlayerInput(1, { up: true });
  g.stepFrames(500);
  assert.equal(g.players[0].y, 0);
  g.setPlayerInput(1, { left: true });
  g.stepFrames(500);
  assert.equal(g.players[0].x, 0);
});
