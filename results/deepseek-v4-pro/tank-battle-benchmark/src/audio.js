// 音频系统：全部音效由 Web Audio API 程序合成，不加载任何音频文件。
// - 首次用户交互后才创建/恢复 AudioContext
// - 静音与音量持久化（随 game.saveData）
// - 连续射击通过限幅器（DynamicsCompressor）避免爆音
// - 暂停/页面隐藏时挂起 AudioContext 并停止循环引擎音
// - 音频不可用时游戏照常运行
export function createAudioSystem(game) {
  let ctx = null;
  let master = null;
  let limiter = null;
  let noiseBuffer = null;
  let engineOsc = null;
  let engineLfo = null;
  let engineGain = null;
  let muted = !game.saveData.sound;
  let volume = game.saveData.volume;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 20;
      limiter.ratio.value = 12;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null; // 音频不可用 → 静默降级
    }
  }

  function tone({ type = 'square', from = 440, to, dur = 0.08, gain = 0.2, when = 0 }) {
    if (!ctx || !master) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, from), t0);
      if (to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      }
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // ignore：节点生命周期竞争不影响游戏
    }
  }

  function noise({ dur = 0.1, gain = 0.2, filterFrom = 4000, filterTo = 200, type = 'lowpass', when = 0 }) {
    if (!ctx || !master || !noiseBuffer) return;
    try {
      const t0 = ctx.currentTime + when;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(Math.max(40, filterFrom), t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
      // ignore
    }
  }

  const sounds = {
    menuConfirm: () => tone({ from: 660, to: 880, dur: 0.07, gain: 0.15 }),
    menuMove: () => tone({ from: 440, dur: 0.04, gain: 0.08 }),
    stageStart: () => {
      tone({ from: 523, dur: 0.1, gain: 0.18 });
      tone({ from: 784, dur: 0.12, gain: 0.18, when: 0.1 });
    },
    playerFire: () => tone({ from: 320, to: 90, dur: 0.09, gain: 0.12 }),
    enemyFire: () => tone({ from: 200, to: 70, dur: 0.07, gain: 0.09 }),
    hitBrick: () => noise({ dur: 0.06, gain: 0.14, filterFrom: 3000, filterTo: 400 }),
    hitSteel: () => {
      tone({ type: 'triangle', from: 1400, to: 900, dur: 0.05, gain: 0.12 });
      noise({ dur: 0.04, gain: 0.06, filterFrom: 6000, filterTo: 2500, type: 'highpass' });
    },
    hitTank: () => tone({ type: 'triangle', from: 220, to: 70, dur: 0.1, gain: 0.2 }),
    explodeSmall: () => {
      noise({ dur: 0.18, gain: 0.22, filterFrom: 2500, filterTo: 200 });
      tone({ type: 'sine', from: 160, to: 60, dur: 0.15, gain: 0.18 });
    },
    explodeLarge: () => {
      noise({ dur: 0.5, gain: 0.32, filterFrom: 3000, filterTo: 120 });
      tone({ type: 'sine', from: 120, to: 40, dur: 0.45, gain: 0.28 });
    },
    baseDestroy: () => {
      noise({ dur: 0.8, gain: 0.4, filterFrom: 3500, filterTo: 100 });
      tone({ type: 'sawtooth', from: 150, to: 30, dur: 0.7, gain: 0.3 });
    },
    powerup: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, dur: 0.06, gain: 0.15, when: i * 0.06 }));
    },
    extraLife: () => {
      [659, 784, 988, 1319].forEach((f, i) =>
        tone({ type: 'triangle', from: f, dur: 0.08, gain: 0.15, when: i * 0.07 })
      );
    },
    playerDeath: () => tone({ type: 'sawtooth', from: 400, to: 80, dur: 0.5, gain: 0.2 }),
    stageClear: () => {
      [392, 523, 659, 784].forEach((f, i) => tone({ from: f, dur: 0.1, gain: 0.16, when: i * 0.09 }));
    },
    gameOver: () => {
      [523, 415, 330, 262].forEach((f, i) =>
        tone({ type: 'triangle', from: f, dur: 0.22, gain: 0.18, when: i * 0.2 })
      );
    },
    victory: () => {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
        tone({ from: f, dur: 0.14, gain: 0.18, when: i * 0.12 })
      );
    },
    pause: () => tone({ from: 440, to: 330, dur: 0.08, gain: 0.1 }),
    resume: () => tone({ from: 330, to: 440, dur: 0.08, gain: 0.1 }),
    clock: () => tone({ type: 'sine', from: 1200, to: 200, dur: 0.3, gain: 0.15 }),
    shovel: () => noise({ dur: 0.15, gain: 0.15, filterFrom: 800, filterTo: 2000, type: 'bandpass' }),
    grenade: () => {
      noise({ dur: 0.5, gain: 0.3, filterFrom: 2000, filterTo: 150 });
      tone({ type: 'sine', from: 140, to: 40, dur: 0.4, gain: 0.2 });
    },
    friendlyStun: () => tone({ from: 180, to: 120, dur: 0.06, gain: 0.1 }),
    powerupSpawn: () => tone({ type: 'triangle', from: 880, dur: 0.05, gain: 0.08 }),
  };

  function onEvent(type, data) {
    switch (type) {
      case 'menuSelect': sounds.menuConfirm(); break;
      case 'menuMove': sounds.menuMove(); break;
      case 'stageStart': sounds.stageStart(); break;
      case 'playerFire': sounds.playerFire(); break;
      case 'enemyFire': sounds.enemyFire(); break;
      case 'hitBrick': sounds.hitBrick(); break;
      case 'hitSteel': sounds.hitSteel(); break;
      case 'hitTank': sounds.hitTank(); break;
      case 'explodeLarge': sounds.explodeLarge(); break;
      case 'powerupPickup': sounds.powerup(); break;
      case 'powerupSpawn': sounds.powerupSpawn(); break;
      case 'playerDeath': sounds.playerDeath(); break;
      case 'stageClear': sounds.stageClear(); break;
      case 'gameOver': sounds.gameOver(); break;
      case 'victory': sounds.victory(); break;
      case 'baseDestroy': sounds.baseDestroy(); break;
      case 'clock': sounds.clock(); break;
      case 'shovelEnd': sounds.shovel(); break;
      case 'grenade': sounds.grenade(); break;
      case 'friendlyStun': sounds.friendlyStun(); break;
      case 'extraLife': sounds.extraLife(); break;
      case 'pause':
        sounds.pause();
        if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
        break;
      case 'resume':
        ensure();
        if (ctx) ctx.resume().catch(() => {});
        sounds.resume();
        break;
      default:
        break;
    }
  }

  function startEngine() {
    if (!ctx || !master || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineLfo = ctx.createOscillator();
      engineLfo.frequency.value = 8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 8;
      engineLfo.connect(lfoGain);
      lfoGain.connect(engineOsc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.05;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineLfo.start();
    } catch {
      engineOsc = null;
    }
  }

  function stopEngine() {
    if (!engineOsc) return;
    try {
      engineOsc.stop();
      engineLfo.stop();
    } catch {
      // ignore
    }
    engineOsc = null;
    engineLfo = null;
    engineGain = null;
  }

  function applyGain() {
    if (ctx && master) {
      master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
    }
  }

  /** 每渲染帧调用：同步静音/音量，管理循环引擎音 */
  function update() {
    if (muted !== !game.saveData.sound) {
      muted = !game.saveData.sound;
      applyGain();
    }
    if (volume !== game.saveData.volume) {
      volume = game.saveData.volume;
      applyGain();
    }
    if (!ctx) return;
    const playing = game.state === 'PLAYING';
    let moving = false;
    for (const p of game.players) {
      if (!p.alive) continue;
      const inp = game.inputForPlayer(p.playerIndex);
      if (inp.up || inp.down || inp.left || inp.right) moving = true;
    }
    if (playing && moving) startEngine();
    else stopEngine();
  }

  function onVisibility(hidden) {
    if (hidden) {
      stopEngine();
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    }
  }

  return { ensure, update, onVisibility, onEvent };
}
