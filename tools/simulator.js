#!/usr/bin/env node
'use strict';

/**
 * LYNUC 控制器模拟器，用于无机床时的开发、测试和演示。
 *
 *   node tools/simulator.js [port] [--ftp]
 *
 * 响应格式取自厂商客户端的解析逻辑（docs/PROTOCOL.md）。它能证明客户端的行为，
 * 不能证明真实控制器的行为。
 */

const net = require('net');

// 命令码 -> 帧长。未列出的为 128。
const FRAME_SIZES = {
  '0030': 256,
  '0051': 1024,
  '0066': 1024,
  '0069': 1024,
  '0081': 1024,
  '0093': 1024,
};
// 0030 的请求 256 字节，响应却按 1024 接收。
const REPLY_SIZES = { '0030': 1024 };

function defaultMacros() {
  const macros = new Map([
    [2041, 0], [2097, 3600000], [2101, 0], [2110, 20261105], [2111, 123000],
    [8006, 3], [30037, 480.5],
    [33503, 100], [33504, 12], [33505, 3000], [33506, 2985], [33512, 4],
    [33518, 100], [33554, 100], [33555, 50],
    [33558, 3], [33559, 120.5], [33560, 3], [33561, 5],
    [33563, 500], [33564, 45000], [33565, 38000], [33868, 1800000],
    [33869, 12], [33870, 1520], [33871, 100],
  ]);
  ['X', 'Y', 'Z'].forEach((_, axis) => {
    const base = 30100 + axis * 50;
    macros.set(base + 18, 100.5 + axis);
    macros.set(base + 19, 10.5 + axis);
    macros.set(base + 21, 500.5 + axis);
    macros.set(base + 22, 1.25 + axis);
    macros.set(base + 30, 200 + axis);
    macros.set(base + 32, 30 + axis);
  });
  // 3 号刀的磨损数据
  macros.set(10801 + 2, 120.5);
  macros.set(10701 + 2, 5);
  macros.set(11401 + 2, 42);
  macros.set(11501 + 2, 7200000);
  macros.set(11601 + 2, 9800);
  return macros;
}

function defaultPlc() {
  return new Map([
    ['200.6', 0], ['200.8', 1], ['200.12', 1],
    ['203.11', 0], ['203.13', 0], ['203.14', 0],
    ['204.0.3', 3],
    ['205.0', 0], ['205.20.24', 2],
    ['206.0', 1], ['206.1', 0], ['206.2', 0], ['206.3', 1],
  ]);
}

class Simulator {
  /**
   * @param {object} [options]
   * @param {number} [options.port] 0 表示随机端口
   * @param {boolean} [options.echo] 数值响应带 `(请求)` 回显
   * @param {boolean} [options.pad] 响应补 NUL 到接收长度
   */
  constructor({ port = 4011, host = '127.0.0.1', echo = true, pad = true } = {}) {
    Object.assign(this, { port, host, echo, pad });
    this.macros = defaultMacros();
    this.plc = defaultPlc();
    this.alarmText = '';
    this.fileName = 'O1234.NC';
    this.filePath = 'NC1/O1234.NC';
    this.totalLines = 2000;
    this.mainLine = 1250;
    this.version = '2.6.2.0';
    this.serial = 'SIM-0001';
    this.mac = '00:11:22:33:44:55';
    /** 收到的全部请求帧，供断言。 */
    this.frames = [];
    /** 故障注入：'silent' 不回复，'garbage' 回垃圾，'drop' 断开连接，'wrong-echo' 回显错误。 */
    this.fault = null;
    /** 把响应拆成两段发出：{ at: 切分偏移, delay: 间隔 ms }，null 表示不拆。 */
    this.split = null;
    this._sockets = new Set();
    this._server = net.createServer((socket) => this._accept(socket));
  }

  start() {
    return new Promise((resolve, reject) => {
      this._server.once('error', reject);
      this._server.listen(this.port, this.host, () => {
        this.port = this._server.address().port;
        resolve(this.port);
      });
    });
  }

  stop() {
    this._sockets.forEach((socket) => socket.destroy());
    return new Promise((resolve) => this._server.close(() => resolve()));
  }

  /** 断开现有连接但继续监听，模拟网络闪断。 */
  dropClients() {
    this._sockets.forEach((socket) => socket.destroy());
  }

  /** 仿真加工推进一步，演示用。 */
  advance() {
    this.mainLine = this.mainLine >= this.totalLines ? 1 : this.mainLine + 7;
    if (this.mainLine === 1) {
      this.macros.set(33869, this.macros.get(33869) + 1);
      this.macros.set(33870, this.macros.get(33870) + 1);
    }
    const jitter = (value, range) => Math.round((value + (Math.random() - 0.5) * range) * 1000) / 1000;
    this.macros.set(30118, jitter(100, 20));
    this.macros.set(30168, jitter(50, 20));
    this.macros.set(30218, jitter(-10, 2));
    this.macros.set(33506, jitter(3000, 30));
    this.macros.set(30037, jitter(500, 25));
    this.macros.set(33868, this.macros.get(33868) + 1000);
    this.macros.set(2097, this.macros.get(2097) + 1000);
  }

  _accept(socket) {
    this._sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => this._sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const size = FRAME_SIZES[buffer.subarray(0, 4).toString('latin1')] || 128;
        if (buffer.length < size) {
          return;
        }
        const frame = buffer.subarray(0, size);
        buffer = buffer.subarray(size);
        this.frames.push(Buffer.from(frame));
        this._respond(socket, frame);
      }
    });
  }

  _respond(socket, frame) {
    if (this.fault === 'silent') {
      return;
    }
    if (this.fault === 'drop') {
      socket.destroy();
      return;
    }
    const end = frame.indexOf(0);
    const request = frame.subarray(0, end < 0 ? frame.length : end).toString('latin1');
    const code = request.slice(0, 4);
    const size = REPLY_SIZES[code] || frame.length;
    if (this.fault === 'garbage') {
      this._send(socket, Buffer.from('\xde\xad\xbe\xefnot-a-frame', 'latin1'), size);
      return;
    }
    this._send(socket, this._reply(code, request.slice(4), request), size);
  }

  _number(replyCode, value, request) {
    const echo = this.fault === 'wrong-echo' ? '0007999' : request;
    return Buffer.from(`${replyCode}${value}${this.echo ? `(${echo})` : ''}`, 'utf8');
  }

  _string(replyCode, value) {
    return Buffer.concat([Buffer.from(replyCode, 'latin1'), Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')]);
  }

  _reply(code, args, request) {
    switch (code) {
      case '0000':
        return this._string('0001', '');
      case '0007': {
        const value = this.macros.has(Number(args)) ? this.macros.get(Number(args)) : 0;
        return this._number('0008', value, request);
      }
      case '0105': {
        const value = this.macros.has(Number(args)) ? this.macros.get(Number(args)) : 0;
        return this._number('0106', value, request);
      }
      case '0060': {
        const address = args.slice(0, args.lastIndexOf('-'));
        return this._number('0061', this.plc.has(address) ? this.plc.get(address) : 0, request);
      }
      case '0081':
        return this._string('0082', this.fileName);
      case '0030':
        return this._string('0031', this.filePath);
      case '0093':
        return this._string('0094', String(this.totalLines));
      case '0123':
        return this._string('0124', String(this.mainLine));
      case '0045':
        return this._string('0046', this.version);
      case '0066':
        return this._string('0067', this.serial);
      case '0069':
        return this._string('0070', this.mac);
      case '0051':
        return this.alarmText ? this._string('0052', this.alarmText) : this._string('0050', '');
      default:
        return this._string('9999', 'unsupported');
    }
  }

  _send(socket, body, size) {
    const data = this.pad ? Buffer.concat([body, Buffer.alloc(Math.max(0, size - body.length))]) : body;
    if (this.split === null) {
      socket.write(data);
      return;
    }
    const { at, delay } = this.split;
    socket.write(data.subarray(0, at));
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.write(data.subarray(at));
      }
    }, delay);
  }
}

/** 厂商库 remote_new_connect 同时要求的匿名 FTP 握手，仅一致性测试用。 */
function startFtpStub(port = 21, host = '127.0.0.1') {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 sim ready\r\n');
    socket.on('data', (chunk) => {
      const line = chunk.toString('latin1');
      if (line.startsWith('USER')) {
        socket.write('331 password required\r\n');
      } else if (line.startsWith('PASS')) {
        socket.write('230 logged in\r\n');
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        stop: () => {
          sockets.forEach((socket) => socket.destroy());
          return new Promise((done) => server.close(() => done()));
        },
      });
    });
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = Number(args.find((arg) => /^\d+$/.test(arg))) || 4011;
  const simulator = new Simulator({ port, host: '0.0.0.0' });
  simulator.start().then(async (listening) => {
    if (args.includes('--ftp')) {
      await startFtpStub(21, '0.0.0.0');
    }
    console.log(`LYNUC 模拟器运行中，端口 ${listening}`);
    setInterval(() => simulator.advance(), 1000);
  }).catch((error) => {
    console.error(`启动失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { Simulator, startFtpStub };
