// 像素画素材模块：所有图形由 Canvas 程序绘制（禁止外部图片）。
// 地形瓦片 → 离屏画布图集；坦克/道具/迷你图标 → 直接矩形绘制。
export const PALETTES = {
  p1: { body: '#d9a441', dark: '#9c7128', barrel: '#8a6120' },
  p2: { body: '#4aa564', dark: '#2f7a45', barrel: '#2c6b3d' },
  scout: { body: '#8b93a3', dark: '#5d6472', barrel: '#4b515c' },
  striker: { body: '#4fb6c9', dark: '#2e8094', barrel: '#246b7c' },
  gunner: { body: '#b25bd4', dark: '#7e3a9c', barrel: '#6a3183' },
  ironclad: { body: '#a03c32', dark: '#6e2a22', barrel: '#571f18' },
};

function tileCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  draw(g);
  return c;
}

function buildTileAtlas() {
  const empty = tileCanvas(16, (g) => {
    g.fillStyle = '#121318';
    g.fillRect(0, 0, 16, 16);
  });
  const brick = tileCanvas(16, (g) => {
    // 4 个 8×8 砖块 + 1px 灰缝，支持局部破坏
    const tones = ['#c05a2e', '#b8532a', '#bc562c', '#c45e31'];
    for (let q = 0; q < 4; q++) {
      const qx = (q & 1) * 8;
      const qy = (q & 2) ? 8 : 0;
      g.fillStyle = '#6e2a12';
      g.fillRect(qx, qy, 8, 8);
      g.fillStyle = tones[q];
      g.fillRect(qx, qy, 7, 7);
      g.fillStyle = '#d97a44';
      g.fillRect(qx, qy, 7, 2);
      g.fillRect(qx, qy, 2, 7);
    }
  });
  const rubble = tileCanvas(8, (g) => {
    g.fillStyle = '#2a1d16';
    g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#54331f';
    g.fillRect(1, 2, 2, 2);
    g.fillRect(5, 1, 2, 2);
    g.fillRect(2, 5, 3, 2);
  });
  const steel = tileCanvas(16, (g) => {
    g.fillStyle = '#4d545e';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#8b95a3';
    g.fillRect(1, 1, 14, 14);
    g.fillStyle = '#aeb7c2';
    g.fillRect(3, 3, 10, 10);
    g.fillStyle = '#e8ecf1';
    g.fillRect(3, 3, 2, 2);
    g.fillRect(11, 3, 2, 2);
    g.fillRect(3, 11, 2, 2);
    g.fillRect(11, 11, 2, 2);
  });
  const water = (shift) =>
    tileCanvas(16, (g) => {
      g.fillStyle = '#1d3f7a';
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#4f8fd6';
      const rows = [
        [1 + shift, 4 + shift, 9 + shift, 13 + shift],
        [4 + shift, 7 + shift, 12 + shift],
        [2 + shift, 6 + shift, 10 + shift, 14 + shift],
      ];
      for (let r = 0; r < 3; r++) {
        for (const x of rows[r]) g.fillRect(((x + 16) % 16) - 2, 2 + r * 5, 4, 2);
      }
      g.fillStyle = '#7fb3e8';
      g.fillRect(((shift + 5) % 16), 9, 2, 1);
      g.fillRect(((shift + 11) % 16), 14, 2, 1);
    });
  const grass = tileCanvas(16, (g) => {
    g.fillStyle = '#1f5e28';
    g.fillRect(2, 8, 3, 2);
    g.fillRect(9, 6, 4, 2);
    g.fillRect(12, 12, 3, 2);
    g.fillStyle = '#2f7d3a';
    g.fillRect(2, 4, 3, 2);
    g.fillRect(9, 2, 3, 2);
    g.fillRect(5, 10, 3, 3);
    g.fillRect(11, 9, 3, 2);
    g.fillStyle = '#3f9a4c';
    g.fillRect(3, 3, 2, 1);
    g.fillRect(10, 1, 2, 1);
    g.fillRect(6, 9, 2, 1);
  });
  const ice = tileCanvas(16, (g) => {
    g.fillStyle = '#6ba7c9';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#9fd4ee';
    g.fillRect(1, 1, 14, 14);
    g.fillStyle = '#e8f7ff';
    g.fillRect(3, 2, 2, 1);
    g.fillRect(6, 5, 1, 3);
    g.fillRect(10, 3, 1, 2);
    g.fillRect(5, 10, 3, 1);
    g.fillRect(10, 11, 2, 2);
  });
  const baseSide = (left) =>
    tileCanvas(16, (g) => {
      g.fillStyle = '#38383f';
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#4d4d55';
      g.fillRect(1, 1, 14, 14);
      g.fillStyle = '#5a5a63';
      g.fillRect(2, 2, 12, 3);
      g.fillStyle = '#2a2a30';
      g.fillRect(3, 6, 10, 9);
      g.fillStyle = '#c8e4ff';
      g.fillRect(left ? 5 : 7, 8, 4, 4);
      if (left) {
        // 旗帜
        g.fillStyle = '#8a8a92';
        g.fillRect(11, 2, 2, 11);
        g.fillStyle = '#e8c33c';
        g.fillRect(3, 2, 8, 4);
        g.fillStyle = '#f6dc7a';
        g.fillRect(3, 2, 8, 1);
      }
    });
  const baseDead = tileCanvas(16, (g) => {
    g.fillStyle = '#141418';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#33333b';
    g.fillRect(2, 4, 3, 2);
    g.fillRect(9, 2, 3, 2);
    g.fillRect(4, 9, 4, 3);
    g.fillRect(11, 11, 3, 2);
    g.fillStyle = '#ff5a2a';
    g.fillRect(6, 10, 2, 2);
    g.fillStyle = '#ffb02a';
    g.fillRect(11, 7, 1, 1);
  });
  return {
    empty,
    brick,
    rubble,
    steel,
    water0: water(0),
    water1: water(4),
    grass,
    ice,
    baseL: baseSide(true),
    baseR: baseSide(false),
    baseLDead: baseDead,
    baseRDead: baseDead,
  };
}

/** 图集在首次使用时构建一次（仅浏览器侧模块会引入本文件） */
export const TILE_ATLAS = buildTileAtlas();

function drawStar(ctx, x, y, size, color, frame) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((frame * 0.2) % (Math.PI * 2));
  ctx.fillStyle = color;
  ctx.fillRect(-1, -size, 2, size * 2);
  ctx.fillRect(-size, -1, size * 2, 2);
  ctx.restore();
}

/**
 * 绘制坦克（面向上的像素造型，按方向旋转 90° 的倍数，保持边缘清晰）。
 * tank 需要提供 cx/cy/dir/type 及若干可选状态字段。
 */
export function drawTankSprite(ctx, tank, frame) {
  const pal = PALETTES[tank.type] ?? PALETTES.scout;
  let body = pal.body;
  const ironShades = ['#b05044', '#a03c32', '#7e2c22', '#5e241c'];
  if (tank.type === 'ironclad') body = ironShades[Math.min(3, tank.damageStage ?? 0)];

  ctx.save();
  ctx.translate(tank.cx, tank.cy);
  ctx.rotate((tank.dir ?? 0) * Math.PI / 2);

  // 履带（履带动画：两组明暗块交替）
  const tOff = (frame >> 2) & 1;
  for (const tx of [-16, 8]) {
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(tx, -16, 8, 32);
    for (let y = -16; y < 16; y += 4) {
      ctx.fillStyle = ((y / 4 + tOff) & 1) ? '#3a3a44' : '#26262e';
      ctx.fillRect(tx, y, 8, 4);
    }
  }
  // 车体
  ctx.fillStyle = body;
  ctx.fillRect(-8, -12, 16, 24);
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-8, 8, 16, 4);
  ctx.fillRect(-8, -12, 2, 24);
  ctx.fillRect(6, -12, 2, 24);
  // 炮塔
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.fillStyle = body;
  ctx.fillRect(-4, -4, 8, 8);
  // 炮管（火力手为双管）
  ctx.fillStyle = pal.barrel;
  if (tank.type === 'gunner') {
    ctx.fillRect(-7, -16, 3, 9);
    ctx.fillRect(4, -16, 3, 9);
  } else {
    ctx.fillRect(-2, -16, 4, 9);
  }
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-2, -14, 4, 2);
  // 铁甲受损裂纹
  if (tank.type === 'ironclad') {
    const stage = Math.min(3, tank.damageStage ?? 0);
    ctx.strokeStyle = '#1c0c08';
    ctx.lineWidth = 1;
    for (let i = 0; i < stage; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 + i * 4, -12);
      ctx.lineTo(-4 + i * 3, 2);
      ctx.lineTo(-8 + i * 5, 10);
      ctx.stroke();
    }
  }
  // 受击闪白
  if (tank.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-16, -16, 32, 32);
  }
  // 道具携带者闪烁
  if (tank.flash && ((frame >> 3) & 1) === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-16, -16, 32, 32);
  }
  // 保护罩动画（防护罩 / 出生保护）
  if (tank.shield > 0) {
    const blink = tank.shield < 180 && ((tank.shield >> 3) & 1) === 0;
    ctx.strokeStyle = blink ? 'rgba(127,243,255,0.35)' : 'rgba(127,243,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
  } else if (tank.spawnProtect > 0) {
    const blink = ((frame >> 2) & 1) === 0;
    ctx.strokeStyle = blink ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 友军误击眩晕
  if (tank.stun > 0) {
    drawStar(ctx, -6, -24, 4, '#f2c94c', frame);
    drawStar(ctx, 7, -20, 3, '#ffe27a', frame + 10);
  }
  ctx.restore();
}

/** 16×16 道具图标（矩形像素画） */
export function drawPowerupIcon(ctx, type, x, y, half = 8) {
  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case 'star':
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-half + 1, -2, half * 2 - 2, 4);
      ctx.fillRect(-2, -half + 1, 4, half * 2 - 2);
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(-2, -2, 4, 4);
      break;
    case 'shield':
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8f7ff';
      ctx.fillRect(-1, -5, 2, 10);
      ctx.fillRect(-5, -1, 10, 2);
      break;
    case 'clock':
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(-1, -6, 2, 6);
      ctx.fillRect(0, -1, 6, 2);
      break;
    case 'shovel':
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(3, -7, 2, 12);
      ctx.fillStyle = '#a06a2f';
      ctx.fillRect(-5, 3, 10, 5);
      ctx.fillStyle = '#6e4018';
      ctx.fillRect(-5, 6, 10, 2);
      break;
    case 'grenade':
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath();
      ctx.arc(0, 1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c98f4a';
      ctx.fillRect(3, -8, 2, 6);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(2, -10, 4, 3);
      break;
    case 'life':
      ctx.fillStyle = '#e85a7f';
      ctx.fillRect(-6, -4, 5, 4);
      ctx.fillRect(1, -4, 5, 4);
      ctx.fillRect(-5, -1, 10, 4);
      ctx.fillRect(-2, 3, 4, 3);
      ctx.fillStyle = '#ff9ab5';
      ctx.fillRect(-5, -3, 2, 1);
      ctx.fillRect(2, -3, 2, 1);
      break;
    default:
      ctx.fillStyle = '#888';
      ctx.fillRect(-4, -4, 8, 8);
  }
  ctx.restore();
}

/** HUD 迷你坦克图标（10×8，面向上） */
export function drawMiniTank(ctx, x, y, paletteName, dir = 0) {
  const pal = PALETTES[paletteName] ?? PALETTES.scout;
  ctx.save();
  ctx.translate(x + 7, y + 5);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-7, -5, 3, 10);
  ctx.fillRect(4, -5, 3, 10);
  ctx.fillStyle = pal.body;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = pal.barrel;
  ctx.fillRect(-1, -7, 2, 4);
  ctx.restore();
}
