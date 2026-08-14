// 存档系统：版本化 localStorage 存档。
// 处理：localStorage 不可用（隐私模式/Node 环境）、JSON 损坏、旧版本缺字段、清除存档。
import { SAVE_KEY, SAVE_VERSION, LEVEL_COUNT } from './config.js';

const DEFAULTS = Object.freeze({
  highScore: 0,
  unlockedStage: 1,
  sound: true,
  volume: 0.8,
  lastMode: '1p',
});

function backend() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__steel_front_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null; // localStorage 不可用 → 使用内存兜底
  }
}

// 迁移旧版本存档：未知/缺失字段全部回落到默认值
function migrate(raw) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function sanitize(raw) {
  const d = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return d;
  const src = migrate(raw);
  if (typeof src.highScore === 'number' && Number.isFinite(src.highScore)) {
    d.highScore = Math.max(0, Math.floor(src.highScore));
  }
  if (typeof src.unlockedStage === 'number' && Number.isFinite(src.unlockedStage)) {
    d.unlockedStage = Math.min(LEVEL_COUNT, Math.max(1, Math.floor(src.unlockedStage)));
  }
  if (typeof src.sound === 'boolean') d.sound = src.sound;
  if (typeof src.volume === 'number' && Number.isFinite(src.volume)) {
    d.volume = Math.min(1, Math.max(0, src.volume));
  }
  if (src.lastMode === '1p' || src.lastMode === '2p' || src.lastMode === 'demo') {
    d.lastMode = src.lastMode;
  }
  return d;
}

export function createStorage() {
  const mem = new Map();
  const ls = backend();

  function load() {
    if (!ls) return { ...DEFAULTS };
    try {
      const text = ls.getItem(SAVE_KEY);
      if (!text) return { ...DEFAULTS };
      return sanitize(JSON.parse(text)); // JSON 损坏被捕获，返回默认值，不影响启动
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(data) {
    const clean = sanitize(data);
    const payload = JSON.stringify({ ...clean, v: SAVE_VERSION });
    if (ls) {
      try {
        ls.setItem(SAVE_KEY, payload);
      } catch {
        // 配额满 / 隐私模式：静默降级为内存存档
      }
    }
    mem.set('save', payload);
    return clean;
  }

  function clear() {
    if (ls) {
      try {
        ls.removeItem(SAVE_KEY);
      } catch {
        // ignore
      }
    }
    mem.delete('save');
    return { ...DEFAULTS };
  }

  return { load, save, clear };
}
