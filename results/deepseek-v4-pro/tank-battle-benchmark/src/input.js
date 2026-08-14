// 键盘输入：P1 WASD+Space，P2 方向键+Enter；公共键 P/R/M/Esc/F2/[ ]。
// - 阻止方向键/空格默认滚动行为
// - 支持同时按住多个键
// - 两名玩家输入完全独立
// - 一次性按键（菜单导航等）通过"本帧按下"集合对外提供（区分按住与刚按下由 game 层完成）
const KEY_MAP = {
  KeyW: ['p1', 'up'],
  KeyS: ['p1', 'down'],
  KeyA: ['p1', 'left'],
  KeyD: ['p1', 'right'],
  Space: ['p1', 'fire'],
  ArrowUp: ['p2', 'up'],
  ArrowDown: ['p2', 'down'],
  ArrowLeft: ['p2', 'left'],
  ArrowRight: ['p2', 'right'],
  Enter: ['p2', 'fire'],
};

export const ACTION_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter',
  'KeyP', 'KeyR', 'KeyM', 'Escape', 'F2', 'BracketLeft', 'BracketRight',
]);

export function createInput(opts = {}) {
  const state = {
    p1: { up: false, down: false, left: false, right: false, fire: false },
    p2: { up: false, down: false, left: false, right: false, fire: false },
  };
  const pressedThisFrame = [];
  let enabled = true;

  function onKeyDown(e) {
    if (!enabled) return;
    if (ACTION_KEYS.has(e.code)) {
      e.preventDefault(); // 阻止方向键/空格滚动页面
    }
    const mapped = KEY_MAP[e.code];
    if (mapped) {
      state[mapped[0]][mapped[1]] = true;
      if (!e.repeat) pressedThisFrame.push(e.code);
    } else if (ACTION_KEYS.has(e.code) && !e.repeat) {
      pressedThisFrame.push(e.code);
    }
  }

  function onKeyUp(e) {
    const mapped = KEY_MAP[e.code];
    if (mapped) state[mapped[0]][mapped[1]] = false;
    if (ACTION_KEYS.has(e.code)) e.preventDefault();
  }

  function onBlur() {
    // 失焦：清空所有按键状态，防止"卡键"
    state.p1.up = state.p1.down = state.p1.left = state.p1.right = state.p1.fire = false;
    state.p2.up = state.p2.down = state.p2.left = state.p2.right = state.p2.fire = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    /** 每渲染帧开始时取走本帧新按下（含菜单/公共键） */
    consumeEdges() {
      return pressedThisFrame.splice(0, pressedThisFrame.length);
    },
    get state() {
      return state;
    },
    setEnabled(v) {
      enabled = v;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
