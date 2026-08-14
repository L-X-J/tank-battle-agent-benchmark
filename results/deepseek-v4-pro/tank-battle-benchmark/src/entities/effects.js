// 特效系统：爆炸/火花/得分浮字/出生星光等短生命周期动画对象。
// 特效只依赖帧计数（确定性），带硬上限并即时清理，绝不长期残留。
import { EFFECTS_MAX, TIMING } from '../config.js';

export const FX = {
  EXPLOSION_S: 'explosion_s',
  EXPLOSION_L: 'explosion_l',
  SPARK: 'spark',
  SCORE: 'score',
  SPAWN: 'spawn',
  POP: 'pop',
};

const LIFETIMES = {
  [FX.EXPLOSION_S]: 24,
  [FX.EXPLOSION_L]: 48,
  [FX.SPARK]: 12,
  [FX.SCORE]: 45,
  [FX.SPAWN]: TIMING.enemySpawnAnim,
  [FX.POP]: 30,
};

export function addEffect(game, type, x, y, data = {}) {
  if (game.effects.length >= EFFECTS_MAX) return null;
  const fx = { type, x, y, age: 0, life: LIFETIMES[type] ?? 24, data };
  game.effects.push(fx);
  return fx;
}

export function updateEffects(game) {
  for (const fx of game.effects) fx.age++;
  if (game.effects.length && game.effects.some((fx) => fx.age >= fx.life)) {
    game.effects = game.effects.filter((fx) => fx.age < fx.life);
  }
}
