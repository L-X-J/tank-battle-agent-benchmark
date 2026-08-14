// 确定性模拟测试：固定 seed 长跑 3600 帧，验证稳定性、数值健康、资源上限与可复现性。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepToPlaying, isFiniteDeep, loadCustomMap, makeAscii } from './helpers.js';
import { spawnBullet } from '../src/entities/bullet.js';
import { DIR, BULLETS_MAX, EFFECTS_MAX, FIELD_W, FIELD_H } from '../src/config.js';
import { STATE } from '../src/state-machine.js';

const PATTERNS = [
  { up: true, fire: true },
  { right: true },
  { down: true, fire: true },
  { left: true },
];

function runScripted(g, frames) {
  const validStates = new Set(Object.values(STATE));
  let maxBullets = 0;
  let maxEffects = 0;
  for (let i = 0; i < frames; i++) {
    g.setPlayerInput(1, PATTERNS[(i / 60 | 0) % 4]);
    g.step();
    if (i % 25 === 0) {
      const s = g.getSnapshot();
      assert.ok(validStates.has(s.state), `非法状态 ${s.state}`);
      assert.ok(isFiniteDeep(s), `帧 ${i} 存在 NaN/Infinity`);
      for (const t of [...s.players, ...s.enemies]) {
        if (t.alive) {
          assert.ok(t.x >= 0 && t.y >= 0 && t.x <= FIELD_W - 32 && t.y <= FIELD_H - 32, `坦克越界 @${i}`);
        }
      }
    }
    maxBullets = Math.max(maxBullets, g.bullets.length);
    maxEffects = Math.max(maxEffects, g.effects.length);
    assert.ok(maxBullets <= BULLETS_MAX);
    assert.ok(maxEffects <= EFFECTS_MAX);
    assert.ok(g.enemies.length <= 25);
    assert.ok(g.powerup === null || g.powerup.life >= 0);
  }
  return { maxBullets, maxEffects };
}

test('固定 seed 模拟 3600 逻辑帧：无异常、无 NaN/Infinity、对象有界、坦克不越界', () => {
  const g = makeGame({ seed: 424242 });
  stepToPlaying(g);
  const { maxBullets, maxEffects } = runScripted(g, 3600);
  assert.ok(maxBullets <= BULLETS_MAX, `子弹峰值 ${maxBullets}`);
  assert.ok(maxEffects <= EFFECTS_MAX, `特效峰值 ${maxEffects}`);
});

test('相同 seed 与相同输入得到完全相同的模拟结果（确定性）', () => {
  const mk = () => {
    const g = makeGame({ seed: 987654 });
    stepToPlaying(g);
    return g;
  };
  const a = mk();
  const b = mk();
  const checkpoints = [600, 1800, 3600];
  for (let i = 1; i <= 3600; i++) {
    const input = PATTERNS[(i / 60 | 0) % 4];
    a.setPlayerInput(1, input);
    b.setPlayerInput(1, input);
    a.step();
    b.step();
    if (checkpoints.includes(i)) {
      assert.equal(JSON.stringify(a.getSnapshot()), JSON.stringify(b.getSnapshot()), `帧 ${i} 快照不一致`);
    }
  }
});

test('已销毁的子弹立即被清理，不会长期残留', () => {
  const g = makeGame({ seed: 555 });
  stepToPlaying(g);
  loadCustomMap(g, makeAscii((gr) => {
    gr[10][10] = '#';
  }));
  // 直接朝砖墙开一枪：下一帧即销毁并从数组移除
  spawnBullet(g, { faction: 'player', x: 160, y: 164, dir: DIR.RIGHT, speed: 4 });
  assert.equal(g.bullets.length, 1);
  g.step();
  assert.equal(g.bullets.length, 0);
});

test('DEMO 模式连续运行 3600 帧（60 秒）无异常且敌人持续生成', () => {
  const g = makeGame({ seed: 606, mode: 'demo' });
  stepToPlaying(g);
  let sawSpawn = false;
  let sawFire = false;
  let frames = 0;
  try {
    for (let i = 0; i < 3600; i++) {
      g.step();
      frames++;
      if (g.spawnQueue.length < 20) sawSpawn = true;
      if (g.bullets.some((b) => b.faction === 'player')) sawFire = true;
      if (i % 100 === 0) assert.ok(isFiniteDeep(g.getSnapshot()));
    }
  } catch (e) {
    assert.fail(`DEMO 运行异常: ${e.message}`);
  }
  assert.equal(frames, 3600);
  assert.ok(sawSpawn, '敌人应有生成');
  assert.ok(sawFire, 'DEMO 玩家应有开火');
});
