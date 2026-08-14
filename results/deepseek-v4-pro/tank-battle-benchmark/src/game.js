// 游戏核心：纯逻辑、与 DOM/Canvas/音频完全解耦，可在 Node.js 中直接测试。
// 固定时间步长由外部 loop 驱动；本模块只实现每帧模拟与状态流转。
import {
  GAME_VERSION,
  TILE,
  COLS,
  ROWS,
  T,
  DIR,
  PLAYER,
  ENEMY_TYPES,
  ENEMY_TYPE_LIST,
  MAX_ACTIVE_ENEMIES,
  LEVEL_COUNT,
  POWERUP_TYPES,
  TIMING,
  ENEMY_SPAWN_POINTS,
  PLAYER_SPAWN_POINTS,
  BASE_CELLS,
  BASE_WALL_CELLS,
} from './config.js';
import { RNG } from './rng.js';
import { createStorage } from './storage.js';
import { parseAscii, setCell, quadIndexAt } from './map.js';
import { LEVELS } from './levels.js';
import { canTankOccupy, moveBullet, bulletHitsTank, bulletHitsBullet } from './collision.js';
import { STATE, setState } from './state-machine.js';
import { Player, updatePlayer, tryRespawnPlayer } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { FX, addEffect, updateEffects } from './entities/effects.js';
import { updatePowerup, spawnPowerup, tryDropPowerup } from './entities/powerup.js';
import { updateEnemy, controlDemoPlayer } from './ai.js';

function emptyInput() {
  return { up: false, down: false, left: false, right: false, fire: false, justFire: false };
}

function newPlayerStats() {
  return { scout: 0, striker: 0, gunner: 0, ironclad: 0 };
}

export class Game {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 1) >>> 0;
    this.rng = new RNG(this.seed);
    this.mode = opts.mode ?? '1p';
    this.stage = 1;
    this.storage = opts.storage ?? createStorage();
    this.saveData = this.storage.load();

    this.frame = 0;
    this.state = STATE.BOOT;
    this.stateTimer = TIMING.boot;
    this.pauseReason = null;

    this.map = null;
    this.levelData = null;
    this.brickDamage = null;

    this.players = [];
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.powerup = null;

    this.spawnQueue = [];
    this.spawnCooldown = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseWallSnapshot = null;
    this.baseAlive = true;

    this.nextEntityId = 1;
    this.input = { p1: emptyInput(), p2: emptyInput() };
    this.prevInput = { p1: emptyInput(), p2: emptyInput() };
    this.debugForcedInput = { p1: null, p2: null };
    this.demoInput = { dir: DIR.UP, fire: false, decideTimer: 0 };
    this.demoInputView = emptyInput();

    this.menu = { index: 0 };
    this.menuTick = 0;
    this.helpPage = 0;
    this.helpTick = 0;

    this.listeners = [];
    this.stats = this.newStats();
  }

  // ————— 事件（浏览器侧音频/UI 订阅；Node 测试中无监听器，不影响确定性）—————
  on(fn) {
    this.listeners.push(fn);
  }
  emit(type, data) {
    for (const fn of this.listeners) fn(type, data);
  }

  nextId() {
    return this.nextEntityId++;
  }

  tanksAll() {
    return [...this.players, ...this.enemies];
  }

  activeEnemies() {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  newPlayerStats() {
    return newPlayerStats();
  }
  newStats() {
    return {
      kills: { p1: newPlayerStats(), p2: newPlayerStats() },
      stageKills: { p1: newPlayerStats(), p2: newPlayerStats() },
      stageTotal: 0,
      totalKills: 0,
      powerups: { p1: 0, p2: 0 },
    };
  }
  resetStageStats() {
    this.stats.stageKills = { p1: newPlayerStats(), p2: newPlayerStats() };
    this.stats.stageTotal = 0;
  }

  // ————— 启动 / 模式 —————
  startGame(options = {}) {
    const mode = options.mode ?? this.mode;
    if (!['1p', '2p', 'demo'].includes(mode)) throw new Error(`非法模式: ${mode}`);
    if (options.seed !== undefined) {
      this.seed = options.seed >>> 0;
      this.rng = new RNG(this.seed);
    }
    this.mode = mode;
    this.frame = 0;
    this.input = { p1: emptyInput(), p2: emptyInput() };
    this.prevInput = { p1: emptyInput(), p2: emptyInput() };
    this.debugForcedInput = { p1: null, p2: null };
    this.demoInput = { dir: DIR.UP, fire: false, decideTimer: 0 };
    this.demoInputView = emptyInput();
    this.menu = { index: 0 };
    this.menuTick = 0;
    this.helpPage = 0;
    this.stats = this.newStats();
    setState(this, STATE.MAIN_MENU);
    if (options.play) this.startMode(this.mode, options.stage ?? 1); // 测试/调试：跳过菜单直接开打
    this.emit('gameStarted', { mode });
  }

  resetGame() {
    this.startGame({ mode: this.mode, stage: this.stage, seed: this.seed });
  }

  startMode(mode, stage = 1) {
    this.mode = mode;
    this.updateSave({ lastMode: mode });
    this.beginStage(stage);
  }

  // ————— 关卡加载 —————
  loadStageData(stage) {
    const lvl = LEVELS[stage - 1];
    this.stage = stage;
    this.levelData = lvl;
    this.map = parseAscii(lvl.ascii);
    this.brickDamage = new Uint8Array(COLS * ROWS);
  }

  resetStageEntities() {
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.powerup = null;
  }

  spawnPlayers(fresh) {
    this.players = [];
    const p1 = new Player(this, { index: 1, x: PLAYER_SPAWN_POINTS[0].col * TILE, y: PLAYER_SPAWN_POINTS[0].row * TILE });
    p1.spawnProtect = PLAYER.stageStartShield;
    this.players.push(p1);
    if (this.mode === '2p') {
      const p2 = new Player(this, { index: 2, x: PLAYER_SPAWN_POINTS[1].col * TILE, y: PLAYER_SPAWN_POINTS[1].row * TILE });
      p2.spawnProtect = PLAYER.stageStartShield;
      this.players.push(p2);
    }
  }

  beginStage(stage) {
    this.loadStageData(stage);
    this.resetStageEntities();
    this.spawnPlayers(true);
    this.resetSpawnQueue();
    this.spawnCooldown = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseWallSnapshot = null;
    this.baseAlive = true;
    this.resetStageStats();
    setState(this, STATE.STAGE_INTRO);
    this.updateSave({ unlockedStage: Math.max(this.saveData.unlockedStage, stage) });
    this.emit('stageStart', { stage, name: this.levelData.name });
  }

  /** 生成队列：每项 {type, flash}，flash 表示道具携带者（由关卡数据固定） */
  resetSpawnQueue() {
    this.spawnQueue = this.levelData.enemies.map((type, i) => ({
      type,
      flash: this.levelData.carriers.includes(i),
    }));
  }

  /** R 键：重新开始当前关卡（保留生命/分数/火力等级） */
  restartStage() {
    const restartable = [STATE.PLAYING, STATE.PAUSED, STATE.PLAYER_RESPAWN];
    if (!restartable.includes(this.state)) return;
    this.loadStageData(this.stage);
    this.resetStageEntities();
    this.resetSpawnQueue();
    this.spawnCooldown = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseWallSnapshot = null;
    this.baseAlive = true;
    this.resetStageStats();
    for (const p of this.players) {
      if (p.lives <= 0 && !p.alive) continue;
      const sp = PLAYER_SPAWN_POINTS[p.playerIndex - 1];
      p.x = sp.col * TILE;
      p.y = sp.row * TILE;
      p.dir = DIR.UP;
      p.alive = true;
      p.respawnPending = false;
      p.respawnTimer = 0;
      p.spawnProtect = PLAYER.stageStartShield;
      p.iceLockDir = null;
      p.stun = 0;
      p.fireCooldown = 0;
      p.bulletsActive = 0;
    }
    if (this.state !== STATE.PLAYING) setState(this, STATE.PLAYING);
    this.emit('restart', { stage: this.stage });
  }

  // ————— 状态查询 / 转换辅助 —————
  inGameplay() {
    return [STATE.PLAYING, STATE.PAUSED, STATE.PLAYER_RESPAWN].includes(this.state);
  }

  pauseToggle(reason = 'user') {
    if (this.state === STATE.PLAYING) {
      setState(this, STATE.PAUSED);
      this.pauseReason = reason;
      this.emit('pause', { reason });
    } else if (this.state === STATE.PAUSED) {
      setState(this, STATE.PLAYING);
      this.pauseReason = null;
      this.emit('resume', {});
    }
  }
  pauseGame() {
    this.pauseToggle('debug');
  }
  resumeGame() {
    if (this.state === STATE.PAUSED) this.pauseToggle();
  }

  quitToMenu() {
    if (this.state === STATE.MAIN_MENU || this.state === STATE.BOOT) return;
    setState(this, STATE.MAIN_MENU);
    this.menu.index = 0;
    this.updateSave({});
  }

  /** Enter：跳过分数统计 / 结束画面 */
  advance() {
    if (this.state === STATE.SCORE_SUMMARY) {
      this.beginStage(this.stage + 1);
    } else if (this.state === STATE.GAME_OVER || this.state === STATE.VICTORY) {
      this.handleEndReturn();
    }
  }

  handleEndReturn() {
    if (this.mode === 'demo') {
      this.beginStage(1); // DEMO 自动循环演示
      return;
    }
    setState(this, STATE.MAIN_MENU);
  }

  // ————— 菜单 —————
  menuItems() {
    return [
      '1 PLAYER',
      '2 PLAYERS',
      'DEMO',
      'HELP',
      `SOUND: ${this.saveData.sound ? 'ON' : 'OFF'}`,
      'CLEAR SAVE',
    ];
  }
  menuMove(delta) {
    const n = this.menuItems().length;
    this.menu.index = (this.menu.index + delta + n) % n;
    this.emit('menuMove', { index: this.menu.index });
  }
  menuSelect() {
    const idx = this.menu.index;
    switch (idx) {
      case 0: this.startMode('1p'); break;
      case 1: this.startMode('2p'); break;
      case 2: this.startMode('demo'); break;
      case 3: setState(this, STATE.HELP); break;
      case 4: this.toggleSound(); break;
      case 5: this.clearSaveData(); break;
      default: break;
    }
    this.emit('menuSelect', { index: idx });
  }
  menuBack() {
    if (this.state === STATE.HELP) setState(this, STATE.MAIN_MENU);
  }
  helpNext() {
    this.helpPage = (this.helpPage + 1) % 3;
  }
  helpPrev() {
    this.helpPage = (this.helpPage + 2) % 3;
  }

  toggleSound() {
    this.saveData.sound = !this.saveData.sound;
    this.updateSave({ sound: this.saveData.sound });
    return this.saveData.sound;
  }
  adjustVolume(delta) {
    this.saveData.volume = Math.min(1, Math.max(0, this.saveData.volume + delta));
    this.updateSave({ volume: this.saveData.volume });
    return this.saveData.volume;
  }
  clearSaveData() {
    this.storage.clear();
    this.saveData = this.storage.load();
    this.emit('saveCleared', {});
  }

  updateSave(extra = {}) {
    this.saveData = { ...this.saveData, ...extra };
    const maxScore = this.players.reduce((m, p) => Math.max(m, p.score), 0);
    this.saveData.highScore = Math.max(this.saveData.highScore, maxScore);
    this.saveData.unlockedStage = Math.max(this.saveData.unlockedStage, this.stage);
    this.saveData = this.storage.save(this.saveData);
  }

  // ————— 主循环步进 —————
  step() {
    if (this.state === STATE.PAUSED) return; // 暂停：所有计时停止
    if (this.state === STATE.BOOT) {
      this.stateTimer--;
      if (this.stateTimer <= 0) setState(this, STATE.MAIN_MENU);
      return;
    }
    this.frame++;
    switch (this.state) {
      case STATE.MAIN_MENU:
        this.menuTick++;
        break;
      case STATE.HELP:
        this.helpTick++;
        break;
      case STATE.STAGE_INTRO:
        this.stateTimer--;
        if (this.stateTimer <= 0) setState(this, STATE.PLAYING);
        break;
      case STATE.PLAYING:
        this.simulate();
        break;
      case STATE.PLAYER_RESPAWN:
        this.tickRespawnState();
        break;
      case STATE.STAGE_CLEAR:
        this.stateTimer--;
        if (this.stateTimer <= 0) {
          if (this.stage >= LEVEL_COUNT) {
            setState(this, STATE.VICTORY);
            this.emit('victory', {});
          } else {
            setState(this, STATE.SCORE_SUMMARY);
          }
        }
        break;
      case STATE.SCORE_SUMMARY:
        this.stateTimer--;
        if (this.stateTimer <= 0) this.beginStage(this.stage + 1);
        break;
      case STATE.GAME_OVER:
      case STATE.VICTORY:
        this.stateTimer--;
        if (this.stateTimer <= 0) this.handleEndReturn();
        break;
      default:
        break;
    }
    if (
      this.state !== STATE.MAIN_MENU &&
      this.state !== STATE.HELP &&
      this.state !== STATE.BOOT &&
      this.state !== STATE.PAUSED
    ) {
      updateEffects(this);
    }
  }

  stepFrames(n) {
    for (let i = 0; i < n; i++) this.step();
  }

  // ————— 单帧模拟（固定顺序：输入 → 玩家 → 敌人 → 生成 → 子弹 → 道具）—————
  simulate() {
    if (this.freezeTimer > 0) this.freezeTimer--;
    if (this.shovelTimer > 0) {
      this.shovelTimer--;
      if (this.shovelTimer === 0) this.restoreBaseWalls();
    }
    if (this.mode === 'demo' && this.players[0] && this.players[0].alive) {
      controlDemoPlayer(this, this.players[0]);
    }
    this.computeInputEdges();
    for (const p of this.players) updatePlayer(this, p);
    for (const e of this.enemies) updateEnemy(this, e);
    if (this.state !== STATE.PLAYING) return; // 玩家死亡等已改变状态
    this.updateSpawner();
    this.updateBullets();
    if (this.state !== STATE.PLAYING) return;
    updatePowerup(this);
    this.checkStageClear();
  }

  computeInputEdges() {
    for (let i = 1; i <= 2; i++) {
      const cur = this.inputForPlayer(i);
      const prev = this.prevInput[`p${i}`];
      cur.justFire = !!cur.fire && !prev.fire;
      this.prevInput[`p${i}`] = {
        up: !!cur.up,
        down: !!cur.down,
        left: !!cur.left,
        right: !!cur.right,
        fire: !!cur.fire,
      };
    }
  }

  inputForPlayer(index) {
    const forced = this.debugForcedInput[`p${index}`];
    if (forced) return forced;
    if (this.mode === 'demo' && index === 1) return this.demoInputView;
    return this.input[`p${index}`];
  }

  setPlayerInput(playerId, state) {
    const id = playerId === 1 || playerId === '1' || playerId === 'p1' ? 1 : 2;
    this.debugForcedInput[`p${id}`] = {
      up: !!state.up,
      down: !!state.down,
      left: !!state.left,
      right: !!state.right,
      fire: !!state.fire,
      justFire: false,
    };
  }

  // ————— 敌人出生 —————
  updateSpawner() {
    if (this.spawnQueue.length === 0) return;
    if (this.activeEnemies() >= MAX_ACTIVE_ENEMIES) return;
    if (this.spawnCooldown > 0) {
      this.spawnCooldown--;
      return;
    }
    for (const sp of ENEMY_SPAWN_POINTS) {
      const x = sp.col * TILE;
      const y = sp.row * TILE;
      if (!canTankOccupy(this, x, y, null)) continue; // 出生点被占 → 延迟生成
      const item = this.spawnQueue.shift();
      const e = new Enemy(this, { type: item.type, x, y, flash: item.flash });
      this.enemies.push(e);
      addEffect(this, FX.SPAWN, e.cx, e.cy);
      this.spawnCooldown = TIMING.enemySpawnCooldown;
      this.emit('enemySpawn', { type: item.type });
      return;
    }
    this.spawnCooldown = TIMING.enemySpawnRetry;
  }

  // ————— 子弹（固定处理顺序：地图 → 坦克 → 敌对子弹）—————
  updateBullets() {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      if (b.faction === 'enemy' && this.freezeTimer > 0) continue; // 时钟冻结的敌方子弹
      const hit = moveBullet(this, b);
      if (hit) {
        this.onBulletMapHit(b, hit);
        b.alive = false;
        continue;
      }
      for (const t of this.tanksAll()) {
        if (!t.alive) continue;
        if (bulletHitsTank(b, t)) {
          const consumed = this.onBulletTankHit(b, t);
          if (consumed) {
            b.alive = false;
            break;
          }
        }
      }
      if (!b.alive) continue;
      for (const o of this.bullets) {
        if (o === b || !o.alive || o.faction === b.faction) continue;
        if (bulletHitsBullet(b, o)) {
          b.alive = false;
          o.alive = false;
          addEffect(this, FX.SPARK, b.x, b.y);
          this.emit('bulletCancel', {});
          break;
        }
      }
    }
    // 清理 + 重新统计玩家在场子弹
    if (this.bullets.some((b) => !b.alive)) {
      this.bullets = this.bullets.filter((b) => b.alive);
    }
    for (const p of this.players) {
      let n = 0;
      for (const b of this.bullets) if (b.ownerId === p.id) n++;
      p.bulletsActive = n;
    }
  }

  onBulletMapHit(b, hit) {
    if (hit.outOfBounds) return;
    if (hit.code === T.BASE) {
      this.destroyBase();
      return;
    }
    if (hit.code === T.STEEL) {
      if (b.power >= 1) {
        setCell(this.map, hit.col, hit.row, T.EMPTY);
        addEffect(this, FX.EXPLOSION_S, hit.col * TILE + 8, hit.row * TILE + 8);
      } else {
        addEffect(this, FX.SPARK, b.x, b.y);
      }
      this.emit('hitSteel', { destroyed: b.power >= 1 });
      return;
    }
    if (hit.code === T.BRICK) {
      const idx = hit.row * COLS + hit.col;
      const qi = quadIndexAt(b.x - hit.col * TILE, b.y - hit.row * TILE);
      this.brickDamage[idx] |= 1 << qi;
      addEffect(this, FX.EXPLOSION_S, b.x, b.y);
      if (this.brickDamage[idx] === 0b1111) {
        this.brickDamage[idx] = 0;
        setCell(this.map, hit.col, hit.row, T.EMPTY);
      }
      this.emit('hitBrick', {});
    }
  }

  /** 返回 true 表示子弹被消耗 */
  onBulletTankHit(b, t) {
    if (t.faction === b.faction) {
      if (t.kind === 'player' && b.faction === 'player' && b.ownerId !== t.id) {
        // 友军误击：不扣生命，约 0.5 秒失控停顿
        t.stun = PLAYER.stunOnFriendlyFire;
        addEffect(this, FX.SPARK, t.cx, t.cy);
        this.emit('friendlyStun', { playerIndex: t.playerIndex });
        return true;
      }
      return false; // 同阵营子弹穿过
    }
    if (t.isProtected()) {
      addEffect(this, FX.SPARK, b.x, b.y);
      this.emit('blocked', {});
      return true;
    }
    this.damageTank(t.id, 1, { bullet: b });
    return true;
  }

  damageTank(id, amount, ctx = {}) {
    const t = this.tanksAll().find((x) => x.id === id);
    if (!t || !t.alive) return false; // 已销毁对象不重复结算
    t.hp -= amount;
    if (t.hp > 0) {
      t.hitFlash = 6;
      if (t.kind === 'enemy') t.damageStage++;
      addEffect(this, FX.SPARK, t.cx, t.cy);
      this.emit('hitTank', { id: t.id });
      return true;
    }
    this.killTank(t, ctx);
    return true;
  }

  killTank(t, ctx = {}) {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    addEffect(this, FX.EXPLOSION_L, t.cx, t.cy);
    this.emit('explodeLarge', {});
    if (t.kind === 'enemy') {
      const owner = ctx.scoreTo ?? ctx.bullet?.playerIndex ?? null;
      this.creditEnemyKills(owner, [t], ctx);
      if (!ctx.byGrenade && t.flash) tryDropPowerup(this, t.cx, t.cy);
      this.emit('enemyKilled', { type: t.type });
    } else {
      t.lives = Math.max(0, t.lives - 1);
      // 死亡后火力等级降低一级（规则固定，README 明确）
      t.level = Math.max(0, t.level - PLAYER.deathLevelPenalty);
      if (t.lives > 0) {
        t.respawnPending = true;
        t.respawnTimer = PLAYER.respawnDelay;
        setState(this, STATE.PLAYER_RESPAWN);
      }
      this.emit('playerDeath', { playerIndex: t.playerIndex });
      if (this.players.every((p) => p.lives <= 0 && !p.alive)) {
        setState(this, STATE.GAME_OVER);
        this.emit('gameOver', {});
      }
    }
    this.updateSave({});
  }

  creditEnemyKills(playerIndex, list, ctx = {}) {
    for (const e of list) {
      const cfg = ENEMY_TYPES[e.type];
      this.stats.totalKills++;
      this.stats.stageTotal++;
      if (playerIndex != null) {
        const key = `p${playerIndex}`;
        this.stats.kills[key][e.type]++;
        this.stats.stageKills[key][e.type]++;
        const p = this.players.find((x) => x.playerIndex === playerIndex);
        if (p) {
          p.score += cfg.score;
          addEffect(this, FX.SCORE, e.cx, e.cy - 16, { text: `+${cfg.score}` });
        }
      }
    }
    if (list.length) this.updateSave({});
  }

  destroyBase() {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    for (const c of BASE_CELLS) {
      addEffect(this, FX.EXPLOSION_L, c.col * TILE + 8, c.row * TILE + 8);
    }
    addEffect(this, FX.EXPLOSION_L, 12.5 * TILE, 24.5 * TILE);
    this.emit('baseDestroy', {});
    setState(this, STATE.GAME_OVER);
    this.emit('gameOver', {});
    this.updateSave({});
  }

  restoreBaseWalls() {
    if (!this.baseWallSnapshot) return;
    this.baseWallSnapshot.forEach((code, i) => {
      const c = BASE_WALL_CELLS[i];
      setCell(this.map, c.col, c.row, code);
    });
    this.baseWallSnapshot = null;
    this.shovelTimer = 0;
    this.emit('shovelEnd', {});
  }

  tickRespawnState() {
    this.stateTimer--;
    for (const p of this.players) {
      if (!p.respawnPending) continue;
      p.respawnTimer--;
      if (p.respawnTimer <= 0) tryRespawnPlayer(this, p);
    }
    if (this.players.every((p) => !p.respawnPending)) setState(this, STATE.PLAYING);
  }

  checkStageClear() {
    if (this.spawnQueue.length === 0 && !this.enemies.some((e) => e.alive)) {
      setState(this, STATE.STAGE_CLEAR);
      this.updateSave({
        unlockedStage: Math.max(this.saveData.unlockedStage, Math.min(LEVEL_COUNT, this.stage + 1)),
      });
      this.emit('stageClear', { stage: this.stage });
    }
  }

  // ————— 调试 / 测试 API（?debug=1 暴露，Node 测试直接使用）—————
  spawnEnemy(type, position) {
    if (!ENEMY_TYPE_LIST.includes(type)) throw new Error(`非法敌人类型: ${type}`);
    if (this.activeEnemies() >= MAX_ACTIVE_ENEMIES) return null;
    const e = new Enemy(this, {
      type,
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      flash: false,
    });
    this.enemies.push(e);
    return e.id;
  }

  spawnPowerUp(type, position) {
    if (!POWERUP_TYPES.includes(type)) throw new Error(`非法道具类型: ${type}`);
    spawnPowerup(this, type, position?.x ?? 12.5 * TILE, position?.y ?? 12.5 * TILE);
    return this.powerup;
  }

  clearActiveEnemies() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.alive = false;
      e.hp = 0;
      addEffect(this, FX.EXPLOSION_S, e.cx, e.cy);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  // ————— 快照（JSON 可序列化，确定性测试比对用）—————
  getSnapshot() {
    return {
      version: GAME_VERSION,
      state: this.state,
      mode: this.mode,
      stage: this.stage,
      frame: this.frame,
      seed: this.seed,
      rngState: this.rng.state,
      stateTimer: this.stateTimer,
      freezeTimer: this.freezeTimer,
      shovelTimer: this.shovelTimer,
      pauseReason: this.pauseReason,
      base: { alive: this.baseAlive },
      players: this.players.map((p) => ({
        id: p.id,
        index: p.playerIndex,
        alive: p.alive,
        lives: p.lives,
        score: p.score,
        level: p.level,
        x: p.x,
        y: p.y,
        dir: p.dir,
        shield: p.shield,
        spawnProtect: p.spawnProtect,
        stun: p.stun,
        fireCooldown: p.fireCooldown,
        bulletsActive: p.bulletsActive,
        respawnPending: p.respawnPending,
        iceLockDir: p.iceLockDir,
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        dir: e.dir,
        hp: e.hp,
        alive: e.alive,
        spawnProtect: e.spawnProtect,
        flash: e.flash,
        damageStage: e.damageStage,
      })),
      bullets: this.bullets.map((b) => ({
        id: b.id,
        faction: b.faction,
        x: b.x,
        y: b.y,
        dir: b.dir,
        speed: b.speed,
        power: b.power,
        ownerId: b.ownerId,
      })),
      powerup: this.powerup
        ? { type: this.powerup.type, x: this.powerup.x, y: this.powerup.y, life: this.powerup.life }
        : null,
      effectsCount: this.effects.length,
      enemiesRemaining: this.spawnQueue.length + this.activeEnemies(),
      spawnQueueLen: this.spawnQueue.length,
      activeCounts: {
        players: this.players.filter((p) => p.alive).length,
        enemies: this.activeEnemies(),
        bullets: this.bullets.filter((b) => b.alive).length,
        effects: this.effects.length,
      },
      stats: JSON.parse(JSON.stringify(this.stats)),
      mapCells: this.map ? Array.from(this.map.cells) : [],
      brickDamage: this.brickDamage ? Array.from(this.brickDamage) : [],
      highScore: this.saveData.highScore,
    };
  }
}
