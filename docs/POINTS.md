# 数据点位表

`lib/points.js` 的说明。"来源"列的 `#` 为宏变量（`0007`），`#…(0105)` 为备用读取路径，`PLC` 为 `0060`，地址即远程 PLC 地址（类型 1=MO）。

验证状态：

- **文档**：来源于宏程序手册、接口说明或 `globals.h`
- **DLL**：Windows 库实际使用的编号（手册未必列出）
- **待现场**：值的含义或单位需真机确认，见 [SITE_ACCEPTANCE.md](SITE_ACCEPTANCE.md)

所有点位都未经真机验证。读失败时字段为 `null`，并记入消息的 `errors` 数组。

## 输出字段

### machineStatus（默认每周期）

| 字段 | 来源 | 说明 | 状态 |
| --- | --- | --- | --- |
| `mode` / `modeRaw` | PLC `205.20.24` (F_MODE) | 1 无代码、2 AUTO、4 HANDLE、5 JOG、6 HOME、8 MDI；未知值输出 `UNKNOWN`，`modeRaw` 保留原值 | 文档，取值待现场 |
| `running` / `holding` / `stopped` / `ready` | PLC `206.0~.3`（通道 2 为 `208.x`） | F_RUNNING 等 | 文档 |
| `systemReady` | PLC `200.12` | F_SYSREADY | 文档 |
| `emergencyStop` | PLC `200.6` | F_EMGSTOP | 文档 |
| `powerOn` | PLC `200.8` | F_PWSTS | 文档 |
| `fatalError` / `error` / `warning` | PLC `203.11` / `.13` / `.14` | | 文档 |
| `errorCode` | `#2041`（通道 2：`#2042`） | 路径错误号 | 文档 |
| `errorLevel` | `#2101`（通道 2：`#2102`） | 0 无、1 致命、2 错误、3 警告、4 消息 | 文档 |
| `state` | 派生 | `EMERGENCY` > `ALARM` > `STOPPED` > `PAUSED` > `RUNNING` > `IDLE`；任一输入缺失为 `UNKNOWN` | 派生 |

### axes（默认每周期）

轴基址 `B = 30100 + 50×序号`，序号按 X,Y,Z,A,B,C,U,V,W。

| 字段 | 来源 | 说明 | 状态 |
| --- | --- | --- | --- |
| `position` | `#B+18` | 工件绝对坐标，Windows API 同此 | DLL、文档 |
| `relative` | `#B+19` | 相对坐标 | DLL、文档 |
| `machine` | `#B+21` | 机械坐标 | DLL、文档 |
| `remaining` | `#B+22` | 加工残量 | 文档 |
| `velocity` | `#B+30` | 轴实际速度 | 文档，单位待现场 |
| `load` | `#B+32 (0105)` | 马达负载 | DLL、文档 |

手册还有 `#B+26`（含刀补的画面绝对坐标）。若现场要与屏幕显示一致，用自定义点位读取。

### spindle（默认每周期）

| 字段 | 来源 | 状态 |
| --- | --- | --- |
| `speed.command` | `#33505` | DLL、文档 |
| `speed.actual` | `#33506` | DLL，手册未列 |
| `override` | `#33518` | 文档 |
| `state` / `stateRaw` | PLC `204.0.3`：2 停止、3 正转、4 反转 | 文档（`globals.h` 的 G_SELSP 说明），F_SELSP 取值待现场 |

### feedrate（默认每周期）

| 字段 | 来源 | 状态 |
| --- | --- | --- |
| `command` | `#33563` | DLL、文档 |
| `actual` | `#30037` 插补轴合成实际速度 | 文档，单位待现场 |
| `override` | `#33554` | 文档 |
| `rapidOverride` | `#33555` | 文档 |

### program（默认每周期）

| 字段 | 来源 | 状态 |
| --- | --- | --- |
| `name` | `0081<通道>` | 文档 |
| `path` | `0030`，仅通道 1 | 文档 |
| `line` | `0123`，仅运行 NC 时有效 | DLL，Linux 库无此接口 |
| `totalLines` | `0093<通道>` | 文档 |
| `progress` | 派生：`line / totalLines` 的百分比 | 派生 |

### alarms（默认每周期）

`0051`，数组元素 `{ code, message, level, severity, since }`。报警文本格式无法识别时 `code` 和 `level` 为 `null`，`message` 保留原文，避免把真实报警当成无报警。`severity`：`FATAL`/`ERROR`/`WARNING`/`INFO`。`since` 是采集器首次看到该报警的时间，不是控制器记录的时间。

### production（默认每 5 周期）

| 字段 | 来源 | 单位 | 状态 |
| --- | --- | --- | --- |
| `completed` | `#33869` 加工零件数 | 件 | 文档 |
| `total` | `#33870` 加工总零件数 | 件 | DLL、文档 |
| `target` | `#33871` 需要零件数 | 件 | 文档 |
| `cycleTarget` | `#33503 (0105)` 设定循环数 | 次 | DLL |
| `cycleCount` | `#33504` 当前循环数 | 次 | DLL |
| `cycleTime` | `#33564` 本次循环时间 | s | 文档 |
| `cuttingTime` | `#33565` 切削时间 | s | 文档 |
| `processTime` | `#33868` 系统加工时间，开机累计 | s | DLL、文档 |
| `uptime` | `#2097` 系统运行时间，开机累计 | s | DLL、文档 |
| `utilization` | 派生：`processTime / uptime`，% | % | 派生 |
| `cycleStartedAt` / `cycleEndedAt` | 采集器观察到的状态跳变 | ISO 时间 | 派生，采集器未运行期间的循环不记录 |

### tool（默认每 5 周期）

| 字段 | 来源 | 状态 |
| --- | --- | --- |
| `number` | `#8006` 主轴当前刀号 | 文档 |
| `next` | `#33512` 指令刀号 | 文档 |
| `lengthOffsetNumber` / `lengthOffset` | `#33558` / `#33559` | 文档 |
| `radiusOffsetNumber` / `radiusOffset` | `#33560` / `#33561` | 文档 |
| `useCount` | `#11401 + 刀号-1` 使用次数 | 文档 |
| `useTime` | `#11501 + 刀号-1` 使用时间，s | 文档 |
| `cutLength` | `#11601 + 刀号-1` 切削周长，mm | 文档 |

无刀（`number` 为 0）时不读后三项。

### system（默认每 60 周期）

`version`（`0045`）、`serial`（`0066`）、`mac`（`0069`）、`date`（`#2110`）、`time`（`#2111`）。

## PRD 中没有标准来源的项

这些数据手册和接口都没有，**不输出占位值**。

| PRD 项 | 情况 | 建议 |
| --- | --- | --- |
| 门开关状态 | 取决于机床 PLC 接线 | 用自定义点位映射到对应 X 点或 MO 位 |
| 主轴负载 | 只有轴负载接口。若主轴占用轴槽，可读 `#B+32 (0105)` | 现场确认后用自定义点位 |
| 主轴温度 | 无 | 需外接或 PLC 映射 |
| 快速移动速度 | 只有倍率 `#33555` | 已输出倍率 |
| 程序剩余时间 | 无。`#33566` 仅是 G04 剩余时间 | 可在平台侧按进度估算 |
| 刀具寿命百分比 | 系统只记录使用量，没有寿命上限 | 平台侧按刀具寿命标准换算 |
| 历史报警 | `ErrorHistory.dat` 需走 FTP | 后续按需实现 |

## 自定义点位

节点配置里填 JSON 数组，结果输出到 `data.custom`：

```json
[
  { "name": "doorOpen", "src": "plc", "addr": "100.3", "type": 0 },
  { "name": "input_X0_5", "src": "macro", "id": 50505 },
  { "name": "spindleLoad", "src": "macroAlt", "id": 30282 }
]
```

| 字段 | 说明 |
| --- | --- |
| `name` | 输出键名 |
| `src` | `macro`（`0007`）、`macroAlt`（`0105`）、`plc`（`0060`） |
| `id` | 宏变量号，`macro` 和 `macroAlt` 使用 |
| `addr` | PLC 地址，不带 `MO`/`MI` 前缀，如 `206.0`、`205.20.24` |
| `type` | PLC 类型，1=MO（默认），0=MI |

I/O 输入点可直接读宏变量：X0~X9 位于 `#50500~#50819`，成块读取位于 `#50900~#50999`，详见宏程序手册 2.5.10。

## 业务事件

节点第 2 个输出：`connected`、`disconnected`、`stateChanged`、`cycleStarted`、`cycleEnded`、`programChanged`、`toolChanged`、`partCompleted`、`alarmRaised`、`alarmCleared`、`collectError`（采集内部异常，正常不应出现）。
