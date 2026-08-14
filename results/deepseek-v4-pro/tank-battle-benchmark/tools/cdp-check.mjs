// 浏览器自动化验收脚本（无第三方依赖）：
// 通过 Chrome DevTools Protocol（Node 内置 WebSocket）加载游戏页面，
// 检查控制台错误/网络 404、验证 debug API、模拟键盘走完整流程并截图。
// 用法：先启动游戏服务器（npm start），再运行：node tools/cdp-check.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = join(ROOT, 'artifacts');
const GAME_URL = process.env.GAME_URL || 'http://localhost:8080/?debug=1';
const CDP_HTTP = process.env.CDP_HTTP || 'http://127.0.0.1:9333';

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 找到页面 target 的 webSocketDebuggerUrl
async function findPageWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${CDP_HTTP}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome 可能还没起来
    }
    await sleep(500);
  }
  throw new Error('无法连接 Chrome DevTools');
}

async function main() {
  const wsUrl = await findPageWs();
  const ws = new WebSocket(wsUrl);
  let msgId = 0;
  const pending = new Map();

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(`[exception] ${d?.exception?.description ?? d?.text ?? 'unknown'}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`[console.error] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(`[log.error] ${msg.params.entry.text}`);
    } else if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
      errors.push(`[http ${msg.params.response.status}] ${msg.params.response.url}`);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = (e) => reject(new Error(`WebSocket error: ${e.message ?? 'unknown'}`));
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');

  // 重新加载页面，确保运行最新代码（并清空加载前捕获的错误）
  await send('Page.navigate', { url: GAME_URL });
  await sleep(2500);
  errors.length = 0;

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`evaluate 失败: ${r.exceptionDetails.text}`);
    return r.result?.value;
  };

  const key = async (code, key, vk) => {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code,
      key,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
    await sleep(40);
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code,
      key,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
  };
  const hold = async (code, key, vk, ms) => {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code,
      key,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
    await sleep(ms);
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code,
      key,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(ARTIFACTS, name), Buffer.from(r.data, 'base64'));
  };

  // 1. 检查页面状态
  const api = await evalJs('typeof window.__TANK_BATTLE_TEST__');
  const version = await evalJs('window.__TANK_BATTLE_TEST__?.version');
  const snap0 = await evalJs('JSON.stringify(window.__TANK_BATTLE_TEST__.getSnapshot().state)');
  console.log(`debug API 存在: ${api}  版本: ${version}  初始状态: ${snap0}`);

  // 2. 主菜单截图
  await shot('main-menu.png');

  // 3. 单机模式：菜单默认选中 1 PLAYER → Enter
  await key('Enter', 'Enter', 13);
  await sleep(3000); // 关卡介绍 2 秒 + 游戏 1 秒
  let st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('进入单机后状态:', st);
  // 玩家移动 + 射击
  await hold('KeyW', 'w', 87, 500);
  await key('Space', ' ', 32);
  await sleep(120);
  await key('Space', ' ', 32);
  await sleep(400);
  await shot('single-player.png');
  const snap1 = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot()');
  console.log(
    `单机快照: 玩家(${snap1.players[0].x},${snap1.players[0].y}) 敌人活跃 ${snap1.activeCounts.enemies} 队列 ${snap1.spawnQueueLen} 子弹 ${snap1.bullets.length}`
  );

  // 4. 暂停 / 恢复
  await key('KeyP', 'p', 80);
  await sleep(300);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('按 P 后状态:', st);
  await shot('paused.png');
  await key('KeyP', 'p', 80);
  await sleep(300);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('再按 P 后状态:', st);

  // 5. 关卡通关画面：清场后进入 STAGE_CLEAR
  await evalJs(
    '(() => { const g = window.__TANK_BATTLE_TEST__.getInternals(); g.spawnQueue = []; g.clearActiveEnemies(); g.stepFrames(2); return g.state; })()'
  );
  await sleep(800);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('清场后状态:', st);
  await shot('stage-clear.png');

  // 6. 回到菜单 → 双人模式
  await key('Escape', 'Escape', 27);
  await sleep(600);
  await key('ArrowDown', 'ArrowDown', 40); // 移动到 2 PLAYERS
  await key('Enter', 'Enter', 13);
  await sleep(3000);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  const snap2 = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot()');
  console.log(`双人模式: 状态 ${st} 玩家数 ${snap2.players.length}`);
  // P1 W 移动 + Space 开火，P2 方向键移动 + Enter 开火
  await hold('KeyW', 'w', 87, 400);
  await key('Space', ' ', 32);
  await hold('ArrowUp', 'ArrowUp', 38, 400);
  await key('Enter', 'Enter', 13);
  await sleep(500);
  await shot('two-player.png');

  // 7. DEMO 模式
  await key('Escape', 'Escape', 27);
  await sleep(600);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40); // 移动到 DEMO
  await key('Enter', 'Enter', 13);
  await sleep(3000);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('DEMO 模式状态:', st);
  await shot('demo.png');
  // 按任意操作键应返回菜单
  await key('KeyW', 'w', 87);
  await sleep(400);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  console.log('DEMO 中按 W 后状态(应为 MAIN_MENU):', st);

  // 8. 帮助页
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40); // 到 HELP
  await key('Enter', 'Enter', 13);
  await sleep(600);
  st = await evalJs('window.__TANK_BATTLE_TEST__.getSnapshot().state');
  await shot('help.png');
  console.log('HELP 状态:', st);
  await key('Escape', 'Escape', 27);
  await sleep(400);

  // 9. 结果
  console.log('---- 浏览器控制台/网络错误 ----');
  if (errors.length === 0) console.log('（无错误）');
  else errors.forEach((e) => console.log(e));
  console.log('---- 完成 ----');
  console.log(`BROWSER_ERRORS=${errors.length}`);
  ws.close();
}

main().catch((e) => {
  console.error('CDP 检查失败:', e.message);
  process.exit(1);
});
