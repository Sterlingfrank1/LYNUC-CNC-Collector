'use strict';

const { Collector } = require('../lib/collector');

const STATUS = {
  connecting: { fill: 'yellow', shape: 'ring', text: '连接中' },
  connected: { fill: 'green', shape: 'dot', text: '已连接' },
  disconnected: { fill: 'red', shape: 'ring', text: '已断开' },
  failed: { fill: 'red', shape: 'dot', text: '重连失败' },
  stopped: { fill: 'grey', shape: 'ring', text: '已停止' },
};

function toOptions(config) {
  const enabled = {};
  const every = {};
  Object.entries(config.groups || {}).forEach(([name, group]) => {
    enabled[name] = group.enabled !== false;
    if (group.every) {
      every[name] = Number(group.every);
    }
  });
  return {
    host: config.host,
    port: Number(config.port) || undefined,
    deviceId: config.deviceId || config.host,
    channel: Number(config.channel) || 1,
    axes: config.axes || 'X,Y,Z',
    pollInterval: Number(config.pollInterval) || 1000,
    connectTimeout: Number(config.connectTimeout) || 3000,
    requestTimeout: Number(config.requestTimeout) || 1000,
    autoReconnect: config.autoReconnect !== false,
    reconnectInterval: Number(config.reconnectInterval) || 5000,
    maxRetries: Number(config.maxRetries) || 0,
    onlyOnChange: config.onlyOnChange === true,
    deadband: Number(config.deadband) || 0,
    customPoints: JSON.parse(config.customPoints || '[]'),
    enabled,
    every,
  };
}

module.exports = function register(RED) {
  function LynucCncNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    let collector;
    try {
      collector = new Collector(toOptions(config));
    } catch (error) {
      node.status({ fill: 'red', shape: 'dot', text: `配置错误: ${error.message}` });
      node.error(`配置错误: ${error.message}`);
      return;
    }

    const topic = config.topic || `cnc/${collector.options.deviceId}/status`;

    collector.on('data', (message) => {
      node.send([{ payload: message, topic, timestamp: Date.now() }, null]);
      const time = new Date().toLocaleTimeString();
      if (message.errors) {
        node.status({ fill: 'yellow', shape: 'dot', text: `${time} ${message.errors.length} 个点位失败` });
      } else {
        node.status({ fill: 'green', shape: 'dot', text: `${time} 已更新` });
      }
    });

    collector.on('event', (event) => {
      node.send([null, { payload: event, topic: `${topic}/events`, timestamp: Date.now() }]);
    });

    collector.on('status', ({ state, detail }) => {
      const status = STATUS[state];
      node.status(detail ? { ...status, text: `${status.text}: ${detail}` } : status);
      if (state === 'failed') {
        node.error(detail);
      }
    });

    node.on('input', (msg, send, done) => {
      switch (msg.payload) {
        case 'reconnect':
          collector.stop();
          collector.start();
          done();
          break;
        case 'disconnect':
          collector.stop();
          done();
          break;
        case 'status':
          send([null, {
            payload: { event: 'status', state: collector.state, deviceId: collector.options.deviceId, host: config.host },
            topic: `${topic}/events`,
          }]);
          done();
          break;
        default:
          // 其他消息都视为按需采集。
          collector.collectNow().then(() => done(), done);
      }
    });

    node.on('close', (done) => {
      collector.stop();
      done();
    });

    collector.start();
  }

  RED.nodes.registerType('lynuc-cnc', LynucCncNode);
};
