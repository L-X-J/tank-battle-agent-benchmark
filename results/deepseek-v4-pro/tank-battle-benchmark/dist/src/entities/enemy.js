// 敌方坦克：4 种类型（侦察兵/突击兵/火力手/铁甲）。
// 铁甲 4 点生命，受损阶段通过 damageStage 驱动外观变化。
import { Tank } from './tank.js';
import { ENEMY_TYPES, DIR, TIMING } from '../config.js';

export class Enemy extends Tank {
  constructor(game, opts) {
    const cfg = ENEMY_TYPES[opts.type];
    if (!cfg) throw new Error(`非法敌人类型 ${opts.type}`);
    super(game, {
      kind: 'enemy',
      type: opts.type,
      faction: 'enemy',
      x: opts.x,
      y: opts.y,
      dir: DIR.DOWN,
      speed: cfg.speed,
      hp: cfg.hp,
    });
    this.cfg = cfg;
    this.flash = !!opts.flash; // 道具携带者（闪烁）
    this.spawnProtect = opts.spawnProtect ?? TIMING.enemySpawnProtect;
    this.decisionTimer = game.rng.int(10, 40);
    this.stuckFrames = 0;
    this.path = null; // 火力手 BFS 路径（格坐标）
    this.pathIndex = 0;
    this.damageStage = 0; // 已受击次数（铁甲外观）
  }
}
