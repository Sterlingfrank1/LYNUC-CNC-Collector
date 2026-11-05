#ifndef RMI_REMOTE_COMM_H_
#define RMI_REMOTE_COMM_H_
#ifdef _WIN32
#define DLL_DECLARE __declspec(dllexport)
#else
#define DLL_DECLARE
#endif

#define REMOTECOMM_VERSION "2.6.2.1"
/***  该库基本功能：与控制器服务端连接，宏变量读写，PLC变量读写， FTP文件传输，远程打开控制器端程序（需要用户盘有要打开的文件）等，具体请参考文档***/

//*** 返回值定义 ***/
enum ErrorCode
{
	SUCCESS,  // 成功
	FAILURE = -1, // 失败
	NO_CONNECTION = -2, // 未建立连接
	CONNECTION_ERROR = -3, // 连接失败
	FTP_CONNECTION_ERROR = -4, // FTP 连接失败
	MACRO_ERROR = -5,  //  宏变量地址错误
	SEND_ERROR = -6,  //  发送失败
	RECV_ERROR = -7,  //  接收失败
	CHANNEL_ERROR = -8,  //  通道错误
	BUFFER_SIZE_ERROR = -9,  //  数据长度超过缓存大小
	FILE_ERROR = -10,   //  文件打开失败
	PLC_VARIABLE_NAME_ERROR = -11,  //  PLC变量错误
	DOWN_FAILURE = -12,  //  文件下载失败
	CD_FAILURE = -13,  //  路径切换失败
	GETMACHINESERIAL_FAILURE = -14,  //  获取机器序列号失败
	GETMACADDRESS_FAILURE = -15,  //  获取MAC地址失败
	GETDIR_FAILURE = -16,  //  获取文件/目录列表失败
	DELE_FAILURE = -17,  //  删除文件失败
	GETFILE_FAILURE = -18,    
	LOG_ERROR = -19,
	VERIFY_ERROR = -20,  //  宏变量校验失败
	COORDINATE_ERROR = -21,  
	PATR_ERROR = -22,  //  部分发送报错
	AXIS_ERROR = -23,  //  轴名称错误
	DATA_ERROR = -24,  //  连续读取错误
	FTP_COMMAND_ERROR = -25,  //  ftp命令错误
	INVALID_PATH = -26,  //  路径错误
	INVALID_REQUEST = -27 // 超出最大读取数
};

/*
*描  述：创建TCP连接（）
*参  数：char* iP:控制器IP地址
*返回值：int nHandle : 大于等于0: 成功  -1：超过最大连接数 -3：连接失败 -4：ftp模块连接失败
*/
extern "C" DLL_DECLARE int remote_new_connect(const char* iP);

/*
*描  述：关闭连接
*参  数：int nHandle
*返回值：无
*/
extern "C" DLL_DECLARE void remote_close(int nHandle);

/*
*描  述：读#宏变量
*参  数：int nHandle:句柄 int nMacro：宏变量号
*返回值：宏变量值
*/
extern "C" DLL_DECLARE double remote_read_macro(int nHandle, int nMacro);

/*
*描  述：读#宏变量
*参  数：int nHandle：句柄 int nMacro：宏变量号 double* val：读取的数据存放位置
*返回值：int  0：成功 -2:未建立连接 -5：宏变量号错误 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_read_macro_p(int nHandle, int nMacro, double* val);

/*
*描  述：写#宏变量
*参  数：int nHandle：句柄  int nMacro：宏变量号  double val：要写入宏变量的值
*返回值：int  0：成功 -2:未建立连接 -5：宏变量号错误 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_write_macro(int nHandle, int nMacro, double val);

/*
*描  述：远程打开控制器端指定文件
*参  数：nHandle:句柄  nChannel:当前通道号（通道一：1 通道二：2） chFileName:要远程打开文件的文件名（在根目录下，要传入文件夹使用/NC1/filename）
*返回值：int  0：成功 -1：打开失败 -2:未建立连接 -6:发送失败 -7：接收失败 -8：通道错误
*/
extern "C" DLL_DECLARE int remote_open_file(int nHandle, int nChannel, const char* chFileName);

/*
*描  述：获取控制器端打开的当前文件的文件名
*参  数：nHandle:句柄  chFileName:存储获取到的文件名
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_open_file_name(int nHandle, char* chFileName);

/*
*描  述：获取控制器端打开的当前文件的文件路径
*参  数：nHandle:句柄  chFilePath:存储获取到的路径
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败 
*/
extern "C" DLL_DECLARE int remote_get_open_file_path(int nHandle, char* chFilePath);

/*
*描  述：获取控制器端文件最后修改时间
*参  数：nHandle:句柄  chFilePath:文件路径  nLastModifiedTime:最后修改时间(UNIX时间戳)
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_file_last_modified_time(int nHandle, const char* chFilePath, int* nLastModifiedTime);

/*
*描  述：获取控制器端打开的当前文件的md5
*参  数：nHandle:句柄  nPath:通道号  buf:存储获取到的md5
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_exe_file_md5sum(int nHandle, int nPath, char *buf);

/*
*描  述：设定除ftp相关接口以外接口（宏变量读写等）的socket接收超时时间
*参  数：nHandle:句柄  nMillisecond:超时时间(ms)
*返回值：int  0：成功 -2:未建立连接
*/
extern "C" DLL_DECLARE int remote_set_receive_timeout(int nHandle, int nMillisecond);

/*
*描  述：设定除ftp相关接口以外接口（宏变量读写等）的socket发送超时时间
*参  数：nHandle:句柄  nMillisecond:超时时间(ms)
*返回值：int  0：成功 -2:未建立连接
*/
extern "C" DLL_DECLARE int remote_set_send_timeout(int nHandle, int nMillisecond);

/*
*描  述：获取PLC变量
*参  数：
	nHandle:句柄 
	PLCAdress:PLC变量对应地址 
	type：变量类型 分为两种 MO:1  MI:0
*返回值：unsigned long PLC变量值
*/
//2.6.1.1版本接口兼容
extern "C" DLL_DECLARE unsigned long remote_read_plc_variable(int nHandle, int variableName);
extern "C" DLL_DECLARE unsigned long remote_read_plc_variable_2(int nHandle, int type, const char* PLCAdress);

/*
*描  述：获取PLC变量
*参  数：
	nHandle:句柄 
	PLCAdress:PLC变量对应地址
	type：变量类型 分为两种 MO:1  MI:0  
	val:储存变量
*返回值：int  0：成功 -2:未建立连接 -6:发送失败 -7：接收失败 -11：PLC变量名错误
*/
//2.6.1.1版本接口兼容
extern "C" DLL_DECLARE int remote_read_plc_variable_p(int nHandle,int variableName, unsigned long* val);
extern "C" DLL_DECLARE int remote_read_plc_variable_p_2(int nHandle, const char* PLCAdress, int type, unsigned long* val);

/*
*描  述：修改PLC变量
*参  数：
	nHandle:句柄 
	PLCAdress:PLC变量对应地址  
	type：变量类型 分为两种 MO:1  MI:0
	val:目标值
*返回值：int  0：成功 -2:未建立连接 -6:发送失败 -7：接收失败 -11：PLC变量名错误
*/
//2.6.1.1版本接口兼容
extern "C" DLL_DECLARE int remote_write_plc_variable(int nHandle, int variableName, unsigned long val);
extern "C" DLL_DECLARE int remote_write_plc_variable_2(int nHandle, const char*  PLCAdress, int type, unsigned long val);

/*
*描  述：远程执行NC指令
*参  数：nHandle:句柄 nChannel:执行指令的通道 buf:存储需要执行的指令
*返回值：int  0：成功 -1：执行失败 -2:未建立连接 -6:发送失败 -7:接收失败 -8:通道错误 -9:指令长度超过缓存
*/
extern "C" DLL_DECLARE int remote_run_string(int nHandle, int nChannel, const char *buf);

/*
*描  述：取得当前文件的指定行号
*参  数：nHandle:句柄， nLine 行号，chLine 返回的行内容， nSize  chLine的buffer大小 
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_file_line(int nHandle, int nLine, char* chLine, int nSize);

/*
*描  述：设定起始行号
*参  数：nHandle:句柄， nChannel:执行指令的通道， nLine 行号
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_set_start_line(int nHandle, int nChannel, int nLine);

/*
*描  述：获取断点信息
*参  数：nHandle:句柄， nChannel:执行指令的通道，nEnable:不为0时有效， nLine:取得的行号
*返回值：int  0：成功 -1：获取失败 -2:未建立连接 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_break_point_info(int nHandle, int nChannel, int* nEnable, long* nLine);

/*
*描  述：上传文件到控制器用户盘（该接口执行传输文件过程，需要一定时间，需要放到线程中去执行，否则会卡顿）
*参  数：nHandle:句柄  
		char* chFileName : 需要传输到控制器的文件名(包含路径)
		wchar_t* chFileName : 宽字符文件名
		int nPath： 路径编号
					1001  NC1				2001  Chn2\NC1
					1002  NC2				2002  Chn2\NC2
					1003  NC3				2003  Chn2\NC3
					1004  NC4				2004  Chn2\NC4
					1005  NC5				2005  Chn2\NC5
					其他  第一通道根路径	2 第二通道根路径
					3001 子程序文件夹		3002 子程序文件夹
		chFilePath:原文件路径
		chDesPath：目的路径
*返回值：int  0：成功 -1：传输失败 -2:未建立连接 -4：ftp连接失败 -10：文件打开失败
*说明  : remote_upload_file_path
*		 fullPath:"/"    -- 根目录
*				  "/NC1" -- NC1文件夹
*/
extern "C" DLL_DECLARE int remote_upload_file(int nHandle, const char* chFileName, int nPath);
extern "C" DLL_DECLARE int remote_upload_file_w(int nHandle, const wchar_t* chFileName, int nPath);
extern "C" DLL_DECLARE int remote_upload_file_path(int nHandle, const char* chFilePath, const char* chDesPath);

/*
*描  述：删除控制器用户盘上的文件
*参  数：nHandle:句柄  
		char* chFileName : 需要传输到控制器的文件名
		int nPath： 路径编号
					1001  NC1				2001  Chn2\NC1
					1002  NC2				2002  Chn2\NC2
					1003  NC3				2003  Chn2\NC3
					1004  NC4				2004  Chn2\NC4
					1005  NC5				2005  Chn2\NC5
					其他  第一通道根路径	2 第二通道根路径
					3001 子程序文件夹		3002 子程序文件夹
		chFilePath:文件完整路径
*返回值：int  0：成功 -1：传输失败 -2:未建立连接
*说明  : remote_delete_file_path
*		 fullPath:"/"    -- 根目录
*				  "/NC1" -- NC1文件夹
*/
extern "C" DLL_DECLARE int remote_delete_file(int nHandle, const char* chFileName, int nPath);
extern "C" DLL_DECLARE int remote_delete_file_path(int nHandle, const char* chFilePath);

/*
*描  述：文件传输进度
*参  数：nHandle:句柄
*返回值：int：返回当前文件传输进度  （范围： 0--100 ） -2：未建立连接
*/
extern "C" DLL_DECLARE int remote_get_process(int nHandle);

/*
*描  述：连接状态
*参  数：nHandle:句柄
*返回值：int 0：已连接返回  -1：连接断开返回 -2：未建立连接
*/
extern "C" DLL_DECLARE int remote_connect_status(int nHandle);

/*
*描  述：获取版本号
*参  数：nHandle:句柄, version:储存获取到的版本号
*返回值：int 0：已连接返回  -1：连接断开返回 -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_version(int nHandle, char* version);

/*
*描  述：错误信息
*参  数：nHandle:句柄, errormessage: 获取到的错误信息
*返回值：int 0：已连接返回  -1：连接断开返回 -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_errormessage(int nHandle, char* errormessage);

/*
*描  述：设置临时字符数据
*参  数：nHandle:句柄, key: key关键字, value: value数据
*返回值：int 0：已连接返回  -1：连接断开返回 -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_set_StringMap(int nHandle, char* key, char* value);

/*
*描  述：获取临时字符数据
*参  数：nHandle:句柄, key: key关键字, value: 获取的value数据
*返回值：int 0：已连接返回  -1：连接断开返回 -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_StringMap(int nHandle, char* key, char* value);

/*
*描  述：从控制器用户盘下载文件（该接口执行传输文件过程，需要一定时间，需要放到线程中去执行，否则会卡顿）
*参  数：nHandle:句柄
		char* chFileName : 需要传输到控制器的文件名
		int nPath：路径编号
					1001  NC1				2001  Chn2\NC1
					1002  NC2				2002  Chn2\NC2
					1003  NC3				2003  Chn2\NC3
					1004  NC4				2004  Chn2\NC4
					1005  NC5				2005  Chn2\NC5
					其他  第一通道根路径	2 第二通道根路径
		
*返回值：int  0：成功 -1：传输失败 -2:未建立连接 -4：ftp连接失败 -10：文件打开失败
*说明  : remote_download_file_path
*		 fullPath:"/"    -- 根目录
*				  "/NC1" -- NC1文件夹
*/
extern "C" DLL_DECLARE int remote_download_file(int nHandle, int nPath, const char* chFileName, const char* outputDir);
extern "C" DLL_DECLARE int remote_download_file_path(int nHandle, const char* fullPath, const char* outputPath);

/*
* 描  述：读取控制器用户盘目录下 文件或目录列表到指定文件
* 参  数：nHandle:句柄
		char* chFileName : 储存指定目录下文件或目录列表的文件路径
		int* FileCount : 文件数量
		int nPath：路径编号
					1001  NC1				2001  Chn2\NC1 
					1002  NC2				2002  Chn2\NC2
					1003  NC3				2003  Chn2\NC3
					1004  NC4				2004  Chn2\NC4
					1005  NC5				2005  Chn2\NC5
					其他  第一通道根路径	2 第二通道根路径	
*返回值：int  0：成功 -1：传输失败 -2:未建立连接 -4：ftp连接失败 -10：文件打开失败 -15：目录获取失败
*/
extern "C" DLL_DECLARE int remote_getFileDir(int nHandle, int nPath, const char* outputFileName);
//2.6.1.6 新增 获取目录列表到字符串中
extern "C" DLL_DECLARE int remote_getFileDir_2(int nHandle, int nPath, int* FileCount, char* FileDir);
extern "C" DLL_DECLARE int remote_getFileDirPath(int nHandle, const char* fullPath, const char* outputFileName);

/*
* 描  述：读取控制器MAC地址
* 参  数：
		nHandle:句柄
		char* value : 储存MAC地址
* 返回值：int  0：成功  -14：MAC地址获取失败
*/
extern "C" DLL_DECLARE int remote_getMacAddress(int nHandle, char* value);

/*
* 描 述：读取控制器序列号
* 参  数：
		nHandle:句柄
		char* value : 储存机器序列号
* 返回值：int  0：成功 -13：机器序列号获取失败
*/
extern "C" DLL_DECLARE int remote_getMachineSerial(int nHandle, char* value);

/*
* 描 述：更新注册码
* 参  数：
		nHandle:句柄
		char* licenseKey : 注册码
* 返回值：int  0：成功  -13:机器序列号获取失败  其他：错误代码
*/
extern "C" DLL_DECLARE int remote_setLicense(int nHandle, const char* licenseKey);

/*
* 描 述：系统同步
* 参  数：
		nHandle:句柄
* 返回值：int  0：成功  -1：失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_setSysCommand(int nHandle, const char* SysCommand);

/*
* 描 述：关闭打开的NC文件
* 参  数：
		nHandle:句柄
		channel：通道号
* 返回值：int  0：成功  -1：失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_closeFile(int nHandle, int channel);

/*
* 描 述：获取当前执行的NC文件名
* 参  数：
		nHandle:句柄
		channel：通道号
		char* value : NC文件名
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_getCurFileName(int nHandle, int channel, char* value);

/*
* 描 述：读取Si变量值
* 参  数：
		nHandle:句柄
		SIAddr：内存地址
		type： 存储类型
		nBitStart：起始位
		nBitSize： 大小
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE double remote_read_SI_variable(int nHandle, unsigned int SIAddr, int type, int nBitStart, int nBitSize);

/*
* 描 述：写入Si变量值
* 参  数：
		nHandle:句柄
		SIAddr：内存地址
		type： 存储类型
		nBitStart：起始位
		nBitSize： 大小
		value： 需要写入的值
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_write_SI_variable(int nHandle, unsigned int SIAddr, int type, int nBitStart, int nBitSize, double value);

/*
* 描 述：获取日志文件
* 参  数：
		nHandle:句柄
		type： 文件类型  1：加工履历  2：错误履历  3：操作日志  4：系统日志
		outputDir：文件存放路径（不含文件名）
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_LogFile(int nHandle, int type, const char* outputDir);

/*
* 描 述：获取当前执行文件总行数
* 参  数：
		nHandle:句柄
		channel：通道号
		totalLine：获取到的行数
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_CurFileTotalLine(int nHandle, int channel, int* totalLine);

/*
* 描 述：重命名NC文件
* 参  数：nHandle:句柄  
		char * chFileName : 需要传输到控制器的文件名
		char * FileName: 原文件名(/NC1/filename,根路径只传文件名)
*返回值：int  0：成功 -1：重命名失败 -2:未建立连接 -6：发送失败
*/
extern "C" DLL_DECLARE int remote_rename_File(int nHandle, const char* chFileName, const char* FileName);

// 2.6.2.0版本新增接口

/*
* 描 述：获取各轴绝对坐标
* 参  数：nHandle:句柄
*		coordType:选则轴(X,Y,Z,A,B,C,U,V,W) 111111111 按顺序0为不获取，1为获取坐标值
		double* value 获取到的坐标
*返回值：int  0: 成功 -1: 获取失败 -2: 无连接  -23: 轴名称错误
*/
extern "C" DLL_DECLARE int remote_get_AbsolutCoordinate(int nHandle, int coordType, double* value);

/*
* 描 述：获取各轴相对坐标
* 参  数：nHandle:句柄
*       coordType:选则轴(X,Y,Z,A,B,C,U,V,W) 111111111 按顺序0为不获取，1为获取坐标值
		double* value 获取到的坐标
*返回值：int  0: 成功 -1: 获取失败 -2: 无连接  -23: 轴名称错误
*/
extern "C" DLL_DECLARE int remote_get_RelativelyCoordinate(int nHandle, int coordType, double* value);

/*
* 描 述：获取各轴机械坐标
* 参  数：nHandle:句柄
*		coordType:选则轴(X,Y,Z,A,B,C,U,V,W) 111111111 按顺序0为不获取，1为获取坐标值
		double* value 获取到的坐标
*返回值：int  0: 成功 -1: 获取失败 -2: 无连接  -23: 轴名称错误
*/
extern "C" DLL_DECLARE int remote_get_MachineCoordinate(int nHandle, int coordType, double* value);

/*
* 描 述：获取各轴负载
* 参  数：nHandle:句柄
*		channel:通道号
*		coordType:选则轴(X-1,Y-2,Z-3,A-4,B-5,C-6)
		double* value 获取到的坐标
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 -23: 轴名称错误
*/
extern "C" DLL_DECLARE int remote_get_AxisLoad(int nHandle, int channel, int coordType, double* value);

/*
* 描 述：获取各轴状态
* 参  数：nHandle:句柄
*		channel:通道号
*		coordType:选则轴(X-1,Y-2,Z-3,A-4,B-5,C-6)
		char * coordStates: 获取到的坐标
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 -23: 轴名称错误
*/
extern "C" DLL_DECLARE int remote_get_AxisInfo(int nHandle, int channel, int coordType, char* coordStates);

/************************************加工信息************************************/

/*
* 描 述：获取设定循环数(33503)
* 参  数：nHandle:句柄
*		channel:通道号
*		double* cyclesNumber 获取到的宏变量值
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_CyclesNumber(int nHandle, int channel, double* cyclesNumber);

/*
* 描 述：获取当前循环数(33504)
* 参  数：nHandle:句柄
*		channel:通道号
*		double* curCyclesNumber 获取到的宏变量值
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_CurrentCyclesNumber(int nHandle, int channel, double* curCyclesNumber);

/*
* 描 述：获取主轴指令转速(33505)
* 参  数：nHandle:句柄
*		channel:通道号
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_S_CommandSpeed(int nHandle, int channel, double* value);

/*
* 描 述：获取主轴实际转速(33506)
* 参  数：nHandle:句柄
*		channel:通道号
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_S_CurrentSpeed(int nHandle, int channel, double* value);

/*
* 描 述：获取当前指令进给速度(33563)
* 参  数：nHandle:句柄
*		channel:通道号
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_F_CommandSpeed(int nHandle, int channel, double* value);

/*
* 描 述：获取当前实际进给速度
* 参  数：nHandle:句柄
*		channel:通道号
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_F_CurrentSpeed(int nHandle, int channel, double* value);

/*
* 描 述：获取加工总零件数(33870)
* 参  数：nHandle:句柄
*		channel:通道号
		double* value 获取到的工件总数
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_WorkpieceNumber(int nHandle, int channel, double* value);

/*
* 描 述：获取系统加工时间(33868)
* 参  数：nHandle:句柄
*		channel:通道号
		double* value 获取到的加工时间
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_ProcessTime(int nHandle, int channel, double* value);

/*
* 描 述：获取系统运行时间(2097)
* 参  数：nHandle:句柄
		char * MachineStates: 获取运行时间
		获取到的信息包括：系统运行时间
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_get_SysUptime(int nHandle, int channel, double* value);

/************************************PLC操作************************************/

/*
* 描 述：切换模式
* 参  数：nHandle:句柄
*		  ModeType:
*		  1： Codeless/无代码； 2： MEM/自动
*         4： Handle / 手轮；   5： Jog
*		  6： Home / 原点复归； 8： MDI
*
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_switch_mode(int nHandle, int ModeType);

/*
* 描 述：启动程序
* 参  数：nHandle:句柄
*
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_cycle_start(int nHandle, int channel);

/*
* 描 述：程序暂停
* 参  数：nHandle:句柄
*
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_cycle_pause(int nHandle, int channel);

/*
* 描 述：程序停止
* 参  数：nHandle:句柄
*
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_cycle_stop(int nHandle, int channel);

/*
* 描 述：复位
* 参  数：nHandle:句柄
*
*返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败
*/
extern "C" DLL_DECLARE int remote_reset(int nHandle, int channel);

/*
* 描 述：成块连续读取宏变量(最大100个)
* 参  数：nHandle: 句柄
*          startMacro: 起始宏变量
*          endMacro: 结束宏变量
*          values: 读取的数据存放位置
* 返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 -24: 数据错误
*/
extern "C" DLL_DECLARE int remote_get_macro_range(int nHandle, int startMacro, int endMacro, double* values);

/*
*描  述：读@宏变量
*参  数：int nHandle：句柄 int nMacro：宏变量号 double* val：读取的数据存放位置
*返回值：int  0：成功 -2:未建立连接 -5：宏变量号错误 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_read_at_macro(int nHandle, int nMacro, double* val);

/*
*描  述：写@宏变量
*参  数：int nHandle：句柄  int nMacro：宏变量号  double val：要写入宏变量的值
*返回值：int  0：成功 -2:未建立连接 -5：宏变量号错误 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_write_at_macro(int nHandle, int nMacro, double val);

/*
* 描 述：根据宏变量号数组读取宏变量值(最大支持100个)
* 参  数：nHandle: 句柄
*          macroArray: 宏变量号数组
*          macroArraySize: 宏变量号数组的大小
*          values: 读取的数据存放位置
* 返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 -24: 数据错误 -27: 超出最大读取数
*/
extern "C" DLL_DECLARE int remote_get_macro_by_array(int nHandle, int* macroArray, int macroArraySize, double* values);

/*
* 描 述：根据宏变量号数组写入宏变量值(最大支持100个)
* 参  数：nHandle: 句柄
*          macroArray: 宏变量号数组
*          macroArraySize: 宏变量号数组的大小
*          values: 要写入的数据数组
* 返回值：int  0: 成功 -1: 获取失败 -6: 发送失败 -7: 接收失败 -24: 数据错误 -27: 超出最大写入数
*/
extern "C" DLL_DECLARE int remote_set_macro_by_array(int nHandle, int* macroArray, int macroArraySize, double* values);

/*
*描  述：取得主NC的当前行号(只有运行NC时才拿的到行号)
*参  数：nHandle:句柄， nLine 行号
*返回值：int  0：成功 -5：获取失败 -6: 发送失败 -7: 接收失败 
*/
extern "C" DLL_DECLARE int remote_get_main_ncline(int nHandle, int *nLine);

#endif // RMI_REMOTE_COMM_H_


