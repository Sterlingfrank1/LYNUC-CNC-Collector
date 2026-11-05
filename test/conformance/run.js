#!/usr/bin/env node
'use strict';

/**
 * 厂商库一致性测试。
 *
 * 让厂商客户端库和 lib/client.js 分别连接模拟器做同样的读取，比较：
 *   G2 请求帧是否一致（Windows 逐字节；Linux 比帧长和 NUL 前的内容，原因见 sameFrame）
 *   G3 厂商库能否解析模拟器的响应，解析结果是否与本实现相同
 *
 * Windows 用 x64 DLL，Linux 用 32 位 .so。需要绑定 21 和 4011 端口（厂商库写死）。
 *
 * 这只验证客户端一侧。模拟器不等于真实控制器，真机验证见 docs/SITE_ACCEPTANCE.md。
 */

const { execFile } = require('child_process');
const path = require('path');
const { LynucClient, parseAlarms } = require('../../lib/client');
const { buildGroups } = require('../../lib/points');
const { Simulator, startFtpStub } = require('../../tools/simulator');

const ROOT = path.join(__dirname, '../..');
const LIB = path.join(ROOT, '客户端库文件');
const IS_WINDOWS = process.platform === 'win32';

const COMMON_CASES = [
  ['macro_int', { src: 'macro', id: 33505 }],
  ['macro_float', { src: 'macro', id: 30118 }],
  ['macro_negative', { src: 'macro', id: 100 }],
  ['plc_bit', { src: 'plc', addr: '206.0', type: 1 }],
  ['plc_field', { src: 'plc', addr: '205.20.24', type: 1 }],
  ['plc_mi', { src: 'plc', addr: '200.1', type: 0 }],
  ['file_name', { src: 'fileName', channel: 1 }],
  ['file_path', { src: 'filePath' }],
  ['total_lines', { src: 'totalLines', channel: 1 }],
  ['version', { src: 'version' }],
  ['serial', { src: 'serial' }],
  ['mac', { src: 'mac' }],
  ['alarms', { src: 'alarms' }],
];
const WINDOWS_CASES = [
  ['main_line', { src: 'mainLine' }],
  ['cycle_target', { src: 'macroAlt', id: 33503 }],
  ['axis_load_x', { src: 'macroAlt', id: 30132 }],
];
const CASES = IS_WINDOWS ? [...COMMON_CASES, ...WINDOWS_CASES] : COMMON_CASES;

// 宏变量写入模拟器，厂商 API 的映射由实际发出的请求来验证。
const API_MAPPING = {
  api_absolute: ['000730118', '000730168', '000730218'],
  api_relative: ['000730119', '000730169', '000730219'],
  api_machine: ['000730121', '000730171', '000730221'],
  api_cycle_count: ['000733504'],
  api_spindle_command: ['000733505'],
  api_spindle_actual: ['000733506'],
  api_feed_command: ['000733563'],
  api_workpieces: ['000733870'],
  api_process_time: ['000733868'],
  api_uptime: ['00072097'],
};

let passed = 0;
let failed = 0;

function check(ok, label, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

function prepare(sim) {
  sim.macros.set(100, -0.125);
  sim.macros.set(30132, 42.5);
  sim.fileName = 'O1234.NC';
  sim.alarmText = '【1204】spindle overload_L2-【1011】servo_L1';
}

function harness(extra = []) {
  const [command, args] = IS_WINDOWS
    ? [process.env.PYTHON || 'python', [path.join(__dirname, 'vendor_windows.py'), path.join(LIB, 'x64/release/RemoteComm.dll'), ...extra]]
    : [path.join(__dirname, 'build/vendor_linux'), [path.join(LIB, 'LINUX/X86/libRemoteComm.so')]];
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30000, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`厂商库调用失败: ${error.message}\n${stderr}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

const requests = (frames) => frames.filter((frame) => frame.subarray(0, 4).toString('latin1') !== '0000');
const textOf = (frame) => frame.toString('latin1').replace(/\0+$/, '');
const cString = (frame) => frame.subarray(0, frame.indexOf(0) < 0 ? frame.length : frame.indexOf(0)).toString('latin1');

/**
 * Windows 库发送前清零缓冲区，可以逐字节比较。Linux 库 sprintf 到未清零的栈上再发满固定长度，
 * NUL 之后是栈垃圾，只有帧长和 C 字符串有意义。这也说明服务端只看到第一个 NUL 为止。
 */
function sameFrame(vendor, mine) {
  if (IS_WINDOWS) {
    return vendor.equals(mine);
  }
  return vendor.length === mine.length && cString(vendor) === cString(mine);
}

async function withSimulator(options, run) {
  const sim = new Simulator({ port: 4011, ...options });
  await sim.start();
  prepare(sim);
  try {
    return await run(sim);
  } finally {
    await sim.stop();
  }
}

async function readAll(sim, cases) {
  sim.frames.length = 0;
  const client = new LynucClient({ host: '127.0.0.1', port: 4011, heartbeatMs: 3600000 });
  await client.connect();
  const results = {};
  for (const [name, point] of cases) {
    try {
      results[name] = { value: await client.read(point) };
    } catch (error) {
      results[name] = { error: error.code };
    }
  }
  client.close();
  return { results, frames: requests(sim.frames) };
}

function vendorValue(row) {
  if ('hex' in row) {
    return Buffer.from(row.hex, 'hex').toString('utf8');
  }
  return row.value;
}

/** 正常响应：请求帧一致，解析结果一致。 */
async function matching(title, options) {
  console.log(`\n# ${title}`);
  await withSimulator(options, async (sim) => {
    const vendorRows = await harness();
    const byCase = Object.fromEntries(vendorRows.map((row) => [row.case, row]));
    check(byCase.connect.rc === 0, '厂商库完成连接', `rc=${byCase.connect.rc}`);
    const vendorFrames = requests(sim.frames);

    const { results, frames } = await readAll(sim, CASES);
    check(vendorFrames.length === frames.length, `请求帧数量一致 (${frames.length})`, `厂商 ${vendorFrames.length}`);
    frames.forEach((frame, index) => {
      const vendor = vendorFrames[index];
      const same = vendor && sameFrame(vendor, frame);
      check(same, `帧 ${CASES[index][0]}: ${textOf(frame)} (${frame.length} 字节)`, vendor && cString(vendor));
    });

    for (const [name] of CASES) {
      const row = byCase[name];
      const mine = results[name];
      const vendor = name === 'alarms' ? parseAlarms(vendorValue(row)) : vendorValue(row);
      const same = row.rc === 0 && JSON.stringify(vendor) === JSON.stringify(mine.value);
      check(same, `解析 ${name} = ${JSON.stringify(mine.value)}`, `厂商 rc=${row.rc} value=${JSON.stringify(vendor)} 本实现=${JSON.stringify(mine)}`);
    }

    if ('stub_absolute' in byCase) {
      const stub = byCase.stub_absolute;
      check(stub.rc === 0 && stub.value === -12345, 'Linux 库坐标接口确为空实现（返回 0，未写数据）', JSON.stringify(stub));
    }
  });
}

/** 异常响应：两边都应判定失败。 */
async function rejecting(title, fault, expected) {
  console.log(`\n# ${title}`);
  await withSimulator({}, async (sim) => {
    const cases = COMMON_CASES.slice(0, 1);
    // 厂商库建连接时不发数据帧，故障可以先于握手设置。
    sim.fault = fault;
    const byCase = Object.fromEntries((await harness()).map((row) => [row.case, row]));
    const { results } = await readAll(sim, cases);
    check(byCase.macro_int.rc !== 0, `厂商库拒绝 (rc=${byCase.macro_int.rc})`);
    check(results.macro_int.error === expected, `本实现拒绝 (${results.macro_int.error})`);
  });
}

/** 动态验证 PROTOCOL.md 第 6 节的 API 映射，并确认点位表用的是同一批变量。 */
async function mapping() {
  console.log('\n# Windows API 到宏变量的映射');
  await withSimulator({}, async (sim) => {
    const rows = await harness(['--mapping']);
    const all = requests(sim.frames).map(textOf);
    const byCase = Object.fromEntries(rows.map((row) => [row.case, row]));

    let cursor = all.length - Object.values(API_MAPPING).flat().length;
    for (const [name, expected] of Object.entries(API_MAPPING)) {
      const actual = all.slice(cursor, cursor + expected.length);
      cursor += expected.length;
      check(byCase[name].rc === 0 && JSON.stringify(actual) === JSON.stringify(expected), `${name} -> ${expected.join(' ')}`, actual.join(' '));
    }

    const groups = buildGroups({ axes: 'X,Y,Z' });
    const sent = new Set();
    for (const group of Object.values(groups)) {
      for (const point of group.points) {
        if (point.src === 'macro') {
          sent.add(`0007${point.id}`);
        }
      }
    }
    for (const expected of Object.values(API_MAPPING).flat()) {
      check(sent.has(expected), `点位表包含 ${expected}`);
    }
    check(byCase.api_absolute.values[0] === sim.macros.get(30118), '坐标 API 返回值与宏变量一致');
  });
}

async function main() {
  console.log(`厂商库: ${IS_WINDOWS ? 'Windows x64 DLL' : 'Linux i386 .so'}`);
  const ftp = await startFtpStub(21);
  try {
    await matching('带回显、补零', {});
    await matching('无回显、补零', { echo: false });
    await matching('带回显、不补零', { pad: false });
    await rejecting('回显不一致', 'wrong-echo', 'ECHO_MISMATCH');
    await rejecting('垃圾响应', 'garbage', 'BAD_REPLY');
    if (IS_WINDOWS) {
      await mapping();
    }
  } finally {
    await ftp.stop();
  }
  console.log(`\n通过 ${passed}，失败 ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
