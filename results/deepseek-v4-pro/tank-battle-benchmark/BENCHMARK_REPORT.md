# BENCHMARK_REPORT — 严格自评（总分 100）

自评原则：每一项都给出文件、函数、测试或截图证据；证据不足不给满分。证据文件路径相对项目根目录。

## 1. 可启动性和稳定性 — 15 / 15

| 证据项 | 证据 |
| --- | --- |
| 服务器启动 | `npm start` 运行 `server.mjs`，终端输出 `http://localhost:8080`；实际运行日志全部资源 200 |
| 浏览器加载 | Chrome headless（CDP）加载首页：`MAIN_MENU` 状态、`window.__TANK_BATTLE_TEST__.version = 1.0.0` |
| 控制台错误 | CDP 全量采集 Runtime/Log/Network：**0 个错误**（`tools/cdp-check.mjs` 输出 `BROWSER_ERRORS=0`） |
| 稳定性 | 确定性测试 3600 逻辑帧无异常/无 NaN/Infinity（`tests/deterministic-simulation.test.js`）；DEMO 连续 60 秒无异常 |
| 长帧/切后台 | `src/loop.js`：dt 钳制 250ms + 单帧最多 5 步 + 丢弃超额累积 |

## 2. 核心碰撞与战斗机制 — 20 / 20

| 要求 | 实现与证据 |
| --- | --- |
| 全碰撞对覆盖 | 坦克×边界/砖/钢/水/基地/坦克，子弹×边界/砖/钢/坦克/基地/敌对子弹，坦克×道具：`src/collision.js` + `src/game.js#updateBullets` |
| 连续碰撞 | 坦克与子弹均 1px 扫掠子步（`moveTank` / `moveBullet`）；高速子弹不穿墙有专测（`tests/collision.test.js`） |
| 砖墙局部破坏 | 4×8×8 子块位图 `brickDamage`，按命中点破坏对应子块（专测断言 `0b0001`） |
| 穿甲弹 | Level 3 可毁钢墙、普通弹只出火花（专测） |
| 伤害规则 | 玩家一击杀侦察兵、铁甲 4 击且受损阶段递增、保护罩免疫、基地双阵营可毁、已销毁不重复计分、友军 0.5s 停顿（`tests/damage.test.js` 9 例） |
| 确定顺序 | 每帧固定顺序：地图 → 坦克 → 敌对子弹（`ARCHITECTURE.md §4`） |
| 清理 | 子弹/特效销毁当帧过滤 + 硬上限（`BULLETS_MAX=16`、`EFFECTS_MAX=64`），专测覆盖 |

## 3. 完整游戏流程 — 15 / 15

| 要求 | 证据 |
| --- | --- |
| 状态机 | 11 个状态全部实现（`src/state-machine.js`），非法转换抛错 |
| 流程 | 启动→菜单→介绍→游戏→消灭 20 敌→通关→统计→下一关→…→35 关胜利：专测逐步断言（`tests/state-machine.test.js`） |
| 失败 | 基地被毁→GAME_OVER；全员生命耗尽→GAME_OVER（双人一死不死局专测） |
| 暂停 | 帧号与全部计时器（道具/冻结/状态计时）冻结专测；浏览器 P 键实测 `PAUSED⇄PLAYING` |
| 辅助 | R 重开保留分数生命、Esc 回菜单、M 静音、F2 调试、失焦自动暂停且不自动恢复 |

## 4. 敌人 AI 和关卡系统 — 13 / 15

| 要求 | 证据 | 得分说明 |
| --- | --- | --- |
| 4 种敌人 | 侦察兵/突击兵/火力手/铁甲，独立速度/射速/生命/分数（`src/config.js`） | 满分项 |
| AI 行为 | 周期决策（类型化节奏+抖动）、撞墙改向、40 帧卡死检测、按概率朝玩家/基地、对齐提高开火、类型差异化（`src/ai.js`） | 满分项 |
| 路径搜索 | 火力手 BFS（26×26 网格），只在决策时刻执行、仅一种类型（`src/pathfind.js`） | 满分项 |
| 确定性 | 全部随机来自 seeded RNG，AI 行为可复现（确定性长跑比对） | 满分项 |
| 35 关卡 | 固定种子生成 + 加载即验证（结构/基地唯一/出生点/路径/难度曲线），全部通过、布局无重复（`tests/level-validator.test.js`） | 满分项 |
| 扣分原因 | AI 战术深度中等（评分驱动为主，无多敌协同/包抄）；关卡为参数化生成而非手工设计（规格允许，但多样性上限较低） | −2 |

## 5. 双人、道具和升级系统 — 10 / 10

- 双人：独立生命/分数/火力等级、输入互不覆盖、共守基地、友军误击停顿、一人死亡不结束（专测）
- 道具 6 种全部实现并逐项测试：星星封顶、护盾到期、时钟冻结（含新生成敌人）、铲子钢化+快照恢复+重复拾取刷新、手雷只杀活动敌人且正确计分、额外生命（`tests/powerups.test.js` 12 例）
- 道具系统规则：同时最多 1 个、新替旧、闪烁/呼吸、15 秒过期、合法可达位置（BFS 校验）、拾取 +500 与文字反馈
- 火力 4 级（单发/高速/双发/穿甲）+ 死亡降一级规则（README 明确、专测覆盖）

## 6. 视觉、动画、音效和 UI — 8 / 10

| 要求 | 证据 |
| --- | --- |
| 全程序绘制 | 无任何外部素材：地形图集、4 阵营坦克造型、履带动画、炮塔方向、子弹、水面 2 帧动画、草丛遮挡层、基地两态、6 道具图标、生成星光、护盾环、大小爆炸、火花、得分浮字（`src/ui/icons.js`、`src/renderer.js`） |
| 像素清晰 | 逻辑坐标 512×416 等比缩放 + DPR + `imageSmoothingEnabled=false`；碰撞与缩放无关 |
| 音效 | 15+ 种合成音效 + 循环引擎音 + 限幅器防爆音；首次交互后创建 AudioContext；静音/音量持久化；暂停/隐藏时挂起（`src/audio.js`） |
| UI | 主菜单（标题/最高分/解锁关卡/清除存档）、3 页帮助、HUD（敌人数/关卡/生命/分数/火力/音量/状态）、各状态覆盖层；截图证据 7 张（`artifacts/`） |
| 扣分原因 | 文字使用系统等宽字体（规格禁止外部字体，属可接受取舍）；不支持 Gamepad（规格为可选项）；爆炸/粒子美术表现较朴素 | −2 |

## 7. 代码架构和可维护性 — 5 / 5

- 26 个源模块职责清晰（逻辑/渲染/音频/输入/存档/UI 分层），`src/game.js` 纯逻辑可在 Node 直接测试
- 集中式配置（`src/config.js`），无散落魔法数字；无全局变量维持状态
- 无 `TODO`/`FIXME`/空实现/`eval`/`new Function`/死代码（全库 grep 验证）
- 关键代码带注释；文档齐全（README/ARCHITECTURE/QA/BENCHMARK）

## 8. 自动化测试和确定性 — 10 / 10

- `node:test` + 内置断言，零依赖；**61 个用例全部通过、退出码 0**（`npm test` 实测）
- 覆盖规格要求的全部类别（碰撞/伤害/道具/流程/生成/关卡验证），超出"至少 25 个"要求
- 确定性：相同 seed+相同输入，600/1800/3600 帧快照 JSON 逐字节一致；3600 帧长跑无 NaN/Infinity、对象数量有界、坦克不越界、子弹即时清理
- 另附浏览器端到端自动化验收脚本（`tools/cdp-check.mjs`）

## 总分

| 项目 | 得分 | 满分 |
| --- | --- | --- |
| 可启动性和稳定性 | 15 | 15 |
| 核心碰撞与战斗机制 | 20 | 20 |
| 完整游戏流程 | 15 | 15 |
| 敌人 AI 和关卡系统 | 13 | 15 |
| 双人、道具和升级系统 | 10 | 10 |
| 视觉、动画、音效和 UI | 8 | 10 |
| 代码架构和可维护性 | 5 | 5 |
| 自动化测试和确定性 | 10 | 10 |
| **合计** | **96** | **100** |

## 最终状态

```text
DELIVERY_STATUS = PASS
GAME_RUNTIME = PASS
UNIT_TESTS = PASS
LEVEL_VALIDATION = PASS
SINGLE_PLAYER = PASS
TWO_PLAYER = PASS
DEMO_MODE = PASS
CORE_MECHANICS = PASS
BROWSER_CONSOLE_ERRORS = 0
EXTERNAL_DEPENDENCIES = 0
PLACEHOLDER_IMPLEMENTATIONS = 0
TOTAL_TESTS = 61
PASSED_TESTS = 61
FAILED_TESTS = 0
BENCHMARK_SCORE = 96
```

工具限制：构建沙箱环境未暴露 npm CLI，验证时使用项目内零依赖 `./npm` 兼容脚本执行 `npm start` / `npm test`；随后已用用户环境的真实 npm（11.3.0 / Node v24.2.0）完整复验：`npm test` 61/61 通过、`npm start` 正常启动并输出 `http://localhost:8080`。其余工具（Node、Chrome 无头浏览器、CDP）可用，无需 `TOOL_LIMITED` 标记。
