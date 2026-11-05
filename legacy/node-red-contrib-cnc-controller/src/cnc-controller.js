/**
 * @file cnc-controller.js
 * @brief Node-RED Custom Node for CNC Controller Data Acquisition
 *
 * This node provides a complete interface for connecting to LYNUC CNC
 * controllers and collecting real-time machine data via TCP/IP.
 *
 * Features:
 * - TCP/IP connection management with auto-reconnect
 * - Configurable data collection (status, axes, spindle, feed, program, etc.)
 * - JSON formatted output
 * - Configurable polling interval
 * - Status indicator integration
 */

'use strict';

const CNCBridge = require('../lib/cnc-bridge');
const CNCDataCollector = require('../lib/cnc-data-collector');

module.exports = function (RED) {
    // Global bridge instance (shared across nodes)
    let globalBridge = null;
    let bridgeRefCount = 0;

    /**
     * Get or create shared CNC bridge instance
     * @returns {CNCBridge}
     */
    function getSharedBridge() {
        if (!globalBridge) {
            globalBridge = new CNCBridge();
            try {
                globalBridge.load();
            } catch (err) {
                RED.log.error('CNC Controller: Failed to load bridge library: ' + err.message);
                return null;
            }
        }
        bridgeRefCount++;
        return globalBridge;
    }

    /**
     * Release shared bridge instance
     */
    function releaseSharedBridge() {
        bridgeRefCount--;
        if (bridgeRefCount <= 0 && globalBridge) {
            globalBridge.unload();
            globalBridge = null;
            bridgeRefCount = 0;
        }
    }

    /**
     * CNC Controller Node
     */
    function CNCControllerNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        // Node configuration
        node.name = config.name || 'CNC Controller';
        node.ip = config.ip || '192.168.1.100';
        node.port = parseInt(config.port) || 8080;
        node.channel = parseInt(config.channel) || 1;
        node.pollInterval = parseInt(config.pollInterval) || 1000;
        node.autoReconnect = config.autoReconnect !== false;
        node.reconnectInterval = parseInt(config.reconnectInterval) || 5000;
        node.timeout = parseInt(config.timeout) || 3000;

        // Data collection flags
        node.collectStatus = config.collectStatus !== false;
        node.collectAxes = config.collectAxes !== false;
        node.collectSpindle = config.collectSpindle !== false;
        node.collectFeed = config.collectFeed !== false;
        node.collectProgram = config.collectProgram !== false;
        node.collectAlarms = config.collectAlarms !== false;
        node.collectProduction = config.collectProduction !== false;
        node.collectTool = config.collectTool !== false;

        // Internal state
        let handle = -1;
        let collector = null;
        let pollTimer = null;
        let reconnectTimer = null;
        let isConnecting = false;

        // Node status helper
        function updateStatus(status, text, fill) {
            fill = fill || 'grey';
            if (typeof status === 'string') {
                node.status({ fill: fill, shape: 'ring', text: status });
            } else {
                node.status({ fill: fill, shape: status.shape || 'ring', text: text });
            }
        }

        /**
         * Send data to output
         * @param {Object} data Data to send
         */
        function sendData(data) {
            const msg = {
                payload: data,
                topic: node.name,
                timestamp: Date.now()
            };
            node.send(msg);
        }

        /**
         * Handle connection error
         * @param {string} error Error message
         */
        function handleError(error) {
            updateStatus('error', error, 'red');
            node.error(error);

            if (node.autoReconnect && handle <= 0) {
                scheduleReconnect();
            }
        }

        /**
         * Schedule reconnection attempt
         */
        function scheduleReconnect() {
            if (reconnectTimer) {
                return;  // Already scheduled
            }

            updateStatus('wait', `Reconnecting in ${node.reconnectInterval / 1000}s...`, 'yellow');

            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (handle <= 0) {
                    doConnect();
                }
            }, node.reconnectInterval);
        }

        /**
         * Establish connection to CNC controller
         */
        function doConnect() {
            if (isConnecting || handle > 0) {
                return;
            }

            isConnecting = true;
            updateStatus('connecting', 'Connecting...', 'blue');

            try {
                const bridge = getSharedBridge();
                if (!bridge) {
                    handleError('Failed to load CNC bridge library');
                    isConnecting = false;
                    return;
                }

                handle = bridge.connect(node.ip);
                if (handle < 0) {
                    handleError(`Connection failed: ${bridge.getError(handle)}`);
                    isConnecting = false;
                    return;
                }

                // Set timeout
                bridge.setTimeout(handle, node.timeout);

                // Create data collector
                collector = new CNCDataCollector(bridge);

                isConnecting = false;
                updateStatus('connected', 'Connected', 'green');

                // Start polling
                startPolling();

                RED.log.info(`CNC Controller: Connected to ${node.ip}:${node.port}`);

            } catch (err) {
                handleError('Connection error: ' + err.message);
                isConnecting = false;
            }
        }

        /**
         * Disconnect from controller
         */
        function doDisconnect() {
            // Stop polling
            stopPolling();

            // Clear reconnect timer
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            // Close connection
            if (handle > 0 && globalBridge) {
                globalBridge.disconnect(handle);
                RED.log.info(`CNC Controller: Disconnected from ${node.ip}:${node.port}`);
            }

            handle = -1;
            collector = null;

            releaseSharedBridge();
            updateStatus('disconnected', 'Disconnected', 'grey');
        }

        /**
         * Start data polling
         */
        function startPolling() {
            if (pollTimer) {
                return;
            }

            // Immediate first collection
            collectData();

            // Setup interval
            pollTimer = setInterval(() => {
                collectData();
            }, node.pollInterval);
        }

        /**
         * Stop data polling
         */
        function stopPolling() {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }

        /**
         * Collect and send data
         */
        function collectData() {
            if (handle <= 0 || !collector) {
                return;
            }

            try {
                // Check connection status
                if (!globalBridge.isConnected(handle)) {
                    handleError('Connection lost');
                    return;
                }

                // Collect data based on configuration
                const config = {
                    channel: node.channel,
                    machineStatus: node.collectStatus,
                    axes: node.collectAxes,
                    spindle: node.collectSpindle,
                    feedrate: node.collectFeed,
                    program: node.collectProgram,
                    alarms: node.collectAlarms,
                    production: node.collectProduction,
                    tool: node.collectTool
                };

                const data = collector.collectData(handle, config);
                sendData(data);

                updateStatus('active', `Updated: ${new Date().toLocaleTimeString()}`, 'green');

            } catch (err) {
                RED.log.error('CNC Controller: Data collection error: ' + err.message);
                // Don't update status on data errors to avoid flickering
            }
        }

        /**
         * Manual trigger - collect data on demand
         */
        function onInput(msg, send, done) {
            if (msg && msg.payload === 'status') {
                // Return connection status
                const bridge = globalBridge;
                send({
                    payload: {
                        connected: handle > 0,
                        ip: node.ip,
                        port: node.port,
                        channel: node.channel
                    }
                });
            } else if (msg && msg.payload === 'reconnect') {
                // Manual reconnection
                doDisconnect();
                doConnect();
            } else if (msg && msg.payload === 'disconnect') {
                // Manual disconnection
                doDisconnect();
            } else {
                // Default: collect data immediately
                if (handle > 0 && collector) {
                    collectData();
                } else {
                    send({ payload: { error: 'Not connected' } });
                }
            }

            if (done) done();
        }

        /**
         * Cleanup on node removal
         */
        function onClose(done) {
            doDisconnect();
            if (done) done();
        }

        // Initialize
        node.status({ fill: 'grey', shape: 'ring', text: 'Initializing...' });

        // Setup event handlers
        node.on('input', onInput);
        node.on('close', onClose);

        // Initial connection (with small delay to allow UI to render)
        setTimeout(() => {
            doConnect();
        }, 100);
    }

    // Register node
    RED.nodes.registerType('cnc-controller', CNCControllerNode);

    // Register credentials type (if needed for password/auth)
    RED.httpAdmin.get('/cnc-controller/:id/status', RED.auth.needsPermission('cnc-controller.read'), function (req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node) {
            res.json({
                connected: node.handle > 0,
                ip: node.ip,
                port: node.port
            });
        } else {
            res.status(404).json({ error: 'Node not found' });
        }
    });
};
