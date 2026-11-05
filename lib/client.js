'use strict';

/**
 * LYNUC RemoteComm 协议客户端。协议规格及其证据见 docs/PROTOCOL.md。
 *
 * 只包含读取命令：COMMANDS 之外没有任何发送途径，采集器无法改动机床状态。
 */

const net = require('net');
const { EventEmitter } = require('events');

const DATA_PORT = 4011;
const HEARTBEAT = '0000';
const FRAME = 128;
const LONG_FRAME = 1024;
// 响应既没有 NUL 结尾也没收满时，静默这么久就视为收完。
const SETTLE_MS = 5;

class LynucError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LynucError';
    this.code = code;
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
const gb18030 = new TextDecoder('gb18030');

function decode(bytes) {
  try {
    return utf8.decode(bytes);
  } catch (_) {
    return gb18030.decode(bytes);
  }
}

function text(body) {
  return body;
}

/** 数值响应可带 `(原请求)` 回显，用来确认响应对应的是这次请求。 */
function number(body, request) {
  const open = body.indexOf('(');
  const close = body.indexOf(')', open);
  let value = body;
  if (open >= 0 && close > open) {
    const echo = body.slice(open + 1, close);
    if (echo !== request) {
      throw new LynucError('ECHO_MISMATCH', `回显 ${echo} 与请求 ${request} 不一致`);
    }
    value = body.slice(0, open);
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new LynucError('BAD_VALUE', `无法解析数值: ${JSON.stringify(value)}`);
  }
  return parsed;
}

/** 解析 `【1204】信息_L2-【1011】信息_L1`。 */
function parseAlarms(body) {
  const alarms = [];
  const pattern = /【(\d+)】(.*?)_L(\d+)(?=-【|$)/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    alarms.push({ code: Number(match[1]), message: match[2], level: Number(match[3]) });
  }
  return alarms;
}

function plcRequest(point) {
  if (!/^[0-9.]+.$/.test(point.addr)) {
    throw new LynucError('BAD_ADDRESS', `PLC 地址须形如 206.0 或 205.20.24: ${point.addr}`);
  }
  return `0060${point.addr}-${point.type === undefined ? 1 : point.type}`;
}

const COMMANDS = {
  macro: { request: (p) => `0007${p.id}`, reply: 8, parse: number },
  macroAlt: { request: (p) => `0105${p.id}`, reply: 106, parse: number },
  plc: { request: plcRequest, reply: 61, parse: number },
  si: {
    request: (p) => `0084${p.addr}-${p.type}-${p.bitStart}-${p.bitSize}`,
    size: LONG_FRAME,
    reply: 85,
    parse: number,
  },
  fileName: { request: (p) => `0081${p.channel}`, size: LONG_FRAME, reply: 82, parse: text },
  filePath: { request: () => '0030', size: 256, recvSize: LONG_FRAME, reply: 31, parse: text },
  totalLines: { request: (p) => `0093${p.channel}`, size: LONG_FRAME, reply: 94, parse: number },
  mainLine: { request: () => '0123', reply: 124, parse: number },
  feedActual: { request: () => '0108', reply: 109, parse: number },
  version: { request: () => '0045', reply: 46, parse: text },
  serial: { request: () => '0066', size: LONG_FRAME, reply: 67, parse: text },
  mac: { request: () => '0069', size: LONG_FRAME, reply: 70, parse: text },
  // 厂商库约定：响应码不是 52 表示当前无错误。
  alarms: { request: () => '0051', size: LONG_FRAME, reply: 52, parse: parseAlarms, otherwise: [] },
};

class LynucClient extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.host 控制器 IP
   * @param {number} [options.port]
   * @param {number} [options.connectTimeout] ms
   * @param {number} [options.requestTimeout] ms
   * @param {number} [options.heartbeatMs] 空闲多久发一次心跳，厂商库为 50 ms
   */
  constructor({ host, port = DATA_PORT, connectTimeout = 3000, requestTimeout = 1000, heartbeatMs = 50 }) {
    super();
    this.host = host;
    this.port = port;
    this.connectTimeout = connectTimeout;
    this.requestTimeout = requestTimeout;
    this.heartbeatMs = heartbeatMs;
    this.connected = false;
    this._socket = null;
    this._queue = Promise.resolve();
    this._queued = 0;
    this._pending = null;
    this._rx = Buffer.alloc(0);
    // 见过 NUL 结尾的响应后就知道服务端补零，此后只认 NUL，不再猜测收完。
    this._terminated = false;
    this._lastActivity = 0;
    this._heartbeat = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const fail = (error) => {
        clearTimeout(timer);
        socket.destroy();
        reject(error);
      };
      const timer = setTimeout(() => {
        fail(new LynucError('CONNECT_TIMEOUT', `连接 ${this.host}:${this.port} 超时`));
      }, this.connectTimeout);
      socket.once('error', fail);
      socket.once('connect', () => {
        clearTimeout(timer);
        socket.removeListener('error', fail);
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 10000);
        socket.on('data', (chunk) => this._onData(chunk));
        // close 事件紧随其后，由它统一收尾。
        socket.on('error', () => {});
        socket.once('close', () => this._onClose());
        this._socket = socket;
        this.connected = true;
        this._lastActivity = Date.now();
        this._startHeartbeat();
        resolve();
      });
    });
  }

  close() {
    if (this._socket) {
      this._socket.destroy();
    }
  }

  /** 读一个点位。point.src 为 COMMANDS 的键。 */
  async read(point) {
    const command = COMMANDS[point.src];
    if (!command) {
      throw new LynucError('BAD_POINT', `未知点位来源: ${point.src}`);
    }
    const request = command.request(point);
    const raw = await this._enqueue(request, command.size || FRAME, command.recvSize || command.size || FRAME);
    const reply = decode(raw);
    const code = Number.parseInt(reply.slice(0, 4), 10);
    if (code !== command.reply) {
      if ('otherwise' in command) {
        return command.otherwise;
      }
      throw new LynucError('BAD_REPLY', `${request} 期望响应码 ${command.reply}，收到 ${JSON.stringify(reply.slice(0, 32))}`);
    }
    return command.parse(reply.slice(4), request);
  }

  /** 串行收发：协议没有事务号，同一时刻只能有一个请求在途。 */
  _enqueue(request, sendSize, recvSize) {
    this._queued += 1;
    const run = () => this._exchange(request, sendSize, recvSize);
    const result = this._queue.then(run, run);
    const done = () => {
      this._queued -= 1;
    };
    this._queue = result.then(done, done);
    return result;
  }

  _exchange(request, sendSize, recvSize) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new LynucError('NOT_CONNECTED', '未连接'));
        return;
      }
      this._rx = Buffer.alloc(0);
      this._pending = {
        resolve,
        reject,
        recvSize,
        settle: null,
        // 超时后迟到的响应会串到下一个请求上，流已不可信，只能断开重连。
        timeout: setTimeout(() => {
          this._finish(new LynucError('TIMEOUT', `${request} 超时`));
          this.close();
        }, this.requestTimeout),
      };
      const frame = Buffer.alloc(sendSize);
      frame.write(request, 'latin1');
      this._lastActivity = Date.now();
      this._socket.write(frame);
    });
  }

  _onData(chunk) {
    const pending = this._pending;
    if (!pending) {
      return;
    }
    this._rx = Buffer.concat([this._rx, chunk]);
    clearTimeout(pending.settle);

    // 上一帧的填充字节可能晚到，先跳过。
    let start = 0;
    while (start < this._rx.length && this._rx[start] === 0) {
      start += 1;
    }
    const end = this._rx.indexOf(0, start);
    if (start < this._rx.length && end >= 0) {
      this._terminated = true;
      this._finish(null, this._rx.subarray(start, end));
    } else if (this._rx.length >= pending.recvSize) {
      this._finish(null, this._rx.subarray(start, pending.recvSize));
    } else if (!this._terminated) {
      pending.settle = setTimeout(() => this._finish(null, this._rx.subarray(start)), SETTLE_MS);
    }
  }

  _finish(error, raw) {
    const pending = this._pending;
    if (!pending) {
      return;
    }
    this._pending = null;
    clearTimeout(pending.timeout);
    clearTimeout(pending.settle);
    this._lastActivity = Date.now();
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(raw);
    }
  }

  _onClose() {
    this.connected = false;
    this._socket = null;
    clearInterval(this._heartbeat);
    this._finish(new LynucError('CONNECTION_CLOSED', '连接已断开'));
    this.emit('close');
  }

  _startHeartbeat() {
    this._heartbeat = setInterval(() => {
      if (this._queued === 0 && Date.now() - this._lastActivity >= this.heartbeatMs) {
        // 心跳失败时连接会被关闭，由 close 事件上报。
        this._enqueue(HEARTBEAT, FRAME, FRAME).catch(() => {});
      }
    }, this.heartbeatMs);
    this._heartbeat.unref();
  }
}

module.exports = { LynucClient, LynucError, COMMANDS, DATA_PORT, parseAlarms };
