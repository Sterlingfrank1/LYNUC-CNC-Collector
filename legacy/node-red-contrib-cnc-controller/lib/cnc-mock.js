/**
 * @file cnc-mock.js
 * @brief Mock CNC Bridge for Testing Without Hardware
 *
 * This module provides a mock implementation of the CNC bridge
 * for development and testing purposes when the actual controller
 * is not available.
 */

'use strict';

/**
 * @class MockCNCBridge
 * @brief Mock implementation for testing without hardware
 */
class MockCNCBridge {
    constructor() {
        this.isLoaded = true;
        this.connected = false;
        this.handleCounter = 1;
        this.ip = '';
    }

    load() {
        this.isLoaded = true;
        return 0;
    }

    unload() {
        this.isLoaded = false;
        this.connected = false;
    }

    loaded() {
        return this.isLoaded;
    }

    connect(ip) {
        this.ip = ip;
        this.connected = true;
        this.handleCounter++;
        return this.handleCounter - 1;
    }

    disconnect(handle) {
        this.connected = false;
    }

    isConnected(handle) {
        return this.connected ? 1 : 0;
    }

    setTimeout(handle, timeout) {
        return true;
    }

    readMacro(handle, macroNum) {
        // Return simulated macro values
        const macros = {
            4120: 45.5,   // Spindle load
            4121: 1,      // Current tool
            4122: 95.0,   // Tool life
            5001: 123.456 // Test macro
        };
        return macros[macroNum] || 0;
    }

    writeMacro(handle, macroNum, value) {
        return true;
    }

    readPLCMO(handle, address) {
        // Simulated PLC values for testing
        const moValues = {
            'MOU205.20.24': 3,   // Mode: AUTO
            'MO206.0': 1,        // Running
            'MO206.1': 0,        // Not holding
            'MO206.2': 0,        // Not stopped
            'MO206.3': 1,        // Ready
            'MO200.6': 0,        // No emergency stop
            'MO200.8': 1,        // Power on
            'MO205.0': 0,        // Not single block
            'MO204.5': 0,        // Not feed hold
            'MOU204.0.3': 3,     // Spindle forward
            'MOU201.16.20': 100, // Feed override 100%
            'MO203.11': 0,       // No fatal error
            'MO203.13': 0,       // No CI error
            'MO203.14': 0        // No warning
        };
        return moValues[address] || 0;
    }

    readPLCMI(handle, address) {
        return 0;
    }

    getAbsCoord(handle, coordMask) {
        // Simulated absolute coordinates
        return {
            X: 100.5 + Math.random() * 0.1,
            Y: 200.3 + Math.random() * 0.1,
            Z: 50.2 + Math.random() * 0.1,
            A: 0,
            B: 0,
            C: 0,
            U: 0,
            V: 0,
            W: 0
        };
    }

    getRelCoord(handle, coordMask) {
        return {
            X: 10.5,
            Y: 20.3,
            Z: 5.2,
            A: 0,
            B: 0,
            C: 0,
            U: 0,
            V: 0,
            W: 0
        };
    }

    getMachineCoord(handle, coordMask) {
        return {
            X: 500.5,
            Y: 300.3,
            Z: 150.2,
            A: 0,
            B: 0,
            C: 0,
            U: 0,
            V: 0,
            W: 0
        };
    }

    getSpindleSpeed(handle, channel) {
        return {
            command: 3000 + Math.floor(Math.random() * 50),
            actual: 2985 + Math.floor(Math.random() * 30)
        };
    }

    getFeedRate(handle, channel) {
        return {
            command: 500,
            actual: 495 + Math.floor(Math.random() * 10)
        };
    }

    getCycleCounts(handle, channel) {
        return {
            target: 100,
            current: 10 + Math.floor(Math.random() * 2)
        };
    }

    getWorkpieceCount(handle, channel) {
        return 10 + Math.floor(Math.random() * 2);
    }

    getProcessTime(handle, channel) {
        return 1200 + Math.floor(Math.random() * 60);
    }

    getCurrentFile(handle, channel) {
        return 'O1234.nc';
    }

    getCurrentLine(handle) {
        return 1250 + Math.floor(Math.random() * 10);
    }

    getFileTotalLines(handle, channel) {
        return 1908;
    }

    getVersion() {
        return '2.6.2.1-mock';
    }

    getSerial(handle) {
        return 'LYNUC-MOCK-12345';
    }

    getError(handle) {
        return '';
    }
}

/**
 * Create a mock bridge instance
 * @returns {MockCNCBridge}
 */
function createMockBridge() {
    return new MockCNCBridge();
}

module.exports = {
    MockCNCBridge: MockCNCBridge,
    createMockBridge: createMockBridge
};
