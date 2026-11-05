'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Collector } = require('../lib/collector');
const { buildGroups, machineState, parseAxes } = require('../lib/points');
const { Simulator } = require('../tools/simulator');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup(t, options = {}, simOptions = {}) {
  const sim = new Simulator({ port: 0, ...simOptions });
  const port = await sim.start();
  const collector = new Collector({
    host: '127.0.0.1',
    port,
    deviceId: 'CNC_001',
    heartbeatMs: 3600000,
    pollInterval: 200,
    reconnectInterval: 20,
    ...options,
  });
  t.after(async () => {
    collector.stop();
    await sim.stop();
  });
  return { sim, collector };
}

function collectEvents(collector) {
  const events = [];
  collector.on('event', (event) => events.push(event));
  return events;
}

test('首轮输出符合 PRD 的 JSON 结构', async (t) => {
  const { collector } = await setup(t);
  const dataPromise = once(collector, 'data');
  collector.start();
  const [message] = await dataPromise;

  assert.ok(!Number.isNaN(Date.parse(message.timestamp)));
  assert.equal(message.deviceId, 'CNC_001');
  assert.equal(message.deviceType, 'CNC_CONTROLLER');
  assert.equal(message.dataType, 'full_status');
  assert.equal(message.errors, undefined);

  const { data } = message;
  assert.deepEqual(
    Object.keys(data).sort(),
    ['alarms', 'axes', 'feedrate', 'machineStatus', 'production', 'program', 'spindle', 'system', 'tool'],
  );
  assert.equal(data.machineStatus.mode, 'AUTO');
  assert.equal(data.machineStatus.state, 'RUNNING');
  assert.equal(data.machineStatus.ready, true);
  assert.equal(data.machineStatus.emergencyStop, false);
  assert.deepEqual(data.axes.X, {
    position: 100.5, relative: 10.5, machine: 500.5, remaining: 1.25, velocity: 200, load: 30, unit: 'mm',
  });
  assert.equal(data.axes.Y.position, 101.5);
  assert.deepEqual(data.spindle.speed, { actual: 2985, command: 3000, unit: 'rpm' });
  assert.equal(data.spindle.state, 'FORWARD');
  assert.equal(data.spindle.override, 100);
  assert.deepEqual(data.feedrate, { command: 500, actual: 480.5, override: 100, rapidOverride: 50, unit: 'mm/min' });
  assert.equal(data.program.name, 'O1234.NC');
  assert.equal(data.program.path, 'NC1/O1234.NC');
  assert.equal(data.program.line, 1250);
  assert.equal(data.program.totalLines, 2000);
  assert.equal(data.program.progress, 62.5);
  assert.deepEqual(data.alarms, []);
  assert.equal(data.production.completed, 12);
  assert.equal(data.production.target, 100);
  assert.equal(data.production.cycleTime, 45);
  assert.equal(data.production.utilization, 50);
  assert.equal(data.tool.number, 3);
  assert.equal(data.tool.next, 4);
  assert.equal(data.tool.useCount, 42);
  assert.equal(data.tool.useTime, 7200);
  assert.equal(data.tool.cutLength, 9800);
  assert.equal(data.system.version, '2.6.2.0');
  assert.equal(data.system.serial, 'SIM-0001');
});

test('全量一轮 67 次读取，本机耗时低于 PRD 的 100 ms', async (t) => {
  const { sim, collector } = await setup(t);
  const dataPromise = once(collector, 'data');
  const started = Date.now();
  collector.start();
  await dataPromise;
  const elapsed = Date.now() - started;
  assert.equal(sim.frames.length, 67);
  assert.ok(elapsed < 100, `耗时 ${elapsed} ms`);
});

test('没有来源的数据不输出占位值', async (t) => {
  const { collector } = await setup(t);
  const dataPromise = once(collector, 'data');
  collector.start();
  const [{ data }] = await dataPromise;
  // 手册没有主轴温度、程序剩余时间，也没有寿命百分比，不能编造。
  assert.equal('temperature' in data.spindle, false);
  assert.equal('remainingTime' in data.program, false);
  assert.equal('life' in data.tool, false);
});

test('单点失败输出 null 并记录错误，其他点位不受影响', async (t) => {
  const { sim, collector } = await setup(t);
  sim.macros.set(33505, 'garbage');
  const dataPromise = once(collector, 'data');
  collector.start();
  const [message] = await dataPromise;
  assert.equal(message.data.spindle.speed.command, null);
  assert.equal(message.data.spindle.speed.actual, 2985);
  assert.deepEqual(message.errors.map((e) => [e.point, e.code]), [['spindle.command', 'BAD_VALUE']]);
});

test('状态依赖的点位失败时 state 为 UNKNOWN，而不是猜一个', async (t) => {
  const { sim, collector } = await setup(t);
  sim.plc.set('206.0', 'garbage');
  const dataPromise = once(collector, 'data');
  collector.start();
  const [message] = await dataPromise;
  assert.equal(message.data.machineStatus.running, null);
  assert.equal(message.data.machineStatus.state, 'UNKNOWN');
});

test('未知模式和主轴状态值保留原始值', async (t) => {
  const { sim, collector } = await setup(t);
  sim.plc.set('205.20.24', 7);
  sim.plc.set('204.0.3', 9);
  const dataPromise = once(collector, 'data');
  collector.start();
  const [{ data }] = await dataPromise;
  assert.equal(data.machineStatus.mode, 'UNKNOWN');
  assert.equal(data.machineStatus.modeRaw, 7);
  assert.equal(data.spindle.state, 'UNKNOWN');
  assert.equal(data.spindle.stateRaw, 9);
});

test('状态优先级：急停 > 报警 > 错误停止 > 暂停 > 运行 > 空闲', () => {
  const base = { emergencyStop: false, fatalError: false, error: false, stopped: false, holding: false, running: false };
  assert.equal(machineState(base), 'IDLE');
  assert.equal(machineState({ ...base, running: true }), 'RUNNING');
  assert.equal(machineState({ ...base, running: true, holding: true }), 'PAUSED');
  assert.equal(machineState({ ...base, holding: true, stopped: true }), 'STOPPED');
  assert.equal(machineState({ ...base, stopped: true, error: true }), 'ALARM');
  assert.equal(machineState({ ...base, fatalError: true, emergencyStop: true }), 'EMERGENCY');
});

test('关闭的组不读取', async (t) => {
  const { sim, collector } = await setup(t, { enabled: { axes: false, tool: false, system: false } });
  const dataPromise = once(collector, 'data');
  collector.start();
  const [{ data }] = await dataPromise;
  assert.equal('axes' in data, false);
  assert.equal('tool' in data, false);
  const requests = sim.frames.map((frame) => frame.toString('latin1').replace(/\0+$/, ''));
  assert.equal(requests.includes('000730118'), false);
  assert.equal(requests.includes('00078006'), false);
});

test('不同组按各自倍率采集', async (t) => {
  const { collector } = await setup(t, { every: { production: 2, system: 100 } });
  const messages = [];
  collector.on('data', (message) => messages.push(message));
  collector.start();
  await sleep(500);
  assert.ok(messages.length >= 3);
  assert.ok('production' in messages[0].data);
  assert.equal('production' in messages[1].data, false);
  assert.equal(messages[1].dataType, 'partial_status');
  assert.ok('production' in messages[2].data);
  assert.equal('system' in messages[1].data, false);
});

test('轮询间隔不低于 200 ms', () => {
  const collector = new Collector({ host: '127.0.0.1', pollInterval: 10 });
  assert.equal(collector.pollInterval, 200);
});

test('上一轮未完成时跳过，不堆积请求', async (t) => {
  const { sim, collector } = await setup(t);
  await collector.start();
  await collector.collectNow();
  const before = sim.frames.length;
  const pending = [collector.collectNow(), collector.collectNow(), collector.collectNow()];
  await Promise.all(pending);
  assert.equal(sim.frames.length - before, 67, '并发触发只应读一轮');
});

test('onlyOnChange 不输出没变化的组，累计时间不算变化', async (t) => {
  const { sim, collector } = await setup(t, { onlyOnChange: true, enabled: { system: false } });
  const messages = [];
  collector.on('data', (message) => messages.push(message));
  await collector.start();
  await collector._collecting;
  await collector.collectNow();
  assert.equal(messages.length, 1);

  sim.macros.set(33868, 999999);
  sim.macros.set(2097, 9999999);
  await collector.collectNow();
  assert.equal(messages.length, 1);

  sim.macros.set(33506, 1500);
  await collector.collectNow();
  assert.equal(messages.length, 2);
  assert.deepEqual(Object.keys(messages[1].data), ['spindle']);
  assert.equal(messages[1].dataType, 'partial_status');
});

test('deadband 内的波动不输出，累计漂移超过阈值后输出', async (t) => {
  const { sim, collector } = await setup(t, { onlyOnChange: true, deadband: 10, enabled: { system: false } });
  const messages = [];
  collector.on('data', (message) => messages.push(message));
  await collector.start();
  await collector._collecting;

  sim.macros.set(33506, 2990);
  await collector.collectNow();
  sim.macros.set(33506, 2994);
  await collector.collectNow();
  assert.equal(messages.length, 1);

  sim.macros.set(33506, 3000);
  await collector.collectNow();
  assert.equal(messages.length, 2);
});

test('产生状态、程序、刀具、产量事件', async (t) => {
  const { sim, collector } = await setup(t);
  const events = collectEvents(collector);
  await collector.start();
  await collector._collecting;
  assert.deepEqual(events.map((e) => e.event), ['connected']);

  sim.plc.set('206.0', 0);
  sim.fileName = 'O2000.NC';
  sim.macros.set(8006, 5);
  sim.macros.set(33869, 13);
  await collector.collectNow();

  const byName = Object.fromEntries(events.map((e) => [e.event, e]));
  assert.deepEqual([byName.stateChanged.from, byName.stateChanged.to], ['RUNNING', 'IDLE']);
  assert.ok(byName.cycleEnded);
  assert.deepEqual([byName.programChanged.from, byName.programChanged.to], ['O1234.NC', 'O2000.NC']);
  assert.deepEqual([byName.toolChanged.from, byName.toolChanged.to], [3, 5]);
  assert.equal(byName.partCompleted.completed, 13);
  assert.equal(byName.toolChanged.deviceId, 'CNC_001');
});

test('记录加工开始与结束时间', async (t) => {
  const { sim, collector } = await setup(t);
  sim.plc.set('206.0', 0);
  await collector.start();
  await collector._collecting;

  sim.plc.set('206.0', 1);
  const running = await collector.collectNow();
  assert.ok(running.data.production.cycleStartedAt);
  assert.equal(running.data.production.cycleEndedAt, null);

  sim.plc.set('206.1', 1);
  const paused = await collector.collectNow();
  assert.equal(paused.data.production.cycleEndedAt, null, '暂停不算结束');

  sim.plc.set('206.0', 0);
  sim.plc.set('206.1', 0);
  const ended = await collector.collectNow();
  assert.ok(ended.data.production.cycleEndedAt);
});

test('报警带等级、首次出现时间，产生和消除各一次事件', async (t) => {
  const { sim, collector } = await setup(t);
  const events = collectEvents(collector);
  await collector.start();
  await collector._collecting;

  sim.alarmText = '【1204】主轴过载_L2-【2001】气压低_L3';
  const first = await collector.collectNow();
  assert.deepEqual(first.data.alarms.map((a) => [a.code, a.severity]), [[1204, 'ERROR'], [2001, 'WARNING']]);
  const { since } = first.data.alarms[0];
  assert.ok(since);

  await sleep(5);
  const second = await collector.collectNow();
  assert.equal(second.data.alarms[0].since, since, '持续中的报警保持首次时间');
  assert.equal(events.filter((e) => e.event === 'alarmRaised').length, 2);

  sim.alarmText = '';
  const third = await collector.collectNow();
  assert.deepEqual(third.data.alarms, []);
  assert.deepEqual(events.filter((e) => e.event === 'alarmCleared').map((e) => e.code), [1204, 2001]);
});

test('断线后自动重连并恢复采集', async (t) => {
  const { sim, collector } = await setup(t);
  const events = collectEvents(collector);
  await collector.start();
  await collector._collecting;

  sim.dropClients();
  await once(collector, 'status');
  const recovered = await new Promise((resolve) => {
    collector.on('data', resolve);
  });
  assert.ok(recovered.data.machineStatus);
  const names = events.map((e) => e.event);
  assert.deepEqual(names, ['connected', 'disconnected', 'connected']);
});

test('控制器无响应时断开重连，不输出半截数据', async (t) => {
  const { sim, collector } = await setup(t, { requestTimeout: 30 });
  await collector.start();
  await collector._collecting;
  const messages = [];
  collector.on('data', (message) => messages.push(message));

  sim.fault = 'silent';
  await collector.collectNow();
  assert.equal(messages.length, 0);

  sim.fault = null;
  await new Promise((resolve) => {
    collector.once('data', resolve);
  });
  assert.equal(collector.state, 'connected');
});

test('达到重连上限后进入 failed，且不再重试', async (t) => {
  const { sim, collector } = await setup(t, { maxRetries: 2 });
  const port = sim.port;
  await sim.stop();
  collector.options.port = port;
  const states = [];
  collector.on('status', ({ state }) => states.push(state));
  collector.start();
  await sleep(150);
  assert.equal(states.at(-1), 'failed');
  assert.equal(states.filter((s) => s === 'connecting').length, 3);
  // 让 t.after 的 sim.stop 不再报错
  sim.stop = async () => {};
});

test('autoReconnect 关闭时停在 disconnected', async (t) => {
  const { sim, collector } = await setup(t, { autoReconnect: false });
  await collector.start();
  await collector._collecting;
  sim.dropClients();
  await once(collector, 'status');
  await sleep(50);
  assert.equal(collector.state, 'disconnected');
});

test('stop 后不再重连也不再输出', async (t) => {
  const { sim, collector } = await setup(t);
  await collector.start();
  await collector._collecting;
  collector.stop();
  const frames = sim.frames.length;
  await sleep(250);
  assert.equal(sim.frames.length, frames);
  assert.equal(collector.state, 'stopped');
});

test('自定义点位进入 custom 组', async (t) => {
  const { sim, collector } = await setup(t, {
    customPoints: [
      { name: 'doorOpen', src: 'plc', addr: '100.3', type: 0 },
      { name: 'coolant', src: 'macro', id: 500 },
      { name: 'spindleLoad', src: 'macroAlt', id: 30282 },
    ],
  });
  sim.plc.set('100.3', 1);
  sim.macros.set(500, 42);
  sim.macros.set(30282, 55);
  const dataPromise = once(collector, 'data');
  collector.start();
  const [{ data }] = await dataPromise;
  assert.deepEqual(data.custom, { doorOpen: 1, coolant: 42, spindleLoad: 55 });
});

test('非法自定义点位在启动前就报错', () => {
  const bad = [
    { src: 'macro', id: 1 },
    { name: 'a', src: 'macro', id: 1.5 },
    { name: 'a', src: 'macro', id: '1;2' },
    { name: 'a', src: 'plc', addr: 'MO200.1' },
    { name: 'a', src: 'plc', addr: '200.1-1' },
    { name: 'a', src: 'plc', addr: '200.1', type: 2 },
    { name: 'a', src: 'writeMacro', id: 1 },
  ];
  for (const point of bad) {
    assert.throws(() => buildGroups({ customPoints: [point] }), undefined, JSON.stringify(point));
  }
});

test('轴配置校验与旋转轴单位', () => {
  assert.deepEqual(parseAxes('x, y,Z'), ['X', 'Y', 'Z']);
  assert.throws(() => parseAxes('X,Q'), /不支持的轴/);
  const output = buildGroups({ axes: 'A' }).axes.format({});
  assert.equal(output.A.unit, 'deg');
});

test('第 2 通道使用运行状态 208 段，通道变量 +100000', () => {
  const groups = buildGroups({ channel: 2, axes: 'X' });
  assert.equal(groups.machineStatus.points.find((p) => p.key === 'running').addr, '208.0');
  assert.equal(groups.machineStatus.points.find((p) => p.key === 'errorCode').id, 2042);
  assert.equal(groups.axes.points[0].id, 130118);
  assert.equal(groups.spindle.points[0].id, 133505);
  assert.throws(() => buildGroups({ channel: 3 }), /通道/);
});

test('全部点位只产生读命令', async (t) => {
  const { sim, collector } = await setup(t);
  await collector.start();
  await collector._collecting;
  const codes = new Set(sim.frames.map((frame) => frame.subarray(0, 4).toString('latin1')));
  const reads = new Set(['0000', '0007', '0105', '0060', '0081', '0030', '0093', '0123', '0045', '0066', '0069', '0051']);
  for (const code of codes) {
    assert.ok(reads.has(code), `出现了非读取命令 ${code}`);
  }
});
