// 生成系统测试：队列、上限、出生点占用延迟、保护期、不重叠、35 关配置。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, clearField } from './helpers.js';
import { LEVELS } from '../src/levels.js';
import { ENEMIES_PER_LEVEL, MAX_ACTIVE_ENEMIES, ENEMY_TYPE_LIST } from '../src/config.js';
import { tanksOverlap } from '../src/collision.js';

test('开局队列包含 20 辆敌人且逐辆生成', () => {
  const g = makeGame({ seed: 301 });
  stepToPlaying(g);
  assert.equal(g.spawnQueue.length, ENEMIES_PER_LEVEL);
  g.step();
  assert.equal(g.spawnQueue.length, ENEMIES_PER_LEVEL - 1);
  assert.equal(g.activeEnemies(), 1);
});

test('每关队列中道具携带者数量与关卡数据一致', () => {
  for (let stage = 1; stage <= 35; stage++) {
    const g = makeGame({ seed: 300 + stage, stage });
    stepToPlaying(g);
    const flashing = g.spawnQueue.filter((item) => item.flash).length;
    assert.equal(flashing, g.levelData.carriers.length, `关卡 ${stage} 携带者数量`);
  }
});

test('同屏活动敌人不超过 4 辆', () => {
  const g = makeGame({ seed: 302 });
  stepToPlaying(g);
  for (let i = 0; i < 2000; i++) {
    g.step();
    if (i % 10 === 0) assert.ok(g.activeEnemies() <= MAX_ACTIVE_ENEMIES);
  }
});

test('出生点被坦克占据时延迟生成', () => {
  const g = makeGame({ seed: 303 });
  stepToPlaying(g);
  clearField(g);
  g.spawnQueue = [
    { type: 'scout', flash: false },
    { type: 'scout', flash: false },
    { type: 'scout', flash: false },
    { type: 'scout', flash: false },
  ];
  // 用三辆固定坦克堵住全部三个出生点
  for (const [x, y] of [[0, 0], [192, 0], [384, 0]]) {
    const id = g.spawnEnemy('scout', { x, y });
    g.enemies.find((e) => e.id === id).speed = 0;
  }
  const queueBefore = g.spawnQueue.length;
  g.stepFrames(200);
  assert.equal(g.spawnQueue.length, queueBefore); // 无法生成
  assert.equal(g.activeEnemies(), 3);
  g.clearActiveEnemies();
  g.stepFrames(120);
  assert.ok(g.spawnQueue.length < queueBefore); // 清场后恢复生成
});

test('生成中的敌人带保护期，子弹无法伤害', () => {
  const g = makeGame({ seed: 304 });
  stepToPlaying(g);
  clearField(g);
  const id = g.spawnEnemy('scout', { x: 200, y: 100 });
  const e = g.enemies.find((x) => x.id === id);
  assert.ok(e.spawnProtect > 0);
  const p = g.players[0];
  p.x = 168;
  p.y = 100;
  p.dir = 1; // 朝右
  p.spawnProtect = 0;
  p.fireCooldown = 0;
  g.setPlayerInput(1, { fire: true });
  g.stepFrames(12);
  assert.equal(e.alive, true); // 保护期未受伤害
  assert.equal(e.hp, e.maxHp);
});

test('生成的敌人之间永不重叠', () => {
  const g = makeGame({ seed: 305 });
  stepToPlaying(g);
  for (let i = 0; i < 800; i++) {
    g.step();
    if (i % 10 === 0) {
      const alive = g.enemies.filter((e) => e.alive);
      for (let a = 0; a < alive.length; a++) {
        for (let b = a + 1; b < alive.length; b++) {
          assert.equal(tanksOverlap(alive[a], alive[b]), false);
        }
      }
    }
  }
});

test('35 个关卡均定义 20 辆敌人且类型合法', () => {
  for (const lvl of LEVELS) {
    assert.equal(lvl.enemies.length, ENEMIES_PER_LEVEL, `关卡 ${lvl.id} 敌人总数`);
    for (const t of lvl.enemies) {
      assert.ok(ENEMY_TYPE_LIST.includes(t), `关卡 ${lvl.id} 类型 ${t}`);
    }
    for (const i of lvl.carriers) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < ENEMIES_PER_LEVEL, `关卡 ${lvl.id} 携带者索引 ${i}`);
    }
  }
});
