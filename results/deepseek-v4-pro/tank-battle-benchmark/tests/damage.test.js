// 伤害测试：玩家/敌人/基地的受击、保护、重复计分、友军误击。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, parkPlayer, clearField, addIdleEnemy } from './helpers.js';
import { spawnBullet } from '../src/entities/bullet.js';
import { DIR, T, BASE_WALL_CELLS } from '../src/config.js';
import { setCell } from '../src/map.js';
import { STATE } from '../src/state-machine.js';

test('玩家子弹一击击毁基础敌人并正确计分', () => {
  const g = makeGame({ seed: 101 });
  stepToPlaying(g);
  clearField(g);
  parkPlayer(g, 1, 136, 200, DIR.RIGHT);
  const id = g.spawnEnemy('scout', { x: 200, y: 200 });
  const e = g.enemies.find((x) => x.id === id);
  e.spawnProtect = 0;
  e.speed = 0; // 固定靶
  g.setPlayerInput(1, { fire: true });
  g.stepFrames(12);
  assert.equal(e.alive, false);
  assert.equal(g.players[0].score, 100);
  assert.equal(g.stats.kills.p1.scout, 1);
  assert.equal(g.stats.totalKills, 1);
});

test('铁甲敌人需要 4 次命中且受损阶段可见', () => {
  const g = makeGame({ seed: 102 });
  stepToPlaying(g);
  clearField(g);
  const id = g.spawnEnemy('ironclad', { x: 200, y: 200 });
  const e = g.enemies.find((x) => x.id === id);
  e.spawnProtect = 0;
  assert.equal(e.hp, 4);
  g.damageTank(id, 1);
  assert.equal(e.alive, true);
  assert.equal(e.hp, 3);
  assert.equal(e.damageStage, 1); // 受损阶段推进（外观变化）
  g.damageTank(id, 1);
  g.damageTank(id, 1);
  assert.equal(e.alive, true);
  assert.equal(e.hp, 1);
  g.damageTank(id, 1);
  assert.equal(e.alive, false);
  assert.equal(e.hp, 0);
});

test('敌方子弹击毁无保护玩家并进入重生流程', () => {
  const g = makeGame({ seed: 103 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g); // 防止清场后立即触发过关
  const p = parkPlayer(g, 1, 200, 280, DIR.UP);
  spawnBullet(g, { faction: 'enemy', x: 200, y: 200, dir: DIR.DOWN, speed: 3 });
  g.stepFrames(40);
  assert.equal(p.alive, false);
  assert.equal(p.lives, 2);
  assert.equal(p.respawnPending, true);
  assert.equal(g.state, STATE.PLAYER_RESPAWN);
});

test('出生保护罩阻止敌方子弹伤害', () => {
  const g = makeGame({ seed: 104 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  const p = parkPlayer(g, 1, 200, 280, DIR.UP);
  p.spawnProtect = 90;
  spawnBullet(g, { faction: 'enemy', x: 200, y: 200, dir: DIR.DOWN, speed: 3 });
  g.stepFrames(40);
  assert.equal(p.alive, true);
  assert.equal(p.lives, 3);
});

test('防护罩道具阻止敌方子弹伤害', () => {
  const g = makeGame({ seed: 105 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  const p = parkPlayer(g, 1, 200, 280, DIR.UP);
  g.spawnPowerUp('shield', { x: p.cx, y: p.cy });
  g.step(); // 拾取
  assert.ok(p.shield > 0);
  spawnBullet(g, { faction: 'enemy', x: 200, y: 200, dir: DIR.DOWN, speed: 3 });
  g.stepFrames(40);
  assert.equal(p.alive, true);
  assert.equal(p.lives, 3);
});

test('基地被敌方子弹击毁进入游戏结束', () => {
  const g = makeGame({ seed: 106 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g); // 保持关卡未完成，让子弹可以飞行
  for (const c of BASE_WALL_CELLS) setCell(g.map, c.col, c.row, T.EMPTY); // 清开围墙，直击基地
  spawnBullet(g, { faction: 'enemy', x: 200, y: 350, dir: DIR.DOWN, speed: 6 });
  g.stepFrames(10);
  assert.equal(g.baseAlive, false);
  assert.equal(g.state, STATE.GAME_OVER);
});

test('玩家误射基地同样导致游戏结束', () => {
  const g = makeGame({ seed: 107 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  for (const c of BASE_WALL_CELLS) setCell(g.map, c.col, c.row, T.EMPTY);
  const p = parkPlayer(g, 1, 200, 350, DIR.DOWN);
  spawnBullet(g, { faction: 'player', x: p.cx, y: p.cy, dir: DIR.DOWN, speed: 6, ownerId: p.id, playerIndex: 1 });
  g.stepFrames(10);
  assert.equal(g.baseAlive, false);
  assert.equal(g.state, STATE.GAME_OVER);
});

test('已销毁敌人不会重复计分', () => {
  const g = makeGame({ seed: 108 });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  parkPlayer(g, 1, 20, 20, DIR.RIGHT); // 远离弹道
  const id = g.spawnEnemy('scout', { x: 200, y: 200 });
  const e = g.enemies.find((x) => x.id === id);
  e.spawnProtect = 0;
  e.speed = 0;
  // 两发同向同速子弹，同一帧到达敌人
  spawnBullet(g, { faction: 'player', x: 160, y: 216, dir: DIR.RIGHT, speed: 4, ownerId: 999, playerIndex: 1 });
  spawnBullet(g, { faction: 'player', x: 161, y: 216, dir: DIR.RIGHT, speed: 4, ownerId: 999, playerIndex: 1 });
  g.stepFrames(12);
  assert.equal(g.players[0].score, 100); // 只计一次
  assert.equal(g.stats.kills.p1.scout, 1);
  assert.equal(g.stats.totalKills, 1);
});

test('友军误击不扣生命但造成短暂停顿', () => {
  const g = makeGame({ seed: 109, mode: '2p' });
  stepToPlaying(g);
  clearField(g);
  addIdleEnemy(g);
  parkPlayer(g, 1, 136, 200, DIR.RIGHT);
  const p2 = parkPlayer(g, 2, 200, 200, DIR.LEFT);
  const p1 = g.players[0];
  spawnBullet(g, { faction: 'player', x: p1.cx + 19, y: p1.cy, dir: DIR.RIGHT, speed: 4, ownerId: p1.id, playerIndex: 1 });
  g.stepFrames(10);
  assert.equal(p2.alive, true);
  assert.equal(p2.lives, 3);
  assert.ok(p2.stun >= 20 && p2.stun <= 30); // 约 0.5 秒停顿（逐帧递减中）
});
