// 确定性随机数生成器（mulberry32）。
// 游戏逻辑中禁止使用 Math.random / Date.now，全部随机性来自显式 seed 的 RNG，
// 保证相同 seed + 相同输入 => 完全相同的模拟结果（用于确定性自动化测试）。

export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = seed >>> 0;
  }

  /** [0, 1) 均匀分布 */
  next() {
    let t = (this.state += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** [min, max] 整数 */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 随机取数组元素 */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 概率 p 命中 */
  chance(p) {
    return this.next() < p;
  }

  /** 返回打乱后的新数组（不修改原数组） */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 按权重随机取索引 */
  weightedIndex(weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}

/** 字符串哈希为 32 位无符号整数（用于派生 seed） */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
