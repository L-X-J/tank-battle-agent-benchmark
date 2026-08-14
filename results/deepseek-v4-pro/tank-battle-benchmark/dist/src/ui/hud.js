// HUD：右侧信息栏 + 调试信息面板。
import { FIELD_W, FIELD_H, HUD_W, ENEMIES_PER_LEVEL } from '../config.js';
import { drawMiniTank } from './icons.js';

const FONT = '"Courier New", ui-monospace, monospace';

export function drawHUD(ctx, game, ui) {
  const x0 = FIELD_W;
  ctx.fillStyle = '#16181f';
  ctx.fillRect(x0, 0, HUD_W, FIELD_H);
  ctx.fillStyle = '#2a2e3a';
  ctx.fillRect(x0, 0, 2, FIELD_H);
  ctx.textAlign = 'left';

  // 关卡
  ctx.fillStyle = '#ffe27a';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(`STAGE ${game.stage}`, x0 + 8, 18);
  ctx.fillStyle = '#8a93a3';
  ctx.font = `8px ${FONT}`;
  ctx.fillText(game.levelData?.name ?? '', x0 + 8, 30);

  // 剩余敌人图标（20 个，逐格熄灭）
  ctx.fillStyle = '#8a93a3';
  ctx.font = `9px ${FONT}`;
  ctx.fillText('ENEMIES', x0 + 8, 44);
  const remaining = game.spawnQueue.length + game.activeEnemies();
  for (let i = 0; i < ENEMIES_PER_LEVEL; i++) {
    const col = i % 2;
    const row = (i / 2) | 0;
    const ix = x0 + 8 + col * 26;
    const iy = 50 + row * 12;
    if (i < remaining) {
      drawMiniTank(ctx, ix, iy, 'scout');
    } else {
      ctx.fillStyle = '#262a33';
      ctx.fillRect(ix, iy, 14, 10);
    }
  }

  // 玩家面板
  let y = 50 + 10 * 12 + 8;
  for (const p of game.players) {
    drawPlayerPanel(ctx, p, x0, y);
    y += 62;
  }

  // 最高分
  ctx.fillStyle = '#e8e8e8';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(`HI ${game.saveData.highScore}`, x0 + 8, y + 12);
  y += 22;
  // 音效/暂停状态
  ctx.fillStyle = '#8a93a3';
  ctx.font = `9px ${FONT}`;
  ctx.fillText(`SOUND ${game.saveData.sound ? 'ON' : 'OFF'}`, x0 + 8, y + 8);
  if (ui.paused) {
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('PAUSED', x0 + 8, y + 20);
  }
  // 音量条
  ctx.fillStyle = '#2a2e3a';
  ctx.fillRect(x0 + 8, y + 30, HUD_W - 16, 4);
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(x0 + 8, y + 30, (HUD_W - 16) * game.saveData.volume, 4);
}

function drawPlayerPanel(ctx, p, x0, y) {
  ctx.fillStyle = '#1f232c';
  ctx.fillRect(x0 + 4, y, HUD_W - 8, 56);
  ctx.fillStyle = p.playerIndex === 1 ? '#d9a441' : '#4aa564';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(`P${p.playerIndex}`, x0 + 8, y + 12);
  // 生命
  for (let i = 0; i < Math.min(p.lives, 9); i++) {
    drawMiniTank(ctx, x0 + 30 + (i % 3) * 20, y + 6 + ((i / 3) | 0) * 13, p.playerIndex === 1 ? 'p1' : 'p2');
  }
  // 分数
  ctx.fillStyle = '#e8e8e8';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(`${p.score}`, x0 + 8, y + 50);
  // 火力等级
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < p.level ? '#f2c94c' : '#3a3f4a';
    ctx.fillRect(x0 + 52 + i * 9, y + 42, 7, 7);
  }
}

export function drawDebugOverlay(ctx, game, ui) {
  const lines = [
    `state=${game.state} mode=${game.mode} stage=${game.stage}`,
    `frame=${game.frame} fps=${ui.fps}`,
    `seed=${game.seed} rng=${game.rng.state}`,
    `enemies active=${game.activeEnemies()} queue=${game.spawnQueue.length}`,
    `bullets=${game.bullets.length} effects=${game.effects.length} powerup=${game.powerup ? game.powerup.type : '-'}`,
    `freeze=${game.freezeTimer} shovel=${game.shovelTimer} base=${game.baseAlive ? 'OK' : 'DESTROYED'}`,
    `players=${game.players.map((p) => `${p.playerIndex}:${p.alive ? 'alive' : 'dead'}/${p.lives}L${p.level}`).join(' ')}`,
    `version=${game.getSnapshot().version}`,
  ];
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(2, 2, 264, lines.length * 12 + 10);
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7ff3a0';
  lines.forEach((l, i) => ctx.fillText(l, 8, 16 + i * 12));
}
