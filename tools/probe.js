#!/usr/bin/env node
'use strict';

/**
 * 现场探测工具：连接控制器，逐点读取并打印结果，生成可回传的报告。只读。
 *
 *   node tools/probe.js <控制器IP> [选项]
 *
 *   --port <n>           默认 4011
 *   --channel <1|2>      默认 1
 *   --axes <X,Y,Z>       默认 X,Y,Z
 *   --scan <起-止>       额外扫描一段宏变量，如 --scan 33500-33600
 *   --report <文件>      把报告（含原始响应）写成 JSON
 */

const fs = require('fs');
const { LynucClient, DATA_PORT } = require('../lib/client');
const { buildGroups } = require('../lib/points');

function parseArgs(argv) {
  const options = { port: DATA_PORT, channel: 1, axes: 'X,Y,Z' };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      options[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  options.host = positional[0];
  options.port = Number(options.port);
  options.channel = Number(options.channel);
  return options;
}

function describe(point) {
  if (point.src === 'plc') return `PLC ${point.addr}`;
  if (point.src === 'macro') return `#${point.id}`;
  if (point.src === 'macroAlt') return `#${point.id} (0105)`;
  return point.src;
}

async function probePoint(client, point, rows) {
  const row = { key: point.key, source: describe(point) };
  const started = process.hrtime.bigint();
  try {
    row.value = await client.read(point);
    row.ok = true;
  } catch (error) {
    row.ok = false;
    row.error = `${error.code}: ${error.message}`;
  }
  row.ms = Number(process.hrtime.bigint() - started) / 1e6;
  rows.push(row);
  console.log(
    `  ${row.ok ? 'OK  ' : 'FAIL'} ${row.key.padEnd(22)} ${row.source.padEnd(18)} ${row.ok ? JSON.stringify(row.value) : row.error}`,
  );
  return row;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.host) {
    console.error('用法: node tools/probe.js <控制器IP> [--port 4011] [--channel 1] [--axes X,Y,Z] [--scan 33500-33600] [--report 文件]');
    process.exit(2);
  }

  const client = new LynucClient({ host: options.host, port: options.port });
  const raw = [];
  client.on('reply', (request, bytes) => {
    if (raw.length < 300) {
      raw.push({ request, hex: bytes.toString('hex'), text: bytes.toString('latin1') });
    }
  });

  console.log(`连接 ${options.host}:${options.port} ...`);
  try {
    await client.connect();
  } catch (error) {
    console.error(`连接失败: ${error.message}`);
    console.error('排查: 能否 ping 通；控制器是否已安装 LynucRemoteEnv；防火墙是否放行 TCP 4011');
    process.exit(1);
  }
  console.log('已连接\n');

  const report = { host: options.host, port: options.port, time: new Date().toISOString(), groups: {}, scan: [], raw };
  const groups = buildGroups({ channel: options.channel, axes: options.axes });
  for (const [name, group] of Object.entries(groups)) {
    console.log(`[${name}]`);
    const rows = [];
    const values = {};
    for (const point of group.points) {
      const row = await probePoint(client, point, rows);
      values[point.key] = row.ok ? row.value : null;
    }
    if (group.followUp) {
      for (const point of group.followUp(values)) {
        await probePoint(client, point, rows);
      }
    }
    report.groups[name] = rows;
    console.log('');
  }

  if (options.scan) {
    const [from, to] = options.scan.split('-').map(Number);
    console.log(`[scan #${from}~#${to}，只列非零值]`);
    for (let id = from; id <= to && client.connected; id += 1) {
      try {
        const value = await client.read({ src: 'macro', id });
        report.scan.push({ id, value });
        if (value !== 0) {
          console.log(`  #${id} = ${value}`);
        }
      } catch (error) {
        report.scan.push({ id, error: error.code });
      }
    }
    console.log('');
  }

  const rows = Object.values(report.groups).flat();
  const failed = rows.filter((row) => !row.ok);
  const latencies = rows.map((row) => row.ms).sort((a, b) => a - b);
  report.summary = {
    total: rows.length,
    failed: failed.length,
    roundMs: latencies.reduce((sum, ms) => sum + ms, 0),
    medianMs: latencies[Math.floor(latencies.length / 2)],
    maxMs: latencies[latencies.length - 1],
  };
  const { total, roundMs, medianMs, maxMs } = report.summary;
  console.log(`共 ${total} 点，失败 ${failed.length}；单点中位 ${medianMs.toFixed(1)} ms，最大 ${maxMs.toFixed(1)} ms，全量一轮 ${roundMs.toFixed(0)} ms`);

  if (options.report) {
    fs.writeFileSync(options.report, JSON.stringify(report, null, 2));
    console.log(`报告已写入 ${options.report}`);
  }
  client.close();
  process.exitCode = failed.length > 0 ? 3 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
