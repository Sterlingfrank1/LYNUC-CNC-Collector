'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const helper = require('node-red-node-test-helper');
const lynucNode = require('../nodes/lynuc-cnc');
const { Simulator } = require('../tools/simulator');

helper.init(require.resolve('node-red'));

const startServer = () => new Promise((resolve) => helper.startServer(resolve));
const stopServer = () => new Promise((resolve) => helper.stopServer(resolve));

test.before(startServer);
test.after(stopServer);

async function deploy(t, overrides = {}) {
  const sim = new Simulator({ port: 0 });
  const port = await sim.start();
  const flow = [
    {
      id: 'cnc',
      type: 'lynuc-cnc',
      host: '127.0.0.1',
      port,
      deviceId: 'CNC_001',
      pollInterval: 200,
      reconnectInterval: 20,
      groups: { system: { enabled: false, every: 1 } },
      customPoints: '[]',
      wires: [['data'], ['events']],
      ...overrides,
    },
    { id: 'data', type: 'helper' },
    { id: 'events', type: 'helper' },
  ];
  await new Promise((resolve) => helper.load(lynucNode, flow, resolve));
  t.after(async () => {
    await helper.unload();
    await sim.stop();
  });
  return { sim, cnc: helper.getNode('cnc'), data: helper.getNode('data'), events: helper.getNode('events') };
}

const nextMessage = (node) => new Promise((resolve) => node.once('input', resolve));

test('输出 PRD 格式的 payload 和默认主题', async (t) => {
  const { data } = await deploy(t);
  const msg = await nextMessage(data);
  assert.equal(msg.topic, 'cnc/CNC_001/status');
  assert.equal(typeof msg.timestamp, 'number');
  assert.equal(msg.payload.deviceId, 'CNC_001');
  assert.equal(msg.payload.deviceType, 'CNC_CONTROLLER');
  assert.equal(msg.payload.data.machineStatus.state, 'RUNNING');
  assert.equal(msg.payload.data.spindle.speed.actual, 2985);
  assert.equal('system' in msg.payload.data, false);
});

test('主题可配置，事件走第 2 个输出', async (t) => {
  const { events } = await deploy(t, { topic: 'factory/line1/cnc1' });
  const msg = await nextMessage(events);
  assert.equal(msg.topic, 'factory/line1/cnc1/events');
  assert.equal(msg.payload.event, 'connected');
});

test('任意输入触发一次采集', async (t) => {
  const { cnc, data } = await deploy(t, { pollInterval: 60000 });
  await nextMessage(data);
  const again = nextMessage(data);
  cnc.receive({ payload: Date.now() });
  const msg = await again;
  assert.ok(msg.payload.data.machineStatus);
});

test('status 命令返回连接状态', async (t) => {
  const { cnc, data, events } = await deploy(t, { pollInterval: 60000 });
  await nextMessage(data);
  const reply = new Promise((resolve) => {
    events.on('input', (msg) => {
      if (msg.payload.event === 'status') resolve(msg);
    });
  });
  cnc.receive({ payload: 'status' });
  const msg = await reply;
  assert.equal(msg.payload.state, 'connected');
});

test('disconnect 后停止采集，reconnect 恢复', async (t) => {
  const { sim, cnc, data } = await deploy(t, { pollInterval: 200 });
  await nextMessage(data);
  cnc.receive({ payload: 'disconnect' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const frames = sim.frames.length;
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(sim.frames.length, frames);

  const resumed = nextMessage(data);
  cnc.receive({ payload: 'reconnect' });
  assert.ok((await resumed).payload.data);
});

test('节点状态随连接变化', async (t) => {
  const { cnc, data } = await deploy(t);
  const statuses = [];
  const original = cnc.status.bind(cnc);
  cnc.status = (status) => {
    statuses.push(status);
    original(status);
  };
  await nextMessage(data);
  await nextMessage(data);
  assert.equal(statuses.at(-1).fill, 'green');
});

test('部分点位失败时状态变黄', async (t) => {
  const { sim, cnc, data } = await deploy(t);
  await nextMessage(data);
  sim.macros.set(33505, 'garbage');
  const statuses = [];
  const original = cnc.status.bind(cnc);
  cnc.status = (status) => {
    statuses.push(status);
    original(status);
  };
  const msg = await nextMessage(data);
  assert.equal(msg.payload.errors[0].point, 'spindle.command');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(statuses.at(-1).fill, 'yellow');
});

test('非法配置报错但不影响 Node-RED', async (t) => {
  const { cnc } = await deploy(t, { customPoints: '[{"name":"x","src":"writeMacro"}]' });
  assert.ok(cnc, '节点已创建');
  const errorCalls = cnc.error.args.map((args) => String(args[0]));
  assert.ok(errorCalls.some((text) => text.includes('配置错误')), errorCalls.join());
});

test('示例 Flow 是合法 JSON，且类型、连线完整', () => {
  const flow = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/lynuc-cnc-mqtt.json'), 'utf8'));
  const ids = new Set(flow.map((node) => node.id));
  assert.ok(flow.some((node) => node.type === 'lynuc-cnc'));
  for (const node of flow) {
    for (const output of node.wires || []) {
      for (const target of output) {
        assert.ok(ids.has(target), `${node.id} 连到了不存在的 ${target}`);
      }
    }
  }
});
