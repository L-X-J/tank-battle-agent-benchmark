// 地图系统：ASCII 地图解析、地形编码查询、砖墙子块损坏位。
// 网格 26×26，每格 16×16。砖墙一格划分为 4 个 8×8 子块，支持局部破坏。
import { COLS, ROWS, T, TILE_CHARS, TILE } from './config.js';

export function parseAscii(ascii) {
  const lines = String(ascii).trim().split('\n').map((l) => l.trim());
  if (lines.length !== ROWS) {
    throw new Error(`地图行数错误: ${lines.length} != ${ROWS}`);
  }
  const cells = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    const line = lines[row];
    if (line.length !== COLS) {
      throw new Error(`地图第 ${row} 行长度错误: ${line.length} != ${COLS}`);
    }
    for (let col = 0; col < COLS; col++) {
      const code = TILE_CHARS[line[col]];
      if (code === undefined) {
        throw new Error(`非法地形字符 "${line[col]}" @(${col},${row})`);
      }
      cells[row * COLS + col] = code;
    }
  }
  return {
    w: COLS,
    h: ROWS,
    cells,
    ascii: lines.join('\n'),
  };
}

export function toAscii(map, brickDamage) {
  const lines = [];
  for (let row = 0; row < map.h; row++) {
    let line = '';
    for (let col = 0; col < map.w; col++) {
      const idx = row * map.w + col;
      const code = map.cells[idx];
      if (code === T.BRICK && brickDamage && brickDamage[idx] === 0b1111) {
        line += '.';
      } else {
        line += code === T.BRICK ? '#' : code === T.STEEL ? 'S' : code === T.WATER ? 'W' : code === T.GRASS ? 'G' : code === T.ICE ? 'I' : code === T.BASE ? 'B' : '.';
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** 边界外视为钢墙（不可通行、阻挡子弹） */
export function cellAt(map, col, row) {
  if (col < 0 || row < 0 || col >= map.w || row >= map.h) return T.STEEL;
  return map.cells[row * map.w + col];
}

export function setCell(map, col, row, code) {
  if (col < 0 || row < 0 || col >= map.w || row >= map.h) return;
  map.cells[row * map.w + col] = code;
}

/** 坦克不可通行地形：砖墙/钢墙/水面/基地 */
export const isSolidForTank = (code) =>
  code === T.BRICK || code === T.STEEL || code === T.WATER || code === T.BASE;

/** 子弹会被阻挡的地形：砖墙/钢墙/基地（水面、草丛、冰面不阻挡） */
export const blocksBullet = (code) =>
  code === T.BRICK || code === T.STEEL || code === T.BASE;

/**
 * 砖墙子块索引：16×16 格划分为 4 个 8×8 子块。
 * px/py 为格内坐标（0..15）：0=左上 1=右上 2=左下 3=右下
 */
export function quadIndexAt(px, py) {
  return ((py & 8) ? 2 : 0) + ((px & 8) ? 1 : 0);
}

/** 格左上角像素坐标 */
export function tileX(col) {
  return col * TILE;
}
export function tileY(row) {
  return row * TILE;
}
