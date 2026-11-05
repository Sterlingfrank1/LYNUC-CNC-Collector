/**
 * @file cnc_bridge.h
 * @brief CNC Controller Bridge - 32-bit compatibility wrapper
 *
 * This header defines the C interface for the CNC controller bridge.
 * The bridge handles 32-bit libRemoteComm.so compatibility on 64-bit systems
 * by providing a pure C interface that can be called via FFI.
 *
 * Build for 32-bit:
 *   gcc -m32 -shared -fPIC -o libcnc_bridge.so cnc_bridge.c
 */

#ifndef CNC_BRIDGE_H
#define CNC_BRIDGE_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/*============================================================================
 * Connection Management
 *============================================================================*/

/**
 * @brief Create TCP connection to CNC controller
 * @param ip Controller IP address string
 * @return Handle (>0) on success, error code (<0) on failure:
 *         -1: Max connections exceeded
 *         -2: Invalid IP
 *         -3: Connection failed
 */
int32_t cnc_bridge_connect(const char* ip);

/**
 * @brief Close connection
 * @param handle Connection handle from cnc_bridge_connect()
 */
void cnc_bridge_disconnect(int32_t handle);

/**
 * @brief Check connection status
 * @param handle Connection handle
 * @return 1: connected, 0: disconnected, -1: invalid handle
 */
int32_t cnc_bridge_is_connected(int32_t handle);

/**
 * @brief Set receive timeout in milliseconds
 * @param handle Connection handle
 * @param timeout Timeout in ms
 * @return 0: success, -1: error
 */
int32_t cnc_bridge_set_timeout(int32_t handle, int32_t timeout);

/*============================================================================
 * Macro Variable Operations (# variables)
 *============================================================================*/

/**
 * @brief Read a single # macro variable
 * @param handle Connection handle
 * @param macroNum Macro variable number (e.g., 5001)
 * @return Macro variable value
 */
double cnc_bridge_read_macro(int32_t handle, int32_t macroNum);

/**
 * @brief Read macro variable with status
 * @param handle Connection handle
 * @param macroNum Macro variable number
 * @param value Output: variable value
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_read_macro_p(int32_t handle, int32_t macroNum, double* value);

/**
 * @brief Write # macro variable
 * @param handle Connection handle
 * @param macroNum Macro variable number
 * @param value Value to write
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_write_macro(int32_t handle, int32_t macroNum, double value);

/**
 * @brief Read range of macro variables (max 100)
 * @param handle Connection handle
 * @param startMacro Start macro number
 * @param endMacro End macro number
 * @param values Output array (must have at least 100 doubles)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_read_macro_range(int32_t handle, int32_t startMacro,
                                     int32_t endMacro, double* values);

/*============================================================================
 * PLC Variable Operations
 *============================================================================*/

/**
 * @brief Read PLC variable (MO type - output)
 * @param handle Connection handle
 * @param variableName Variable name/MO address
 * @return Variable value as unsigned long
 */
uint32_t cnc_bridge_read_plc_mo(int32_t handle, const char* variableName);

/**
 * @brief Read PLC variable (MI type - input)
 * @param handle Connection handle
 * @param variableName Variable name/MI address
 * @return Variable value as unsigned long
 */
uint32_t cnc_bridge_read_plc_mi(int32_t handle, const char* variableName);

/**
 * @brief Read PLC variable with pointer output
 * @param handle Connection handle
 * @param variableName Variable address
 * @param type 1: MO, 0: MI
 * @param value Output variable value
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_read_plc_variable(int32_t handle, const char* variableName,
                                      int32_t type, uint32_t* value);

/**
 * @brief Write PLC variable (MO type)
 * @param handle Connection handle
 * @param variableName Variable address
 * @param value Value to write
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_write_plc_mo(int32_t handle, const char* variableName,
                                 uint32_t value);

/*============================================================================
 * Coordinate & Position Data
 *============================================================================*/

/**
 * @brief Get absolute coordinates for axes
 * @param handle Connection handle
 * @param coordMask Bitmask: X=1, Y=2, Z=4, A=8, B=16, C=32, U=64, V=128, W=256
 * @param values Output array (at least 9 doubles for X-Y-Z-A-B-C-U-V-W)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_abs_coord(int32_t handle, int32_t coordMask, double* values);

/**
 * @brief Get relative coordinates for axes
 * @param handle Connection handle
 * @param coordMask Bitmask for axes
 * @param values Output array
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_rel_coord(int32_t handle, int32_t coordMask, double* values);

/**
 * @brief Get machine coordinates for axes
 * @param handle Connection handle
 * @param coordMask Bitmask for axes
 * @param values Output array
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_machine_coord(int32_t handle, int32_t coordMask, double* values);

/*============================================================================
 * Spindle & Feed Data
 *============================================================================*/

/**
 * @brief Get spindle command speed
 * @param handle Connection handle
 * @param channel Channel number (1 or 2)
 * @param value Output: spindle command speed (RPM)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_spindle_cmd_speed(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get spindle actual speed
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: actual spindle speed (RPM)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_spindle_act_speed(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get feed command speed
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: command feed rate (mm/min)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_feed_cmd_speed(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get feed actual speed
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: actual feed rate (mm/min)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_feed_act_speed(int32_t handle, int32_t channel, double* value);

/*============================================================================
 * Production & Cycle Data
 *============================================================================*/

/**
 * @brief Get target cycle count
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: target cycle count
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_cycles_target(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get current cycle count
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: current cycle count
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_cycles_current(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get total workpieces produced
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: total workpiece count
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_workpiece_count(int32_t handle, int32_t channel, double* value);

/**
 * @brief Get processing time
 * @param handle Connection handle
 * @param channel Channel number
 * @param value Output: processing time (seconds)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_process_time(int32_t handle, int32_t channel, double* value);

/*============================================================================
 * Program & File Info
 *============================================================================*/

/**
 * @brief Get current NC file name
 * @param handle Connection handle
 * @param channel Channel number
 * @param filename Output buffer for filename (min 256 bytes)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_current_file(int32_t handle, int32_t channel, char* filename);

/**
 * @brief Get current NC line number
 * @param handle Connection handle
 * @param lineNum Output: current line number
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_current_line(int32_t handle, int32_t* lineNum);

/**
 * @brief Get total lines in current file
 * @param handle Connection handle
 * @param channel Channel number
 * @param totalLine Output: total line count
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_file_total_lines(int32_t handle, int32_t channel, int32_t* totalLine);

/*============================================================================
 * System Info
 *============================================================================*/

/**
 * @brief Get library version
 * @param version Output buffer for version string (min 64 bytes)
 * @return 0: success
 */
int32_t cnc_bridge_get_version(char* version);

/**
 * @brief Get controller serial number
 * @param handle Connection handle
 * @param serial Output buffer for serial (min 64 bytes)
 * @return 0: success, -1: failure
 */
int32_t cnc_bridge_get_serial(int32_t handle, char* serial);

/**
 * @brief Get last error message
 * @param handle Connection handle
 * @param error Output buffer for error message (min 256 bytes)
 * @return 0: success
 */
int32_t cnc_bridge_get_error(int32_t handle, char* error);

/*============================================================================
 * Error Code Definitions
 *============================================================================*/

#define CNC_SUCCESS             0
#define CNC_FAILURE            -1
#define CNC_NO_CONNECTION      -2
#define CNC_CONNECTION_ERR     -3
#define CNC_FTP_ERR            -4
#define CNC_MACRO_ERR          -5
#define CNC_SEND_ERR           -6
#define CNC_RECV_ERR           -7
#define CNC_CHANNEL_ERR        -8
#define CNC_BUFFER_ERR         -9
#define CNC_FILE_ERR          -10
#define CNC_PLC_ERR           -11
#define CNC_AXIS_ERR          -23
#define CNC_DATA_ERR          -24

#ifdef __cplusplus
}
#endif

#endif /* CNC_BRIDGE_H */
