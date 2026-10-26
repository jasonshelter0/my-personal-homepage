import test from 'node:test';
import assert from 'node:assert/strict';
// Browser-shared pure JavaScript module; no runtime framework is required.
// @ts-expect-error JavaScript educational calculation module.
import { scalarTTT, estimateTTTCost, makeTTTPlan } from '../apps/site/src/lib/ttt-learning.js';

test('TTT default gradient step and readout match the hand calculation', () => {
  const state = scalarTTT();
  assert.equal(state.history[0].loss, 0.5);
  assert.equal(state.history[0].gradient, -2);
  assert.equal(state.history[1].w, 0.2);
  assert.ok(Math.abs(state.history[1].readout - 0.6) < 1e-12);
  assert.ok(Math.abs(state.history[1].loss - 0.18) < 1e-12);
});

test('TTT zero steps, negative states and zero learning view are valid', () => {
  const zero = scalarTTT({ steps: 0, w0: -1 });
  assert.equal(zero.history.length, 1);
  assert.equal(zero.history[0].w, -1);
  assert.equal(zero.history[0].readout, -3);
  assert.equal(scalarTTT({ k: 0 }).regime, 'stationary');
  assert.equal(scalarTTT({ k: 0 }).history[1].w, 0);
});

test('TTT trajectory agrees with the analytic solution and detects unstable steps', () => {
  const state = scalarTTT({ steps: 20 });
  for (const row of state.history) assert.ok(Math.abs(row.w - 0.5 * (1 - 0.6 ** row.step)) < 1e-12);
  assert.equal(state.regime, 'convergent');
  const unstable = scalarTTT({ eta: 0.6, steps: 3 });
  assert.equal(unstable.regime, 'divergent');
  assert.ok(unstable.history[3].loss > unstable.history[0].loss);
  assert.equal(scalarTTT({ eta: 0.5 }).regime, 'boundary');
  assert.throws(() => scalarTTT({ steps: -1 }), RangeError);
  assert.throws(() => scalarTTT({ eta: Infinity }), RangeError);
  assert.ok(scalarTTT({ k: 1e60, steps: 20 }).stopped);
});

test('TTT cost never invents timing for missing measurements', () => {
  const plan = makeTTTPlan();
  assert.equal(plan.estimate.complete, false);
  assert.equal(plan.estimate.gpuHours, null);
  assert.equal(plan.estimate.idealWallHours, null);
  assert.equal(plan.jobs[0].epochs * plan.jobs[0].stepsPerEpoch, 20);
  assert.equal(plan.test_labels_for_inner_updates, false);
  assert.equal(plan.status, 'draft_not_executed');
  assert.equal(estimateTTTCost([], 1).gpuHours, null);
});

test('TTT GPU-hours and wall lower bound account for single-GPU runs', () => {
  const jobs = [{ id:'B0', stepsPerEpoch:100, epochs:36, secondsPerStep:1, seeds:3 }];
  const cost = estimateTTTCost(jobs, 8);
  assert.equal(cost.gpuHours, 3);
  assert.equal(cost.idealWallHours, 1);
  assert.equal(cost.runCount, 3);
  assert.equal(estimateTTTCost(jobs, 2).idealWallHours, 1.5);
  const missing = estimateTTTCost([...jobs,{...jobs[0],id:'B1',secondsPerStep:null}],2);
  assert.deepEqual(missing.missing,['B1']);
  assert.equal(missing.gpuHours,null);
});

test('TTT experiment selection preserves paired controls and separates smoke seeds', () => {
  const plan = makeTTTPlan({ids:['S0','B0','B1','H0','H1'],resolution:256,seeds:3});
  assert.equal(plan.jobs[0].seeds,1);
  assert.equal(plan.jobs[1].seeds,3);
  assert.equal(plan.jobs[1].resolution,256);
  assert.equal(plan.jobs[3].resolution,512);
  assert.ok(plan.fixed_controls.includes('decoder'));
  assert.ok(plan.fixed_controls.includes('paired_seeds'));
});
