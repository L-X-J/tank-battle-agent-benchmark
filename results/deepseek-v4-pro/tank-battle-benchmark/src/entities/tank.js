// 坦克基类：玩家与敌人共用字段。
// 所有坐标为逻辑坐标（左上角），与显示坐标完全分离。
import { DIR } from '../config.js';

export class Tank {
  constructor(game, opts) {
    this.id = opts.id ?? game.nextId();
    this.kind = opts.kind; // 'player' | 'enemy'
    this.type = opts.type; // 'p1' | 'p2' | 'scout' | 'striker' | 'gunner' | 'ironclad'
    this.faction = opts.faction; // 'player' | 'enemy'
    this.x = opts.x;
    this.y = opts.y;
    this.dir = opts.dir ?? DIR.UP;
    this.speed = opts.speed ?? 1;
    this.hp = opts.hp ?? 1;
    this.maxHp = this.hp;
    this.alive = true;
    this.spawnProtect = opts.spawnProtect ?? 0; // 出生保护罩
    this.shield = 0; // 防护罩道具
    this.stun = 0; // 友军误击停顿
    this.fireCooldown = 0;
    this.moveAccum = 0; // 小数速度累积
    this.iceLockDir = null; // 冰面滑行方向锁
    this.collided = false; // 本帧是否撞到障碍
    this.frameBorn = game.frame;
    this.lastX = this.x;
    this.lastY = this.y;
    this.hitFlash = 0; // 受击闪白（渲染用，逻辑无关）
  }

  get cx() {
    return this.x + 16;
  }
  get cy() {
    return this.y + 16;
  }

  /** 是否处于保护状态（出生保护或防护罩） */
  isProtected() {
    return this.spawnProtect > 0 || this.shield > 0;
  }

  /** 逐帧递减各类计时器（时钟冻结期间敌人不调用本函数） */
  decrementTimers() {
    if (this.spawnProtect > 0) this.spawnProtect--;
    if (this.shield > 0) this.shield--;
    if (this.stun > 0) this.stun--;
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.hitFlash > 0) this.hitFlash--;
  }
}
