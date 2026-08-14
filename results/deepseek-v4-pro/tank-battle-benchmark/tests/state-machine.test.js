// 游戏流程测试：状态机、暂停、关卡推进、双人死亡规则、胜利、重开、死亡降级。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, clearField, parkPlayer, stepUntil } from './helpers.js';
import { STATE } from '../src/state-machine.js';
import { DIR, LEVEL_COUNT, PLAYER_SPAWN_POINTS, TILE, T, BASE_WALL_CELLS } from '../src/config.js';

test('完整启动流程：BOOT → 主菜单 → 关卡介绍 → 游戏', () => {
  const g = makeGame({ seed: 401 });
  assert.ok(stepToPlaying(g)); // 通过 STAGE_INTRO 进入 PLAYING
  assert.equal(g.state, STATE.PLAYING);
  assert.equal(g.stage, 1);
});

test('暂停期间所有计时器停止推进', () => {
  const g = makeGame({ seed: 402 });
  stepToPlaying(g);
  clearField(g);
  g.spawnPowerUp('star', { x: 100, y: 100 });
  g.pauseGame();
  const before = g.getSnapshot();
  g.stepFrames(600);
  const after = g.getSnapshot();
  assert.equal(after.frame, before.frame);
  assert.equal(after.stateTimer, before.stateTimer);
  assert.equal(after.powerup.life, before.powerup.life);
  assert.equal(after.freezeTimer, before.freezeTimer);
  g.resumeGame();
  assert.equal(g.state, STATE.PLAYING);
});

test('消灭全部敌人 → 通关动画 → 分数统计 → 下一关', () => {
  const g = makeGame({ seed: 403 });
  stepToPlaying(g);
  g.clearActiveEnemies();
  g.spawnQueue = [];
  assert.ok(stepUntil(g, (x) => x.state === STATE.STAGE_CLEAR));
  assert.ok(stepUntil(g, (x) => x.state === STATE.SCORE_SUMMARY));
  assert.ok(stepUntil(g, (x) => x.state === STATE.STAGE_INTRO && x.stage === 2));
  assert.ok(stepUntil(g, (x) => x.state === STATE.PLAYING && x.stage === 2));
});

test('基地被摧毁 → 游戏结束 → 回到主菜单', () => {
  const g = makeGame({ seed: 404 });
  stepToPlaying(g);
  g.destroyBase();
  assert.equal(g.state, STATE.GAME_OVER);
  assert.ok(stepUntil(g, (x) => x.state === STATE.MAIN_MENU));
});

test('双人模式：一名玩家死亡不结束游戏并会重生', () => {
  const g = makeGame({ seed: 405, mode: '2p' });
  stepToPlaying(g);
  clearField(g);
  const p2 = parkPlayer(g, 2, 200, 200, DIR.UP);
  p2.spawnProtect = 0;
  g.damageTank(p2.id, 1);
  assert.equal(g.state, STATE.PLAYER_RESPAWN); // 进入重生，而非游戏结束
  assert.equal(p2.lives, 2);
  assert.ok(stepUntil(g, (x) => x.state === STATE.PLAYING && p2.alive));
  assert.ok(p2.spawnProtect > 0); // 重生带保护罩
  assert.equal(p2.x, PLAYER_SPAWN_POINTS[1].col * TILE);
});

test('双人模式：两名玩家生命耗尽才结束游戏', () => {
  const g = makeGame({ seed: 406, mode: '2p' });
  stepToPlaying(g);
  clearField(g);
  const p1 = parkPlayer(g, 1, 100, 100, DIR.UP);
  const p2 = parkPlayer(g, 2, 200, 100, DIR.UP);
  p1.lives = 1;
  p2.lives = 1;
  g.damageTank(p1.id, 1); // P1 生命耗尽，等待重生
  assert.notEqual(g.state, STATE.GAME_OVER);
  g.damageTank(p2.id, 1); // P2 也耗尽
  assert.equal(g.state, STATE.GAME_OVER);
});

test('第 35 关完成后进入胜利状态', () => {
  const g = makeGame({ seed: 407, stage: LEVEL_COUNT });
  stepToPlaying(g);
  assert.equal(g.stage, LEVEL_COUNT);
  g.clearActiveEnemies();
  g.spawnQueue = [];
  assert.ok(stepUntil(g, (x) => x.state === STATE.STAGE_CLEAR));
  assert.ok(stepUntil(g, (x) => x.state === STATE.VICTORY));
});

test('R 重开当前关卡：保留生命/分数，地图与敌人重置', () => {
  const g = makeGame({ seed: 408 });
  stepToPlaying(g);
  const p = g.players[0];
  p.score = 777;
  p.lives = 2;
  p.level = 2;
  // 破坏基地围墙中的一块砖墙
  const wall = BASE_WALL_CELLS[0];
  const wallIdx = wall.row * 26 + wall.col;
  g.brickDamage[wallIdx] = 0b1111;
  g.map.cells[wallIdx] = T.EMPTY;
  g.restartStage();
  assert.equal(g.state, STATE.PLAYING);
  assert.equal(g.stage, 1);
  assert.equal(p.score, 777);
  assert.equal(p.lives, 2);
  assert.equal(p.level, 2);
  assert.equal(g.spawnQueue.length, 20);
  assert.equal(g.brickDamage.every((v) => v === 0), true); // 地图恢复
  assert.equal(g.map.cells[wallIdx], T.BRICK);
  assert.equal(p.alive, true);
});

test('玩家死亡后火力等级降低一级（最低 0）', () => {
  const g = makeGame({ seed: 409 });
  stepToPlaying(g);
  clearField(g);
  const p = parkPlayer(g, 1, 200, 200, DIR.UP);
  p.level = 3;
  g.damageTank(p.id, 1);
  assert.ok(stepUntil(g, (x) => p.alive && x.state === STATE.PLAYING));
  assert.equal(p.level, 2); // 3 → 2
  p.level = 0;
  g.damageTank(p.id, 1);
  assert.ok(stepUntil(g, (x) => p.alive && x.state === STATE.PLAYING));
  assert.equal(p.level, 0); // 0 级保持 0
});

test('游戏结束后回到主菜单（非 DEMO）', () => {
  const g = makeGame({ seed: 410 });
  stepToPlaying(g);
  g.destroyBase();
  assert.ok(stepUntil(g, (x) => x.state === STATE.MAIN_MENU));
  assert.equal(g.menu.index, 0);
});
