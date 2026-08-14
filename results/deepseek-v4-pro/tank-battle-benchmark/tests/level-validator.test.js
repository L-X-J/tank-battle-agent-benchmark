// 关卡验证测试：35 关全部合法、无重复、基地唯一、出生点合法、敌人配置、有效路径、难度上升。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { validateLevel, validateAll } from '../src/level-validator.js';
import { Game } from '../src/game.js';
import { bfsPathToNearest } from '../src/pathfind.js';
import { ENEMIES_PER_LEVEL, ENEMY_SPAWN_POINTS, PLAYER_SPAWN_POINTS, LEVEL_COUNT } from '../src/config.js';

test('35 个关卡全部通过关卡验证器', () => {
  const result = validateAll(LEVELS);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(LEVELS.length, LEVEL_COUNT);
});

test('不存在完全重复的地图布局与重复编号', () => {
  const layouts = new Set(LEVELS.map((l) => l.ascii));
  assert.equal(layouts.size, LEVEL_COUNT);
  const ids = new Set(LEVELS.map((l) => l.id));
  assert.equal(ids.size, LEVEL_COUNT);
  const names = new Set(LEVELS.map((l) => l.name));
  assert.equal(names.size, LEVEL_COUNT);
});

test('每关基地存在且唯一，出生点无阻挡', () => {
  for (const lvl of LEVELS) {
    const lines = lvl.ascii.split('\n');
    const baseCount = lines.join('').split('B').length - 1;
    assert.equal(baseCount, 2, `关卡 ${lvl.id} 基地格数`);
    for (const sp of ENEMY_SPAWN_POINTS) {
      assert.equal(lines[sp.row][sp.col], '.', `关卡 ${lvl.id} 敌生成点`);
      assert.equal(lines[sp.row + 1][sp.col], '.');
      assert.equal(lines[sp.row][sp.col + 1], '.');
      assert.equal(lines[sp.row + 1][sp.col + 1], '.');
    }
    for (const sp of PLAYER_SPAWN_POINTS) {
      assert.equal(lines[sp.row][sp.col], '.', `关卡 ${lvl.id} 玩家出生点`);
      assert.equal(lines[sp.row + 1][sp.col], '.');
      assert.equal(lines[sp.row][sp.col + 1], '.');
      assert.equal(lines[sp.row + 1][sp.col + 1], '.');
    }
  }
});

test('每关敌人总数与类型配置正确', () => {
  for (const lvl of LEVELS) {
    assert.equal(lvl.enemies.length, ENEMIES_PER_LEVEL);
    assert.equal(new Set(lvl.carriers).size, lvl.carriers.length); // 携带者不重复
    const v = validateLevel(lvl);
    assert.equal(v.ok, true, v.errors.join('; '));
  }
});

test('每关存在从敌人区域通往基地附近的有效路径', () => {
  const g = new Game({ seed: 501 });
  for (const lvl of LEVELS) {
    g.loadStageData(lvl.id);
    for (const sp of ENEMY_SPAWN_POINTS) {
      const path = bfsPathToNearest(
        g,
        sp.col,
        sp.row,
        (c, r) => Math.max(Math.abs(c - 12), Math.abs(r - 24)) <= 2,
        { brickReachable: true } // 砖墙可被子弹破坏，按可达处理
      );
      assert.ok(path, `关卡 ${lvl.id} 出生点 (${sp.col},${sp.row}) 无路径`);
    }
  }
});

test('难度随关卡总体上升（后期障碍物明显更多）', () => {
  const countObstacles = (ascii) => {
    let n = 0;
    for (const ch of ascii) if ('#SWB'.includes(ch)) n++;
    return n;
  };
  const early = LEVELS.slice(0, 5).reduce((s, l) => s + countObstacles(l.ascii), 0) / 5;
  const late = LEVELS.slice(-5).reduce((s, l) => s + countObstacles(l.ascii), 0) / 5;
  assert.ok(late > early, `后期障碍均值 ${late} 应大于前期 ${early}`);
  assert.ok(countObstacles(LEVELS[34].ascii) > countObstacles(LEVELS[0].ascii));
});
