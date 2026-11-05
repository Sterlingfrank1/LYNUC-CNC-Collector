# Lynuc2 MODBUS 变量说明

## 读写变量

| 系统变量名 | 读写 | 内部类型 | 名称解释 | 远程PLC 变量 |
| --- | --- | --- | --- | --- |
| MO30.0 | RW | G_CHAN1 | 路径1 | MI200.1 |
| MO30.1 | RW | G_CHAN2 | 路径2 | MI200.2 |
| MO30.9 | RW | G_HALTSYS | 系统关机 | MI200.3 |
| MO30.10 | RW | G_OT2 | OT2 | MI200.4 |
| MO30.11 | RW | G_AUTOHW | 手轮干预 | MI200.5 |
| MOU30.13.15 | RW | G_JOGMODE | Jog运动模式 | MIU200.6.8 |
| MOU55.0.3 | RW | G_SELSP | 第1主轴 3:正传 4：反转 2：停止 | MIU200.9.12 |
| MOU55.4.7 | RW | G_SELSP2 | 第2主轴 | MIU200.13.16 |
| MOU55.8.11 | RW | G_SELSP3 | 第3主轴 | MIU200.17.20 |
| MOU55.12.15 | RW | G_SELSP4 | 第4主轴 | MIU200.21.24 |
| MOU34.0.3 | RW | G_HWAXIS | 手轮轴选 | MIU201.0.3 |
| MOU34.4.7 | RW | G_JOVRD | Jog倍率 | MIU201.4.7 |
| MOU34.8.11 | RW | G_JINC_OVRD | 步进倍率 | MIU201.8.11 |
| MOU34.12.15 | RW | G_ROVRD | 快进倍率 | MIU201.12.15 |
| MOU34.16.20 | RW | G_FOVRD | 进给倍率 | MIU201.16.20 |
| MOU34.21.24 | RW | G_SOVRD | 主轴倍率 | MIU201.21.24 |
| MOU34.25.28 | RW | G_HWOVRD | 手轮倍率 | MIU201.25.28 |
| MOU38.0.3 | RW | G_HWAXIS2 | 手轮轴选2 | MIU202.0.3 |
| MO52.0 | RW | DIS_CYCLESTART | 禁止CycleStart | MI52.0 |
| MO52.1 | RW | DIS_JOG | 禁止Jog | MI52.1 |
| MO52.2 | RW | DIS_HANDLE | 禁止手轮 | MI52.2 |
| MO31.0 | RW | G_SINGLE | 单步 | MI204.0 |
| MO31.1 | RW | G_OPSTOP | 任选停止 | MI204.1 |
| MO31.2 | RW | G_BLKSKIP | 选择跳跃 | MI204.2 |
| MO31.3 | RW | G_DRYRUN | 干加工 | MI204.3 |
| MO31.4 | RW | G_CYCLESTART | 程序启动 | MI204.4 |
| MO31.5 | RW | G_FEEDHOLD | 程序暂停 | MI204.5 |
| MO31.6 | RW | G_PROGSTOP | 程序停止 | MI204.6 |
| MO31.7 | RW | G_RESET | 复位 | MI204.7 |
| MO31.8 | RW | G_MPGTRACE | 手轮模拟 | MI204.8 |
| MO31.9 | RW | G_FRESET | 快速复位 | MI204.9 |
| MO31.10 | RW | G_WAXIS | W轴 | MI204.10 |
| MOU31.20.24 | RW | G_MODE | 模式选择 | MIU204.20.24 |
| MOU31.25.28 | RW | G_AXIS | Jog/HM 轴选 | MIU204.25.28 |
| MO31.30 | RW | G_JOGPLUS | J+ | MI204.30 |
| MO31.31 | RW | G_JOGMINUS | J- | MI204.31 |
| MOU32.0.15 | RW | G_JMPLUS | 轴名J+ | MIU205.0.15 |
| MOU32.16.31 | RW | G_JMMINUS | 轴名J- | MIU205.16.31 |
| MOU36.0.15 | RW | G_JMPLUS2 | 轴名J+2 | MIU206.0.15 |
| MOU36.16.31 | RW | G_JMMINUS2 | 轴名J-2 | MIU206.16.31 |

## 只读变量

*传输支持浮点型，设置COM1、2、3，TCP的支持格式。默认8，即TCP支持浮点型；串口不支持浮点型；MO:number*

| 系统变量名 | 读写 | 内部类型 | 名称解释 | 远程PLC 变量 |
| --- | --- | --- | --- | --- |
| MO40.0 | R | F_CHAN1 | 路径1 | MO200.1 |
| MO40.1 | R | F_CHAN2 | 路径2 | MO200.2 |
| MO40.12 | R | F_SYSREADY | CI 就绪状态 | MO200.12 |
| MO40.6 | R | F_EMGSTOP | 急停 | MO200.6 |
| MO40.8 | R | F_PWSTS | 机床上电 | MO200.8 |
| MO40.10 | R | F_OT2 | OT2 | MO200.10 |
| MO40.11 | R | F_AUTOHW | 手轮干预 | MO200.11 |
| MOU40.13.15 | R | F_JOGMODE | Jog模式 | MOU200.13.15 |
| MO40.16 | R | F_MPG2 | 第2手轮 | MO200.16 |
| MOU44.0.3 | R | F_HWAXIS | 手轮轴选-路径1 | MOU201.0.3 |
| MOU34.4.7 | R | F_JOVRD | Jog倍率 | MOU201.4.7 |
| MOU34.8.11 | R | F_JINC_OVRD | 步进倍率 | MOU201.8.11 |
| MOU34.12.15 | R | F_ROVRD | 快进倍率 | MOU201.12.15 |
| MOU34.16.20 | R | F_FOVRD | 进给倍率 | MOU201.16.20 |
| MOU34.21.24 | R | F_SOVRD | 主轴倍率 | MOU201.21.24 |
| MOU34.25.28 | R | F_HWOVRD | 手轮倍率 | MOU201.25.28 |
| MOU48.0.3 | R | F_HWAXIS2 | 手轮轴选-路径2 | MOU202.0.3 |
| MO50.11 | R | F_FATALERR | 系统严重错误 | MO203.11 |
| MO50.13 | R | F_CIERR | 系统错误 | MO203.13 |
| MO50.14 | R | F_WARN | 系统警告 | MO203.14 |
| MOU51.0.3 | R | F_SELSP | 主轴1 | MOU204.0.3 |
| MOU51.4.7 | R | F_SELSP2 | 主轴2 | MOU204.4.7 |
| MOU51.8.11 | R | F_SELSP3 | 主轴3 | MOU204.8.11 |
| MOU51.12.15 | R | F_SELSP4 | 主轴4 | MOU204.12.15 |
| MOU51.16.19 | R | F_SELSP5 | 主轴5 | MOU204.16.19 |
| MOU51.20.23 | R | F_SELSP6 | 主轴6 | MOU204.20.23 |
| MOU51.24.27 | R | F_SELSP7 | 主轴7 | MOU204.24.27 |
| MOU51.28.31 | R | F_SELSP8 | 主轴8 | MOU204.28.31 |
| MO41.0 | R | F_SINGLE | 单步 | MO205.0 |
| MO41.1 | R | F_OPSTOP | 选停 | MO205.1 |
| MO41.2 | R | F_BLKSKIP | 跳跃 | MO205.2 |
| MO41.3 | R | F_DRYRUN | 干加工 | MO205.3 |
| MO41.8 | R | F_MPGTRACE | 手轮模拟 | MO205.8 |
| MO41.10 | R | F_WAXIS | W轴 | MO205.10 |
| MOU41.20.24 | R | F_MODE | 模式选择 | MOU205.20.24 |
| MOU41.25.28 | R | F_AXIS | 轴选（JOG/HM） | MOU205.25.28 |
| MO42.0 | R | F_RUNNING | 运行中 | MO206.0 |
| MO42.1 | R | F_HOLDING | 暂停中 | MO206.1 |
| MO42.2 | R | F_STOPPED | 错误停止中 | MO206.2 |
| MO42.3 | R | F_READY | 就绪 | MO206.3 |
| MOU45.25.28 | R | F_AXIS2 | 轴选2（JOG/HM） | MOU207.25.28 |
| MO46.0 | R | F_RUNNING2 | 运行中2 | MO208.0 |
| MO46.1 | R | F_HOLDING2 | 暂停中2 | MO208.1 |
| MO46.2 | R | F_STOPPED2 | 错误停止中2 | MO208.2 |
| MO46.3 | R | F_READY2 | 就绪2 | MO208.3 |
