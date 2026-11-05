'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { LynucClient, COMMANDS, parseAlarms } = require('../lib/client');
const { Simulator } = require('../tools/simulator');

async function setup(t, simOptions = {}, clientOptions = {}) {
  const sim = new Simulator({ port: 0, ...simOptions });
  const port = await sim.start();
  // 关掉心跳，帧计数才确定；心跳有专门的用例。
  const client = new LynucClient({ host: '127.0.0.1', port, heartbeatMs: 3600000, ...clientOptions });
  await client.connect();
  t.after(async () => {
    client.close();
    await sim.stop();
  });
  return { sim, client };
}

test('请求帧是定长 128 字节、NUL 填充的 ASCII', async (t) => {
  const { sim, client } = await setup(t);
  await client.read({ src: 'macro', id: 33505 });
  assert.equal(sim.frames.length, 1);
  const frame = sim.frames[0];
  assert.equal(frame.length, 128);
  assert.equal(frame.subarray(0, 9).toString('latin1'), '000733505');
  assert.ok(frame.subarray(9).every((byte) => byte === 0));
});

test('长帧命令按 1024 字节发送', async (t) => {
  const { sim, client } = await setup(t);
  await client.read({ src: 'fileName', channel: 1 });
  assert.equal(sim.frames[0].length, 1024);
  assert.equal(sim.frames[0].subarray(0, 5).toString('latin1'), '00811');
});

test('各命令解析响应', async (t) => {
  const { sim, client } = await setup(t);
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
  assert.equal(await client.read({ src: 'macroAlt', id: 33503 }), 100);
  assert.equal(await client.read({ src: 'plc', addr: '205.20.24' }), 2);
  assert.equal(await client.read({ src: 'fileName', channel: 1 }), 'O1234.NC');
  assert.equal(await client.read({ src: 'filePath' }), 'NC1/O1234.NC');
  assert.equal(await client.read({ src: 'totalLines', channel: 1 }), 2000);
  assert.equal(await client.read({ src: 'mainLine' }), 1250);
  assert.equal(await client.read({ src: 'version' }), '2.6.2.0');
  assert.equal(await client.read({ src: 'serial' }), 'SIM-0001');
  assert.equal(await client.read({ src: 'mac' }), '00:11:22:33:44:55');
  assert.equal(sim.frames.length, 10);
});

test('PLC 地址不带前缀，类型默认 MO', async (t) => {
  const { sim, client } = await setup(t);
  await client.read({ src: 'plc', addr: '206.0' });
  await client.read({ src: 'plc', addr: '200.1', type: 0 });
  assert.equal(sim.frames[0].subarray(0, 11).toString('latin1'), '0060206.0-1');
  assert.equal(sim.frames[1].subarray(0, 11).toString('latin1'), '0060200.1-0');
});

test('拒绝带 MO 前缀的 PLC 地址', async (t) => {
  const { sim, client } = await setup(t);
  await assert.rejects(client.read({ src: 'plc', addr: 'MO206.0' }), { code: 'BAD_ADDRESS' });
  assert.equal(sim.frames.length, 0);
});

test('兼容无回显响应', async (t) => {
  const { client } = await setup(t, { echo: false });
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
});

test('兼容不补零的响应', async (t) => {
  const { client } = await setup(t, { pad: false });
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
  assert.equal(await client.read({ src: 'version' }), '2.6.2.0');
});

test('数值中间被 TCP 拆开时不产生截断值', async (t) => {
  const { sim, client } = await setup(t);
  sim.macros.set(100, 123456.789);
  // 第一条响应让客户端确认服务端补零。
  await client.read({ src: 'macro', id: 33505 });
  sim.split = { at: 9, delay: 30 };
  assert.equal(await client.read({ src: 'macro', id: 100 }), 123456.789);
});

test('填充字节晚到不污染下一条响应', async (t) => {
  const { sim, client } = await setup(t);
  sim.split = { at: 64, delay: 30 };
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
  sim.split = null;
  // 上一帧后半段的 NUL 紧跟着下一个请求到达。
  assert.equal(await client.read({ src: 'macro', id: 33506 }), 2985);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
});

test('回显不一致报错，连接保持', async (t) => {
  const { sim, client } = await setup(t);
  sim.fault = 'wrong-echo';
  await assert.rejects(client.read({ src: 'macro', id: 33505 }), { code: 'ECHO_MISMATCH' });
  sim.fault = null;
  assert.equal(client.connected, true);
  assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
});

test('响应码不符报 BAD_REPLY，连接保持', async (t) => {
  const { sim, client } = await setup(t);
  sim.fault = 'garbage';
  await assert.rejects(client.read({ src: 'macro', id: 33505 }), { code: 'BAD_REPLY' });
  sim.fault = null;
  assert.equal(client.connected, true);
});

test('非数值内容报 BAD_VALUE', async (t) => {
  const { sim, client } = await setup(t);
  sim.macros.set(100, 'nan');
  await assert.rejects(client.read({ src: 'macro', id: 100 }), { code: 'BAD_VALUE' });
});

test('超时报错并断开连接', async (t) => {
  const { sim, client } = await setup(t, {}, { requestTimeout: 50 });
  sim.fault = 'silent';
  const closed = once(client, 'close');
  await assert.rejects(client.read({ src: 'macro', id: 33505 }), { code: 'TIMEOUT' });
  await closed;
  assert.equal(client.connected, false);
});

test('排队中的请求在断开时全部失败，不会挂起', async (t) => {
  const { sim, client } = await setup(t, {}, { requestTimeout: 50 });
  sim.fault = 'silent';
  const results = await Promise.allSettled([
    client.read({ src: 'macro', id: 1 }),
    client.read({ src: 'macro', id: 2 }),
    client.read({ src: 'macro', id: 3 }),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected', 'rejected']);
  assert.equal(results[0].reason.code, 'TIMEOUT');
  assert.equal(results[2].reason.code, 'NOT_CONNECTED');
});

test('服务端断开时报 CONNECTION_CLOSED', async (t) => {
  const { sim, client } = await setup(t);
  sim.fault = 'drop';
  await assert.rejects(client.read({ src: 'macro', id: 33505 }), { code: 'CONNECTION_CLOSED' });
  assert.equal(client.connected, false);
});

test('连接被拒绝时 connect 失败', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const { port } = blocker.address();
  await new Promise((resolve) => blocker.close(resolve));
  const client = new LynucClient({ host: '127.0.0.1', port });
  await assert.rejects(client.connect(), { code: 'ECONNREFUSED' });
});

test('连接无响应时 connect 超时', async (t) => {
  t.mock.method(net, 'createConnection', () => new net.Socket());
  const client = new LynucClient({ host: '192.0.2.1', connectTimeout: 30 });
  await assert.rejects(client.connect(), { code: 'CONNECT_TIMEOUT' });
});

test('并发请求严格串行，响应不串位', async (t) => {
  const { sim, client } = await setup(t);
  sim.macros.set(1, 11);
  sim.macros.set(2, 22);
  sim.macros.set(3, 33);
  const values = await Promise.all([1, 2, 3].map((id) => client.read({ src: 'macro', id })));
  assert.deepEqual(values, [11, 22, 33]);
  assert.deepEqual(sim.frames.map((f) => f[4]), [0x31, 0x32, 0x33]);
});

test('空闲时发 0000 心跳，帧长 128', async (t) => {
  const { sim } = await setup(t, {}, { heartbeatMs: 20 });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.ok(sim.frames.length >= 3, `只收到 ${sim.frames.length} 帧心跳`);
  assert.equal(sim.frames[0].length, 128);
  assert.equal(sim.frames[0].subarray(0, 4).toString('latin1'), '0000');
});

test('心跳不干扰采集', async (t) => {
  const { client } = await setup(t, {}, { heartbeatMs: 1 });
  for (let i = 0; i < 50; i += 1) {
    assert.equal(await client.read({ src: 'macro', id: 33505 }), 3000);
  }
});

test('心跳无响应时判定断线', async (t) => {
  const { sim, client } = await setup(t, {}, { heartbeatMs: 10, requestTimeout: 50 });
  sim.fault = 'silent';
  await once(client, 'close');
  assert.equal(client.connected, false);
});

test('无报警时返回空数组', async (t) => {
  const { client } = await setup(t);
  assert.deepEqual(await client.read({ src: 'alarms' }), []);
});

test('解析多条报警', async (t) => {
  const { sim, client } = await setup(t);
  sim.alarmText = '【1204】主轴过载_L2-【1011】伺服-报警_L1';
  assert.deepEqual(await client.read({ src: 'alarms' }), [
    { code: 1204, message: '主轴过载', level: 2 },
    { code: 1011, message: '伺服-报警', level: 1 },
  ]);
});

test('GB18030 编码的中文能解码', async (t) => {
  const { sim, client } = await setup(t);
  // “工件.NC” 的 GBK 字节
  sim.fileName = Buffer.from([0xb9, 0xa4, 0xbc, 0xfe, 0x2e, 0x4e, 0x43]);
  assert.equal(await client.read({ src: 'fileName', channel: 1 }), '工件.NC');
});

test('未知点位来源报错', async (t) => {
  const { client } = await setup(t);
  await assert.rejects(client.read({ src: 'writeMacro', id: 1 }), { code: 'BAD_POINT' });
});

test('命令表不含任何写命令', () => {
  const writes = ['0004', '0011', '0021', '0027', '0036', '0039', '0057', '0063', '0072', '0075', '0077', '0087', '0096', '0114', '0120'];
  const sample = { id: 1, addr: '1.1', type: 1, channel: 1 };
  for (const [name, command] of Object.entries(COMMANDS)) {
    const code = command.request(sample).slice(0, 4);
    assert.ok(!writes.includes(code), `${name} 使用了写命令 ${code}`);
  }
});

test('无法识别的报警保留原文，不能当成无报警', () => {
  assert.deepEqual(parseAlarms(''), []);
  assert.deepEqual(parseAlarms('  '), []);
  assert.deepEqual(parseAlarms('E1204 spindle overload'), [
    { code: null, message: 'E1204 spindle overload', level: null },
  ]);
});

test('报警串尾部的空白不影响解析', () => {
  assert.deepEqual(parseAlarms('【1204】主轴过载_L2\r\n'), [{ code: 1204, message: '主轴过载', level: 2 }]);
});

test('只有宏变量和 PLC 校验回显，与厂商库一致', async (t) => {
  const { sim, client } = await setup(t);
  sim.totalLines = '2000(00000)';
  sim.mainLine = '1250(00000)';
  assert.equal(await client.read({ src: 'totalLines', channel: 1 }), 2000);
  assert.equal(await client.read({ src: 'mainLine' }), 1250);
});
