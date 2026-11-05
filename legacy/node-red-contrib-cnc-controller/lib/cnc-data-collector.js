/**
 * @file cnc-data-collector.js
 * @brief CNC Controller Data Collector
 *
 * High-level data collection module that combines multiple low-level
 * API calls into comprehensive data objects matching the PRD specification.
 */

'use strict';

const CNCBridge = require('./cnc-bridge');

/**
 * @class CNCDataCollector
 * @brief Collects and formats CNC controller data
 */
class CNCDataCollector {
    /**
     * @brief Create a new data collector
     * @param {CNCBridge} bridge Initialized CNC bridge instance
     */
    constructor(bridge) {
        if (!bridge || !bridge.loaded()) {
            throw new Error('CNC bridge must be loaded before creating collector');
        }
        this.bridge = bridge;
    }

    /*========================================================================
     * Machine Status (PLC-based)
     *======================================================================*/

    /**
     * @brief Get machine status from PLC variables
     * @param {number} handle Connection handle
     * @returns {Object} Machine status
     */
    getMachineStatus(handle) {
        const status = {
            mode: 'UNKNOWN',
            state: 'UNKNOWN',
            ready: false,
            emergencyStop: false,
            powerOn: false,
            singleBlock: false,
            feedHold: false,
            runStatus: 'IDLE'
        };

        try {
            // Read PLC variables
            const modeVal = this.bridge.readPLCMO(handle, 'MOU205.20.24');  // Mode
            const running = this.bridge.readPLCMO(handle, 'MO206.0');       // Running
            const holding = this.bridge.readPLCMO(handle, 'MO206.1');       // Holding
            const stopped = this.bridge.readPLCMO(handle, 'MO206.2');       // Stopped
            const ready = this.bridge.readPLCMO(handle, 'MO206.3');         // Ready
            const emgStop = this.bridge.readPLCMO(handle, 'MO200.6');       // Emergency Stop
            const powerOn = this.bridge.readPLCMO(handle, 'MO200.8');       // Power On
            const single = this.bridge.readPLCMO(handle, 'MO205.0');        // Single Block
            const feedHold = this.bridge.readPLCMO(handle, 'MO204.5');      // Feed Hold

            // Mode decoding (3-bit value)
            const modeMap = {
                0: 'EDIT',
                1: 'HANDLE',
                2: 'MDI',
                3: 'AUTO',
                4: 'JOG',
                5: 'HOME'
            };
            status.mode = modeMap[modeVal & 0x7] || 'UNKNOWN';

            // State decoding
            status.ready = ready === 1;
            status.emergencyStop = emgStop === 1;
            status.powerOn = powerOn === 1;
            status.singleBlock = single === 1;
            status.feedHold = feedHold === 1;

            // Run state
            if (emgStop === 1) {
                status.runStatus = 'EMERGENCY';
            } else if (holding === 1) {
                status.runStatus = 'HOLDING';
            } else if (stopped === 1) {
                status.runStatus = 'STOPPED';
            } else if (running === 1) {
                status.runStatus = 'RUNNING';
            } else {
                status.runStatus = 'IDLE';
            }

            status.state = status.runStatus;

        } catch (err) {
            status.error = err.message;
        }

        return status;
    }

    /*========================================================================
     * Axes Data
     *======================================================================*/

    /**
     * @brief Get all axis data
     * @param {number} handle Connection handle
     * @returns {Object} Axis data with positions, types, and units
     */
    getAxesData(handle) {
        const axes = {
            unit: 'mm',
            axes: {}
        };

        try {
            // Get coordinates (using bitmask for X, Y, Z)
            const coordMask = 0x07;  // X=1, Y=2, Z=4

            const absCoord = this.bridge.getAbsCoord(handle, coordMask);
            const relCoord = this.bridge.getRelCoord(handle, coordMask);
            const machCoord = this.bridge.getMachineCoord(handle, coordMask);

            const axisNames = ['X', 'Y', 'Z'];
            const positions = [absCoord.X, absCoord.Y, absCoord.Z];

            for (let i = 0; i < axisNames.length; i++) {
                const name = axisNames[i];
                axes.axes[name] = {
                    absolute: positions[i],
                    relative: [relCoord.X, relCoord.Y, relCoord.Z][i],
                    machine: [machCoord.X, machCoord.Y, machCoord.Z][i],
                    unit: 'mm'
                };
            }
        } catch (err) {
            axes.error = err.message;
        }

        return axes;
    }

    /*========================================================================
     * Spindle Data
     *======================================================================*/

    /**
     * @brief Get spindle data
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} Spindle data
     */
    getSpindleData(handle, channel = 1) {
        const spindle = {
            unit: 'rpm',
            state: 'STOPPED',
            load: 0
        };

        try {
            const speeds = this.bridge.getSpindleSpeed(handle, channel);
            spindle.command = speeds.command;
            spindle.actual = speeds.actual;

            // Read spindle state from PLC
            const spState = this.bridge.readPLCMO(handle, 'MOU204.0.3');
            const stateMap = {
                2: 'STOPPED',
                3: 'FORWARD',
                4: 'REVERSE'
            };
            spindle.state = stateMap[spState] || 'UNKNOWN';

            // Load can be estimated from macro variable or calculated
            try {
                spindle.load = this.bridge.readMacro(handle, 4120);  // Spindle load macro
            } catch (e) {
                // Not available
            }
        } catch (err) {
            spindle.error = err.message;
        }

        return spindle;
    }

    /*========================================================================
     * Feed Rate Data
     *======================================================================*/

    /**
     * @brief Get feed rate data
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} Feed rate data
     */
    getFeedData(handle, channel = 1) {
        const feed = {
            unit: 'mm/min',
            override: 100
        };

        try {
            const rates = this.bridge.getFeedRate(handle, channel);
            feed.command = rates.command;
            feed.actual = rates.actual;

            // Read feed override from PLC
            const ovrd = this.bridge.readPLCMO(handle, 'MOU201.16.20');
            feed.override = ovrd > 0 ? ovrd : 100;
        } catch (err) {
            feed.error = err.message;
        }

        return feed;
    }

    /*========================================================================
     * Program Data
     *======================================================================*/

    /**
     * @brief Get program execution data
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} Program data
     */
    getProgramData(handle, channel = 1) {
        const program = {};

        try {
            program.name = this.bridge.getCurrentFile(handle, channel);
            program.currentLine = this.bridge.getCurrentLine(handle);
            program.totalLines = this.bridge.getFileTotalLines(handle, channel);

            if (program.totalLines > 0) {
                program.progress = ((program.currentLine / program.totalLines) * 100).toFixed(1);
            } else {
                program.progress = 0;
            }
        } catch (err) {
            program.error = err.message;
        }

        return program;
    }

    /*========================================================================
     * Production Data
     *======================================================================*/

    /**
     * @brief Get production statistics
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} Production data
     */
    getProductionData(handle, channel = 1) {
        const production = {};

        try {
            const cycles = this.bridge.getCycleCounts(handle, channel);
            production.targetCycles = cycles.target;
            production.currentCycles = cycles.current;
            production.completed = Math.floor(cycles.current);
            production.target = Math.floor(cycles.target > 0 ? cycles.target : 0);

            production.workpieceCount = this.bridge.getWorkpieceCount(handle, channel);
            production.processTime = this.bridge.getProcessTime(handle, channel);

            // Calculate cycle time if we have multiple completions
            if (production.completed > 1 && production.processTime > 0) {
                production.avgCycleTime = (production.processTime / production.completed).toFixed(1);
            }
        } catch (err) {
            production.error = err.message;
        }

        return production;
    }

    /*========================================================================
     * Alarms
     *======================================================================*/

    /**
     * @brief Get alarm status (simplified - full alarm list requires FTP)
     * @param {number} handle Connection handle
     * @returns {Object} Alarm status
     */
    getAlarmData(handle) {
        const alarms = {
            hasAlarm: false,
            level: 'NONE',
            codes: [],
            messages: []
        };

        try {
            // Check PLC alarm flags
            const fatalErr = this.bridge.readPLCMO(handle, 'MO203.11');
            const ciErr = this.bridge.readPLCMO(handle, 'MO203.13');
            const warning = this.bridge.readPLCMO(handle, 'MO203.14');

            if (fatalErr === 1) {
                alarms.hasAlarm = true;
                alarms.level = 'FATAL';
                alarms.codes.push({ code: 'FATAL_ERR', level: 'FATAL' });
            } else if (ciErr === 1) {
                alarms.hasAlarm = true;
                alarms.level = 'ERROR';
                alarms.codes.push({ code: 'CI_ERR', level: 'ERROR' });
            } else if (warning === 1) {
                alarms.hasAlarm = true;
                alarms.level = 'WARNING';
                alarms.codes.push({ code: 'WARN', level: 'WARNING' });
            }
        } catch (err) {
            alarms.error = err.message;
        }

        return alarms;
    }

    /*========================================================================
     * Tool Data
     *======================================================================*/

    /**
     * @brief Get tool information
     * @param {number} handle Connection handle
     * @returns {Object} Tool data
     */
    getToolData(handle) {
        const tool = {
            currentTool: 0,
            lifeRemaining: 100
        };

        try {
            // Read current tool from macro variable
            tool.currentTool = Math.floor(this.bridge.readMacro(handle, 4121));

            // Read tool life from macro (if available)
            try {
                const life = this.bridge.readMacro(handle, 4122);
                tool.lifeRemaining = life > 0 ? Math.min(100, life) : 100;
            } catch (e) {
                // Not available
            }
        } catch (err) {
            tool.error = err.message;
        }

        return tool;
    }

    /*========================================================================
     * Full Status Collection
     *======================================================================*/

    /**
     * @brief Collect all machine data into unified format
     * @param {number} handle Connection handle
     * @param {number} channel Channel number
     * @returns {Object} Complete machine status object
     */
    collectFullStatus(handle, channel = 1) {
        const timestamp = new Date().toISOString();

        return {
            timestamp: timestamp,
            data: {
                machineStatus: this.getMachineStatus(handle),
                axes: this.getAxesData(handle).axes,
                spindle: this.getSpindleData(handle, channel),
                feedrate: this.getFeedData(handle, channel),
                program: this.getProgramData(handle, channel),
                alarms: this.getAlarmData(handle),
                production: this.getProductionData(handle, channel),
                tool: this.getToolData(handle)
            }
        };
    }

    /**
     * @brief Collect data based on configured fields
     * @param {number} handle Connection handle
     * @param {Object} config Data collection configuration
     * @returns {Object} Collected data
     */
    collectData(handle, config) {
        const result = {
            timestamp: new Date().toISOString(),
            data: {}
        };

        const channel = config.channel || 1;

        if (config.machineStatus !== false) {
            result.data.machineStatus = this.getMachineStatus(handle);
        }
        if (config.axes !== false) {
            const axesData = this.getAxesData(handle);
            result.data.axes = axesData.axes;
        }
        if (config.spindle !== false) {
            result.data.spindle = this.getSpindleData(handle, channel);
        }
        if (config.feedrate !== false) {
            result.data.feedrate = this.getFeedData(handle, channel);
        }
        if (config.program !== false) {
            result.data.program = this.getProgramData(handle, channel);
        }
        if (config.alarms !== false) {
            result.data.alarms = this.getAlarmData(handle);
        }
        if (config.production !== false) {
            result.data.production = this.getProductionData(handle, channel);
        }
        if (config.tool !== false) {
            result.data.tool = this.getToolData(handle);
        }

        return result;
    }
}

module.exports = CNCDataCollector;
