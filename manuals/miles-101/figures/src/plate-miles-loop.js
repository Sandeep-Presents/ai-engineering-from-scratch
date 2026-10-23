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
  { hue: 'violet', time: m.rollout_time_s.median, line: 'the SGLang engine writes 256 answers' },
  { hue: 'blue', time: m.log_probs_time_s.median, line: `the trainer wakes in ${sec(m.wake_up_time_s.median, 2)}, then computes log probabilities` },
  { hue: 'blue', time: gradient, line: 'the trainer takes the GRPO update, Adam, one step' },
  { hue: 'amber', time: m.update_weights_time_s.median, digits: 2, line: `the weight update reaches the engine, the trainer offloads in ${sec(m.sleep_time_s.median, 2)}` },
];

module.exports = figure('plate-miles-loop', {
  height: 532,
  title: 'One GRPO step on one GPU',
  desc: `One GRPO step of Qwen3-0.6B on one DGX Spark GB10, drawn as machines on one bench. GSM8K prompts, 32 a step, go to the SGLang engine, which writes 256 answers. A math reward scores each answer 1 or 0, and the FSDP trainer learns from the scores. The weight update takes the new weights back to the engine. Below, the same GB10 memory is drawn as one board that the engine and the trainer take in turns, to scale: the engine for ${sec(m.rollout_time_s.median)}, the trainer for ${sec(m.log_probs_time_s.median)} of log probabilities and ${sec(gradient)} of GRPO update, and the weight update for ${sec(m.update_weights_time_s.median, 2)}, in a median step of ${sec(step)}. Medians of ${steps} steps of a run made before we added the heat guard.`,
}, f => {
  const bench = f.isoView({ ox: 0, oy: 176, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue, options = {}) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const quad = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);

  f.kicker(20, 18, 'one GRPO step · Qwen3-0.6B on one DGX Spark GB10');
  f.isoBeam(bench, { sx0: 14, sx1: 626, c: 60, back: 120, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const stations = [
    { cx: 75, w: 130, hue: 'green', title: 'GSM8K prompts', sub: ['32 prompts', 'a step'] },
    { cx: 232, w: 150, hue: 'violet', title: 'SGLang engine', sub: ['sglang::scheduler', `256 answers, ${sec(m.rollout_time_s.median)}`] },
    { cx: 392, w: 140, hue: 'green', title: 'math reward', sub: ['1 or 0', 'per answer'] },
    { cx: 550, w: 140, hue: 'blue', title: 'FSDP trainer', sub: ['FSDPTrainRayActor', 'GRPO, Adam'] },
  ];
  stations.forEach(station => f.box({ x: station.cx - station.w / 2, y: 30, w: station.w, h: 66, hue: station.hue, title: station.title, sub: station.sub }));

  const tray = unit(bench, 75, 0, 48, 8, 'green');
  for (const [k, du] of [[8, 0], [10.5, 3], [13, 6]]) {
    f.isoBlock(bench, { x: tray.box.x + 8 + du, y: tray.box.y + 10 - du, z: k, w: 26, d: 22, h: 2.5, hue: 'paper', inkHue: 'green', ink: 1, shadow: false });
  }

  const engine = unit(bench, 232, 0, 46, 30, 'violet');
  quad(engine, 7, 39, 9, 25, 'violet-ink', 0.85);
  for (const k of [20, 15]) quad(engine, 11, 30, k - 1.6, k, 'violet-fill', 0.9);
  const drum = f.isoDrum(bench, { x: engine.box.x + 23, y: engine.box.y + 23, z: 30, r: 12, h: 10, hue: 'violet' });

  const reward = unit(bench, 392, 0, 46, 26, 'green');
  [1, 0, 1, 1, 0, 1, 1, 1].forEach((score, index) => {
    const u = 6 + (index % 4) * 9;
    const v = 10 + Math.floor(index / 4) * 14;
    face(reward, [[u, v, 26], [u + 6, v, 26], [u + 6, v + 10, 26], [u, v + 10, 26]], score ? 'green-ink' : 'paper', score ? 0.75 : 0.95);
  });

  const trainer = unit(bench, 550, 0, 46, 34, 'blue');
  for (const k of [28, 21, 14]) quad(trainer, 7, 39, k - 4, k, 'blue-ink', 0.5);

  const machines = [tray, engine, reward, trainer];
  machines.forEach((machine, index) => f.leader([stations[index].cx, 98], machine === engine ? drum.top : machine.top, { hue: stations[index].hue }));
  const styles = ['call', 'model', 'event'];
  for (let i = 0; i < 3; i += 1) {
    f.beat(i + 1);
    const from = machines[i].P(machines[i].box.w, 0, i === 0 ? 6 : 15);
    const to = machines[i + 1].P(0, machines[i + 1].box.d, i === 0 ? 5 : 15);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: styles[i] });
  }
  f.beat(4);
  f.path('M550 211 V230 H232 V213', { style: 'state' });
  f.text(392, 234, `weight update, ${sec(m.update_weights_time_s.median, 2)}`, { size: 11.5, anchor: 'middle', hue: 'amber', knock: true });

  f.beat(0);
  f.kicker(20, 270, 'the same GB10 memory, taken in turns · one step to scale');
  f.text(20, 290, `${sec(step)} a step, median of ${steps} steps`, { size: 12, weight: 700 });
  const board = f.isoView({ ox: 0, oy: 380, angle: 'true' });
  const x0 = 20;
  const span = 600;
  f.isoBeam(board, { sx0: 14, sx1: 626, c: 0, back: 40, h: 8, hue: 'grey' });
  f.text(620, 400, 'GB10 · 128 GB shared by engine and trainer', { size: 11, anchor: 'end', hue: 'ink-soft' });
  let cursor = x0;
  TURNS.forEach((turn, index) => {
    f.beat(5 + index);
    const width = Math.max(5, (turn.time / step) * span);
    f.isoBeam(board, { sx0: cursor, sx1: cursor + width, z: 8, c: -6, back: 26, h: 16, hue: turn.hue, shadow: index === 0 });
    const label = `${sec(turn.time, turn.digits || 1)}`;
    if (index === TURNS.length - 1) {
      f.step(cursor + width / 2, 318, index + 1, { hue: turn.hue });
      f.text(cursor + width / 2 - 14, 322, label, { size: 11.5, weight: 700, anchor: 'end', hue: turn.hue });
    } else {
      f.step(cursor + 14, 318, index + 1, { hue: turn.hue });
      f.text(cursor + 28, 322, label, { size: 11.5, weight: 700, hue: turn.hue });
    }
    f.step(29, 430 + index * 22, index + 1, { hue: turn.hue });
    f.text(46, 434 + index * 22, turn.line, { size: 12, serif: true, hue: 'ink-soft' });
    cursor += width;
  });

  f.beat(0);
  f.text(20, 522, 'Medians from the run made before the heat guard, so no pause could occur.', { size: 11, serif: true, hue: 'ink-mute' });
});
