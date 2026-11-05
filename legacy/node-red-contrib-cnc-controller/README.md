# node-red-contrib-cnc-controller

Node-RED custom node for LYNUC CNC controller data acquisition via TCP/IP.

## Features

- **TCP/IP Connection**: Connect to LYNUC CNC controllers over the network
- **Comprehensive Data Collection**:
  - Machine status (mode, state, emergency stop, etc.)
  - Axis positions (absolute, relative, machine coordinates)
  - Spindle data (speed, load, state)
  - Feed rate (command, actual, override)
  - Program information (file name, line, progress)
  - Alarm status
  - Production data (cycle count, workpiece count, process time)
  - Tool information
- **JSON Output**: Standardized JSON format for easy integration
- **Configurable Polling**: Adjustable data collection interval
- **Auto-Reconnect**: Automatic reconnection on connection loss
- **Manual Control**: Trigger data collection or connection via input messages

## Requirements

- Node-RED >= 2.0
- Node.js >= 16
- **Ubuntu 24.02 x64** with 32-bit compatibility libraries (for libRemoteComm.so)
- LYNUC CNC controller with RemoteEnv 2.6.2.0 or later

### 32-bit Compatibility

The official `libRemoteComm.so` library is 32-bit only. On 64-bit Ubuntu:

```bash
# Enable 32-bit architecture
sudo dpkg --add-architecture i386

# Update and install 32-bit libraries
sudo apt-get update
sudo apt-get install lib32z1 lib32stdc++6 libc6:i386

# For FFI support
sudo apt-get install libffi-dev:amd64
```

## Installation

### From NPM (recommended)

```bash
cd ~/.node-red
npm install node-red-contrib-cnc-controller
```

### From Source

```bash
cd ~/.node-red
git clone https://github.com/your-org/node-red-contrib-cnc-controller.git
cd node-red-contrib-cnc-controller
npm install
```

### Build C Bridge Library

```bash
# Install build tools
sudo apt-get install build-essential gcc-multilib g++-multilib

# Build for 32-bit
cd src
gcc -m32 -shared -fPIC -o ../lib/libcnc_bridge.so cnc_bridge.c -lRemoteComm -lpthread -ldl

# Or for testing without hardware, copy the mock version
cp ../lib/cnc-mock.js ../lib/cnc-bridge.js
```

## Usage

### Basic Flow

1. Drag the **CNC Controller** node from the IIoT category to your flow
2. Configure the node with your controller IP and port
3. Connect the output to debug node or other processing nodes
4. Deploy the flow

### Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| IP Address | CNC controller IP | 192.168.1.100 |
| Port | TCP port | 8080 |
| Channel | NC channel (1 or 2) | 1 |
| Interval | Data polling interval (ms) | 1000 |
| Timeout | Socket timeout (ms) | 3000 |
| Auto-reconnect | Enable auto-reconnect | Enabled |
| Reconnect Interval | Reconnect delay (ms) | 5000 |

### Data Collection Options

Enable/disable specific data collection:

- Machine Status
- Axis Positions
- Spindle Data
- Feed Rate
- Program Info
- Alarm Status
- Production Data
- Tool Info

### Input Messages

Send messages to control the node:

```javascript
// Trigger immediate data collection
msg = { payload: 'status' };

// Force reconnection
msg = { payload: 'reconnect' };

// Disconnect
msg = { payload: 'disconnect' };
```

### Output Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "data": {
    "machineStatus": {
      "mode": "AUTO",
      "state": "RUNNING",
      "ready": true,
      "emergencyStop": false
    },
    "axes": {
      "X": { "absolute": 100.5, "relative": 10.5, "machine": 500.5, "unit": "mm" },
      "Y": { "absolute": 200.3, "relative": 20.3, "machine": 300.3, "unit": "mm" },
      "Z": { "absolute": 50.2, "relative": 5.2, "machine": 150.2, "unit": "mm" }
    },
    "spindle": {
      "command": 3000,
      "actual": 2985,
      "load": 45.5,
      "state": "FORWARD",
      "unit": "rpm"
    },
    "feedrate": {
      "command": 500,
      "actual": 495,
      "override": 100,
      "unit": "mm/min"
    },
    "program": {
      "name": "O1234.nc",
      "currentLine": 1250,
      "totalLines": 1908,
      "progress": "65.5"
    },
    "alarms": {
      "hasAlarm": false,
      "level": "NONE"
    },
    "production": {
      "targetCycles": 100,
      "currentCycles": 10,
      "workpieceCount": 10,
      "processTime": 1200
    },
    "tool": {
      "currentTool": 1,
      "lifeRemaining": 95
    }
  }
}
```

### Example Flow

```json
[
    {
        "id": "cnc1",
        "type": "cnc-controller",
        "name": "CNC #1",
        "ip": "192.168.1.100",
        "port": "8080",
        "channel": "1",
        "pollInterval": "1000",
        "outputs": "debug1"
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Debug",
        "active": true,
        "console": "false",
        "complete": "payload"
    }
]
```

## Integration with MQTT

For IIoT platform integration:

1. Add **mqtt out** node after CNC controller
2. Configure MQTT broker connection
3. Set topic: `cnc/{deviceId}/status`
4. Configure QoS and retain as needed

## Testing Without Hardware

Use the mock bridge for development:

```javascript
// lib/cnc-bridge.js - replace with mock
const { createMockBridge } = require('./cnc-mock');
module.exports = createMockBridge();
```

## Troubleshooting

### Connection Failed

1. Verify controller IP is reachable: `ping 192.168.1.100`
2. Check RemoteEnv is installed on controller
3. Verify port 8080 is not blocked by firewall
4. Ensure correct network configuration

### FFI Errors

```
Error: Cannot load library
```

Solution:
```bash
# Install 32-bit support
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install libc6:i386 libstdc++6:i386 zlib1g:i386
```

### No Data

1. Check node status in editor
2. Verify data collection options are enabled
3. Check controller is in valid state (not in emergency stop)
4. Review debug output for specific errors

## Architecture

```
┌─────────────────┐
│   CNC Controller│
│  (TCP/IP Server)│
└────────┬────────┘
         │ TCP/IP Socket
         │
┌────────▼────────┐
│   libcnc_bridge │  ← C wrapper (handles 32-bit libRemoteComm.so)
└────────┬────────┘
         │ FFI (ffi-napi)
         │
┌────────▼────────┐
│  cnc-bridge.js  │  ← Node.js FFI bindings
└────────┬────────┘
         │
┌────────▼────────┐
│cnc-data-collector│ ← Data aggregation & formatting
└────────┬────────┘
         │
┌────────▼────────┐
│  cnc-controller │  ← Node-RED node
└────────┬────────┘
         │ JSON
         │
┌────────▼────────┐
│  MQTT/HTTP/etc  │  → IIoT Platform
└─────────────────┘
```

## License

MIT License

## Support

For issues related to:
- This node: Open GitHub issue
- LYNUC controller: Contact LYNUC technical support
- RemoteEnv: Refer to controller documentation
