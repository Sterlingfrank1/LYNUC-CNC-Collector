# 开发计划与执行记录

活文档，随实现更新。工作准则见根目录 [AGENT.md](../AGENT.md)。

## 1. 目标与成功标准

在 Linux 上的 Node-RED 中，用一个节点从铼钠克 CNC 控制器采集生产、PLC、运行数据，输出 PRD 规定的 JSON，可接 MQTT。

| 编号 | 标准 | 验证方式 |
| --- | --- | --- |
| G1 | 不依赖 32 位库、FFI、Windows 中间件 | `package.json` 零运行时依赖；64 位 Linux CI 通过 |
| G2 | 发出的请求帧与厂商库逐字节一致 | 一致性测试（厂商 DLL / .so 对接模拟器后比对） |
| G3 | 厂商库能解析模拟器响应，且解析结果与本实现相同 | 同上 |
| G4 | PRD 2.1.2 各类数据有来源，没有来源的如实标注 | 点位表 + [POINTS.md](POINTS.md) |
| G5 | 断线、超时、错包不崩溃、可恢复，失败点位为 `null` 而不是假数据 | 故障注入测试 |
| G6 | 节点能在真实 Node-RED 中部署运行，示例 Flow 可导入 | 节点集成测试 + 编辑器实测 |
| G7 | 只读：代码中不存在任何写控制器的命令 | 测试扫描请求帧 |
| G8 | 真机验收清单就绪 | [SITE_ACCEPTANCE.md](SITE_ACCEPTANCE.md) |

## 2. 方案决策

| 决策 | 选择 | 原因 |
| --- | --- | --- |
| 对接方式 | 纯 Node.js 实现协议 | 协议是 ASCII，厂商 Linux 库 32 位且功能残缺，见 [PROTOCOL.md](PROTOCOL.md) 第 1 节 |
| 交付形态 | 自定义节点 + 示例 Flow | 心跳、串行收发、重连放在 Function 节点里不可靠也不可测 |
| 读写范围 | 只读 | PRD 只要采集；写操作会影响机床安全 |
| 点位 | 声明式点位表 + 用户自定义点 | 现场差异（门开关等）无需改代码 |
| 批量读 | 暂不使用 | 响应长度有截断风险，单点每轮约 45 次往返可接受 |
| 文件类（FTP 履历） | 暂不实现 | PRD 标注可选，后续按需加 |

被否决的方案：

- **FFI 直载 `.so`**：64 位进程加载不了 32 位库。
- **32 位 sidecar 调厂商库**：能跑，但 Linux 库缺坐标和大部分业务 API，补不回来。
- **Modbus TCP**：`Lynuc2 MODBUS 变量说明.md` 只覆盖 PLC 状态位，拿不到坐标、转速、程序、产量。

## 3. 任务拆分

| 阶段 | 内容 | 产出 | 通过门槛 |
| --- | --- | --- | --- |
| 基线 | 原样入库、打 tag | `baseline-project-test` | 新克隆与 `project-test` 逐字节一致 |
| PR1 | 资料入库、规格、计划、旧代码归档 | `docs/`、`legacy/` | 每条结论可追溯到证据 |
| PR2 | 协议客户端 + 模拟器 | `lib/client.js`、`tools/simulator.js` | 单测 + 故障注入通过 |
| PR3 | 点位表 + 采集器 | `lib/points.js`、`lib/collector.js`、`docs/POINTS.md` | JSON 结构符合 PRD |
| PR4 | Node-RED 节点 + 示例 Flow + 现场探测工具 | `nodes/`、`examples/`、`tools/probe.js` | 真实 Node-RED 中跑通 |
| PR5 | 厂商库一致性测试 + CI | `test/conformance/`、`.github/workflows/` | G2、G3 通过 |
| 发布 | 文档收口、`v0.1.0` | Release 与 `.tgz` | 全部 G 项有证据 |

## 4. 风险

| 风险 | 级别 | 应对 |
| --- | --- | --- |
| 协议来自逆向，真机行为可能有差异 | 高 | 兼容多种响应形态；提供 `tools/probe.js` 现场一键验证 |
| 无真机，端到端未验证 | 高 | 用厂商库做客户端侧一致性验证；真机验收清单 |
| 逆向的合规性 | 中 | 仅用于对接自有设备、仓库私有、不外发；建议向厂商确认 |
| 个别点位语义待确认（模式值、单位） | 中 | 输出带原始值，现场校准 |
| 高频读取给控制器增加负担 | 低 | 默认 1 s，下限 200 ms，上一轮未完成则跳过 |

## 5. 执行记录

| 日期 | 事项 | 结果 |
| --- | --- | --- |
| 2026-11-05 | 基线入库 | GitHub 新克隆与 `project-test` 一致，tag `baseline-project-test` |
| 2026-11-05 | 协议分析 | 确认 ASCII 协议、端口 4011、Linux 坐标 API 为空实现，见 PROTOCOL.md |
| 2026-11-05 | 资料补全 | `project-test` 缺的接口说明、宏程序手册、Windows 库取自 `D:\Industry\Cursor_Workspace\CNC` |
