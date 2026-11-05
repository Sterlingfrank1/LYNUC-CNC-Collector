#!/usr/bin/env bash
# 在 Docker 里跑 docs/ci-workflow.yml 的全部内容，用于没有 GitHub Actions 时验证 Linux。
# 测的是已提交的 HEAD，不含未提交的改动。
#
#   bash test/linux-matrix.sh
set -u

run() {
  local name=$1 image=$2 script=$3
  if git archive --format=tar HEAD | docker run -i --rm "$image" bash -ec "
      mkdir /work && cd /work && tar x
      $script" >"/tmp/linux-matrix-$name.log" 2>&1; then
    echo "PASS  $name  ($(grep -aE '^(ℹ pass|# pass|通过|共 )' "/tmp/linux-matrix-$name.log" | tail -1))"
  else
    echo "FAIL  $name  (日志: /tmp/linux-matrix-$name.log)"
    failed=1
  fi
}

failed=0

for version in 22 24; do
  run "test-node$version" "node:$version-slim" 'npm ci --no-audit --no-fund && npm test'
done

run node-red-3 node:18-slim \
  'npm install --no-save --no-package-lock --no-audit --no-fund node-red@3 node-red-node-test-helper@0.3 && node --test test/node.test.js'
run node-red-4 node:20-slim \
  'npm install --no-save --no-package-lock --no-audit --no-fund node-red@4 node-red-node-test-helper@0.3 && node --test test/node.test.js'

for version in 14 16; do
  run "runtime-node$version" "node:$version-slim" \
    'node tools/simulator.js 14011 & sleep 1; node tools/probe.js 127.0.0.1 --port 14011'
done

run vendor-conformance-linux node:22-bookworm-slim '
  # 部分网络下容器的 80 端口被代理拦截。走 HTTPS，完整性由 apt 的 GPG 签名保证。
  sed -i "s#http://#https://#g" /etc/apt/sources.list.d/*.sources
  APT="apt-get -o Acquire::https::Verify-Peer=false -o Acquire::Retries=3"
  $APT update -qq
  $APT install -y -qq --no-install-recommends gcc-multilib g++-multilib >/dev/null
  mkdir -p test/conformance/build
  gcc -m32 -o test/conformance/build/vendor_linux test/conformance/vendor_linux.c -ldl
  node test/conformance/run.js'

# Tier0-Edge 使用的镜像（Alpine + musl）。像现场一样安装打包产物，在真实 Node-RED 里采集。
target_image=${TARGET_IMAGE:-nodered/node-red:4.0.8-22}
if git archive --format=tar HEAD | docker run -i --rm --entrypoint bash "$target_image" -ec '
    mkdir -p /tmp/work /tmp/nr && cd /tmp/work && tar x
    npm pack --silent >/dev/null
    tarball=$PWD/$(ls *.tgz)
    cd /tmp/nr && npm init -y >/dev/null
    npm install --no-audit --no-fund --offline "$tarball" >/dev/null
    cat > flows.json <<EOF
[{"id":"t","type":"tab","label":"t"},
 {"id":"c","type":"lynuc-cnc","z":"t","host":"127.0.0.1","port":14011,"deviceId":"CNC_T","pollInterval":500,"groups":{},"customPoints":"[]","wires":[["d"],["e"]]},
 {"id":"d","type":"file","z":"t","filename":"/tmp/nr/data.jsonl","filenameType":"str","appendNewline":true,"overwriteFile":"false","encoding":"none","wires":[[]]},
 {"id":"e","type":"file","z":"t","filename":"/tmp/nr/events.jsonl","filenameType":"str","appendNewline":true,"overwriteFile":"false","encoding":"none","wires":[[]]}]
EOF
    node /tmp/work/tools/simulator.js 14011 &
    sleep 1
    node /usr/src/node-red/node_modules/node-red/red.js --userDir /tmp/nr --port 18801 flows.json &
    sleep 9
    node -e "
      const fs = require(\"fs\");
      const lines = fs.readFileSync(\"/tmp/nr/data.jsonl\", \"utf8\").trim().split(\"\n\").map(JSON.parse);
      const events = fs.readFileSync(\"/tmp/nr/events.jsonl\", \"utf8\").trim().split(\"\n\").map(JSON.parse);
      const first = lines[0];
      if (lines.length < 5) throw new Error(\"too few messages: \" + lines.length);
      if (first.data.machineStatus.state !== \"RUNNING\") throw new Error(\"bad state\");
      if (lines.some((m) => m.errors)) throw new Error(\"point errors\");
      if (events[0].event !== \"connected\") throw new Error(\"no connected event\");
      console.log(\"共 \" + lines.length + \" 条数据、\" + events.length + \" 条事件，Node-RED \" + require(\"/usr/src/node-red/node_modules/node-red/package.json\").version + \"，Node \" + process.version);
    "
    pkill -f red.js || true' >/tmp/linux-matrix-target.log 2>&1; then
  echo "PASS  target-image $target_image  ($(grep '^共 ' /tmp/linux-matrix-target.log | tail -1))"
else
  echo "FAIL  target-image $target_image  (日志: /tmp/linux-matrix-target.log)"
  failed=1
fi

exit $failed
