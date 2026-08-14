// 状态机：BOOT → MAIN_MENU → HELP / STAGE_INTRO → PLAYING →
// PAUSED / PLAYER_RESPAWN / STAGE_CLEAR → SCORE_SUMMARY → STAGE_INTRO(下一关) →
// GAME_OVER / VICTORY → MAIN_MENU。
// 非法转换直接抛错（fail fast，杜绝隐式状态漂移）。
import { TIMING } from './config.js';

export const STATE = {
  BOOT: 'BOOT',
  MAIN_MENU: 'MAIN_MENU',
  HELP: 'HELP',
  STAGE_INTRO: 'STAGE_INTRO',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  PLAYER_RESPAWN: 'PLAYER_RESPAWN',
  STAGE_CLEAR: 'STAGE_CLEAR',
  SCORE_SUMMARY: 'SCORE_SUMMARY',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
};

export const STATE_TIMER = {
  [STATE.BOOT]: TIMING.boot,
  [STATE.STAGE_INTRO]: TIMING.stageIntro,
  [STATE.STAGE_CLEAR]: TIMING.stageClear,
  [STATE.SCORE_SUMMARY]: TIMING.scoreSummary,
  [STATE.GAME_OVER]: TIMING.gameOver,
  [STATE.VICTORY]: TIMING.victory,
};

const ALLOWED = {
  [STATE.BOOT]: [STATE.MAIN_MENU],
  [STATE.MAIN_MENU]: [STATE.HELP, STATE.STAGE_INTRO],
  [STATE.HELP]: [STATE.MAIN_MENU],
  [STATE.STAGE_INTRO]: [STATE.PLAYING, STATE.MAIN_MENU],
  [STATE.PLAYING]: [STATE.PAUSED, STATE.PLAYER_RESPAWN, STATE.STAGE_CLEAR, STATE.GAME_OVER, STATE.MAIN_MENU],
  [STATE.PAUSED]: [STATE.PLAYING, STATE.MAIN_MENU],
  [STATE.PLAYER_RESPAWN]: [STATE.PLAYING, STATE.GAME_OVER, STATE.MAIN_MENU],
  [STATE.STAGE_CLEAR]: [STATE.SCORE_SUMMARY, STATE.VICTORY, STATE.MAIN_MENU],
  [STATE.SCORE_SUMMARY]: [STATE.STAGE_INTRO, STATE.MAIN_MENU],
  // DEMO 模式在结束后自动进入下一轮演示（STAGE_INTRO）
  [STATE.GAME_OVER]: [STATE.MAIN_MENU, STATE.STAGE_INTRO],
  [STATE.VICTORY]: [STATE.MAIN_MENU, STATE.STAGE_INTRO],
};

export function setState(game, next) {
  if (game.state === next) return false;
  const allowed = ALLOWED[game.state];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`非法状态转换: ${game.state} -> ${next}`);
  }
  const prev = game.state;
  game.state = next;
  game.stateTimer = STATE_TIMER[next] ?? 0;
  game.emit('stateChange', { from: prev, to: next });
  return true;
}
