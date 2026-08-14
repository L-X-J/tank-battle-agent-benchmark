// 菜单与各状态覆盖层绘制（主菜单 / 帮助 / 关卡介绍 / 暂停 / 通关 / 统计 / 结束 / 胜利）。
import {
  CANVAS_W,
  CANVAS_H,
  GAME_TITLE,
  GAME_TITLE_CN,
  GAME_VERSION,
  DIR,
  POWERUP_TYPES,
  POWERUP_NAMES,
} from '../config.js';
import { drawTankSprite, drawPowerupIcon, drawMiniTank, TILE_ATLAS } from './icons.js';

const MENU_X = 196;
const MENU_Y0 = 196;
const MENU_STEP = 26;
const FONT = '"Courier New", ui-monospace, monospace';

/** 菜单项命中检测（与 drawMenu 布局一致） */
export function menuHitTest(x, y, game) {
  const items = game.menuItems();
  for (let i = 0; i < items.length; i++) {
    const iy = MENU_Y0 + i * MENU_STEP;
    if (x >= MENU_X - 24 && x <= MENU_X + 180 && y >= iy - 12 && y <= iy + 8) return i;
  }
  return null;
}

function decorTank(cx, cy, dir, type) {
  return { cx, cy, dir, type, shield: 0, spawnProtect: 0, stun: 0, flash: false, hitFlash: 0, damageStage: 0 };
}

export function drawMenu(ctx, game) {
  const frame = game.frame;
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // 装饰：对阵坦克
  drawTankSprite(ctx, decorTank(96, 108, DIR.RIGHT, 'scout'), frame);
  drawTankSprite(ctx, decorTank(416, 108, DIR.LEFT, 'p1'), frame);
  ctx.fillStyle = '#232834';
  ctx.fillRect(0, 150, CANVAS_W, 2);
  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(GAME_TITLE, CANVAS_W / 2 + 3, 83);
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(GAME_TITLE, CANVAS_W / 2, 80);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#7fb3e8';
  ctx.fillText(`— ${GAME_TITLE_CN} —`, CANVAS_W / 2, 102);
  // 菜单项
  const items = game.menuItems();
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'left';
  for (let i = 0; i < items.length; i++) {
    const y = MENU_Y0 + i * MENU_STEP;
    const selected = i === game.menu.index;
    ctx.fillStyle = selected ? '#ffe27a' : '#9aa3ad';
    if (selected && ((frame >> 4) & 1) === 0) {
      ctx.fillText('▶', MENU_X - 24, y);
    }
    ctx.fillText(items[i], MENU_X, y);
  }
  // 底部信息
  ctx.font = `10px ${FONT}`;
  ctx.fillStyle = '#8a93a3';
  ctx.textAlign = 'left';
  ctx.fillText(`HI ${game.saveData.highScore}`, 24, 352);
  ctx.fillText(`UNLOCKED: STAGE ${game.saveData.unlockedStage}`, 24, 368);
  ctx.fillText(`v${GAME_VERSION}`, CANVAS_W - 60, 352);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a6270';
  ctx.fillText('↑↓ / WASD 移动 · ENTER / SPACE 选择 · M 音效', CANVAS_W / 2, 396);
}

export function drawHelp(ctx, game) {
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('HELP', CANVAS_W / 2, 32);
  const page = game.helpPage;
  ctx.textAlign = 'left';
  ctx.font = `11px ${FONT}`;
  if (page === 0) {
    const lines = [
      ['PLAYER 1', 'W / A / S / D 移动   SPACE 开火'],
      ['PLAYER 2', '方向键移动   ENTER 开火'],
      ['COMMON', 'P 暂停 · R 重开本关 · M 静音'],
      ['', 'ESC 返回菜单 · F2 调试信息'],
      ['', '[ / ] 音量 减/增'],
      ['RULE', '保护基地！消灭全部 20 辆敌坦克'],
      ['', '基地被毁或生命耗尽 → 游戏结束'],
      ['', '通关 35 关 → 胜利'],
    ];
    lines.forEach((l, i) => {
      ctx.fillStyle = l[1] ? '#8a93a3' : '#e8e8e8';
      ctx.fillText(l[0], 60, 76 + i * 22);
      ctx.fillStyle = '#d7dee8';
      ctx.fillText(l[1] ?? '', 190, 76 + i * 22);
    });
  } else if (page === 1) {
    // 地形说明（迷你瓦片 + 描述）
    const terrains = [
      [TILE_ATLAS.empty, '空地', '可自由通行'],
      [TILE_ATLAS.brick, '砖墙', '挡路，可被子弹摧毁（局部破坏）'],
      [TILE_ATLAS.steel, '钢墙', '挡路，仅 3 级穿甲弹可摧毁'],
      [TILE_ATLAS.water0, '水面', '坦克不可过，子弹可以飞越'],
      [TILE_ATLAS.grass, '草丛', '可通行，会遮挡坦克'],
      [TILE_ATLAS.ice, '冰面', '可通行，但会打滑'],
    ];
    terrains.forEach((t, i) => {
      const y = 66 + i * 30;
      ctx.drawImage(t[0], 60, y - 12);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText(t[1], 92, y);
      ctx.fillStyle = '#8a93a3';
      ctx.fillText(t[2], 160, y);
    });
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('基地', 92, 66 + 6 * 30);
    ctx.fillStyle = '#8a93a3';
    ctx.fillText('守住它！任何子弹击中基地都会失败', 160, 66 + 6 * 30);
  } else {
    // 道具说明
    const names = ['星星', '护盾', '时钟', '铲子', '手雷', '生命'];
    const desc = [
      '火力 +1（最高 3 级：高速/双发/穿甲）',
      '约 10 秒无敌',
      '冻结敌方坦克与子弹约 10 秒',
      '基地围墙临时变为钢墙约 18 秒',
      '消灭屏幕内全部敌人',
      '+1 生命',
    ];
    for (let i = 0; i < 6; i++) {
      const y = 66 + i * 30;
      drawPowerupIcon(ctx, POWERUP_TYPES[i], 68, y - 4, 8);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText(names[i], 92, y);
      ctx.fillStyle = '#8a93a3';
      ctx.fillText(desc[i], 160, y);
    }
    ctx.fillStyle = '#5a6270';
    ctx.fillText('道具由闪烁的敌坦克掉落 · 拾取得 500 分', 60, 66 + 6 * 30 + 14);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a6270';
  ctx.fillText('← → 翻页 · ESC 返回', CANVAS_W / 2, 396);
  ctx.fillStyle = '#8a93a3';
  ctx.fillText(`${page + 1} / 3`, CANVAS_W - 30, 396);
}

export function drawStageIntro(ctx, game) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fb3e8';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText(`STAGE ${game.stage}`, CANVAS_W / 2, 180);
  ctx.fillStyle = '#f2c94c';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(game.levelData?.name ?? '', CANVAS_W / 2, 216);
  if (((game.frame >> 4) & 1) === 0) {
    ctx.fillStyle = '#8a93a3';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('READY…', CANVAS_W / 2, 260);
  }
}

export function drawPaused(ctx, game) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe27a';
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText('PAUSED', CANVAS_W / 2, 200);
  ctx.fillStyle = '#8a93a3';
  ctx.font = `12px ${FONT}`;
  const hint =
    game.pauseReason === 'blur' ? '窗口失焦已自动暂停 · 按 P 恢复' : '按 P 恢复 · R 重开本关 · ESC 返回菜单';
  ctx.fillText(hint, CANVAS_W / 2, 232);
}

export function drawStageClear(ctx, game) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  if ((game.frame >> 3) & 1) {
    ctx.fillStyle = '#ffe27a';
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText('STAGE CLEAR!', CANVAS_W / 2, 200);
  }
}

export function drawScoreSummary(ctx, game) {
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(`STAGE ${game.stage} CLEAR`, CANVAS_W / 2, 48);
  ctx.textAlign = 'left';
  ctx.font = `11px ${FONT}`;
  let y = 92;
  for (const p of game.players) {
    ctx.fillStyle = p.playerIndex === 1 ? '#d9a441' : '#4aa564';
    ctx.fillText(`P${p.playerIndex}  SCORE ${p.score}`, 80, y);
    y += 24;
    const stats = game.stats.stageKills[`p${p.playerIndex}`];
    let x = 100;
    for (const type of ['scout', 'striker', 'gunner', 'ironclad']) {
      drawMiniTank(ctx, x, y - 12, type);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText(`×${stats[type]}`, x + 16, y - 2);
      x += 60;
    }
    y += 30;
    ctx.fillStyle = '#8a93a3';
    ctx.fillText(`道具 ×${game.stats.powerups[`p${p.playerIndex}`]}`, 100, y - 10);
    y += 30;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a93a3';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('ENTER / SPACE → 下一关', CANVAS_W / 2, 380);
}

export function drawGameOver(ctx, game) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('GAME OVER', CANVAS_W / 2, 160);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#e8e8e8';
  let y = 210;
  for (const p of game.players) {
    ctx.fillText(`P${p.playerIndex}  SCORE ${p.score}`, CANVAS_W / 2, y);
    y += 24;
  }
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(`HIGH SCORE ${game.saveData.highScore}`, CANVAS_W / 2, y + 12);
  ctx.fillStyle = '#8a93a3';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('ENTER → 主菜单', CANVAS_W / 2, 300);
}

export function drawVictory(ctx, game) {
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // 彩带（渲染层装饰，与逻辑无关）
  const colors = ['#f2c94c', '#4fc3f7', '#ff5a5a', '#4aa564', '#b25bd4'];
  for (let i = 0; i < 60; i++) {
    const x = (i * 37 + game.frame * 2) % CANVAS_W;
    const y = (i * 53 + game.frame) % CANVAS_H;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, 3, 6);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText('VICTORY!', CANVAS_W / 2, 170);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#e8e8e8';
  let y = 220;
  for (const p of game.players) {
    ctx.fillText(`P${p.playerIndex}  SCORE ${p.score}`, CANVAS_W / 2, y);
    y += 24;
  }
  ctx.fillStyle = '#8a93a3';
  ctx.fillText(`TOTAL KILLS ${game.stats.totalKills} · HIGH SCORE ${game.saveData.highScore}`, CANVAS_W / 2, y + 12);
  ctx.font = `12px ${FONT}`;
  ctx.fillText('你守住了钢铁前线！ · ENTER → 主菜单', CANVAS_W / 2, 330);
}
