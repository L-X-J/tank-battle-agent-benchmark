// 道具测试：6 种道具的效果、过期、替换、掉落与计分。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, loadCustomMap, makeAscii, parkPlayer, clearField, addIdleEnemy } from './helpers.js';
import { spawnBullet } from '../src/entities/bullet.js';
import { applyPowerup } from '../src/entities/powerup.js';
import { DIR, T, POWERUP, BASE_WALL_CELLS, ENEMY_TYPES } from '../src/config.js';
import { cellAt } from '../src/map.js';

test('星星提高火力等级但不超过 3 级上限', () => {
  const g = makeGame({ seed: 201 });
  stepToPlaying(g);
  clearField(g);
  const p = g.players[0];
  assert.equal(p.level, 0);
  applyPowerup(g, p, 'star');
  assert.equal(p.level, 1);
  applyPowerup(g, p, 'star');
  assert.equal(p.level, 2);
  applyPowerup(g, p, 'star');
  assert.equal(p.level, 3);
  applyPowerup(g, p, 'star'); // 上限
  assert.equal(p.level, 3);
});

test('防护罩约 10 秒后到期', () => {
  const g = makeGame({ seed: 202 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  const p = g.players[0];
  applyPowerup(g, p, 'shield');
  assert.equal(p.shield, POWERUP.shieldDuration);
  g.stepFrames(POWERUP.shieldDuration);
  assert.equal(p.shield, 0);
});

test('时钟冻结敌人与敌方子弹并在到期后恢复', () => {
  const g = makeGame({ seed: 203 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii(() => {})); // 空旷地图，保证敌人可自由移动
  const id = g.spawnEnemy('scout', { x: 200, y: 100 });
  const e = g.enemies.find((x) => x.id === id);
  e.spawnProtect = 0;
  spawnBullet(g, { faction: 'enemy', x: 300, y: 300, dir: DIR.LEFT, speed: 3 });
  applyPowerup(g, g.players[0], 'clock');
  assert.equal(g.freezeTimer, POWERUP.clockDuration);
  g.stepFrames(30);
  const frozenY = e.y;
  const frozenBulletX = g.bullets.length ? g.bullets[0].x : 300;
  g.stepFrames(120);
  assert.equal(e.y, frozenY); // 敌人被冻结
  assert.equal(g.bullets.length ? g.bullets[0].x : null, frozenBulletX); // 子弹被冻结
  g.stepFrames(POWERUP.clockDuration); // 冻结结束
  assert.equal(g.freezeTimer, 0);
  g.stepFrames(60);
  assert.notEqual(e.y, frozenY); // 恢复行动
});

test('时钟冻结期间新生成的敌人同样被冻结', () => {
  const g = makeGame({ seed: 204 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii(() => {}));
  applyPowerup(g, g.players[0], 'clock');
  g.spawnQueue = [{ type: 'scout', flash: false }];
  g.stepFrames(40); // 冻结期间仍会生成
  const spawned = g.enemies.find((e) => e.alive);
  assert.ok(spawned);
  const x0 = spawned.x;
  g.stepFrames(120);
  assert.equal(spawned.x, x0); // 新生成的敌人被冻结
});

test('铲子将基地围墙变为钢墙并在到期后恢复原状', () => {
  const g = makeGame({ seed: 205 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  const before = BASE_WALL_CELLS.map((c) => cellAt(g.map, c.col, c.row));
  assert.ok(before.every((code) => code === T.BRICK));
  applyPowerup(g, g.players[0], 'shovel');
  for (const c of BASE_WALL_CELLS) {
    assert.equal(cellAt(g.map, c.col, c.row), T.STEEL);
  }
  g.stepFrames(POWERUP.shovelDuration + 1);
  const after = BASE_WALL_CELLS.map((c) => cellAt(g.map, c.col, c.row));
  assert.deepEqual(after, before); // 恢复拾取前状态
});

test('铲子重复拾取刷新时长且不破坏墙体状态', () => {
  const g = makeGame({ seed: 206 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  applyPowerup(g, g.players[0], 'shovel');
  g.stepFrames(300);
  applyPowerup(g, g.players[0], 'shovel'); // 刷新
  assert.equal(g.shovelTimer, POWERUP.shovelDuration);
  g.stepFrames(POWERUP.shovelDuration + 1);
  assert.ok(BASE_WALL_CELLS.every((c) => cellAt(g.map, c.col, c.row) === T.BRICK));
});

test('手雷只消灭当前活动敌人并正确计分', () => {
  const g = makeGame({ seed: 207 });
  stepToPlaying(g);
  clearField(g);
  g.spawnQueue = [
    { type: 'scout', flash: false },
    { type: 'striker', flash: false },
    { type: 'gunner', flash: false },
  ]; // 等待生成的敌人
  g.spawnEnemy('gunner', { x: 300, y: 300 });
  g.spawnEnemy('striker', { x: 100, y: 300 });
  for (const e of g.enemies) e.spawnProtect = 0;
  const queueBefore = g.spawnQueue.length;
  const killScore = g.enemies
    .filter((e) => e.alive)
    .reduce((s, e) => s + ENEMY_TYPES[e.type].score, 0);
  applyPowerup(g, g.players[0], 'grenade');
  assert.equal(g.activeEnemies(), 0); // 场上敌人全灭
  assert.equal(g.spawnQueue.length, queueBefore); // 等待生成的不受影响
  assert.equal(g.players[0].score, killScore + POWERUP.pickupScore); // 击杀分 + 拾取分
  assert.equal(g.baseAlive, true);
  assert.equal(g.powerup, null); // 手雷击杀不掉落道具
});

test('额外生命道具增加一条生命', () => {
  const g = makeGame({ seed: 208 });
  stepToPlaying(g);
  clearField(g);
  const p = g.players[0];
  assert.equal(p.lives, 3);
  applyPowerup(g, p, 'life');
  assert.equal(p.lives, 4);
});

test('道具经过合理时间后自动消失', () => {
  const g = makeGame({ seed: 209 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  g.spawnPowerUp('star', { x: 100, y: 100 });
  assert.ok(g.powerup);
  g.stepFrames(POWERUP.life + 1);
  assert.equal(g.powerup, null);
});

test('同一时间最多存在一个未拾取道具（新道具替换旧道具）', () => {
  const g = makeGame({ seed: 210 });
  stepToPlaying(g);
  clearField(g);
  g.spawnPowerUp('star', { x: 100, y: 100 });
  g.spawnPowerUp('shield', { x: 200, y: 200 });
  assert.equal(g.powerup.type, 'shield');
});

test('闪烁的道具携带者被击毁后掉落道具', () => {
  const g = makeGame({ seed: 211 });
  stepToPlaying(g);
  clearField(g);
  g.spawnQueue = [{ type: g.levelData.enemies[g.levelData.carriers[0]], flash: true }];
  g.stepFrames(60); // 等待携带者生成
  const carrier = g.enemies.find((e) => e.alive);
  assert.ok(carrier);
  assert.equal(carrier.flash, true);
  carrier.spawnProtect = 0;
  g.damageTank(carrier.id, 1);
  assert.ok(g.powerup); // 掉落道具
});

test('拾取道具获得 500 分并播放反馈', () => {
  const g = makeGame({ seed: 212 });
  stepToPlaying(g);
  clearField(g);
  const p = parkPlayer(g, 1, 200, 200, DIR.UP);
  g.spawnPowerUp('star', { x: p.cx, y: p.cy });
  const scoreBefore = p.score;
  g.step();
  assert.equal(g.powerup, null);
  assert.equal(p.score, scoreBefore + POWERUP.pickupScore);
  assert.equal(p.level, 1);
});
