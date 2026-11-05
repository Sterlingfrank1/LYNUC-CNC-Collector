# LYNUC-CNC-Collector

铼钠克（LYNUC）CNC 控制器的 Node-RED 采集节点。直连控制器 TCP 4011，采集运行、PLC、生产数据，输出 JSON，可接 MQTT。

- **纯 JavaScript**：无运行时依赖，不需要 32 位库、FFI 或 Windows 中间件
- **只读**：代码中没有任何写控制器的命令
- **不编造数据**：读失败的点位为 `null`，并记入 `errors`

> **状态**：协议依据厂商客户端库分析得出，已通过厂商库一致性验证，但**尚未在真机上验证**。上线前请完成 [docs/SITE_ACCEPTANCE.md](docs/SITE_ACCEPTANCE.md)。

本仓库含厂商资料与协议分析，请保持私有。

## 安装

从 [Releases](https://github.com/Sterlingfrank1/LYNUC-CNC-Collector/releases) 下载 `.tgz`，或在仓库根目录执行：

```bash
npm pack
```

然后二选一：

- Node-RED 编辑器：菜单 → 节点管理 → 安装 → 上传模块 tgz 文件
- 命令行：

```bash
cd ~/.node-red && npm install /path/to/node-red-contrib-lynuc-cnc-0.1.0.tgz
```

要求 Node-RED ≥ 2.0、Node.js ≥ 14。Linux x64、ARM、容器环境都可以使用。

## 现场第一步

先确认控制器能通、点位正确，再配置 Flow：

```bash
node ~/.node-red/node_modules/node-red-contrib-lynuc-cnc/tools/probe.js 192.168.1.100 --report probe-report.json
```

## 使用

1. 从 `IIoT` 分类拖入 **LYNUC CNC** 节点，填写控制器 IP 和设备 ID。
2. 第 1 个输出是采集数据，第 2 个输出是事件，接 `mqtt out` 或其他节点。
3. 部署。

也可以导入示例：菜单 → 导入 → 示例 → `node-red-contrib-lynuc-cnc` → `lynuc-cnc-mqtt`，把控制器 IP 和 Broker 地址改成实际值。

`mqtt out` 的主题留空时，使用节点输出的 `msg.topic`：数据为 `cnc/<设备ID>/status`，事件为 `cnc/<设备ID>/status/events`。

### 输入命令

| `msg.payload` | 作用 |
| --- | --- |
| `reconnect` | 重新连接 |
| `disconnect` | 断开 |
| `status` | 从第 2 个输出返回连接状态 |
| 其他 | 立即采集一轮 |

### 输出示例

```json
{
  "timestamp": "2026-11-05T21:42:40.683Z",
  "deviceId": "CNC_001",
  "deviceType": "CNC_CONTROLLER",
  "dataType": "partial_status",
  "data": {
    "machineStatus": { "mode": "AUTO", "state": "RUNNING", "ready": true, "emergencyStop": false },
    "axes": { "X": { "position": 100.5, "relative": 10.5, "machine": 500.5, "remaining": 1.25, "velocity": 200, "load": 30, "unit": "mm" } },
    "spindle": { "speed": { "actual": 2985, "command": 3000, "unit": "rpm" }, "override": 100, "state": "FORWARD" },
    "feedrate": { "command": 500, "actual": 480.5, "override": 100, "rapidOverride": 50, "unit": "mm/min" },
    "program": { "name": "O1234.NC", "line": 1250, "totalLines": 2000, "progress": 62.5 },
    "alarms": []
  }
}
```

全部字段及来源见 [docs/POINTS.md](docs/POINTS.md)。各组采集频率不同，所以一条消息只含本轮到期的组：全部包含时 `dataType` 为 `full_status`，否则为 `partial_status`。

部分 PRD 项在控制器上没有标准来源（主轴温度、程序剩余时间、刀具寿命百分比等），不会输出占位值，门开关等可通过自定义点位配置，详见 POINTS.md。

## 无机床试用

```bash
npm run simulate
```

模拟器监听 4011，把节点 IP 配成运行模拟器的机器即可。模拟器只能证明客户端的行为，不能证明真实控制器的行为。

## 开发

```bash
npm install
npm test
```

| 路径 | 内容 |
| --- | --- |
| `lib/client.js` | 协议客户端 |
| `lib/points.js` | 点位表 |
| `lib/collector.js` | 采集、重连、事件 |
| `nodes/` | Node-RED 节点 |
| `tools/probe.js` | 现场探测工具 |
| `tools/simulator.js` | 控制器模拟器 |
| `test/conformance/` | 与厂商库的一致性测试 |

文档：

- [协议规格](docs/PROTOCOL.md)
- [数据点位](docs/POINTS.md)
- [现场验收清单](docs/SITE_ACCEPTANCE.md)
- [开发计划与执行记录](docs/DEV_PLAN.md)
- [需求 PRD](CNC_Node_RED_Node_PRD.md)、[工作准则](AGENT.md)
- 厂商资料：[Protocol_doc/](Protocol_doc/)、[客户端库文件/](客户端库文件/)
- [历史实现（已弃用）](legacy/README.md)，原始快照见 tag `baseline-project-test`
