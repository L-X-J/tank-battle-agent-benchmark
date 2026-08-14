// 网格路径搜索工具：BFS（26×26 网格代价极低）。
// AI 与道具掉落位置校验共用；支持"砖墙可破坏→视为可达"模式。
import { COLS, ROWS, T } from './config.js';
import { cellAt } from './map.js';

/** 坦克可通行地形（可选：砖墙可被子弹破坏，视为可达） */
export function passableForTank(code, brickReachable) {
  return (
    code === T.EMPTY ||
    code === T.GRASS ||
    code === T.ICE ||
    (brickReachable && code === T.BRICK)
  );
}

/** BFS：从 (startCol,startRow) 出发，是否存在满足 predicate 的格 */
export function bfs(game, startCol, startRow, predicate, opts = {}) {
  return bfsPathToNearest(game, startCol, startRow, predicate, opts) !== null;
}

/**
 * BFS 寻路：返回从起点到"最近"满足 predicate 的格的路径（含起点与终点，格坐标数组）。
 * 无路径返回 null。起点必须本身可通行。
 */
export function bfsPathToNearest(game, startCol, startRow, predicate, opts = {}) {
  const brickReachable = !!opts.brickReachable;
  const size = COLS * ROWS;
  const seen = new Uint8Array(size);
  const prev = new Int32Array(size).fill(-1);
  const startIdx = startRow * COLS + startCol;
  const queue = [startIdx];
  seen[startIdx] = 1;
  let endIdx = -1;

  while (queue.length) {
    const cur = queue.shift();
    const r = (cur / COLS) | 0;
    const c = cur % COLS;
    if (predicate(c, r)) {
      endIdx = cur;
      break;
    }
    const nbs = [];
    if (r > 0) nbs.push(cur - COLS);
    if (r < ROWS - 1) nbs.push(cur + COLS);
    if (c > 0) nbs.push(cur - 1);
    if (c < COLS - 1) nbs.push(cur + 1);
    for (const nb of nbs) {
      if (seen[nb]) continue;
      const nr = (nb / COLS) | 0;
      const nc = nb % COLS;
      if (!passableForTank(cellAt(game.map, nc, nr), brickReachable)) continue;
      seen[nb] = 1;
      prev[nb] = cur;
      queue.push(nb);
    }
  }

  if (endIdx === -1) return null;
  const path = [];
  for (let i = endIdx; i !== -1; i = prev[i]) path.push(i);
  path.reverse();
  return path.map((i) => ({ col: i % COLS, row: (i / COLS) | 0 }));
}
