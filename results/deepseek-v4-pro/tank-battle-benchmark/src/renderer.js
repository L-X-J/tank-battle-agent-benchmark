// 渲染器：把游戏状态绘制到 Canvas。
// - 逻辑坐标 512×416 固定，按窗口等比缩放（0.25 步长对齐）+ 高 DPI 适配
// - imageSmoothingEnabled = false，像素边缘清晰
// - 草丛覆盖坦克；爆炸/特效在草丛之上；渲染与逻辑完全分离
import {
  TILE,
  COLS,
  ROWS,
  T,
  FIELD_W,
  FIELD_H,
  CANVAS_W,
  CANVAS_H,
  POWERUP,
  ENEMY_SPAWN_POINTS,
  BASE_CELLS,
  BASE_WALL_CELLS,
} from './config.js';
import { STATE } from './state-machine.js';
import { FX } from './entities/effects.js';
import { TILE_ATLAS, drawTankSprite, drawPowerupIcon } from './ui/icons.js';
import {
  drawMenu,
  drawHelp,
  drawStageIntro,
  drawPaused,
  drawStageClear,
  drawScoreSummary,
  drawGameOver,
  drawVictory,
  menuHitTest,
} from './ui/menu.js';
import { drawHUD, drawDebugOverlay } from './ui/hud.js';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let dpr = 1;

  function fit() {
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
    scale = Math.max(0.25, Math.floor(scale * 4) / 4);
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${Math.round(CANVAS_W * scale)}px`;
    canvas.style.height = `${Math.round(CANVAS_H * scale)}px`;
    canvas.width = Math.round(CANVAS_W * scale * dpr);
    canvas.height = Math.round(CANVAS_H * scale * dpr);
  }

  function render(game, ui) {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'alphabetic';
    drawScene(ctx, game, ui);
  }

  function logicalFromClient(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  }

  fit();

  return { render, fit, logicalFromClient, hitTestMenu: (x, y, game) => menuHitTest(x, y, game) };
}

function drawScene(ctx, game, ui) {
  const frame = game.frame;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawField(ctx, game, frame);
  drawHUD(ctx, game, ui);
  drawStateOverlay(ctx, game, ui);
  if (ui.debug) drawDebugOverlay(ctx, game, ui);
}

function drawField(ctx, game, frame) {
  const map = game.map;
  if (!map) return;
  const waterFrame = (frame >> 4) & 1; // 水面动画约 500ms 一帧
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const code = map.cells[row * COLS + col];
      const x = col * TILE;
      const y = row * TILE;
      switch (code) {
        case T.EMPTY:
          ctx.drawImage(TILE_ATLAS.empty, x, y);
          break;
        case T.BRICK:
          ctx.drawImage(TILE_ATLAS.brick, x, y);
          drawBrickDamage(ctx, x, y, game.brickDamage[row * COLS + col]);
          break;
        case T.STEEL:
          ctx.drawImage(TILE_ATLAS.steel, x, y);
          break;
        case T.WATER:
          ctx.drawImage(waterFrame ? TILE_ATLAS.water1 : TILE_ATLAS.water0, x, y);
          break;
        case T.ICE:
          ctx.drawImage(TILE_ATLAS.ice, x, y);
          break;
        case T.GRASS:
          // 草丛在坦克之后绘制（遮挡层级）
          break;
        case T.BASE:
          if (game.baseAlive) {
            ctx.drawImage(col === BASE_CELLS[0].col ? TILE_ATLAS.baseL : TILE_ATLAS.baseR, x, y);
          } else {
            ctx.drawImage(col === BASE_CELLS[0].col ? TILE_ATLAS.baseLDead : TILE_ATLAS.baseRDead, x, y);
          }
          break;
        default:
          break;
      }
    }
  }
  // 铲子效果结束前钢墙闪烁
  if (game.shovelTimer > 0 && game.shovelTimer < 180 && ((game.shovelTimer >> 3) & 1) === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (const c of BASE_WALL_CELLS) ctx.fillRect(c.col * TILE, c.row * TILE, TILE, TILE);
  }
  // 敌人出生点标记
  ctx.fillStyle = '#232834';
  for (const sp of ENEMY_SPAWN_POINTS) {
    ctx.fillRect(sp.col * TILE + 4, sp.row * TILE + 4, 8, 8);
  }
  // 道具（呼吸 + 消失前闪烁）
  const pu = game.powerup;
  if (pu) {
    const blink = pu.life < POWERUP.blinkStart && ((frame >> 4) & 1) === 0;
    if (!blink) {
      const pulse = [0, 1, 0, -1][(frame >> 3) & 3];
      drawPowerupIcon(ctx, pu.type, pu.x, pu.y, 8 + pulse);
    }
  }
  // 子弹
  for (const b of game.bullets) {
    ctx.fillStyle = b.faction === 'player' ? (b.power >= 1 ? '#ffd75a' : '#f4f4f4') : '#ff5a2a';
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
    ctx.fillStyle = '#202020';
    ctx.fillRect(b.x - 3, b.y - 3, 6, 1);
    ctx.fillRect(b.x - 3, b.y + 2, 6, 1);
  }
  // 坦克
  for (const p of game.players) if (p.alive) drawTankSprite(ctx, p, frame);
  for (const e of game.enemies) if (e.alive) drawTankSprite(ctx, e, frame);
  // 草丛覆盖坦克与子弹
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (map.cells[row * COLS + col] === T.GRASS) {
        ctx.drawImage(TILE_ATLAS.grass, col * TILE, row * TILE);
      }
    }
  }
  // 特效（最上层）
  for (const fx of game.effects) drawEffect(ctx, fx);
  // 时钟冻结氛围
  if (game.freezeTimer > 0) {
    ctx.fillStyle = 'rgba(80,140,255,0.10)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }
}

function drawBrickDamage(ctx, x, y, damage) {
  if (damage & 1) ctx.drawImage(TILE_ATLAS.rubble, x, y);
  if (damage & 2) ctx.drawImage(TILE_ATLAS.rubble, x + 8, y);
  if (damage & 4) ctx.drawImage(TILE_ATLAS.rubble, x, y + 8);
  if (damage & 8) ctx.drawImage(TILE_ATLAS.rubble, x + 8, y + 8);
}

function drawEffect(ctx, fx) {
  const t = fx.age / fx.life;
  switch (fx.type) {
    case FX.EXPLOSION_S: {
      const r = 4 + t * 12;
      ctx.fillStyle = t < 0.5 ? 'rgba(255,236,170,0.9)' : 'rgba(255,120,40,0.75)';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,80,20,0.9)';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.6, 0, TAU);
      ctx.fill();
      break;
    }
    case FX.EXPLOSION_L: {
      const r = 6 + t * 22;
      ctx.fillStyle = t < 0.4 ? 'rgba(255,240,190,0.95)' : 'rgba(255,110,30,0.8)';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,40,10,0.9)';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.62, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(60,60,70,0.5)';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y + 2, r * 0.35, 0, TAU);
      ctx.fill();
      break;
    }
    case FX.SPARK: {
      ctx.fillStyle = '#fff8d0';
      for (let i = 0; i < 4; i++) {
        const ang = (i * 2.4 + fx.age * 1.3) % TAU;
        const d = 2 + t * 8;
        ctx.fillRect(fx.x + Math.cos(ang) * d - 1, fx.y + Math.sin(ang) * d - 1, 2, 2);
      }
      break;
    }
    case FX.SCORE: {
      const alpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(fx.data.text ?? '', fx.x + 1, fx.y - t * 16 + 1);
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(fx.data.text ?? '', fx.x, fx.y - t * 16);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      break;
    }
    case FX.SPAWN: {
      const r = 6 + t * 10;
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.age * 0.25);
      ctx.fillStyle = `rgba(255,255,255,${1 - t})`;
      ctx.fillRect(-1, -r, 2, r * 2);
      ctx.fillRect(-r, -1, r * 2, 2);
      ctx.strokeStyle = `rgba(140,220,255,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case FX.POP: {
      ctx.strokeStyle = `rgba(255,255,255,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 4 + t * 14, 0, TAU);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
}

function drawStateOverlay(ctx, game, ui) {
  switch (game.state) {
    case STATE.MAIN_MENU:
      drawMenu(ctx, game);
      break;
    case STATE.HELP:
      drawHelp(ctx, game);
      break;
    case STATE.STAGE_INTRO:
      drawStageIntro(ctx, game);
      break;
    case STATE.PAUSED:
      drawPaused(ctx, game);
      break;
    case STATE.STAGE_CLEAR:
      drawStageClear(ctx, game);
      break;
    case STATE.SCORE_SUMMARY:
      drawScoreSummary(ctx, game);
      break;
    case STATE.GAME_OVER:
      drawGameOver(ctx, game);
      break;
    case STATE.VICTORY:
      drawVictory(ctx, game);
      break;
    default:
      break;
  }
}
