#ifndef RMI_REMOTE_COMM_H_
#define RMI_REMOTE_COMM_H_

#ifdef _WIN32
#define DLL_DECLARE __declspec(dllexport)
#else
#define DLL_DECLARE
#endif

#define REMOTECOMM_VERSION "2.0.0.0"

/***  该库基本功能：与控制器端宏变量读写，FTP文件传输，远程打开控制器端程序（需要用户盘有要打开的文件）***/

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
*描  述：读宏变量
*参  数：int nHandle:句柄 int nMacro：宏变量号
*返回值：宏变量值
*/
extern "C" DLL_DECLARE double remote_read_macro(int nHandle, int nMacro);

/*
*描  述：读宏变量
*参  数：int nHandle：句柄 int nMacro：宏变量号 double* val：读取的数据存放位置
*返回值：int  0：成功 -2:未建立连接 -5：宏变量号错误 -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_read_macro_p(int nHandle, int nMacro, double* val);

/*
*描  述：写宏变量
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
		char* chFileName : 需要传输到控制器的文件名
		wchar_t* chFileName : 宽字符文件名
		int nPath： 路径编号
					1001  NC1				2001  Chn2\NC1
					1002  NC2				2002  Chn2\NC2
					1003  NC3				2003  Chn2\NC3
					1004  NC4				2004  Chn2\NC4
					1005  NC5				2005  Chn2\NC5
					其他  第一通道根路径	2 第二通道根路径
*返回值：int  0：成功 -1：传输失败 -2:未建立连接 -4：ftp连接失败 -10：文件打开失败
*说明  : 增加了路径选择
*/
//2.6.1.5兼容unicode字符集
extern "C" DLL_DECLARE int remote_upload_file(int nHandle, const char* chFileName, int nPath);

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
*返回值：int  0：成功 -1：传输失败 -2:未建立连接
*说明  : 增加了路径选择
*/
extern "C" DLL_DECLARE int remote_delete_file(int nHandle, const char* chFileName, int nPath);

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
*说明  : 增加了路径选择
*/
extern "C" DLL_DECLARE int remote_download_file(int nHandle, int nPath, const char* chFileName, const char* outputDir);

/*
* 描  述：读取控制器用户盘目录下 文件或目录列表到指定文件
* 参  数：nHandle:句柄
		char* chFileName : 储存指定目录下文件或目录列表的文件路径
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

extern "C" DLL_DECLARE int remote_get_MachineCoordinate(int nHandle, int channel, double* value);

extern "C" DLL_DECLARE int remote_get_AbsolutCoordinate(int nHandle, int channel, double* value);

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
		type： 文件类型  1：加工履历  2：错误履历  3：操作日志  4：系统日志
		outputDir：文件存放路径（不含文件名）
* 返回值：int  0：成功  -1：获取失败  -2：未建立连接  -6:发送失败 -7：接收失败
*/
extern "C" DLL_DECLARE int remote_get_CurFileTotalLine(int nHandle, int channel, int* totalLine);

/*
* 描 述：重命名NC文件
* 参  数：nHandle:句柄  
		char * chFileName : 需要传输到控制器的文件名(可以是中文)
		char * FileName: 原文件名(/NC1/filename,根路径只传文件名)
*返回值：int  0：成功 -1：重命名失败 -2:未建立连接 -6：发送失败
*/
extern "C" DLL_DECLARE int remote_rename_File(int nHandle, const char* chFileName, const char* FileName);

#endif // RMI_REMOTE_COMM_H_


