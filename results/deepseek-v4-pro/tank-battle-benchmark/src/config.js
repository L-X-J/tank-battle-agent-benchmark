// 集中式配置：所有主要游戏参数都在这里定义，其他模块不得散落魔法数字。

export const GAME_VERSION = '1.0.0';
export const GAME_TITLE = 'STEEL FRONT';
export const GAME_TITLE_CN = '钢铁前线';

export const FPS = 60;
export const FIXED_DT = 1 / FPS;

// —— 画面尺寸（逻辑坐标）——
export const TILE = 16;
export const COLS = 26;
export const ROWS = 26;
export const FIELD_W = COLS * TILE; // 416
export const FIELD_H = ROWS * TILE; // 416
export const HUD_W = 96;
export const CANVAS_W = FIELD_W + HUD_W; // 512
export const CANVAS_H = FIELD_H; // 416

export const LEVEL_COUNT = 35;
export const ENEMIES_PER_LEVEL = 20;
export const MAX_ACTIVE_ENEMIES = 4;

// —— 方向：0上 1右 2下 3左 ——
export const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
export const DIR_X = [0, 1, 0, -1];
export const DIR_Y = [-1, 0, 1, 0];
export const DIR_NAME = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

// —— 固定布局锚点（列, 行，tile 坐标）——
export const ENEMY_SPAWN_POINTS = [
  { col: 0, row: 0 },
  { col: 12, row: 0 },
  { col: 24, row: 0 },
];
export const PLAYER_SPAWN_POINTS = [
  { col: 8, row: 24 },
  { col: 16, row: 24 },
];
export const BASE_CELLS = [
  { col: 12, row: 24 },
  { col: 13, row:24 },
];
// 基地周围的防御墙环（铲子道具作用范围）
export const BASE_WALL_CELLS = [
  { col: 11, row: 23 }, { col: 12, row: 23 }, { col: 13, row: 23 }, { col: 14, row: 23 },
  { col: 11, row: 24 }, { col: 14, row: 24 },
  { col: 11, row: 25 }, { col: 12, row: 25 }, { col: 13, row: 25 }, { col: 14, row: 25 },
];

// —— 地形编码 ——
export const T = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  GRASS: 4,
  ICE: 5,
  BASE: 6,
};
export const TILE_CHARS = { '.': T.EMPTY, '#': T.BRICK, S: T.STEEL, W: T.WATER, G: T.GRASS, I: T.ICE, B: T.BASE };
export const CHAR_FOR_TILE = ['.', '#', 'S', 'W', 'G', 'I', 'B'];
export const TILE_NAMES = ['空地', '砖墙', '钢墙', '水面', '草丛', '冰面', '基地'];

// —— 玩家坦克 ——
export const PLAYER = {
  lives: 3,
  speed: 1, // px / 逻辑帧
  bulletSpeed: [4, 6, 6, 6], // 火力等级 0..3
  maxBullets: [1, 1, 2, 2],
  fireCooldown: [30, 26, 20, 18],
  spawnProtect: 90, // 出生/重生保护罩帧数
  stageStartShield: 120,
  respawnDelay: 90,
  stunOnFriendlyFire: 30, // 友军误击：约 0.5 秒停顿
  deathLevelPenalty: 1, // 死亡后火力等级降低 1 级（最低 0），README 中已明确
};

// —— 敌人 ——
export const ENEMY_TYPES = {
  scout: {
    name: 'SCOUT', cn: '侦察兵', hp: 1, speed: 0.75, fireCooldown: 90, bulletSpeed: 3,
    fireChanceAligned: 0.05, fireChanceRandom: 0.004, score: 100, decideMin: 40, decideMax: 90,
  },
  striker: {
    name: 'STRIKER', cn: '突击兵', hp: 1, speed: 1.5, fireCooldown: 85, bulletSpeed: 3,
    fireChanceAligned: 0.06, fireChanceRandom: 0.004, score: 200, decideMin: 30, decideMax: 70,
  },
  gunner: {
    name: 'GUNNER', cn: '火力手', hp: 1, speed: 0.75, fireCooldown: 45, bulletSpeed: 5,
    fireChanceAligned: 0.12, fireChanceRandom: 0.006, score: 300, decideMin: 35, decideMax: 80,
    pathfind: true, // 火力手拥有简单网格路径搜索能力
  },
  ironclad: {
    name: 'IRONCLAD', cn: '铁甲', hp: 4, speed: 0.5, fireCooldown: 80, bulletSpeed: 3,
    fireChanceAligned: 0.05, fireChanceRandom: 0.004, score: 400, decideMin: 50, decideMax: 110,
  },
};
export const ENEMY_TYPE_LIST = ['scout', 'striker', 'gunner', 'ironclad'];

// —— 道具 ——
export const POWERUP_TYPES = ['star', 'shield', 'clock', 'shovel', 'grenade', 'life'];
export const POWERUP_NAMES = {
  star: 'STAR', shield: 'SHIELD', clock: 'CLOCK', shovel: 'SHOVEL', grenade: 'GRENADE', life: 'LIFE',
};
// 掉落权重：星星/护盾/时钟/铲子/手雷/生命
export const POWERUP_WEIGHTS = [3, 3, 3, 3, 2, 1];
export const POWERUP = {
  life: 900, // 15 秒后自动消失
  blinkStart: 240, // 消失前 4 秒开始闪烁
  shieldDuration: 600, // 防护罩约 10 秒
  clockDuration: 600, // 时钟冻结约 10 秒
  shovelDuration: 1080, // 铲子约 18 秒
  pickupScore: 500,
};

// —— 时间（逻辑帧）——
export const TIMING = {
  boot: 30,
  stageIntro: 120,
  stageClear: 120,
  scoreSummary: 300,
  gameOver: 360,
  victory: 420,
  enemySpawnProtect: 90,
  enemySpawnAnim: 60,
  enemySpawnCooldown: 30,
  enemySpawnRetry: 20,
};

export const BULLET = { size: 6, half: 3 };

// 资源上限：对象清理的硬性约束，防止内存无限增长
export const BULLETS_MAX = 16;
export const EFFECTS_MAX = 64;

// —— 存档 ——
export const SAVE_KEY = 'steel-front-save';
export const SAVE_VERSION = 2;
