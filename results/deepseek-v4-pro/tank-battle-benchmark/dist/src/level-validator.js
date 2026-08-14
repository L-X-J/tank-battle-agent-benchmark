// 关卡验证器：对每张地图做结构与可玩性检查。
// 检查项：尺寸、字符合法、基地唯一、出生点/生成点无阻挡、有效路径、
//         敌人总数与类型、关卡编号唯一、地图不重复、不可通行比例合理。
import {
  COLS,
  ROWS,
  TILE_CHARS,
  ENEMIES_PER_LEVEL,
  ENEMY_TYPE_LIST,
  BASE_CELLS,
  ENEMY_SPAWN_POINTS,
  PLAYER_SPAWN_POINTS,
} from './config.js';

// 路径搜索中的"可达"：砖墙可以被子弹破坏，因此按可达处理；
// 水面/钢墙/基地对坦克不可破坏，视为硬障碍。
const REACHABLE = new Set(['.', 'G', 'I', '#']);
// 坦克可直接通行的地形（用于不可通行比例）
const TANK_PASSABLE = new Set(['.', 'G', 'I']);

function charAt(lines, row, col) {
  if (row < 0 || row >= lines.length) return undefined;
  const line = lines[row];
  if (col < 0 || col >= line.length) return undefined;
  return line[col];
}

/** BFS：从 (r,c) 出发，能否到达满足 predicate 的任一格 */
function bfsReachable(lines, start, predicate, reachable = REACHABLE) {
  const seen = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const queue = [[start.row, start.col]];
  seen[start.row][start.col] = true;
  while (queue.length) {
    const [r, c] = queue.shift();
    if (predicate(r, c)) return true;
    const neighbors = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      if (seen[nr][nc]) continue;
      if (!reachable.has(charAt(lines, nr, nc))) continue;
      seen[nr][nc] = true;
      queue.push([nr, nc]);
    }
  }
  return false;
}

export function validateLevel(level) {
  const errors = [];
  const ascii = String(level.ascii ?? '');
  const lines = ascii.trim().split('\n').map((l) => l.trim());
  const id = level.id;
  const name = level.name ?? `STAGE ${id}`;

  // 尺寸
  if (lines.length !== ROWS) errors.push(`[${name}] 行数 ${lines.length} != ${ROWS}`);
  // 字符合法
  for (let r = 0; r < lines.length; r++) {
    if (lines[r].length !== COLS) {
      errors.push(`[${name}] 第 ${r} 行长度 ${lines[r].length} != ${COLS}`);
      continue;
    }
    for (let c = 0; c < COLS; c++) {
      if (!(lines[r][c] in TILE_CHARS)) errors.push(`[${name}] 非法字符 "${lines[r][c]}" @(${c},${r})`);
    }
  }
  if (lines.length !== ROWS) return { ok: false, errors };

  // 基地：恰好 2 格且相邻
  const baseCells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (lines[r][c] === 'B') baseCells.push({ r, c });
    }
  }
  if (baseCells.length !== BASE_CELLS.length) {
    errors.push(`[${name}] 基地格数 ${baseCells.length} != ${BASE_CELLS.length}`);
  }
  if (baseCells.length >= 2) {
    const [a, b] = baseCells;
    const adjacent = Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
    if (!adjacent) errors.push(`[${name}] 基地格不相邻`);
  }

  // 敌人出生点：3 个 2×2 区域必须全为空地
  for (const sp of ENEMY_SPAWN_POINTS) {
    const cells = [
      charAt(lines, sp.row, sp.col),
      charAt(lines, sp.row, sp.col + 1),
      charAt(lines, sp.row + 1, sp.col),
      charAt(lines, sp.row + 1, sp.col + 1),
    ];
    if (cells.some((ch) => ch !== '.')) {
      errors.push(`[${name}] 敌人出生点 (${sp.col},${sp.row}) 被阻挡`);
    }
  }

  // 玩家出生点：2×2 区域全为空地
  for (const sp of PLAYER_SPAWN_POINTS) {
    const cells = [
      charAt(lines, sp.row, sp.col),
      charAt(lines, sp.row, sp.col + 1),
      charAt(lines, sp.row + 1, sp.col),
      charAt(lines, sp.row + 1, sp.col + 1),
    ];
    if (cells.some((ch) => ch !== '.')) {
      errors.push(`[${name}] 玩家出生点 (${sp.col},${sp.row}) 被阻挡`);
    }
  }

  // 有效路径：每个敌人出生点 → 基地附近
  const nearBase = (r, c) => {
    for (const b of BASE_CELLS) {
      if (Math.max(Math.abs(r - b.row), Math.abs(c - b.col)) <= 2) return true;
    }
    return false;
  };
  for (const sp of ENEMY_SPAWN_POINTS) {
    if (!bfsReachable(lines, sp, nearBase)) {
      errors.push(`[${name}] 敌人出生点 (${sp.col},${sp.row}) 到基地无有效路径`);
    }
  }
  // 玩家出生点 → 上方开阔区域
  const openArea = (r) => r <= 20;
  for (const sp of PLAYER_SPAWN_POINTS) {
    if (!bfsReachable(lines, sp, (r) => openArea(r))) {
      errors.push(`[${name}] 玩家出生点 (${sp.col},${sp.row}) 被封死`);
    }
  }

  // 不可通行地形比例合理
  let passable = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (TANK_PASSABLE.has(lines[r][c])) passable++;
    }
  }
  const ratio = passable / (ROWS * COLS);
  if (ratio < 0.45 || ratio > 0.9) {
    errors.push(`[${name}] 可通行比例 ${ratio.toFixed(2)} 超出 [0.45, 0.9]`);
  }

  // 敌人配置
  const enemies = level.enemies ?? [];
  if (enemies.length !== ENEMIES_PER_LEVEL) {
    errors.push(`[${name}] 敌人总数 ${enemies.length} != ${ENEMIES_PER_LEVEL}`);
  }
  for (const t of enemies) {
    if (!ENEMY_TYPE_LIST.includes(t)) errors.push(`[${name}] 非法敌人类型 ${t}`);
  }
  for (const i of level.carriers ?? []) {
    if (!Number.isInteger(i) || i < 0 || i >= ENEMIES_PER_LEVEL) {
      errors.push(`[${name}] 非法道具携带者索引 ${i}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateAll(levels) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  const layouts = new Set();
  for (const level of levels) {
    const result = validateLevel(level);
    errors.push(...result.errors);
    if (ids.has(level.id)) errors.push(`关卡编号重复: ${level.id}`);
    ids.add(level.id);
    if (names.has(level.name)) errors.push(`关卡名称重复: ${level.name}`);
    names.add(level.name);
    const layout = level.ascii.trim();
    if (layouts.has(layout)) errors.push(`地图数据完全重复: 关卡 ${level.id}`);
    layouts.add(layout);
  }
  return { ok: errors.length === 0, errors };
}
