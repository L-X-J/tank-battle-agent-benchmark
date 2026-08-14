// 主循环：固定时间步长（60Hz）逻辑更新 + requestAnimationFrame 渲染。
// 处理长帧与切后台后的时间累积：dt 钳制 + 步数上限，避免瞬移/穿墙与时间螺旋。
import { FIXED_DT } from './config.js';

export class Loop {
  constructor({ step, render }) {
    this.step = step; // 每次调用 = 一个固定逻辑帧
    this.render = render; // 每个 rAF 一帧
    this.running = false;
    this.rafId = 0;
    this.last = 0;
    this.acc = 0;
    this.fps = 60;
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // 标签页切回/长帧：钳制单帧时间
      this.acc += dt;
      let steps = 0;
      const MAX_STEPS = 5;
      while (this.acc >= FIXED_DT && steps < MAX_STEPS) {
        this.step();
        this.acc -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0; // 丢弃超额累积，防止螺旋
      // FPS 统计（仅渲染帧率，供调试面板）
      this.fpsFrames++;
      if (now - this.fpsTime >= 500) {
        this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsTime));
        this.fpsFrames = 0;
        this.fpsTime = now;
      }
      this.render(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
