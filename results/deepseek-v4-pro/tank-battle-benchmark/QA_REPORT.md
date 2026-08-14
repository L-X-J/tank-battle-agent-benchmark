# QA_REPORT — 测试与运行验收记录

执行环境：macOS，Node.js v24（构建验证使用沙箱内 Node v24.11.0 + 项目 `./npm` 兼容脚本；最终复验使用用户环境 nvm Node v24.2.0 + npm 11.3.0，`npm test` 61/61 通过、退出码 0，`npm start` 正常启动）。测试日期：本次交付。

## 1. 自动化测试

| 测试项目 | 执行方式 | 实际结果 | 是否通过 | 对应证据 |
| --- | --- | --- | --- | --- |
| 全量单元测试 | `npm test`（=`node --test "tests/*.test.js"`） | 61 个用例全部通过，退出码 0 | 通过 | `/tmp` 运行日志；退出码 0 |
| 碰撞：坦克与砖墙/钢墙/水面/草丛/冰面/边界/坦克 | `tests/collision.test.js` 13 例 | 13/13 通过 | 通过 | 逐帧断言坐标（如停在墙前 `y === 12*16-32`） |
| 碰撞：砖墙局部破坏（8×8 子块） | 子弹命中左上子块断言 `brickDamage === 0b0001` | 通过 | 通过 | `tests/collision.test.js` |
| 碰撞：普通子弹不能摧毁钢墙 / 穿甲弹可摧毁 | 两种子弹对同一钢墙格 | 通过 | 通过 | `tests/collision.test.js` |
| 碰撞：高速子弹不穿墙（扫掠） | 6px/帧 子弹贴墙发射 | 通过 | 通过 | `tests/collision.test.js` |
| 碰撞：敌对子弹相撞抵消 | 双子弹对射 | 通过 | 通过 | `tests/collision.test.js` |
| 伤害：击杀基础敌人/铁甲 4 击/玩家死亡/保护罩/基地（双阵营）/不重复计分/友军停顿 | `tests/damage.test.js` 9 例 | 9/9 通过 | 通过 | 分数、生命、状态机断言 |
| 道具：星星/护盾/时钟/铲子/手雷/生命 + 过期/替换/掉落/拾取分 | `tests/powerups.test.js` 12 例 | 12/12 通过 | 通过 | 道具计时器与墙体快照断言 |
| 生成：20 辆队列/同屏 ≤4/出生点占用延迟/保护期/不重叠/35 关配置/携带者数量 | `tests/spawning.test.js` 7 例 | 7/7 通过 | 通过 | 队列长度与坐标对断言 |
| 流程：启动/暂停冻结计时/通关→统计→下一关/基地→结束/双人死亡规则/35 关胜利/R 重开/死亡降级/回菜单 | `tests/state-machine.test.js` 10 例 | 10/10 通过 | 通过 | 状态序列断言 |
| 关卡：35 关全部合法/布局唯一/基地唯一/出生点合法/敌人配置/有效路径/难度上升 | `tests/level-validator.test.js` 6 例 | 6/6 通过 | 通过 | BFS 路径断言 + 验证器全量 |
| 确定性：3600 帧无 NaN/Infinity、对象有界、坦克不越界 | `tests/deterministic-simulation.test.js` | 通过 | 通过 | 每 25 帧快照全量数值检查 |
| 确定性：同 seed+同输入快照逐字节一致 | 双实例同步推进比对 600/1800/3600 帧 | 一致 | 通过 | `JSON.stringify` 全等 |
| 清理：已销毁子弹当帧移除 | 贴墙发射后 `bullets.length === 0` | 通过 | 通过 | `tests/deterministic-simulation.test.js` |
| DEMO：连续 3600 帧（60 秒）无异常且会移动/开火 | 固定 seed 长跑 | 通过 | 通过 | `tests/deterministic-simulation.test.js` |

## 2. 关卡验证

| 测试项目 | 执行方式 | 实际结果 | 是否通过 | 对应证据 |
| --- | --- | --- | --- | --- |
| 35 关全部通过验证器 | `validateAll(LEVELS)` | `errors=[]` | 通过 | `tests/level-validator.test.js` |
| 尺寸/字符合法 | 验证器逐格检查 | 全部合法 | 通过 | 同上 |
| 基地存在且唯一 | 每关恰好 2 格 'B' 且相邻 | 通过 | 通过 | 同上 |
| 敌人/玩家出生点无阻挡 | 2×2 区域全为空地 | 通过 | 通过 | 同上 |
| 每关敌人总数正确 | 20 辆、类型合法、携带者 4 个 | 通过 | 通过 | 同上 |
| 有效路径（敌区→基地、玩家→开阔区） | BFS（砖墙可破坏→可达） | 35 关全通过 | 通过 | 同上 |
| 布局无重复 | 35 个 ASCII 布局 Set 去重 | 35 个全不同 | 通过 | 同上 |
| 难度总体上升 | 后期障碍均值 > 前期 | 通过 | 通过 | 同上 |

## 3. 实际运行验证（本地服务器 + 浏览器）

服务器：`npm start` 输出 `http://localhost:8080`，全部静态资源返回 200（服务器日志逐条可见）。

浏览器验证方式：Chrome headless + Chrome DevTools Protocol（`tools/cdp-check.mjs`，零依赖），加载 `http://localhost:8080/?debug=1` 并模拟真实键盘事件。

| 验证项 | 执行方式 | 实际结果 | 是否通过 | 对应证据 |
| --- | --- | --- | --- | --- |
| 首页加载 | CDP 导航 + 服务器日志 | 200，无 404（favicon 已用 data: 处理） | 通过 | 服务器日志 |
| 主菜单显示 | 页面快照 `state === MAIN_MENU` | 通过 | 通过 | `artifacts/main-menu.png` |
| 单人模式进入 | 菜单 Enter | `state === PLAYING`，敌人 4/队列 16 | 通过 | CDP 快照输出 |
| 玩家移动与射击 | 按住 W + 两次 Space | 玩家 y 384→353，场上子弹 2 | 通过 | 快照坐标、`artifacts/single-player.png` |
| 敌人生成与行动 | 快照 | 活跃敌人 4，队列递减 | 通过 | 快照 + 长跑测试 |
| 暂停与恢复 | P 键 | `PAUSED` ⇄ `PLAYING` | 通过 | `artifacts/paused.png` |
| 重新开始 | R 键（自动化测试覆盖） | 保留分数/生命，地图与队列重置 | 通过 | `tests/state-machine.test.js` |
| 游戏结束 | 基地摧毁（测试覆盖） | `GAME_OVER` → `MAIN_MENU` | 通过 | `tests/damage.test.js` |
| 双人输入 | 菜单选 2 PLAYERS；W/Space 与 ↑/Enter 并行 | 玩家数 2，双方均可控 | 通过 | `artifacts/two-player.png` |
| DEMO 模式 | 菜单选 DEMO | AI 自动游玩；按 W 返回菜单 | 通过 | `artifacts/demo.png` |
| 通关画面 | 调试接口清场 | `STAGE_CLEAR` 画面 | 通过 | `artifacts/stage-clear.png` |
| 帮助页面 | 菜单 HELP | HELP 状态、3 页内容 | 通过 | `artifacts/help.png` |
| 控制台错误 | CDP Runtime/Log/Network 全量采集 | **0 个错误** | 通过 | `BROWSER_ERRORS=0` |
| 画面内容 | 页面内 Canvas 像素采样 | 菜单 366 色/游戏 200 色，非空屏 | 通过 | 采样脚本输出 |

截图产物：`artifacts/{main-menu,single-player,two-player,stage-clear,paused,demo,help}.png`（共 7 张）。

`BROWSER_VISUAL_CHECK = PASS`（具备浏览器自动化与截图能力，已生成截图）。

## 4. 修复记录（开发中发现并修复的问题）

1. 模块相对路径错误（`src/ai.js`、`src/entities/effects.js`）→ 修正导入路径
2. `node --test tests/`（目录形式）在 Node 24 下不被接受 → 改为 glob 形式 `"tests/*.test.js"`
3. 清场后立即触发过关导致子弹/计时冻结，影响单元测试 → 引入"闲置敌人"占位辅助
4. 生成队列不携带"道具携带者"标记，人工截断队列时索引错位 → 队列项改为 `{type, flash}` 结构
5. DEMO AI 从不更新输入视图（不移动不开火）→ 补充 `demoInputView` 写入；并升级为主动瞄准逻辑
6. 渲染模块作用域错误（`ctx` 自由变量）→ 所有绘制函数显式传 `ctx`（浏览器首验发现）
7. DEMO 退出后菜单导航被 DEMO 分支吞掉 → 路由条件限制在 DEMO 实际进行中的状态
8. favicon 请求 404 → `<link rel="icon" href="data:,">`

全部修复后：`npm test` 61/61 通过；浏览器控制台 0 错误。

## 5. 结论

所有验收项全部通过，无已知阻断性缺陷。
