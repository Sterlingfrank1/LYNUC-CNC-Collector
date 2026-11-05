'use strict';

/**
 * 采集器：管理连接与重连，按周期读取点位组，产出 PRD 格式的 JSON 与事件。
 *
 * 事件：
 *   data   (message) PRD 2.1.4 的 JSON
 *   event  ({ event, timestamp, deviceId, ... }) 业务与连接事件
 *   status ({ state, detail }) 连接状态，state 为 connecting/connected/disconnected/failed/stopped
 */

const { EventEmitter } = require('events');
const { LynucClient } = require('./client');
const { buildGroups, DEFAULT_EVERY, SEVERITIES } = require('./points');

const MIN_POLL_INTERVAL = 200;
// 这些错误说明连接已不可用，继续读没有意义；其余错误只影响单个点位。
const CONNECTION_ERRORS = new Set(['TIMEOUT', 'CONNECTION_CLOSED', 'NOT_CONNECTED']);

function differs(a, b, deadband) {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) > deadband;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].some((key) => differs(a[key], b[key], deadband));
  }
  return a !== b;
}

function without(value, keys) {
  if (!keys) {
    return value;
  }
  const copy = { ...value };
  keys.forEach((key) => delete copy[key]);
  return copy;
}

class Collector extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.host
   * @param {number} [options.port]
   * @param {string} [options.deviceId]
   * @param {number} [options.channel]
   * @param {string} [options.axes] 如 'X,Y,Z'
   * @param {number} [options.pollInterval] ms，不低于 200
   * @param {number} [options.connectTimeout] ms
   * @param {number} [options.requestTimeout] ms
   * @param {boolean} [options.autoReconnect]
   * @param {number} [options.reconnectInterval] ms
   * @param {number} [options.maxRetries] 连续重连上限，0 表示不限
   * @param {Object<string, boolean>} [options.enabled] 关闭某组：{ tool: false }
   * @param {Object<string, number>} [options.every] 覆盖采集倍率：{ tool: 10 }
   * @param {object[]} [options.customPoints]
   * @param {boolean} [options.onlyOnChange] 只输出有变化的组
   * @param {number} [options.deadband] 数值变化阈值
   */
  constructor(options) {
    super();
    this.options = {
      deviceId: options.host,
      channel: 1,
      axes: 'X,Y,Z',
      pollInterval: 1000,
      connectTimeout: 3000,
      requestTimeout: 1000,
      autoReconnect: true,
      reconnectInterval: 5000,
      maxRetries: 0,
      enabled: {},
      every: {},
      customPoints: [],
      onlyOnChange: false,
      deadband: 0,
      ...options,
    };
    this.pollInterval = Math.max(MIN_POLL_INTERVAL, this.options.pollInterval);
    this.groups = buildGroups(this.options);
    this.activeGroups = Object.keys(this.groups).filter((name) => this.options.enabled[name] !== false);

    this.client = null;
    this.state = 'stopped';
    this._stopped = true;
    this._retries = 0;
    this._pollTimer = null;
    this._reconnectTimer = null;
    this._collecting = null;
    this._tick = 0;
    this._reported = {};
    this._alarmsSince = new Map();
    this._last = {};
    this._cycle = { startedAt: null, endedAt: null };
  }

  start() {
    this._stopped = false;
    this._retries = 0;
    return this._connect();
  }

  stop() {
    this._stopped = true;
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    if (this.client) {
      this.client.close();
    }
    this._setState('stopped');
  }

  /** 立即采集全部启用的组，用于按需触发。 */
  collectNow() {
    return this._run(this.activeGroups);
  }

  _setState(state, detail) {
    this.state = state;
    this.emit('status', { state, detail });
  }

  _emitEvent(event, fields) {
    this.emit('event', {
      event,
      timestamp: new Date().toISOString(),
      deviceId: this.options.deviceId,
      ...fields,
    });
  }

  async _connect() {
    if (this._stopped) {
      return;
    }
    this._setState('connecting');
    const { host, port, connectTimeout, requestTimeout, heartbeatMs } = this.options;
    const client = new LynucClient({ host, port, connectTimeout, requestTimeout, heartbeatMs });
    try {
      await client.connect();
    } catch (error) {
      this._onDisconnected(error.message);
      return;
    }
    if (this._stopped) {
      client.close();
      return;
    }
    this.client = client;
    this._retries = 0;
    client.once('close', () => this._onClose(client));
    this._setState('connected');
    this._emitEvent('connected', { host });
    this._tick = 0;
    this._pollTimer = setInterval(() => this._poll(), this.pollInterval);
    this._poll();
  }

  _onClose(client) {
    if (client !== this.client) {
      return;
    }
    this.client = null;
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    if (!this._stopped) {
      this._emitEvent('disconnected', {});
      this._onDisconnected('连接已断开');
    }
  }

  _onDisconnected(detail) {
    if (this._stopped) {
      return;
    }
    const { autoReconnect, maxRetries, reconnectInterval } = this.options;
    if (!autoReconnect) {
      this._setState('disconnected', detail);
      return;
    }
    if (maxRetries > 0 && this._retries >= maxRetries) {
      this._setState('failed', `已重试 ${this._retries} 次仍未连上: ${detail}`);
      return;
    }
    this._retries += 1;
    this._setState('disconnected', detail);
    this._reconnectTimer = setTimeout(() => this._connect(), reconnectInterval);
  }

  _poll() {
    // 上一轮还没读完就跳过，不让请求堆积到控制器上。
    if (this._collecting) {
      return;
    }
    const due = this.activeGroups.filter((name) => {
      const every = this.options.every[name] || DEFAULT_EVERY[name] || 1;
      return this._tick % every === 0;
    });
    this._tick += 1;
    if (due.length > 0) {
      this._run(due);
    }
  }

  _run(names) {
    if (!this._collecting) {
      this._collecting = this._collect(names).finally(() => {
        this._collecting = null;
      });
    }
    return this._collecting;
  }

  async _collect(names) {
    const client = this.client;
    if (!client) {
      return null;
    }
    const data = {};
    const errors = [];
    try {
      for (const name of names) {
        data[name] = await this._readGroup(client, name, errors);
      }
    } catch (error) {
      // 连接已断：close 事件负责重连，这一轮的半截数据不输出。
      return null;
    }

    this._track(data);
    return this._publish(data, errors, names);
  }

  async _readGroup(client, name, errors) {
    const group = this.groups[name];
    const values = {};
    await this._readPoints(client, name, group.points, values, errors);
    if (group.followUp) {
      await this._readPoints(client, name, group.followUp(values), values, errors);
    }
    return group.format(values);
  }

  async _readPoints(client, groupName, points, values, errors) {
    for (const point of points) {
      try {
        values[point.key] = await client.read(point);
      } catch (error) {
        if (CONNECTION_ERRORS.has(error.code)) {
          throw error;
        }
        values[point.key] = null;
        errors.push({ point: `${groupName}.${point.key}`, code: error.code, message: error.message });
      }
    }
  }

  /** 比较前后两次采集，产生业务事件并补充派生字段。 */
  _track(data) {
    const last = this._last;

    if (data.machineStatus) {
      const to = data.machineStatus.state;
      const from = last.state;
      if (from !== undefined && from !== to) {
        this._emitEvent('stateChanged', { from, to });
        const wasActive = from === 'RUNNING' || from === 'PAUSED';
        const isActive = to === 'RUNNING' || to === 'PAUSED';
        if (!wasActive && isActive) {
          this._cycle = { startedAt: new Date().toISOString(), endedAt: null };
          this._emitEvent('cycleStarted', {});
        } else if (wasActive && !isActive) {
          this._cycle.endedAt = new Date().toISOString();
          this._emitEvent('cycleEnded', { startedAt: this._cycle.startedAt });
        }
      }
      last.state = to;
    }

    if (data.program && data.program.name !== null) {
      if (last.program !== undefined && last.program !== data.program.name) {
        this._emitEvent('programChanged', { from: last.program, to: data.program.name });
      }
      last.program = data.program.name;
    }

    if (data.tool && data.tool.number !== null) {
      if (last.tool !== undefined && last.tool !== data.tool.number) {
        this._emitEvent('toolChanged', { from: last.tool, to: data.tool.number });
      }
      last.tool = data.tool.number;
    }

    if (data.production) {
      const { completed } = data.production;
      if (completed !== null) {
        if (last.completed !== undefined && completed > last.completed) {
          this._emitEvent('partCompleted', { completed });
        }
        last.completed = completed;
      }
      data.production.cycleStartedAt = this._cycle.startedAt;
      data.production.cycleEndedAt = this._cycle.endedAt;
    }

    if (data.alarms) {
      data.alarms = this._trackAlarms(data.alarms);
    }
  }

  _trackAlarms(list) {
    if (list === null) {
      return null;
    }
    const now = new Date().toISOString();
    const active = new Set(list.map((alarm) => alarm.code));
    const enriched = list.map((alarm) => {
      const isNew = !this._alarmsSince.has(alarm.code);
      if (isNew) {
        this._alarmsSince.set(alarm.code, now);
      }
      const item = {
        ...alarm,
        severity: SEVERITIES[alarm.level] || 'UNKNOWN',
        since: this._alarmsSince.get(alarm.code),
      };
      if (isNew) {
        this._emitEvent('alarmRaised', item);
      }
      return item;
    });
    for (const code of [...this._alarmsSince.keys()]) {
      if (!active.has(code)) {
        this._alarmsSince.delete(code);
        this._emitEvent('alarmCleared', { code });
      }
    }
    return enriched;
  }

  _publish(data, errors, names) {
    const { onlyOnChange, deadband, deviceId } = this.options;
    const output = {};
    for (const name of names) {
      const volatile = this.groups[name].volatile;
      const current = without(data[name], volatile);
      if (!onlyOnChange || differs(this._reported[name], current, deadband)) {
        output[name] = data[name];
        this._reported[name] = current;
      }
    }
    if (onlyOnChange && Object.keys(output).length === 0) {
      return null;
    }
    const message = {
      timestamp: new Date().toISOString(),
      deviceId,
      deviceType: 'CNC_CONTROLLER',
      dataType: Object.keys(output).length === this.activeGroups.length ? 'full_status' : 'partial_status',
      data: output,
    };
    if (errors.length > 0) {
      message.errors = errors;
    }
    this.emit('data', message);
    return message;
  }
}

module.exports = { Collector, MIN_POLL_INTERVAL };
