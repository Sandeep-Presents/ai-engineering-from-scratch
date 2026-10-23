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
  { hue: 'violet', time: m.rollout_time_s.median, line: 'rollout: the SGLang engine writes 256 answers' },
  { hue: 'blue', time: m.log_probs_time_s.median, line: 'log probabilities: the FSDP trainer reads them' },
  { hue: 'blue', time: gradient, line: 'GRPO update: Adam, one step' },
  { hue: 'amber', time: m.update_weights_time_s.median, digits: 2, line: 'weight update: new weights to the engine' },
];
const ACTORS = [
  { sx: 44, hue: 'grey', title: 'Ray head', sub: 'ray start --head' },
  { sx: 102, hue: 'amber', title: 'TrainerController', sub: 'Ray actor, the step loop' },
  { sx: 160, hue: 'violet', title: 'ray::RolloutExecutor', sub: 'Ray actor, drives SGLang' },
  { sx: 218, hue: 'green', title: 'math reward', sub: '1 or 0 per answer, on CPU' },
];

module.exports = figure('plate-miles-loop', {
  height: 700,
  title: 'One GRPO step on one GB10',
  desc: `One DGX Spark GB10 superchip: the Grace CPU and the Blackwell GPU stand on one 128 GB pool of unified LPDDR5X memory. On Grace run the Ray head, the TrainerController and ray::RolloutExecutor actors, and the math reward. On Blackwell the SGLang rollout engine and the FSDP trainer take turns, drawn to scale over a median step of ${sec(step)}: rollout ${sec(m.rollout_time_s.median)}, log probabilities ${sec(m.log_probs_time_s.median)}, GRPO update ${sec(gradient)}, and weight update ${sec(m.update_weights_time_s.median, 2)}. The tenant that waits is parked in the same pool: the trainer onloads in ${sec(m.wake_up_time_s.median, 2)} and offloads in ${sec(m.sleep_time_s.median, 2)}. Medians of ${steps} steps of a run made before we added the heat guard.`,
}, f => {
  const chip = f.isoView({ ox: 0, oy: 476, angle: 'true' });
  const face = (part, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => part.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });
  const flat = (part, u, v, w, d, hue, opacity) => face(part, [[u, v, part.box.h], [u + w, v, part.box.h], [u + w, v + d, part.box.h], [u, v + d, part.box.h]], hue, opacity);
  const quad = (part, u0, u1, k0, k1, hue, opacity) => face(part, [[u0, part.box.d, k0], [u1, part.box.d, k0], [u1, part.box.d, k1], [u0, part.box.d, k1]], hue, opacity);

  f.kicker(20, 18, 'one NVIDIA DGX Spark · GB10 superchip');
  f.text(620, 18, 'Qwen3-0.6B', { size: 11, anchor: 'end', hue: 'ink-soft' });

  f.isoBeam(chip, { sx0: 14, sx1: 626, c: 120, back: 270, h: 10, hue: 'paper', inkHue: 'grey', ink: 1.4 });
  for (let i = 1; i < 8; i += 1) {
    const sx = 14 + (612 * i) / 8;
    const low = chip.P(...chip.at(sx, 120), 0);
    const high = chip.P(...chip.at(sx, 120), 10);
    f.rule(low[0], low[1], high[0], high[1], { hue: 'grey', opacity: 0.7 });
  }
  const grace = f.isoBeam(chip, { sx0: 20, sx1: 246, z: 10, c: -30, back: 110, h: 10, hue: 'grey' });
  f.isoBeam(chip, { sx0: 258, sx1: 620, z: 10, c: -30, back: 110, h: 10, hue: 'grey' });

  const machines = ACTORS.map((actor, index) => {
    const [x, y] = chip.at(actor.sx, -84);
    const block = f.isoBlock(chip, { x: x - 13, y: y - 13, z: 20, w: 26, d: 26, h: index === 0 ? 20 : 16, hue: actor.hue, shadow: false });
    if (index === 3) [[4, 4, 1], [12, 4, 0], [4, 14, 1], [12, 14, 1]].forEach(([u, v, s]) => flat(block, u, v, 8, 8, s ? 'green-ink' : 'paper', s ? 0.75 : 0.95));
    else quad(block, 5, 21, 4, index === 0 ? 15 : 11, `${actor.hue}-ink`, 0.6);
    return block;
  });
  ACTORS.forEach((actor, index) => {
    const y = 66 + index * 50;
    f.text(actor.sx - 24, y, actor.title, { size: 12, weight: 700, hue: actor.hue === 'grey' ? undefined : actor.hue });
    f.text(actor.sx - 24, y + 16, actor.sub, { size: 11, serif: true, hue: 'ink-soft' });
    f.leader([actor.sx, y + 22], machines[index].top, { hue: actor.hue === 'grey' ? 'ink-mute' : actor.hue });
  });

  f.kicker(620, 252, 'Blackwell GPU · one step to scale', { anchor: 'end' });
  f.text(620, 272, `${sec(step)} a step, median of ${steps}`, { size: 12, weight: 700, anchor: 'end' });

  const x0 = 264;
  const span = 350;
  const edges = [x0];
  TURNS.forEach(turn => edges.push(edges[edges.length - 1] + Math.max(5, (turn.time / step) * span)));
  const tenants = [];
  TURNS.forEach((turn, index) => {
    f.beat(1 + index * 2);
    tenants.push(f.isoBeam(chip, { sx0: edges[index], sx1: edges[index + 1] - (index < 3 ? 1 : 0), z: 20, c: -46, back: 64, h: 20, hue: turn.hue, shadow: false }));
    const last = index === TURNS.length - 1;
    const cx = last ? edges[index] - 14 : edges[index] + 12;
    const cy = index === 2 ? 354 : 330;
    f.step(cx, cy, index + 1, { hue: turn.hue });
    f.text(last ? cx - 13 : cx + 13, cy + 4, sec(turn.time, turn.digits || 1), { size: 11.5, weight: 700, hue: turn.hue, anchor: last ? 'end' : undefined });
  });

  f.beat(1);
  f.isoBeam(chip, { sx0: edges[0], sx1: edges[1] - 1, z: 10, c: 92, back: 36, h: 12, hue: 'paper', inkHue: 'blue', ink: 1.2, dash: 'dashed', shadow: false });
  f.beat(2);
  f.isoBeam(chip, { sx0: edges[1], sx1: edges[3] - 1, z: 10, c: 92, back: 36, h: 12, hue: 'paper', inkHue: 'violet', ink: 1.2, dash: 'dashed', shadow: false });
  const rowTop = chip.P(...chip.at(0, -46), 20)[1];
  const parkTop = chip.P(...chip.at(0, 92), 22)[1];
  const parkBack = chip.P(...chip.at(0, 56), 22)[1];
  f.line(edges[1] - 8, parkBack + 2, edges[1] - 8, rowTop + 4, { style: 'state' });
  f.text(edges[1] - 14, parkBack - 8, `onload ${sec(m.wake_up_time_s.median, 2)}`, { size: 11, anchor: 'end', hue: 'amber', knock: true });
  f.line(edges[1] + 8, rowTop + 4, edges[1] + 8, parkBack + 2, { style: 'state' });
  f.text(edges[1] + 14, parkBack - 8, 'engine released', { size: 11, hue: 'amber', knock: true });

  f.beat(6);
  f.line(edges[3] - 8, rowTop + 4, edges[3] - 8, parkTop + 4, { style: 'state' });
  f.text(edges[3] - 14, parkBack - 8, `offload ${sec(m.sleep_time_s.median, 2)}`, { size: 11, anchor: 'end', hue: 'amber', knock: true });

  f.beat(7);
  const top = tenants[0].left[1];
  f.path(`M${edges[3] + 2} ${top - 4} V300 H${edges[0] + 92} V${top - 4}`, { style: 'state' });
  f.text((edges[0] + edges[3]) / 2, 304, `weight update, ${sec(m.update_weights_time_s.median, 2)}`, { size: 11.5, anchor: 'middle', hue: 'amber', knock: true });

  f.beat(0);
  f.text(20, 566, 'Grace CPU, 20 Arm cores', { size: 11, hue: 'ink-soft' });
  f.leader([100, 556], grace.front[3], { hue: 'ink-mute' });
  f.text(620, 566, 'LPDDR5X, 128 GB unified, one pool for both chips', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.leader([560, 556], chip.P(...chip.at(560, 120), 6), { hue: 'ink-mute' });
  f.rect(20, 582, 12, 12, { hue: 'violet' });
  f.text(38, 592, 'on the GPU', { size: 11, hue: 'ink-soft' });
  f.rect(140, 582, 12, 12, { hue: 'paper', stroke: color('ink-mute'), dash: 'dashed' });
  f.text(158, 592, 'parked in the pool', { size: 11, hue: 'ink-soft' });
  TURNS.forEach((turn, index) => {
    f.step(29, 614 + index * 21, index + 1, { hue: turn.hue });
    f.text(46, 618 + index * 21, turn.line, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.text(620, 692, 'Medians from the run made before the heat guard.', { size: 11, serif: true, hue: 'ink-mute', anchor: 'end' });
});
