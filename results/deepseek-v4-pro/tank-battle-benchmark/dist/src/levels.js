// 关卡系统：35 个原创关卡，使用固定种子的确定性生成。
// 同一版本、同一关卡每次加载布局完全一致；每个关卡在生成时立即通过关卡验证器，
// 验证失败则递增种子重试（依然确定性），保证交付的 35 关全部合法。
import {
  COLS,
  ROWS,
  ENEMIES_PER_LEVEL,
  BASE_CELLS,
  BASE_WALL_CELLS,
} from './config.js';
import { RNG } from './rng.js';
import { validateLevel } from './level-validator.js';

export const STAGE_NAMES = [
  'IRON DAWN',
  'BRICK LINE',
  'CROSSFIRE',
  'RIVER RUN',
  'STEEL GATE',
  'FROZEN PATH',
  'HIDDEN FOE',
  'DUAL LANE',
  'WATERFALL',
  'IRON WALL',
  'NIGHT PATROL',
  'SNOW FIELD',
  'STEEL FOREST',
  'CROSSING',
  'AMBUSH',
  'ICE AGE',
  'RIVER FORT',
  "GUNNER'S DEN",
  'TWIN PEAKS',
  'ARROWHEAD',
  'COLD STEEL',
  'MOAT CITY',
  'BRICK MAZE',
  'STEEL CROSS',
  'GLACIER',
  'IRONCLAD ROW',
  'WALL OF FIRE',
  'DEEP WATER',
  'CHOKE POINT',
  'STORM FRONT',
  'FORTRESS',
  'FROZEN FORTRESS',
  'THE GAUNTLET',
  'LAST BASTION',
  'FINAL FRONTIER',
];

const BASE_SEED = 0x5eed0000;

function blankGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill('.'));
}

function placeBase(g) {
  for (const c of BASE_CELLS) g[c.row][c.col] = 'B';
  for (const c of BASE_WALL_CELLS) {
    if (g[c.row][c.col] === '.') g[c.row][c.col] = '#';
  }
}

/** 每关 20 辆敌人的类型构成：难度随关卡上升（火力手/铁甲/突击兵占比增大） */
function buildEnemyList(level, rng) {
  const gunner = level >= 4 ? Math.min(6, Math.ceil((level - 2) / 5)) : 0;
  const ironclad = level >= 9 ? Math.min(5, Math.ceil((level - 7) / 5)) : 0;
  const striker = level >= 2 ? Math.min(7, 3 + Math.floor(level / 6)) : 1;
  const scout = ENEMIES_PER_LEVEL - gunner - ironclad - striker;
  const list = [];
  for (let i = 0; i < scout; i++) list.push('scout');
  for (let i = 0; i < striker; i++) list.push('striker');
  for (let i = 0; i < gunner; i++) list.push('gunner');
  for (let i = 0; i < ironclad; i++) list.push('ironclad');
  return rng.shuffle(list);
}

/** 每关固定 4 个闪烁道具携带者（生成顺序索引） */
function buildCarriers(level) {
  const carriers = [];
  for (let i = 0; i < ENEMIES_PER_LEVEL; i++) {
    if ((i * 7 + level * 3) % 5 === 2) carriers.push(i);
  }
  return carriers;
}

function placeCluster(g, rng, ch, w, h) {
  const col = rng.int(1, COLS - 1 - w);
  const row = rng.int(2, ROWS - 7 - h); // 底部 6 行保持畅通，保证玩家出口与进攻路径
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (g[r][c] === '.') g[r][c] = ch;
    }
  }
}

function buildLayout(level, rng) {
  const g = blankGrid();
  placeBase(g);

  const bricks = Math.min(10, 4 + Math.floor(level / 2));
  const steel = level >= 8 ? Math.min(7, Math.floor((level - 6) / 4)) : 0;
  const water = level >= 4 ? Math.min(4, 1 + Math.floor((level - 2) / 6)) : 0;
  const ice = level >= 6 ? Math.min(5, 1 + Math.floor((level - 4) / 8)) : 0;
  const grass = 2 + (level % 3);

  // 砖墙簇
  for (let i = 0; i < bricks; i++) {
    placeCluster(g, rng, '#', rng.int(2, 5), rng.int(2, 4));
  }
  // 钢墙条（横向或纵向）
  for (let i = 0; i < steel; i++) {
    const len = rng.int(2, 5);
    if (rng.chance(0.5)) {
      placeCluster(g, rng, 'S', len, 1);
    } else {
      placeCluster(g, rng, 'S', 1, len);
    }
  }
  // 水面横段（保留缺口，敌人无法通过水面）
  for (let i = 0; i < water; i++) {
    const len = rng.int(12, 20);
    const col = rng.int(1, COLS - 1 - len);
    const row = rng.int(3, 16);
    for (let c = col; c < col + len; c++) {
      if (g[row][c] === '.') g[row][c] = 'W';
    }
  }
  // 冰面
  for (let i = 0; i < ice; i++) {
    placeCluster(g, rng, 'I', rng.int(3, 6), rng.int(2, 3));
  }
  // 草丛
  for (let i = 0; i < grass; i++) {
    placeCluster(g, rng, 'G', rng.int(2, 5), rng.int(2, 3));
  }
  return g;
}

function generate(level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const seed = (BASE_SEED + level * 0x9e3779b9 + attempt * 0x85ebca77) >>> 0;
    const rng = new RNG(seed);
    const grid = buildLayout(level, rng);
    const ascii = grid.map((r) => r.join('')).join('\n');
    const enemiesRng = new RNG((seed ^ 0xcafe1234) >>> 0);
    const lvl = {
      id: level,
      name: STAGE_NAMES[level - 1],
      ascii,
      enemies: buildEnemyList(level, enemiesRng),
      carriers: buildCarriers(level),
      seed,
    };
    const result = validateLevel(lvl);
    if (result.ok) return lvl;
    // 验证失败 → 换种子重试（确定性，不引入随机环境因素）
  }
  throw new Error(`关卡 ${level} 生成失败：60 次尝试均未通过验证`);
}

/** 全部 35 关：模块加载时生成，任何一关非法会立即抛错（fail fast） */
export const LEVELS = [];
for (let i = 1; i <= 35; i++) {
  LEVELS.push(generate(i));
}

export function getLevel(n) {
  return LEVELS[n - 1];
}
