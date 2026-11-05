'use strict';

/**
 * 点位表：PRD 的业务数据到控制器变量的映射。每个点位的来源见 docs/POINTS.md。
 *
 * 读失败的点位值为 null，format 必须原样透传，不得代入默认值：
 * 下游要能区分“读到 0”和“没读到”。
 */

const AXIS_NAMES = ['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V', 'W'];
const ROTARY_AXES = new Set(['A', 'B', 'C']);
const MODES = { 1: 'CODELESS', 2: 'AUTO', 4: 'HANDLE', 5: 'JOG', 6: 'HOME', 8: 'MDI' };
const SPINDLE_STATES = { 2: 'STOPPED', 3: 'FORWARD', 4: 'REVERSE' };
const SEVERITIES = { 1: 'FATAL', 2: 'ERROR', 3: 'WARNING', 4: 'INFO' };

/** 每组默认的采集倍率：每 N 个轮询周期读一次。 */
const DEFAULT_EVERY = {
  machineStatus: 1,
  axes: 1,
  spindle: 1,
  feedrate: 1,
  program: 1,
  alarms: 1,
  production: 5,
  tool: 5,
  system: 60,
  custom: 1,
};

const macro = (key, id) => ({ key, src: 'macro', id });
const macroAlt = (key, id) => ({ key, src: 'macroAlt', id });
const plc = (key, addr) => ({ key, src: 'plc', addr });

const flag = (value) => (value === null ? null : value !== 0);
const seconds = (ms) => (ms === null ? null : ms / 1000);
const lookup = (table, value) => (value === null ? null : table[value] || 'UNKNOWN');

function machineState(status) {
  const inputs = [status.emergencyStop, status.fatalError, status.error, status.stopped, status.holding, status.running];
  if (inputs.includes(null)) {
    return 'UNKNOWN';
  }
  if (status.emergencyStop) return 'EMERGENCY';
  if (status.fatalError || status.error) return 'ALARM';
  if (status.stopped) return 'STOPPED';
  if (status.holding) return 'PAUSED';
  if (status.running) return 'RUNNING';
  return 'IDLE';
}

function percent(part, whole) {
  if (part === null || whole === null || whole <= 0) {
    return null;
  }
  return Math.round((part / whole) * 1000) / 10;
}

function parseAxes(axes) {
  const names = (Array.isArray(axes) ? axes : String(axes).split(','))
    .map((name) => name.trim().toUpperCase())
    .filter(Boolean);
  const unknown = names.filter((name) => !AXIS_NAMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(`不支持的轴: ${unknown.join(',')}，可选 ${AXIS_NAMES.join(',')}`);
  }
  return names;
}

/** 校验并规范化用户自定义点位，这些内容会直接拼进请求帧。 */
function parseCustomPoints(customPoints) {
  return customPoints.map((point, index) => {
    const where = `自定义点位 #${index + 1}`;
    if (typeof point.name !== 'string' || point.name === '') {
      throw new Error(`${where} 缺少 name`);
    }
    if (point.src === 'macro' || point.src === 'macroAlt') {
      if (!Number.isInteger(point.id) || point.id < 0) {
        throw new Error(`${where} (${point.name}) 的 id 须为非负整数`);
      }
      return { key: point.name, src: point.src, id: point.id };
    }
    if (point.src === 'plc') {
      if (typeof point.addr !== 'string' || !/^\d+(\.\d+){0,2}$/.test(point.addr)) {
        throw new Error(`${where} (${point.name}) 的 addr 须形如 206.0 或 205.20.24`);
      }
      if (point.type !== undefined && point.type !== 0 && point.type !== 1) {
        throw new Error(`${where} (${point.name}) 的 type 须为 1(MO) 或 0(MI)`);
      }
      return { key: point.name, src: 'plc', addr: point.addr, type: point.type === undefined ? 1 : point.type };
    }
    throw new Error(`${where} (${point.name}) 的 src 须为 macro、macroAlt 或 plc`);
  });
}

/**
 * @param {object} options
 * @param {number} [options.channel] 1 或 2
 * @param {string|string[]} [options.axes] 如 'X,Y,Z'
 * @param {object[]} [options.customPoints]
 * @returns {Object<string, {points: object[], followUp?: Function, format: Function, volatile?: string[]}>}
 */
function buildGroups({ channel = 1, axes = 'X,Y,Z', customPoints = [] } = {}) {
  if (channel !== 1 && channel !== 2) {
    throw new Error(`通道须为 1 或 2: ${channel}`);
  }
  const second = channel === 2;
  // 第 2 通道的通道变量 +100000（宏程序手册 2.5.7），真机待确认。
  const ch = (id) => (second ? id + 100000 : id);
  const run = second ? '208' : '206';
  const axisNames = parseAxes(axes);
  const custom = parseCustomPoints(customPoints);

  const groups = {
    machineStatus: {
      points: [
        plc('modeRaw', '205.20.24'),
        plc('running', `${run}.0`),
        plc('holding', `${run}.1`),
        plc('stopped', `${run}.2`),
        plc('ready', `${run}.3`),
        plc('systemReady', '200.12'),
        plc('emergencyStop', '200.6'),
        plc('powerOn', '200.8'),
        plc('fatalError', '203.11'),
        plc('error', '203.13'),
        plc('warning', '203.14'),
        macro('errorCode', second ? 2042 : 2041),
        macro('errorLevel', second ? 2102 : 2101),
      ],
      format(v) {
        const status = {
          mode: lookup(MODES, v.modeRaw),
          modeRaw: v.modeRaw,
          ready: flag(v.ready),
          systemReady: flag(v.systemReady),
          emergencyStop: flag(v.emergencyStop),
          powerOn: flag(v.powerOn),
          running: flag(v.running),
          holding: flag(v.holding),
          stopped: flag(v.stopped),
          fatalError: flag(v.fatalError),
          error: flag(v.error),
          warning: flag(v.warning),
          errorCode: v.errorCode,
          errorLevel: v.errorLevel,
        };
        status.state = machineState(status);
        return status;
      },
    },

    axes: {
      points: axisNames.flatMap((name) => {
        const base = 30100 + AXIS_NAMES.indexOf(name) * 50;
        return [
          macro(`${name}.position`, ch(base + 18)),
          macro(`${name}.relative`, ch(base + 19)),
          macro(`${name}.machine`, ch(base + 21)),
          macro(`${name}.remaining`, ch(base + 22)),
          macro(`${name}.velocity`, ch(base + 30)),
          macroAlt(`${name}.load`, ch(base + 32)),
        ];
      }),
      format(v) {
        const output = {};
        for (const name of axisNames) {
          output[name] = {
            position: v[`${name}.position`],
            relative: v[`${name}.relative`],
            machine: v[`${name}.machine`],
            remaining: v[`${name}.remaining`],
            velocity: v[`${name}.velocity`],
            load: v[`${name}.load`],
            unit: ROTARY_AXES.has(name) ? 'deg' : 'mm',
          };
        }
        return output;
      },
    },

    spindle: {
      points: [
        macro('command', ch(33505)),
        macro('actual', ch(33506)),
        macro('override', ch(33518)),
        plc('stateRaw', '204.0.3'),
      ],
      format(v) {
        return {
          speed: { actual: v.actual, command: v.command, unit: 'rpm' },
          override: v.override,
          state: lookup(SPINDLE_STATES, v.stateRaw),
          stateRaw: v.stateRaw,
        };
      },
    },

    feedrate: {
      points: [
        macro('command', ch(33563)),
        macro('actual', ch(30037)),
        macro('override', ch(33554)),
        macro('rapidOverride', ch(33555)),
      ],
      format(v) {
        return { ...v, unit: 'mm/min' };
      },
    },

    program: {
      points: [
        { key: 'name', src: 'fileName', channel },
        { key: 'line', src: 'mainLine' },
        { key: 'totalLines', src: 'totalLines', channel },
        ...(second ? [] : [{ key: 'path', src: 'filePath' }]),
      ],
      format(v) {
        return { ...v, progress: percent(v.line, v.totalLines) };
      },
    },

    alarms: {
      points: [{ key: 'list', src: 'alarms' }],
      format(v) {
        return v.list;
      },
    },

    production: {
      points: [
        macro('completed', ch(33869)),
        macro('total', ch(33870)),
        macro('target', ch(33871)),
        macroAlt('cycleTarget', ch(33503)),
        macro('cycleCount', ch(33504)),
        macro('cycleTimeMs', ch(33564)),
        macro('cuttingTimeMs', ch(33565)),
        macro('processTimeMs', ch(33868)),
        macro('uptimeMs', 2097),
      ],
      volatile: ['cycleTime', 'cuttingTime', 'processTime', 'uptime', 'utilization'],
      format(v) {
        return {
          completed: v.completed,
          total: v.total,
          target: v.target,
          cycleTarget: v.cycleTarget,
          cycleCount: v.cycleCount,
          cycleTime: seconds(v.cycleTimeMs),
          cuttingTime: seconds(v.cuttingTimeMs),
          processTime: seconds(v.processTimeMs),
          uptime: seconds(v.uptimeMs),
          // 两个累计量都从本次开机算起。
          utilization: percent(v.processTimeMs, v.uptimeMs),
        };
      },
    },

    tool: {
      points: [
        macro('number', 8006),
        macro('next', ch(33512)),
        macro('lengthOffsetNumber', ch(33558)),
        macro('lengthOffset', ch(33559)),
        macro('radiusOffsetNumber', ch(33560)),
        macro('radiusOffset', ch(33561)),
      ],
      // 刀具参数按刀号偏移，要先知道当前刀号。
      followUp(v) {
        if (!v.number) {
          return [];
        }
        const index = v.number - 1;
        return [
          macro('useCount', 11401 + index),
          macro('useTimeMs', 11501 + index),
          macro('cutLength', 11601 + index),
        ];
      },
      format(v) {
        const { useTimeMs, ...rest } = v;
        return { ...rest, useTime: useTimeMs === undefined ? undefined : seconds(useTimeMs) };
      },
    },

    system: {
      points: [
        { key: 'version', src: 'version' },
        { key: 'serial', src: 'serial' },
        { key: 'mac', src: 'mac' },
        macro('date', 2110),
        macro('time', 2111),
      ],
      format: (v) => v,
    },
  };

  if (custom.length > 0) {
    groups.custom = { points: custom, format: (v) => v };
  }
  return groups;
}

module.exports = { buildGroups, machineState, parseAxes, DEFAULT_EVERY, AXIS_NAMES, MODES, SEVERITIES };
