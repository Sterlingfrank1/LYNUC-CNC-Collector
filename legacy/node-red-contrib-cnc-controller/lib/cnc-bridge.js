/**
 * @file cnc-bridge.js
 * @brief Node.js FFI Binding for CNC Controller Bridge
 *
 * This module provides a high-level JavaScript wrapper around the C bridge
 * library (libcnc_bridge.so). It handles FFI calls, type conversions, and
 * provides a clean async API for the Node-RED node.
 *
 * The bridge handles 32-bit libRemoteComm.so compatibility on 64-bit systems.
 */

'use strict';

const ffi = require('ffi-napi');
const ref = require('ref-napi');
const ArrayType = require('ref-array-napi');

// Type definitions
const int32 = ref.types.int;
const int64 = ref.types.long;
const uint32 = ref.types.uint;
const double = ref.types.double;
const void = ref.types.void;
const bool = ref.types.bool;
const char = ref.types.char;
const uchar = ref.types.uchar;
const CString = ref.types.CString;

// Array types for coordinate data
const DoubleArray = ArrayType(double);
const Int32Array = ArrayType(int32);
const UInt32Array = ArrayType(uint32);

/**
 * @class CNCBridge
 * @brief FFI wrapper for CNC controller communication
 */
class CNCBridge {
    /**
     * @brief Create a new CNCBridge instance
     * @param {string} libPath Optional path to libcnc_bridge.so
     */
    constructor(libPath = null) {
        this.libPath = libPath || './libcnc_bridge.so';
        this.library = null;
        this.isLoaded = false;
    }

    /**
     * @brief Load the C bridge library
     * @throws {Error} If library fails to load
     */
    load() {
        if (this.isLoaded) {
            return;
        }

        try {
            this.library = ffi.Library(this.libPath, {
                // Version & Info
                'cnc_bridge_init': ['int32', [CString]],
                'cnc_bridge_shutdown': ['void', []],
                'cnc_bridge_get_version': ['int32', [CString]],
                'cnc_bridge_get_error': ['int32', ['int32', CString]],

                // Connection Management
                'cnc_bridge_connect': ['int32', [CString]],
                'cnc_bridge_disconnect': ['void', ['int32']],
                'cnc_bridge_is_connected': ['int32', ['int32']],
                'cnc_bridge_set_timeout': ['int32', ['int32', 'int32']],

                // Macro Variables
                'cnc_bridge_read_macro': ['double', ['int32', 'int32']],
                'cnc_bridge_read_macro_p': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_write_macro': ['int32', ['int32', 'int32', 'double']],

                // PLC Variables
                'cnc_bridge_read_plc_mo': ['uint32', ['int32', CString]],
                'cnc_bridge_read_plc_mi': ['uint32', ['int32', CString]],
                'cnc_bridge_read_plc_variable': ['int32', ['int32', CString, 'int32', ref.refType(uint32)]],
                'cnc_bridge_write_plc_mo': ['int32', ['int32', CString, 'uint32']],

                // Coordinates
                'cnc_bridge_get_abs_coord': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_rel_coord': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_machine_coord': ['int32', ['int32', 'int32', ref.refType(double)]],

                // Spindle
                'cnc_bridge_get_spindle_cmd_speed': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_spindle_act_speed': ['int32', ['int32', 'int32', ref.refType(double)]],

                // Feed
                'cnc_bridge_get_feed_cmd_speed': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_feed_act_speed': ['int32', ['int32', 'int32', ref.refType(double)]],

                // Production
                'cnc_bridge_get_cycles_target': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_cycles_current': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_workpiece_count': ['int32', ['int32', 'int32', ref.refType(double)]],
                'cnc_bridge_get_process_time': ['int32', ['int32', 'int32', ref.refType(double)]],

                // Program
                'cnc_bridge_get_current_file': ['int32', ['int32', 'int32', CString]],
                'cnc_bridge_get_current_line': ['int32', ['int32', ref.refType(int32)]],
                'cnc_bridge_get_file_total_lines': ['int32', ['int32', 'int32', ref.refType(int32)]],

                // System
                'cnc_bridge_get_serial': ['int32', ['int32', CString]]
            });

            // Initialize the library
            const result = this.library.cnc_bridge_init(null);
            if (result < 0) {
                throw new Error(`Failed to initialize CNC bridge: error code ${result}`);
            }

            this.isLoaded = true;
        } catch (err) {
            throw new Error(`Failed to load CNC bridge library: ${err.message}`);
        }
    }

    /**
     * @brief Unload the library
     */
    unload() {
        if (this.library && this.isLoaded) {
            this.library.cnc_bridge_shutdown();
            this.isLoaded = false;
        }
    }

    /**
     * @brief Check if library is loaded
     * @returns {boolean}
     */
    loaded() {
        return this.isLoaded;
    }

    /*========================================================================
     * Connection Methods
     *======================================================================*/

    /**
     * @brief Connect to CNC controller
     * @param {string} ip Controller IP address
     * @returns {number} Connection handle (>0) or error code (<0)
     */
    connect(ip) {
        this._checkLoaded();
        return this.library.cnc_bridge_connect(ip);
    }

    /**
     * @brief Disconnect from controller
     * @param {number} handle Connection handle
     */
    disconnect(handle) {
        if (this.library && handle > 0) {
            this.library.cnc_bridge_disconnect(handle);
        }
    }

    /**
     * @brief Check connection status
     * @param {number} handle Connection handle
     * @returns {boolean} True if connected
     */
    isConnected(handle) {
        this._checkLoaded();
        return this.library.cnc_bridge_is_connected(handle) === 1;
    }

    /**
     * @brief Set receive timeout
     * @param {number} handle Connection handle
     * @param {number} timeout Timeout in milliseconds
     */
    setTimeout(handle, timeout) {
        this._checkLoaded();
        return this.library.cnc_bridge_set_timeout(handle, timeout) === 0;
    }

    /*========================================================================
     * Macro Variable Methods
     *======================================================================*/

    /**
     * @brief Read a macro variable
     * @param {number} handle Connection handle
     * @param {number} macroNum Macro variable number
     * @returns {number} Variable value
     */
    readMacro(handle, macroNum) {
        this._checkLoaded();
        return this.library.cnc_bridge_read_macro(handle, macroNum);
    }

    /**
     * @brief Write a macro variable
     * @param {number} handle Connection handle
     * @param {number} macroNum Macro variable number
     * @param {number} value Value to write
     * @returns {boolean} Success status
     */
    writeMacro(handle, macroNum, value) {
        this._checkLoaded();
        return this.library.cnc_bridge_write_macro(handle, macroNum, value) === 0;
    }

    /*========================================================================
     * PLC Variable Methods
     *======================================================================*/

    /**
     * @brief Read PLC MO (output) variable
     * @param {number} handle Connection handle
     * @param {string} address Variable address (e.g., "200.1")
     * @returns {number} Variable value
     */
    readPLCMO(handle, address) {
        this._checkLoaded();
        return this.library.cnc_bridge_read_plc_mo(handle, address);
    }

    /**
     * @brief Read PLC MI (input) variable
     * @param {number} handle Connection handle
     * @param {string} address Variable address
     * @returns {number} Variable value
     */
    readPLCMI(handle, address) {
        this._checkLoaded();
        return this.library.cnc_bridge_read_plc_mi(handle, address);
    }

    /*========================================================================
     * Coordinate Methods
     *======================================================================*/

    /**
     * @brief Get absolute coordinates
     * @param {number} handle Connection handle
     * @param {number} coordMask Bitmask: X=1, Y=2, Z=4, A=8, B=16, C=32
     * @returns {Object} Coordinates {X, Y, Z, A, B, C}
     */
    getAbsCoord(handle, coordMask = 0x3F) {  // X-Y-Z-A-B-C by default
        this._checkLoaded();
        const values = new DoubleArray(9);
        const result = this.library.cnc_bridge_get_abs_coord(handle, coordMask, values.ref());

        if (result !== 0) {
            throw new Error(`Failed to get absolute coordinates: ${this.getError(handle)}`);
        }

        return {
            X: values[0],
            Y: values[1],
            Z: values[2],
            A: values[3],
            B: values[4],
            C: values[5],
            U: values[6],
            V: values[7],
            W: values[8]
        };
    }

    /**
     * @brief Get relative coordinates
     * @param {number} handle Connection handle
     * @param {number} coordMask Bitmask for axes
     * @returns {Object} Coordinates
     */
    getRelCoord(handle, coordMask = 0x3F) {
        this._checkLoaded();
        const values = new DoubleArray(9);
        const result = this.library.cnc_bridge_get_rel_coord(handle, coordMask, values.ref());

        if (result !== 0) {
            throw new Error(`Failed to get relative coordinates: ${this.getError(handle)}`);
        }

        return {
            X: values[0],
            Y: values[1],
            Z: values[2],
            A: values[3],
            B: values[4],
            C: values[5],
            U: values[6],
            V: values[7],
            W: values[8]
        };
    }

    /**
     * @brief Get machine coordinates
     * @param {number} handle Connection handle
     * @param {number} coordMask Bitmask for axes
     * @returns {Object} Coordinates
     */
    getMachineCoord(handle, coordMask = 0x3F) {
        this._checkLoaded();
        const values = new DoubleArray(9);
        const result = this.library.cnc_bridge_get_machine_coord(handle, coordMask, values.ref());

        if (result !== 0) {
            throw new Error(`Failed to get machine coordinates: ${this.getError(handle)}`);
        }

        return {
            X: values[0],
            Y: values[1],
            Z: values[2],
            A: values[3],
            B: values[4],
            C: values[5],
            U: values[6],
            V: values[7],
            W: values[8]
        };
    }

    /*========================================================================
     * Spindle & Feed Methods
     *======================================================================*/

    /**
     * @brief Get spindle speeds
     * @param {number} handle Connection handle
     * @param {number} channel Channel number (1 or 2)
     * @returns {Object} {command: number, actual: number}
     */
    getSpindleSpeed(handle, channel = 1) {
        this._checkLoaded();

        const cmdValue = new double();
        const actValue = new double();

        let cmdResult = this.library.cnc_bridge_get_spindle_cmd_speed(handle, channel, cmdValue.ref());
        let actResult = this.library.cnc_bridge_get_spindle_act_speed(handle, channel, actValue.ref());

        return {
            command: cmdResult === 0 ? cmdValue.deref() : 0,
            actual: actResult === 0 ? actValue.deref() : 0
        };
    }

    /**
     * @brief Get feed rates
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} {command: number, actual: number}
     */
    getFeedRate(handle, channel = 1) {
        this._checkLoaded();

        const cmdValue = new double();
        const actValue = new double();

        let cmdResult = this.library.cnc_bridge_get_feed_cmd_speed(handle, channel, cmdValue.ref());
        let actResult = this.library.cnc_bridge_get_feed_act_speed(handle, channel, actValue.ref());

        return {
            command: cmdResult === 0 ? cmdValue.deref() : 0,
            actual: actResult === 0 ? actValue.deref() : 0
        };
    }

    /*========================================================================
     * Production Data Methods
     *======================================================================*/

    /**
     * @brief Get cycle counts
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} {target: number, current: number}
     */
    getCycleCounts(handle, channel = 1) {
        this._checkLoaded();

        const target = new double();
        const current = new double();

        let targetResult = this.library.cnc_bridge_get_cycles_target(handle, channel, target.ref());
        let currentResult = this.library.cnc_bridge_get_cycles_current(handle, channel, current.ref());

        return {
            target: targetResult === 0 ? target.deref() : 0,
            current: currentResult === 0 ? current.deref() : 0
        };
    }

    /**
     * @brief Get workpiece count
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {number} Total workpiece count
     */
    getWorkpieceCount(handle, channel = 1) {
        this._checkLoaded();
        const value = new double();
        const result = this.library.cnc_bridge_get_workpiece_count(handle, channel, value.ref());
        return result === 0 ? value.deref() : 0;
    }

    /**
     * @brief Get process time
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {number} Process time in seconds
     */
    getProcessTime(handle, channel = 1) {
        this._checkLoaded();
        const value = new double();
        const result = this.library.cnc_bridge_get_process_time(handle, channel, value.ref());
        return result === 0 ? value.deref() : 0;
    }

    /*========================================================================
     * Program Methods
     *======================================================================*/

    /**
     * @brief Get current program file name
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {string} Current file name
     */
    getCurrentFile(handle, channel = 1) {
        this._checkLoaded();
        const buffer = Buffer.alloc(256);
        const result = this.library.cnc_bridge_get_current_file(handle, channel, buffer);
        return result === 0 ? buffer.toString('utf8').trim() : '';
    }

    /**
     * @brief Get current program line number
     * @param {number} handle Connection handle
     * @returns {number} Current line number
     */
    getCurrentLine(handle) {
        this._checkLoaded();
        const lineNum = new int32();
        const result = this.library.cnc_bridge_get_current_line(handle, lineNum.ref());
        return result === 0 ? lineNum.deref() : 0;
    }

    /**
     * @brief Get total lines in current file
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {number} Total line count
     */
    getFileTotalLines(handle, channel = 1) {
        this._checkLoaded();
        const totalLine = new int32();
        const result = this.library.cnc_bridge_get_file_total_lines(handle, channel, totalLine.ref());
        return result === 0 ? totalLine.deref() : 0;
    }

    /*========================================================================
     * System Info Methods
     *======================================================================*/

    /**
     * @brief Get library version
     * @returns {string} Version string
     */
    getVersion() {
        this._checkLoaded();
        const buffer = Buffer.alloc(64);
        this.library.cnc_bridge_get_version(buffer);
        return buffer.toString('utf8').trim();
    }

    /**
     * @brief Get controller serial number
     * @param {number} handle Connection handle
     * @returns {string} Serial number
     */
    getSerial(handle) {
        this._checkLoaded();
        const buffer = Buffer.alloc(64);
        const result = this.library.cnc_bridge_get_serial(handle, buffer);
        return result === 0 ? buffer.toString('utf8').trim() : '';
    }

    /**
     * @brief Get last error message
     * @param {number} handle Connection handle
     * @returns {string} Error message
     */
    getError(handle) {
        const buffer = Buffer.alloc(256);
        const result = this.library.cnc_bridge_get_error(handle, buffer);
        return result === 0 ? buffer.toString('utf8').trim() : 'Unknown error';
    }

    /*========================================================================
     * Helper Methods
     *======================================================================*/

    /**
     * @brief Check if library is loaded
     * @throws {Error} If not loaded
     */
    _checkLoaded() {
        if (!this.isLoaded) {
            throw new Error('CNC bridge library not loaded. Call load() first.');
        }
    }
}

// Error code constants
CNCBridge.ERRORS = {
    SUCCESS: 0,
    FAILURE: -1,
    NO_CONNECTION: -2,
    CONNECTION_ERROR: -3,
    FTP_ERROR: -4,
    MACRO_ERROR: -5,
    SEND_ERROR: -6,
    RECV_ERROR: -7,
    CHANNEL_ERROR: -8,
    BUFFER_ERROR: -9,
    FILE_ERROR: -10,
    PLC_ERROR: -11,
    AXIS_ERROR: -23,
    DATA_ERROR: -24
};

module.exports = CNCBridge;
