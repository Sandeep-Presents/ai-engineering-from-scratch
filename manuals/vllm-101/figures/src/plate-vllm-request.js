'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const summary = load(path.join(__dirname, '../../capture/gpu/summary/l4.json'));
const prefix = summary.prefix;
const pool = prefix.vllm.kv_pool_tokens;
const at = (key, x) => prefix[key].points.find(p => p.x === x).median_ttft_ms.median;
const PAIRS = [256, 1024, 2048].map(x => ({ x, on: at('vllm', x), off: at('vllm-no-prefix-cache', x) }));
const ms = v => `${Math.round(v).toLocaleString('en-US')} ms`;
const HIT = 87.2;
const CELLS = 39;
const CACHED = Math.round(CELLS * HIT / 100);

module.exports = figure('plate-vllm-request', {
  height: 568,
  title: 'One request, three processes, one block pool',
  desc: `A chat request crosses the API server, the engine core, and a GPU worker, drawn as machines on one bench. The API server tokenizes, the engine core holds the Scheduler and the KVCacheManager with its grid of blocks, and the GPU worker runs GPUModelRunner on the NVIDIA L4. With 8 users and Qwen3-8B, 87.2 percent of the prompt tokens came from cached 16-token blocks of a ${pool.toLocaleString('en-US')}-token pool. Below, towers show the median time to first token with the prefix cache on and off at 256, 1,024, and 2,048 shared tokens.`,
}, f => {
  const bench = f.isoView({ ox: 0, oy: 176, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue, options = {}) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const quad = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);

  f.kicker(20, 18, 'one request through vLLM 0.31.0 on our L4');
  f.isoBeam(bench, { sx0: 14, sx1: 626, c: 60, back: 120, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const stations = [
    { cx: 70, w: 100, hue: 'olive', title: 'client', sub: ['chat request', 'over HTTP'] },
    { cx: 220, w: 150, hue: 'blue', title: 'API server', sub: ['tokenizer', 'text to ids'] },
    { cx: 390, w: 150, hue: 'blue', title: 'engine core', sub: ['Scheduler', 'KVCacheManager'] },
    { cx: 555, w: 130, hue: 'violet', title: 'GPU worker', sub: ['GPUModelRunner', 'NVIDIA L4'] },
  ];
  stations.forEach(station => f.box({ x: station.cx - station.w / 2, y: 30, w: station.w, h: 66, hue: station.hue, title: station.title, sub: station.sub }));

  const client = unit(bench, 70, 0, 46, 30, 'olive');
  quad(client, 8, 38, 9, 25, 'olive-ink', 0.85);
  for (const k of [20, 15]) quad(client, 12, 30, k - 1.6, k, 'olive-fill', 0.9);

  const api = unit(bench, 220, 0, 46, 30, 'blue');
  for (const v of [10, 21, 32]) face(api, [[9, v, 30], [37, v, 30], [37, v + 4, 30], [9, v + 4, 30]], 'blue-ink', 0.55);

  const core = unit(bench, 390, 0, 46, 30, 'blue');
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const u = 5 + col * 9.5;
      const v = 5 + row * 9.5;
      const cached = row * 4 + col < 13;
      face(core, [[u, v, 30], [u + 7, v, 30], [u + 7, v + 7, 30], [u, v + 7, 30]], cached ? 'green-ink' : 'green-fill', cached ? 0.7 : 0.95);
    }
  }
  for (const [u1, k] of [[38, 22], [30, 16], [22, 10]]) quad(core, 8, u1, k - 2.4, k, 'amber-ink', 0.8);

  const [gx, gy] = bench.at(555, 0);
  const board = f.isoBlock(bench, { x: gx - 29, y: gy - 29, w: 58, d: 58, h: 5, hue: 'grey' });
  for (let u = 8; u <= 50; u += 7) face(board, [[u, 58, 1.2], [u + 3, 58, 1.2], [u + 3, 58, 3.8], [u, 58, 3.8]], 'grey-ink', 0.6);
  const worker = f.isoBlock(bench, { x: gx - 21, y: gy - 21, z: 5, w: 42, d: 42, h: 26, hue: 'violet', shadow: false });
  quad(worker, 6, 36, 5, 21, 'violet-ink', 0.85);
  for (const k of [17, 12]) quad(worker, 10, 28, k - 1.6, k, 'violet-fill', 0.9);

  const machines = [client, api, core, worker];
  machines.forEach((machine, index) => f.leader([stations[index].cx, 98], machine.top, { hue: stations[index].hue }));
  const styles = ['call', 'event', 'event'];
  for (let i = 0; i < 3; i += 1) {
    f.beat(i + 1);
    const from = machines[i].P(machines[i].box.w, 0, 15);
    const to = machines[i + 1].P(0, machines[i + 1].box.d, i === 2 ? 10 : 15);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: styles[i] });
  }

  f.beat(4);
  const prompt = f.isoView({ ox: 0, oy: 300, angle: 'true' });
  f.kicker(20, 242, 'prompt tokens in 16-token blocks, as the prefix cache saw them');
  f.text(20, 262, `${HIT} percent from cached blocks, 8 users`, { size: 12, weight: 700, hue: 'green' });
  const span = 586 / CELLS;
  const split = 20 + CACHED * span;
  const dividers = (from, to, hue) => {
    for (let i = from; i < to; i += 1) {
      const sx = 20 + i * span;
      const low = prompt.P(...prompt.at(sx, 0), 0);
      const high = prompt.P(...prompt.at(sx, -30), 14);
      f.rule(low[0], low[1], high[0], high[1], { hue, opacity: 0.7 });
    }
  };
  f.isoBeam(prompt, { sx0: 20, sx1: split, c: 0, back: 30, h: 14, hue: 'green' });
  dividers(1, CACHED, 'green');
  f.beat(5);
  f.isoBeam(prompt, { sx0: split, sx1: 606, c: 0, back: 30, h: 14, hue: 'plum', shadow: false });
  dividers(CACHED + 1, CELLS, 'plum');
  f.text(606, 324, `${(100 - HIT).toFixed(1)} percent computed`, { size: 11, anchor: 'end', hue: 'plum' });
  f.beat(4);
  f.text(20, 324, `pool of ${pool.toLocaleString('en-US')} tokens, ${(pool / 16).toLocaleString('en-US')} blocks`, { size: 11, serif: true, hue: 'ink-soft' });

  f.beat(0);
  f.kicker(20, 364, 'median time to first token, prefix cache on and off');
  const yard = f.isoView({ ox: 0, oy: 524, angle: 'true' });
  f.isoBeam(yard, { sx0: 150, sx1: 626, c: 30, back: 60, h: 5, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const scale = 120 / 2550;
  PAIRS.forEach((pair, index) => {
    f.beat(6 + index);
    const base = 220 + index * 150;
    const on = unit(yard, base, 0, 24, Math.max(4, pair.on * scale), 'green');
    const off = unit(yard, base + 54, 0, 24, Math.max(4, pair.off * scale), 'rose');
    f.text(base, on.top[1] - 16, ms(pair.on), { size: 11.5, weight: 700, anchor: 'middle', hue: 'green' });
    f.text(base + 54, off.top[1] - 16, ms(pair.off), { size: 11.5, weight: 700, anchor: 'middle', hue: 'rose' });
    f.text(base + 27, 556, `${pair.x.toLocaleString('en-US')} tokens`, { size: 11.5, anchor: 'middle', hue: 'ink-soft' });
  });
  f.beat(0);
  f.rect(20, 418, 12, 12, { hue: 'green' });
  f.text(40, 428, 'cache on', { size: 11.5, hue: 'green' });
  f.rect(20, 440, 12, 12, { hue: 'rose' });
  f.text(40, 450, 'cache off', { size: 11.5, hue: 'rose' });
  f.text(20, 478, 'NVIDIA L4', { size: 11, serif: true, hue: 'ink-mute' });
  f.text(20, 494, 'Qwen3-8B', { size: 11, serif: true, hue: 'ink-mute' });
});
