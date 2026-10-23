'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['plain-48'];
const m = run.median_unpaused;
const sec = (value, digits = 1) => `${value.toFixed(digits)} s`;
const diffs = run.per_step.map(p => p.train_time_s - p.log_probs_time_s).sort((a, b) => a - b);
const gradient = (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2;
const step = m.step_time_s.median;
const steps = m.step_time_s.steps;
const TURNS = [
  { hue: 'violet', time: m.rollout_time_s.median, line: 'rollout, SGLang engine' },
  { hue: 'blue', time: m.log_probs_time_s.median, line: 'log probabilities, trainer' },
  { hue: 'blue', time: gradient, line: 'GRPO update, Adam' },
  { hue: 'amber', time: m.update_weights_time_s.median, digits: 2, line: 'weight update to the engine' },
];
const untimed = step - TURNS.reduce((sum, turn) => sum + turn.time, 0);
const ACTORS = [
  { u: 8, v: 14, hue: 'grey', title: 'Ray head', sub: 'ray start --head' },
  { u: 58, v: 14, hue: 'amber', title: 'TrainerController', sub: 'Ray actor, step loop' },
  { u: 8, v: 74, hue: 'violet', title: 'ray::RolloutExecutor', sub: 'Ray actor, drives SGLang' },
  { u: 58, v: 74, hue: 'green', title: 'math reward', sub: '1 or 0 per answer' },
];

module.exports = figure('plate-miles-loop', {
  height: 716,
  title: 'One GRPO step on one GB10',
  desc: `One DGX Spark GB10 package drawn in iso: a Grace CPU die with 20 Arm cores and a Blackwell GPU die, both joined to one 128 GB slab of unified LPDDR5X memory at the center. On the Grace die run the Ray head, the TrainerController and ray::RolloutExecutor actors, and the math reward. On the Blackwell die the FSDP trainer is active and the SGLang engine waits. Inside the shared slab the trainer state is the active footprint and the engine state is parked. The trainer onloads in ${sec(m.wake_up_time_s.median, 2)}, and the weight update to the engine takes ${sec(m.update_weights_time_s.median, 2)}. Below, one median step of ${sec(step)} to scale: rollout ${sec(m.rollout_time_s.median)}, log probabilities ${sec(m.log_probs_time_s.median)}, GRPO update ${sec(gradient)}, weight update ${sec(m.update_weights_time_s.median, 2)}, and ${sec(untimed)} that the phase medians do not cover. Medians of ${steps} steps of a run made before we added the heat guard.`,
}, f => {
  const chip = f.isoView({ ox: 300, oy: 118, angle: 'true' });
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const flat = (part, u, v, w, d, hue, opacity) => face(part, [[u, v, part.box.h], [u + w, v, part.box.h], [u + w, v + d, part.box.h], [u, v + d, part.box.h]], hue, opacity);
  const front = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);
  const on = (part, u, v, w, d, h, hue, extra = {}) => f.isoBlock(chip, { x: part.box.x + u, y: part.box.y + v, z: part.box.z + part.box.h, w, d, h, hue, shadow: false, ...extra });

  f.kicker(20, 18, 'one NVIDIA DGX Spark · GB10 superchip');
  f.text(620, 18, 'Qwen3-0.6B', { size: 11, anchor: 'end', hue: 'ink-soft' });

  const pkg = f.isoBlock(chip, { x: 0, y: 0, w: 340, d: 320, h: 8, hue: 'grey' });
  const grace = on(pkg, 14, 170, 112, 136, 12, 'grey', { shadow: true });
  for (let i = 0; i < 20; i += 1) flat(grace, 6 + (i % 10) * 10, i < 10 ? 6 : 122, 7, 8, 'ink-mute', 0.55);
  const gpu = on(pkg, 196, 14, 130, 120, 12, 'grey', { shadow: true });
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) flat(gpu, 8 + col * 29, 6 + row * 28, 22, 22, 'violet-ink', 0.22);
  const slab = on(pkg, 134, 142, 196, 168, 16, 'paper', { inkHue: 'grey', ink: 1.6, shadow: true });
  const wire = (a, b) => f.rule(a[0], a[1], b[0], b[1], { hue: 'grey', width: 2.2, opacity: 0.8 });
  for (const k of [40, 80]) wire(grace.P(112, k, 6), slab.P(0, k - 20, 8));
  for (const k of [40, 90]) wire(gpu.P(k, 120, 6), slab.P(k + 50, 0, 8));
  wire(grace.P(60, 0, 6), gpu.P(0, 60, 6));

  const actors = ACTORS.map(actor => {
    const block = on(grace, actor.u, actor.v, 30, 30, 18, actor.hue);
    if (actor.hue === 'green') [[4, 4, 1], [16, 4, 0], [4, 16, 1], [16, 16, 1]].forEach(([u, v, s]) => flat(block, u, v, 10, 10, s ? 'green-ink' : 'paper', s ? 0.75 : 0.95));
    else front(block, 5, 25, 4, 13, `${actor.hue}-ink`, 0.6);
    return block;
  });
  const ORDER = [1, 0, 3, 2];
  ORDER.forEach((index, row) => {
    const actor = ACTORS[index];
    const y = 44 + row * 34;
    f.text(20, y, actor.title, { size: 12, weight: 700, hue: actor.hue === 'grey' ? undefined : actor.hue });
    f.text(20, y + 14, actor.sub, { size: 11, serif: true, hue: 'ink-soft' });
  });
  ORDER.forEach((index, row) => f.leader([180, 46 + row * 34], actors[index].top, { hue: ACTORS[index].hue === 'grey' ? 'ink-mute' : ACTORS[index].hue }));

  const trainer = on(gpu, 18, 30, 40, 40, 30, 'blue');
  front(trainer, 6, 34, 6, 24, 'blue-ink', 0.5);
  const engine = on(gpu, 76, 30, 40, 40, 8, 'paper', { inkHue: 'violet', dash: 'dashed' });

  const active = on(slab, 14, 14, 92, 140, 14, 'blue');
  const parked = on(slab, 116, 14, 66, 140, 5, 'paper', { inkHue: 'violet', dash: 'dashed' });
  for (let v = 10; v < 140; v += 22) flat(active, 8, v, 76, 10, 'blue-ink', 0.18);

  f.text(406, 204, 'Blackwell GPU', { size: 12, weight: 700, anchor: 'end' });
  f.leader([410, 202], gpu.P(0, 34, 12), { hue: 'ink-mute' });
  f.text(620, 100, 'FSDP trainer', { size: 12, weight: 700, hue: 'blue', anchor: 'end' });
  f.text(620, 114, 'FSDPTrainRayActor', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.leader([515, 120], trainer.top, { hue: 'blue' });
  f.text(620, 146, 'SGLang engine', { size: 12, weight: 700, hue: 'violet', anchor: 'end' });
  f.text(620, 160, 'waits for new weights', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.leader([590, 166], engine.top, { hue: 'violet' });
  f.text(20, 214, 'Grace CPU', { size: 12, weight: 700 });
  f.text(20, 228, '20 Arm cores', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([100, 210], grace.P(0, 40, 12), { hue: 'ink-mute' });

  f.beat(2);
  const tUp = active.P(46, 0, 14);
  const tDown = trainer.P(20, 40, 0);
  f.path(`M${tUp[0]} ${tUp[1] - 2} L${tDown[0]} ${tDown[1] + 2}`, { style: 'state' });
  f.text(tUp[0] + 6, (tUp[1] + tDown[1]) / 2 + 8, `onload ${sec(m.wake_up_time_s.median, 2)}`, { size: 11, hue: 'amber', knock: true });
  f.beat(2);
  const eA = engine.P(20, 40, 0);
  const eB = parked.P(33, 0, 5);
  f.path(`M${eA[0]} ${eA[1] + 2} L${eB[0]} ${eB[1] - 2}`, { style: 'state' });
  f.beat(4);
  const w0 = trainer.P(40, 20, 26);
  const w1 = engine.P(0, 20, 8);
  f.path(`M${w0[0]} ${w0[1]} V${w0[1] - 52} H${w1[0]} V${w1[1] - 2}`, { style: 'state' });
  f.text((w0[0] + w1[0]) / 2, w0[1] - 56, `weight update ${sec(m.update_weights_time_s.median, 2)}`, { size: 11, anchor: 'middle', hue: 'amber', knock: true });

  f.beat(0);
  f.text(300, 498, 'LPDDR5X · 128 GB unified, one pool for both dies', { size: 12, weight: 700, anchor: 'middle' });
  f.leader([300, 486], slab.P(98, 168, 4), { hue: 'ink-mute' });
  f.text(20, 330, 'trainer state', { size: 12, weight: 700, hue: 'blue' });
  f.text(20, 344, 'active footprint', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([124, 340], active.P(0, 100, 14), { hue: 'blue' });
  f.text(620, 400, 'engine state', { size: 12, weight: 700, hue: 'violet', anchor: 'end' });
  f.text(620, 414, 'parked in the pool', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.leader([540, 420], parked.P(66, 120, 5), { hue: 'violet' });

  const line = f.isoView({ ox: 0, oy: 590, angle: 'true' });
  f.kicker(20, 534, `one step to scale · ${sec(step)}, median of ${steps}`);
  const x0 = 20;
  const span = 600;
  const edges = [x0];
  TURNS.forEach(turn => edges.push(edges[edges.length - 1] + (turn.time / step) * span));
  TURNS.forEach((turn, index) => {
    f.beat(1 + index);
    f.isoBeam(line, { sx0: edges[index], sx1: edges[index + 1] - (index < 3 ? 1 : 0), c: 0, back: 16, h: 10, hue: turn.hue, shadow: false });
    const last = index === TURNS.length - 1;
    const cx = last ? edges[index] - 14 : edges[index] + 11;
    f.step(cx, 562, index + 1, { hue: turn.hue });
    f.text(last ? cx - 13 : cx + 13, 566, sec(turn.time, turn.digits || 1), { size: 11, weight: 700, hue: turn.hue, anchor: last ? 'end' : undefined });
  });
  f.beat(0);
  f.isoBeam(line, { sx0: edges[4] + 1, sx1: x0 + span, c: 0, back: 16, h: 10, hue: 'paper', inkHue: 'ink-mute', ink: 1, dash: 'dashed', shadow: false });
  TURNS.forEach((turn, index) => {
    const x = index % 2 ? 330 : 20;
    const y = 624 + Math.floor(index / 2) * 22;
    f.step(x + 9, y - 4, index + 1, { hue: turn.hue });
    f.text(x + 26, y, turn.line, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 676, `dashed end: median step minus the phase medians, ${sec(untimed)}. Trainer offload ${sec(m.sleep_time_s.median, 2)}.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 700, 'Medians from the run made before the heat guard.', { size: 11, serif: true, hue: 'ink-mute' });
});
