# TankBench · 坦克大战多模型 Agent 能力基准

> `tank-battle-agent-benchmark` —— A standardized prompt for benchmarking LLM agents on building a complete game from scratch, with a fixed tech stack, a fixed rubric, and per-model results.

用**同一套提示词 + 固定技术栈 + 固定评分标准**，横向评测不同大模型 Agent 从零完成一个完整可玩游戏的能力。提示词不仅考察代码生成，还覆盖项目规划、游戏机制、碰撞系统、AI、架构设计、自动测试、调试与交付。

> 不是又一个游戏 demo，而是一把"同一把尺子量所有 Agent"的尺子——提示词不变、技术栈不变、评分标准不变，变的只有模型。

## 工作原理

1. **一份统一提示词**（见 [`坦克大战_通用大模型能力测试提示词.md`](./坦克大战_通用大模型能力测试提示词.md)，唯一标准）
2. 每个模型 Agent 在独立工作目录中、以该提示词从零实现，产出**必须**落在 `tank-battle-benchmark/` 子目录
3. 固定技术栈：HTML5 + CSS3 + 原生 JS ES2022 + Canvas 2D + Web Audio API + Node.js（`node:http` 静态服务器 + `node:test` 测试），禁止框架、TypeScript、第三方依赖、CDN、网络资源、外部素材
4. 统一验收：`npm start`、`npm test`、35 关卡验证、浏览器控制台错误、截图
5. 统一评分：100 分制（提示词第二十一节），产出归档到 `results/<模型>/`

## 目录结构

```text
.
├─ README.md                              本文件（评测框架说明）
├─ 坦克大战_通用大模型能力测试提示词.md      统一提示词（唯一标准，只读）
├─ .gitignore
└─ results/                               各模型的产出归档
   └─ deepseek-v4-pro/                    模型名
      └─ tank-battle-benchmark/           该模型按要求创建的完整项目
         ├─ index.html / styles.css       入口与样式
         ├─ src/                          游戏源码（逻辑与渲染分离）
         ├─ tests/                        自动化测试（node:test）
         ├─ artifacts/                    浏览器验收截图
         └─ README.md / ARCHITECTURE.md
             QA_REPORT.md / BENCHMARK_REPORT.md   该模型自写的文档
```

## 已收录模型结果

| 模型 | 运行时 / Agent | 自动化测试 | 关卡验证 | 浏览器控制台错误 | 自评分 | DELIVERY_STATUS | 在线试玩 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| deepseek-v4-pro | DeepSeek Harness | 61 / 61 通过 | 35 / 35 通过 | 0 | 96 / 100 | PASS | [dsh-tank-game.icxl.net](https://dsh-tank-game.icxl.net/) |

## 快速开始（运行某个模型的结果）

```bash
cd results/deepseek-v4-pro/tank-battle-benchmark

npm start        # 启动本地服务器 → http://localhost:8080
npm test         # 运行全部自动化测试（61 个用例）
npm run build    # 可选：本地生成部署目录（产物不入库，见 .gitignore）
```

> 该项目零第三方依赖，无需 `npm install`；浏览器打开 `http://localhost:8080` 即可游玩。

## 如何添加一个新模型的产出

1. 复制 `坦克大战_通用大模型能力测试提示词.md` 中的提示词，交给目标模型 Agent，工作目录设为 `results/<模型名>/`
2. 要求其按要求创建 `tank-battle-benchmark/` 并完成实现、测试与交付
3. 在该目录内验证：`npm test`（记录用例数/通过数）、`npm start`、浏览器控制台错误数、截图
4. 在上方「已收录模型结果」表新增一行；建议同步归档该模型自写的 `QA_REPORT.md` / `BENCHMARK_REPORT.md`

## 评分标准（满分 100，详见提示词第二十一节）

| 项目 | 分值 |
| --- | --- |
| 可启动性和稳定性 | 15 |
| 核心碰撞与战斗机制 | 20 |
| 完整游戏流程 | 15 |
| 敌人 AI 和关卡系统 | 15 |
| 双人、道具和升级系统 | 10 |
| 视觉、动画、音效和 UI | 10 |
| 代码架构和可维护性 | 5 |
| 自动化测试和确定性 | 10 |

最终状态判定以提示词第二十三节（`DELIVERY_STATUS = PASS / PARTIAL / FAIL`）与第二十四节（固定格式交付报告）为准。

## 推荐 Topics（GitHub 标签）

```text
benchmark  llm-agents  agent-benchmark  code-generation
game-development  canvas  nodejs  web-audio  tank-battle
```

## 免责声明

- 提示词明确要求原创名称、原创关卡、原创图形与程序合成音效，禁止复制商业作品的版权素材；各模型产出由对应模型 Agent 自身生成
- 本仓库仅用于模型能力评测与横向对比
