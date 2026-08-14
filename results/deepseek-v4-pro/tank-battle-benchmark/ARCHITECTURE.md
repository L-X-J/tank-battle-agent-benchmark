# STEEL FRONT 架构说明

核心原则：**游戏规则与 Canvas 渲染完全分离**。`src/game.js` 及其依赖（entities/collision/ai/levels/map/state-machine/rng/storage）不引用任何 DOM/Canvas/音频 API，因此同一套逻辑既能跑在浏览器中，也能在 Node.js 里被 `node:test` 直接实例化、单步推进与断言。

## 1. 主循环与固定时间步长

`src/loop.js`：

- 逻辑更新固定 **60Hz**（`FIXED_DT = 1/60`），渲染使用 `requestAnimationFrame`，两者解耦
- 累加器模式：`acc += min(dt, 0.25)`，`while (acc >= FIXED_DT && steps < 5) step()`；单帧最多补 5 步，超出部分丢弃
- 长帧与切后台返回时时间被钳制到 250ms，**不会出现物体瞬移或穿墙**，也不会进入时间螺旋
- 所有游戏内时间（冷却、无敌、冻结、道具寿命、动画帧）一律以**逻辑帧计数**表达，绝不使用墙钟时间，因此暂停（不调用 `step()`）即冻结一切计时
- 渲染只读状态（`renderer.render(game, ui)`），从不写回逻辑数据

## 2. 状态机

`src/state-machine.js`：

```text
BOOT → MAIN_MENU ⇄ HELP
MAIN_MENU → STAGE_INTRO → PLAYING ⇄ PAUSED
PLAYING → PLAYER_RESPAWN → PLAYING
PLAYING → STAGE_CLEAR → SCORE_SUMMARY → STAGE_INTRO(下一关)
STAGE_CLEAR(第35关) → VICTORY → MAIN_MENU
PLAYING / PLAYER_RESPAWN → GAME_OVER → MAIN_MENU
任意游戏内状态 --Esc--> MAIN_MENU（存档）
DEMO：GAME_OVER / VICTORY → STAGE_INTRO（自动循环演示）
```

- 合法转换集中定义在 `ALLOWED` 表，非法转换直接抛错（fail fast，杜绝隐式状态漂移）
- 每个状态带 `stateTimer`（介绍 2s、通关 2s、统计 5s、结束 6s 等），Enter 可跳过统计/结束画面
- 玩家死亡 → `PLAYER_RESPAWN`（90 帧，期间战场冻结、特效照常动画），重生后回到 `PLAYING`
- 基地被毁或全员耗尽生命 → `GAME_OVER`

## 3. 实体管理

- 实体为普通对象/类实例，保存在 `game.players / enemies / bullets / effects / powerup` 数组
- 统一分配自增 `id`（`game.nextId()`）；`game.tanksAll()` 返回玩家+敌人合集供碰撞遍历
- **可靠清理机制**：子弹/特效在销毁当帧末即从数组过滤；子弹上限 16、特效上限 64（超限丢弃）；敌人按关卡生命周期清理。确定性长跑测试断言了这些上限与清理行为
- 已销毁对象标记 `alive=false` 并在同帧跳过后续碰撞处理，杜绝"一帧内重复伤害/重复计分"

## 4. 碰撞系统

`src/collision.js`：

- **连续碰撞**：坦克与子弹都按 **1px 子步扫掠**移动（小数速度用余量累积，`moveAccum`），高速子弹（≤6px/帧）不可能穿透 8px 砖墙子块
- 坦克碰撞检测：32×32 包围盒覆盖的 4 个格 + 其它坦克包围盒（`canTankOccupy`）
- 子弹判定框 6×6；坦克受击判定使用 30×30 内缩框（手感公平且确定）
- **固定处理顺序**（每帧确定）：输入 → 玩家 → 敌人 → 出生 → 子弹（地图 → 坦克 → 敌对子弹）→ 道具 → 过关判定
- 砖墙局部破坏：每格 4 个 8×8 子块，按命中点设置 4bit 损伤位（`brickDamage`），4 块全毁才变成空地
- 敌对子弹相撞互相抵消；同阵营子弹穿过（玩家击中另一玩家除外：停顿 0.5 秒）
- 碰撞结果只依赖逻辑坐标与帧序，与显示帧率、窗口缩放完全无关

## 5. 地图系统

- 地图为 26×26 ASCII 网格（字符：`. # S W G I B`），`src/map.js` 解析为 `Uint8Array` 地形码
- 基地（2 格）、基地围墙环（10 格）、玩家出生点（2×2）、敌人出生点（3×2×2）为固定锚点（`config.js`）
- **35 个关卡由固定种子确定性生成**（`src/levels.js`）：种子 = `BASE_SEED + level*常数 + attempt*常数`，同一版本同一关每次加载布局完全一致；布局参数（砖簇/钢条/水面/冰面/草丛数量与密度）随关卡号单调上升，敌人类型构成向火力手/铁甲倾斜（难度曲线）
- 生成时立即运行关卡验证器，失败则按确定序列换种子重试（最多 60 次），**交付的 35 关全部通过验证**

## 6. AI 系统

`src/ai.js` + `src/pathfind.js`：

- 每辆敌人有独立的**决策节奏**：按类型的基础区间（30–110 帧）+ RNG 抖动，避免所有敌人同步决策
- **方向评分**：对 4 个方向打分 = 朝目标（玩家或基地，按类型概率选择）的曼哈顿距离收益 × 权重 + 保持原方向（防抖动）+ 随机扰动（防同步）
- **卡死检测**：位置 40 帧无变化或撞墙即强制重新决策，杜绝永久撞墙与左右抖动
- **对齐开火**：与玩家或基地同行/同列且偏差 ≤6px 时大幅提高开火概率；每个敌人同时最多 1 发子弹
- **路径搜索**：火力手（GUNNER）在决策时刻以约 70% 概率执行一次 26×26 网格 BFS（`bfsPathToNearest`），直奔最近玩家或基地附近；BFS 只发生在决策时刻且只属于一种敌人类型，**绝不每帧对全体敌人做全图搜索**
- 冰面滑行对敌人同样生效；时钟冻结期间敌人不决策、不移动、不开火、计时器不推进
- 所有随机性来自 `game.rng`（显式 seed），AI 行为可复现
- DEMO 模式：同一套系统自动控制玩家 1——主动把垂直炮口偏移收敛到 6px 内再对齐开火，追击最近敌人、无敌人时随机巡逻、撞墙即改向；任何主要操作键返回菜单

## 7. 音频系统

`src/audio.js`：

- 首次用户交互（pointerdown/keydown）后才创建 `AudioContext`；创建失败静默降级，游戏照常运行
- 全程序合成：振荡器（square/triangle/sine/sawtooth）+ 预生成白噪声缓冲 + 双二次滤波器 + 指数包络；覆盖菜单/开火/命中砖钢/爆炸/道具/死亡/通关/失败/胜利/基地摧毁/引擎循环音等
- 主链路挂 **DynamicsCompressor 限幅器**，连续射击不爆音
- 静音（M）与音量（[ ]）写入存档并实时生效；暂停/页面隐藏时挂起 AudioContext 并停止循环引擎音，恢复时由用户操作触发 resume
- 全程只存在一个 AudioContext

## 8. 存档系统

`src/storage.js`：

- 单一版本化键 `steel-front-save`，结构 `{ v: 2, highScore, unlockedStage, sound, volume, lastMode }`
- 读取时逐字段 sanitize（类型/范围校验），旧版本与缺字段回落到默认值；JSON 损坏被捕获并返回默认存档，**不会阻止启动**
- localStorage 不可用（隐私模式/Node）时自动切换到内存存档
- 关键节点（开局、通关、结束、返回菜单、页面卸载）写入；最高分在击杀/拾取时实时更新

## 9. 确定性随机数

`src/rng.js`：mulberry32，显式 seed，暴露 `range/int/pick/chance/shuffle/weightedIndex` 与内部 `state`（快照可复现）。

- 逻辑层禁用 `Math.random` / `Date.now`（唯一例外：音频噪声缓冲与浏览器首次随机种子，均不参与逻辑）
- 关卡生成、敌人构成、AI 决策、道具掉落全部使用 seeded RNG
- 测试证据：相同 seed + 相同输入脚本，600/1800/3600 帧快照 JSON 逐字节一致

## 10. 渲染

`src/renderer.js` + `src/ui/`：

- 逻辑画布 512×416（战场 416 + 信息栏 96），按窗口等比缩放（0.25 步长取整），`canvas.width = 逻辑宽 × scale × devicePixelRatio`，`imageSmoothingEnabled = false`，高 DPI 下像素边缘依然清晰
- 地形用离屏画布图集（16×16 瓦片），砖墙 5 态、水面 2 帧动画、草丛独立分层
- 固定绘制顺序：地形 → 基地/出生点标记 → 道具 → 子弹 → 坦克 → **草丛（覆盖坦克）** → 特效 → 冻结氛围 → HUD → 状态覆盖层
- 坦克为程序矩形像素画（履带动画、方向旋转、双管/裂纹/闪烁/护盾环/眩晕星等细节）；所有界面（菜单/帮助/介绍/暂停/通关/统计/结束/胜利/HUD/调试面板）全部 Canvas 绘制，无 DOM UI

## 11. 测试架构

- `tests/*.test.js` 7 个文件、61 个用例，`node:test` + `node:assert/strict`，零依赖
- 公共工具（`tests/helpers.js`）：构造游戏、跳过介绍进入 PLAYING、注入自定义 ASCII 地图、清场、放置"闲置敌人"（防止清场瞬间触发过关）、数值健康检查
- 覆盖：碰撞 13、伤害 9、道具 12、生成 6、状态机/流程 10、关卡验证 6、确定性长跑 5
- 浏览器侧由 `tools/cdp-check.mjs`（CDP over Node 内置 WebSocket，零依赖）做端到端验收：控制台/网络错误采集、键盘流程模拟（单机/暂停/通关/双人/DEMO/帮助）、截图输出到 `artifacts/`
