"""通过 ctypes 调用厂商 Windows x64 DLL，结果以 JSON 输出到 stdout。由 run.js 驱动。"""

import ctypes
import json
import sys

dll = ctypes.CDLL(sys.argv[1])
dll.remote_read_macro_p.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_double)]
dll.remote_read_plc_variable_p_2.argtypes = [
    ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(ctypes.c_ulong),
]

handle = dll.remote_new_connect(b"127.0.0.1")
results = [{"case": "connect", "rc": 0 if handle >= 0 else handle}]


def number(name, call):
    value = ctypes.c_double(float("nan"))
    rc = call(ctypes.byref(value))
    # 读失败时保持 NaN，JSON 无法表示。
    results.append({"case": name, "rc": rc, "value": None if value.value != value.value else value.value})


def integer(name, call):
    value = ctypes.c_int(-1)
    rc = call(ctypes.byref(value))
    results.append({"case": name, "rc": rc, "value": value.value})


def plc(name, address, kind):
    value = ctypes.c_ulong(0xFFFFFFFF)
    rc = dll.remote_read_plc_variable_p_2(handle, address, kind, ctypes.byref(value))
    results.append({"case": name, "rc": rc, "value": value.value})


def text(name, call):
    buffer = ctypes.create_string_buffer(4096)
    rc = call(buffer)
    results.append({"case": name, "rc": rc, "hex": buffer.value.hex()})


def macro(name, macro_id):
    number(name, lambda p: dll.remote_read_macro_p(handle, macro_id, p))


def coordinates(name, function):
    values = (ctypes.c_double * 9)()
    rc = function(handle, 111000000, values)
    results.append({"case": name, "rc": rc, "values": list(values)[:3]})


if handle >= 0:
    macro("macro_int", 33505)
    macro("macro_float", 30118)
    macro("macro_negative", 100)
    plc("plc_bit", b"206.0", 1)
    plc("plc_field", b"205.20.24", 1)
    plc("plc_mi", b"200.1", 0)
    text("file_name", lambda b: dll.remote_getCurFileName(handle, 1, b))
    text("file_path", lambda b: dll.remote_get_open_file_path(handle, b))
    integer("total_lines", lambda p: dll.remote_get_CurFileTotalLine(handle, 1, p))
    text("version", lambda b: dll.remote_get_version(handle, b))
    text("serial", lambda b: dll.remote_getMachineSerial(handle, b))
    text("mac", lambda b: dll.remote_getMacAddress(handle, b))
    text("alarms", lambda b: dll.remote_get_errormessage(handle, b))
    # 只有 Windows 库才有的命令
    integer("main_line", lambda p: dll.remote_get_main_ncline(handle, p))
    number("cycle_target", lambda p: dll.remote_get_CyclesNumber(handle, 1, p))
    number("axis_load_x", lambda p: dll.remote_get_AxisLoad(handle, 1, 1, p))

    if len(sys.argv) > 2 and sys.argv[2] == "--mapping":
        # 动态验证 docs/PROTOCOL.md 第 6 节：这些 API 实际发出什么请求。
        coordinates("api_absolute", dll.remote_get_AbsolutCoordinate)
        coordinates("api_relative", dll.remote_get_RelativelyCoordinate)
        coordinates("api_machine", dll.remote_get_MachineCoordinate)
        number("api_cycle_count", lambda p: dll.remote_get_CurrentCyclesNumber(handle, 1, p))
        number("api_spindle_command", lambda p: dll.remote_get_S_CommandSpeed(handle, 1, p))
        number("api_spindle_actual", lambda p: dll.remote_get_S_CurrentSpeed(handle, 1, p))
        number("api_feed_command", lambda p: dll.remote_get_F_CommandSpeed(handle, 1, p))
        number("api_workpieces", lambda p: dll.remote_get_WorkpieceNumber(handle, 1, p))
        number("api_process_time", lambda p: dll.remote_get_ProcessTime(handle, 1, p))
        number("api_uptime", lambda p: dll.remote_get_SysUptime(handle, 1, p))

    dll.remote_close(handle)

print(json.dumps(results))
