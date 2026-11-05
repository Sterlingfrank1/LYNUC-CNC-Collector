/**
 * @file cnc_bridge.c
 * @brief CNC Controller Bridge Implementation
 *
 * This module provides a C wrapper for the 32-bit libRemoteComm.so library.
 * It handles 32-bit/64-bit compatibility and provides a clean FFI interface
 * for Node.js to call the CNC controller communication functions.
 *
 * Build for 32-bit Linux:
 *   gcc -m32 -shared -fPIC -o libcnc_bridge.so cnc_bridge.c -lRemoteComm -lpthread
 *
 * Build for 64-bit (testing without actual hardware):
 *   gcc -shared -fPIC -o libcnc_bridge.so cnc_bridge.c -lpthread
 */

#include "cnc_bridge.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <dlfcn.h>

/*============================================================================
 * Dynamic Library Loading
 *============================================================================*/

/* Library handle - loaded dynamically for flexibility */
static void* g_libRemoteComm = NULL;

/* Function pointer types for libRemoteComm */
typedef int (*connect_fn_t)(const char* ip);
typedef void (*close_fn_t)(int nHandle);
typedef double (*read_macro_fn_t)(int nHandle, int nMacro);
typedef int (*read_macro_p_fn_t)(int nHandle, int nMacro, double* val);
typedef int (*write_macro_fn_t)(int nHandle, int nMacro, double val);
typedef unsigned long (*read_plc_fn_t)(int nHandle, int variableName);
typedef unsigned long (*read_plc_2_fn_t)(int nHandle, int type, const char* PLCAdress);
typedef int (*read_plc_p_fn_t)(int nHandle, int variableName, unsigned long* val);
typedef int (*read_plc_p_2_fn_t)(int nHandle, const char* PLCAdress, int type, unsigned long* val);
typedef int (*write_plc_fn_t)(int nHandle, int variableName, unsigned long val);
typedef int (*write_plc_2_fn_t)(int nHandle, const char* PLCAdress, int type, unsigned long val);
typedef int (*get_abs_coord_fn_t)(int nHandle, int coordType, double* value);
typedef int (*get_rel_coord_fn_t)(int nHandle, int coordType, double* value);
typedef int (*get_mach_coord_fn_t)(int nHandle, int coordType, double* value);
typedef int (*get_spindle_cmd_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_spindle_act_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_feed_cmd_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_feed_act_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_cycles_target_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_cycles_cur_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_workpiece_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_proctime_fn_t)(int nHandle, int channel, double* value);
typedef int (*get_cur_file_fn_t)(int nHandle, int channel, char* value);
typedef int (*get_cur_line_fn_t)(int nHandle, int* nLine);
typedef int (*get_file_lines_fn_t)(int nHandle, int channel, int* totalLine);
typedef int (*get_version_fn_t)(int nHandle, char* version);
typedef int (*get_serial_fn_t)(int nHandle, char* value);
typedef int (*get_error_fn_t)(int nHandle, char* errormessage);
typedef int (*set_timeout_fn_t)(int nHandle, int nMillisecond);
typedef int (*connect_status_fn_t)(int nHandle);

/* Function pointers */
static connect_fn_t g_remote_new_connect = NULL;
static close_fn_t g_remote_close = NULL;
static read_macro_fn_t g_remote_read_macro = NULL;
static read_macro_p_fn_t g_remote_read_macro_p = NULL;
static write_macro_fn_t g_remote_write_macro = NULL;
static read_plc_2_fn_t g_remote_read_plc_2 = NULL;
static read_plc_p_2_fn_t g_remote_read_plc_p_2 = NULL;
static write_plc_2_fn_t g_remote_write_plc_2 = NULL;
static get_abs_coord_fn_t g_remote_get_abs = NULL;
static get_rel_coord_fn_t g_remote_get_rel = NULL;
static get_mach_coord_fn_t g_remote_get_mach = NULL;
static get_spindle_cmd_fn_t g_remote_spindle_cmd = NULL;
static get_spindle_act_fn_t g_remote_spindle_act = NULL;
static get_feed_cmd_fn_t g_remote_feed_cmd = NULL;
static get_feed_act_fn_t g_remote_feed_act = NULL;
static get_cycles_target_fn_t g_remote_cycles_target = NULL;
static get_cycles_cur_fn_t g_remote_cycles_cur = NULL;
static get_workpiece_fn_t g_remote_workpiece = NULL;
static get_proctime_fn_t g_remote_proctime = NULL;
static get_cur_file_fn_t g_remote_cur_file = NULL;
static get_cur_line_fn_t g_remote_cur_line = NULL;
static get_file_lines_fn_t g_remote_file_lines = NULL;
static get_version_fn_t g_remote_version = NULL;
static get_serial_fn_t g_remote_serial = NULL;
static get_error_fn_t g_remote_error = NULL;
static set_timeout_fn_t g_remote_set_timeout = NULL;
static connect_status_fn_t g_remote_status = NULL;

/*============================================================================
 * Library Initialization
 *============================================================================*/

/**
 * @brief Load the RemoteComm library and resolve function pointers
 * @param libPath Path to libRemoteComm.so (NULL for default search)
 * @return 0: success, -1: library not found, -2: symbol resolution failed
 */
static int32_t load_library(const char* libPath) {
    if (g_libRemoteComm != NULL) {
        return 0;  /* Already loaded */
    }

    const char* path = libPath ? libPath : "libRemoteComm.so";
    g_libRemoteComm = dlopen(path, RTLD_NOW | RTLD_LOCAL);

    if (g_libRemoteComm == NULL) {
        fprintf(stderr, "CNC Bridge: Failed to load %s: %s\n", path, dlerror());
        return -1;
    }

    /* Resolve all function pointers */
#define RESOLVE(fn) do { \
    g_##fn = (fn##_t)dlsym(g_libRemoteComm, #fn); \
    if (g_##fn == NULL) { \
        fprintf(stderr, "CNC Bridge: Symbol %s not found\n", #fn); \
        return -2; \
    } \
} while(0)

    RESOLVE(remote_new_connect);
    RESOLVE(remote_close);
    RESOLVE(remote_read_macro);
    RESOLVE(remote_read_macro_p);
    RESOLVE(remote_write_macro);
    RESOLVE(remote_read_plc_variable_2);
    RESOLVE(remote_read_plc_variable_p_2);
    RESOLVE(remote_write_plc_variable_2);
    RESOLVE(remote_get_AbsolutCoordinate);
    RESOLVE(remote_get_RelativelyCoordinate);
    RESOLVE(remote_get_MachineCoordinate);
    RESOLVE(remote_get_S_CommandSpeed);
    RESOLVE(remote_get_S_CurrentSpeed);
    RESOLVE(remote_get_F_CommandSpeed);
    RESOLVE(remote_get_F_CurrentSpeed);
    RESOLVE(remote_get_CyclesNumber);
    RESOLVE(remote_get_CurrentCyclesNumber);
    RESOLVE(remote_get_WorkpieceNumber);
    RESOLVE(remote_get_ProcessTime);
    RESOLVE(remote_getCurFileName);
    RESOLVE(remote_get_main_ncline);
    RESOLVE(remote_get_CurFileTotalLine);
    RESOLVE(remote_get_version);
    RESOLVE(remote_getMachineSerial);
    RESOLVE(remote_get_errormessage);
    RESOLVE(remote_set_receive_timeout);
    RESOLVE(remote_connect_status);

#undef RESOLVE

    return 0;
}

/**
 * @brief Unload the library (for cleanup)
 */
static void unload_library(void) {
    if (g_libRemoteComm != NULL) {
        dlclose(g_libRemoteComm);
        g_libRemoteComm = NULL;
    }
}

/**
 * @brief Initialize the bridge with optional library path
 * @param libPath Path to libRemoteComm.so (can be NULL)
 * @return 0: success, error code otherwise
 */
int32_t cnc_bridge_init(const char* libPath) {
    return load_library(libPath);
}

/**
 * @brief Shutdown the bridge and free resources
 */
void cnc_bridge_shutdown(void) {
    unload_library();
}

/*============================================================================
 * Connection Management
 *============================================================================*/

int32_t cnc_bridge_connect(const char* ip) {
    if (g_remote_new_connect == NULL) {
        if (load_library(NULL) != 0) {
            return CNC_CONNECTION_ERR;
        }
    }
    return g_remote_new_connect(ip);
}

void cnc_bridge_disconnect(int32_t handle) {
    if (g_remote_close != NULL && handle > 0) {
        g_remote_close(handle);
    }
}

int32_t cnc_bridge_is_connected(int32_t handle) {
    if (g_remote_status == NULL || handle <= 0) {
        return -1;
    }
    return g_remote_status(handle) == 0 ? 1 : 0;
}

int32_t cnc_bridge_set_timeout(int32_t handle, int32_t timeout) {
    if (g_remote_set_timeout == NULL || handle <= 0) {
        return CNC_FAILURE;
    }
    return g_remote_set_timeout(handle, timeout);
}

/*============================================================================
 * Macro Variable Operations
 *============================================================================*/

double cnc_bridge_read_macro(int32_t handle, int32_t macroNum) {
    if (g_remote_read_macro == NULL || handle <= 0) {
        return 0.0;
    }
    return g_remote_read_macro(handle, macroNum);
}

int32_t cnc_bridge_read_macro_p(int32_t handle, int32_t macroNum, double* value) {
    if (g_remote_read_macro_p == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_read_macro_p(handle, macroNum, value);
}

int32_t cnc_bridge_write_macro(int32_t handle, int32_t macroNum, double value) {
    if (g_remote_write_macro == NULL || handle <= 0) {
        return CNC_FAILURE;
    }
    return g_remote_write_macro(handle, macroNum, value);
}

int32_t cnc_bridge_read_macro_range(int32_t handle, int32_t startMacro,
                                     int32_t endMacro, double* values) {
    /* Note: This would require remote_get_macro_range from newer library */
    (void)handle;
    (void)startMacro;
    (void)endMacro;
    (void)values;
    return CNC_FAILURE;  /* Not implemented in current wrapper */
}

/*============================================================================
 * PLC Variable Operations
 *============================================================================*/

uint32_t cnc_bridge_read_plc_mo(int32_t handle, const char* variableName) {
    uint32_t val = 0;
    if (g_remote_read_plc_p_2 != NULL && handle > 0) {
        g_remote_read_plc_p_2(variableName, 1, &val);  /* MO = type 1 */
    }
    return val;
}

uint32_t cnc_bridge_read_plc_mi(int32_t handle, const char* variableName) {
    uint32_t val = 0;
    if (g_remote_read_plc_p_2 != NULL && handle > 0) {
        g_remote_read_plc_p_2(variableName, 0, &val);  /* MI = type 0 */
    }
    return val;
}

int32_t cnc_bridge_read_plc_variable(int32_t handle, const char* variableName,
                                      int32_t type, uint32_t* value) {
    if (g_remote_read_plc_p_2 == NULL || handle <= 0 ||
        variableName == NULL || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_read_plc_p_2(variableName, type, value) == 0 ? CNC_SUCCESS : CNC_FAILURE;
}

int32_t cnc_bridge_write_plc_mo(int32_t handle, const char* variableName,
                                 uint32_t value) {
    if (g_remote_write_plc_2 == NULL || handle <= 0) {
        return CNC_FAILURE;
    }
    return g_remote_write_plc_2(variableName, 1, value) == 0 ? CNC_SUCCESS : CNC_FAILURE;
}

/*============================================================================
 * Coordinate Operations
 *============================================================================*/

int32_t cnc_bridge_get_abs_coord(int32_t handle, int32_t coordMask, double* values) {
    if (g_remote_get_abs == NULL || handle <= 0 || values == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_get_abs(handle, coordMask, values);
}

int32_t cnc_bridge_get_rel_coord(int32_t handle, int32_t coordMask, double* values) {
    if (g_remote_get_rel == NULL || handle <= 0 || values == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_get_rel(handle, coordMask, values);
}

int32_t cnc_bridge_get_machine_coord(int32_t handle, int32_t coordMask, double* values) {
    if (g_remote_get_mach == NULL || handle <= 0 || values == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_get_mach(handle, coordMask, values);
}

/*============================================================================
 * Spindle & Feed Operations
 *============================================================================*/

int32_t cnc_bridge_get_spindle_cmd_speed(int32_t handle, int32_t channel, double* value) {
    if (g_remote_spindle_cmd == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_spindle_cmd(handle, channel, value);
}

int32_t cnc_bridge_get_spindle_act_speed(int32_t handle, int32_t channel, double* value) {
    if (g_remote_spindle_act == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_spindle_act(handle, channel, value);
}

int32_t cnc_bridge_get_feed_cmd_speed(int32_t handle, int32_t channel, double* value) {
    if (g_remote_feed_cmd == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_feed_cmd(handle, channel, value);
}

int32_t cnc_bridge_get_feed_act_speed(int32_t handle, int32_t channel, double* value) {
    if (g_remote_feed_act == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_feed_act(handle, channel, value);
}

/*============================================================================
 * Production Operations
 *============================================================================*/

int32_t cnc_bridge_get_cycles_target(int32_t handle, int32_t channel, double* value) {
    if (g_remote_cycles_target == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_cycles_target(handle, channel, value);
}

int32_t cnc_bridge_get_cycles_current(int32_t handle, int32_t channel, double* value) {
    if (g_remote_cycles_cur == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_cycles_cur(handle, channel, value);
}

int32_t cnc_bridge_get_workpiece_count(int32_t handle, int32_t channel, double* value) {
    if (g_remote_workpiece == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_workpiece(handle, channel, value);
}

int32_t cnc_bridge_get_process_time(int32_t handle, int32_t channel, double* value) {
    if (g_remote_proctime == NULL || handle <= 0 || value == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_proctime(handle, channel, value);
}

/*============================================================================
 * Program Operations
 *============================================================================*/

int32_t cnc_bridge_get_current_file(int32_t handle, int32_t channel, char* filename) {
    if (g_remote_cur_file == NULL || handle <= 0 || filename == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_cur_file(handle, channel, filename);
}

int32_t cnc_bridge_get_current_line(int32_t handle, int32_t* lineNum) {
    if (g_remote_cur_line == NULL || handle <= 0 || lineNum == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_cur_line(handle, lineNum);
}

int32_t cnc_bridge_get_file_total_lines(int32_t handle, int32_t channel, int32_t* totalLine) {
    if (g_remote_file_lines == NULL || handle <= 0 || totalLine == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_file_lines(handle, channel, totalLine);
}

/*============================================================================
 * System Info Operations
 *============================================================================*/

int32_t cnc_bridge_get_version(char* version) {
    if (g_remote_version == NULL || version == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_version(0, version);
}

int32_t cnc_bridge_get_serial(int32_t handle, char* serial) {
    if (g_remote_serial == NULL || handle <= 0 || serial == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_serial(handle, serial);
}

int32_t cnc_bridge_get_error(int32_t handle, char* error) {
    if (g_remote_error == NULL || error == NULL) {
        return CNC_FAILURE;
    }
    return g_remote_error(handle, error);
}
