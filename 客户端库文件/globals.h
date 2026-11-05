#ifndef RMI_GLOBALS_H_
#define RMI_GLOBALS_H_

namespace rmi
{
        /* 定义PLC只写变量名 */
        enum PlcWriteOnlyVariableName
        {
                G_CHAN1,			// 描述：路径1，						  MI200.1
                G_CHAN2,			// 描述：路径2，						  MI200.2
                G_HALTSYS,			// 描述：系统关机，						  MI200.3
                G_OT2,				// 描述：OT2，							  MI200.4
                G_AUTOHW,			// 描述：手轮干预，						  MI200.5
                G_JOGMODE,			// 描述：Jog运动模式，					  MIU200.6.8
                G_SELSP,			// 描述：第1主轴 3:正传 4：反转  2：停止  MIU200.9.12
                G_SELSP2,			// 描述：第2主轴 3:正传 4：反转  2：停止  MIU200.13.16
                G_SELSP3,			// 描述：第3主轴 3:正传 4：反转  2：停止  MIU200.17.20
                G_SELSP4,			// 描述：第4主轴 3:正传 4：反转  2：停止  MIU200.21.24

                G_HWAXIS,			// 描述：手轮轴选，         MIU201.0.3
                G_JOVRD,			// 描述：Jog倍率，          MIU201.4.7
                G_JINC_OVRD,		// 描述：步进倍率，         MIU201.8.11
                G_ROVRD,			// 描述：快进倍率，         MIU201.12.15
                G_FOVRD,			// 描述：进给倍率，         MIU201.16.20
                G_SOVRD,			// 描述：主轴倍率，         MIU201.21.24
                G_HWOVRD,			// 描述：手轮倍率，         MIU201.25.28
                G_HWAXIS2,			// 描述：手轮轴选2，        MIU202.0.3

                DIS_CYCLESTART,		// 描述：禁止CycleStart，   MI52.0
                DIS_JOG,			// 描述：禁止Jog，		    MI52.1
                DIS_HANDLE,			// 描述：禁止手轮，         MI52.2


                G_SINGLE,           // 描述：单步，             MI204.0
                G_OPSTOP,           // 描述：任选停止，         MI204.1
                G_BLKSKIP,          // 描述：选择跳跃，         MI204.2
                G_DRYRUN,           // 描述：干加工，           MI204.3
                G_CYCLESTART,       // 描述：程序启动，         MI204.4
                G_FEEDHOLD,         // 描述：程序暂停，         MI204.5
                G_PROGSTOP,         // 描述：程序停止，         MI204.6
                G_RESET,            // 描述：复位，             MI204.7
                G_MPGTRACE,         // 描述：手轮模拟，         MI204.8
                G_FRESET,           // 描述：快速复位，         MI204.9
                G_WAXIS,            // 描述：W轴，              MI204.10
                G_RTCPHW,           //						    MI204.11
                G_MODE,             // 描述：模式选择，         MIU204.20.24
                G_AXIS,             // 描述：Jog / HM 轴选，    MIU204.25.28
                G_JOGPLUS,          // 描述：J +，              MI204.30
                G_JOGMINUS,         // 描述：J -，              MI204.31
                G_JMPLUS,           // 描述：轴名J +，          MIU205.0.15
                G_JMMINUS,          // 描述：轴名J -，          MIU205.16.31


                G_JMPLUS2,          // 描述：轴名J +2，         MIU206.0.15
                G_JMMINUS2,	        // 描述：轴名J -2，         MIU206.16.31

                G_AUX1,				// 描述：备用1
                G_AUX2,				// 描述：备用2
                G_AUX3,				// 描述：备用3
                G_AUX4,				// 描述：备用4
                G_AUX5,				// 描述：备用5
                G_AUX6,				// 描述：备用6
                G_AUX7,				// 描述：备用7
                G_AUX8,				// 描述：备用8
                G_AUX9,				// 描述：备用9

                G_AUX10,			// 描述：备用10
                G_AUX11,			// 描述：备用11
                G_AUX12,			// 描述：备用12
                G_AUX13,			// 描述：备用13
                G_AUX14,			// 描述：备用14
                G_AUX15,			// 描述：备用15
                G_AUX16,			// 描述：备用16
                G_AUX17,			// 描述：备用17
                G_AUX18,			// 描述：备用18
                G_AUX19,			// 描述：备用19

                G_AUX20,			// 描述：备用20
                G_AUX21,			// 描述：备用21
                G_AUX22,			// 描述：备用22
                G_AUX23,			// 描述：备用23
                G_AUX24,			// 描述：备用24
                G_AUX25,			// 描述：备用25
                G_AUX26,			// 描述：备用26
                G_AUX27,			// 描述：备用27
                G_AUX28,			// 描述：备用28
                G_AUX29,			// 描述：备用29

                G_AUX30,			// 描述：备用30
                G_AUX31,			// 描述：备用31
                G_AUX32			    // 描述：备用32
        };

        //定义PLC只读变量名
        enum PlcReadOnlyVariableName
        {
                F_CHAN1,           // 描述：路径1               MO200.1
                F_CHAN2,	       // 描述：路径2               MO200.2
                F_SYSREADY,	       // 描述：CI 就绪状态         MO200.12
                F_EMGSTOP,	       // 描述：急停                MO200.6
                F_PWSTS,	       // 描述：机床上电            MO200.8
                F_OT2,		       // 描述：OT2                 MO200.10
                F_AUTOHW,	       // 描述：手轮干预            MO200.11
                F_JOGMODE,	       // 描述：Jog模式             MOU200.13.15
                F_MPG2,		       // 描述：第2手轮             MO200.16
                F_HWAXIS,	       // 描述：手轮轴选 - 路径1    MOU201.0.3
                F_JOVRD,	       // 描述：Jog倍率             MOU201.4.7
                F_JINC_OVRD,       // 描述：步进倍率            MOU201.8.11
                F_ROVRD,	       // 描述：快进倍率            MOU201.12.15
                F_FOVRD,	       // 描述：进给倍率            MOU201.16.20
                F_SOVRD,	       // 描述：主轴倍率            MOU201.21.24
                F_HWOVRD,	       // 描述：手轮倍率            MOU201.25.28
                F_HWAXIS2,	       // 描述：手轮轴选 - 路径2    MOU202.0.3
                F_FATALERR,	       // 描述：系统严重错误        MO203.11
                F_CIERR,           // 描述：系统错误            MO203.13
                F_WARN,	           // 描述：系统警告            MO203.14
                F_SELSP,           // 描述：主轴1               MOU204.0.3
                F_SELSP2,          // 描述：主轴2               MOU204.4.7
                F_SELSP3,          // 描述：主轴3               MOU204.8.11
                F_SELSP4,          // 描述：主轴4               MOU204.12.15
                F_SELSP5,          // 描述：主轴5               MOU204.16.19
                F_SELSP6,          // 描述：主轴6               MOU204.20.23
                F_SELSP7,          // 描述：主轴7               MOU204.24.27
                F_SELSP8,          // 描述：主轴8               MOU204.28.31


                F_SINGLE,			// 描述：单步               MO205.0
                F_OPSTOP,			// 描述：选停               MO205.1
                F_BLKSKIP,			// 描述：跳跃               MO205.2
                F_DRYRUN,			// 描述：干加工             MO205.3
                F_MPGTRACE,			// 描述：手轮模拟           MO205.8
                F_WAXIS,			// 描述：W轴		        MO205.10
                F_RTCPHW,			//
                F_MODE,				// 描述：模式选择           MOU205.20.24
                F_AXIS,				// 描述：轴选（JOG / HM）   MOU205.25.28
                F_RUNNING,			// 描述：运行中             MO206.0
                F_HOLDING,			// 描述：暂停中             MO206.1
                F_STOPPED,			// 描述：错误停止中         MO206.2
                F_READY,			// 描述：就绪               MO206.3

                F_AXIS2,			// 描述：轴选2（JOG / HM）  MOU207.25.28
                F_RUNNING2,			// 描述：运行中2			MO208.0
                F_HOLDING2,			// 描述：暂停中2			MO208.1
                F_STOPPED2,			// 描述：错误停止中2		MO208.2
                F_READY2,			// 描述：就绪2				MO208.3

                F_AUX1,				// 描述：备用1
                F_AUX2,				// 描述：备用2
                F_AUX3,				// 描述：备用3
                F_AUX4,				// 描述：备用4
                F_AUX5,				// 描述：备用5
                F_AUX6,				// 描述：备用6
                F_AUX7,				// 描述：备用7
                F_AUX8,				// 描述：备用8
                F_AUX9,				// 描述：备用9

                F_AUX10,			// 描述：备用10
                F_AUX11,			// 描述：备用11
                F_AUX12,			// 描述：备用12
                F_AUX13,			// 描述：备用13
                F_AUX14,			// 描述：备用14
                F_AUX15,			// 描述：备用15
                F_AUX16,			// 描述：备用16
                F_AUX17,			// 描述：备用17
                F_AUX18,			// 描述：备用18
                F_AUX19,			// 描述：备用19

                F_AUX20,			// 描述：备用20
                F_AUX21,			// 描述：备用21
                F_AUX22,			// 描述：备用22
                F_AUX23,			// 描述：备用23
                F_AUX24,			// 描述：备用24
                F_AUX25,			// 描述：备用25
                F_AUX26,			// 描述：备用26
                F_AUX27,			// 描述：备用27
                F_AUX28,			// 描述：备用28
                F_AUX29,			// 描述：备用29

                F_AUX30,			// 描述：备用30
                F_AUX31,			// 描述：备用31
        F_AUX32             // 描述：备用32

        };
}

#endif // RMI_GLOBALS_H_
