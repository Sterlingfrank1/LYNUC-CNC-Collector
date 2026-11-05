# 历史实现（已弃用，仅存档）

`node-red-contrib-cnc-controller/` 是此前的实现，保留作参考，**不要使用**。原始快照见 tag `baseline-project-test`。

其中 `CODE_REVIEW.md` 结论为 "Approved 8.5/10"，与实测不符，以下面的验证结果为准。

| 问题 | 验证方式 | 结果 |
| --- | --- | --- |
| JS 无法解析 | `node --check lib/cnc-bridge.js` | `SyntaxError: Unexpected token 'void'`，`const void = …` 使用了保留字 |
| 依赖不存在的符号 | `RESOLVE(...)` 列表与 `libRemoteComm.so` 导出表比对 | 27 个符号缺 10 个：`remote_get_S_*`、`remote_get_F_*`、`remote_get_CyclesNumber`、`remote_get_CurrentCyclesNumber`、`remote_get_WorkpieceNumber`、`remote_get_ProcessTime`、`remote_get_RelativelyCoordinate`、`remote_get_main_ncline`，`dlopen` 后初始化必失败 |
| 架构不成立 | ELF 头 | `.so` 为 32 位，64 位 Node 进程无法加载 32 位桥接库 |
| 坐标读不到 | 反汇编 | Linux 库坐标接口是 `xor eax,eax; ret`，且参数用法也错（把 `coordMask` 当位掩码，实际是十进制数字串） |
| PLC 地址格式错 | 正则 `^[0-9.]+.$` | 传 `MO206.0` 被客户端以 -11 拒绝，应传 `206.0` |
| C 代码无法编译 | 阅读 `RESOLVE` 宏 | 引用未定义的 `remote_new_connect_t` 等类型；PLC 调用漏传 `nHandle` |
| 点位是臆造的 | 对照宏程序手册 | `#4120~#4122` 落在马达参数段（#4100~#7280），不是主轴负载、刀具号和寿命；模式枚举与 `remote_switch_mode` 文档不符 |
| 失败时输出假数据 | 阅读 `cnc-data-collector.js` | 读失败返回 `0`、`lifeRemaining: 100`，下游无法区分 |

新实现见仓库根目录，依据见 [docs/PROTOCOL.md](../docs/PROTOCOL.md)。
