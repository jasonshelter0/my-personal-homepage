/** A scalar teaching model, not a neural-network benchmark. */
export function scalarTTT({ w0 = 0, k = 2, v = 1, q = 3, eta = 0.1, steps = 1 } = {}) {
  if (![w0, k, v, q, eta, steps].every(Number.isFinite) || eta < 0 || !Number.isInteger(steps) || steps < 0 || steps > 100) {
    throw new RangeError('Finite parameters, nonnegative eta and 0–100 integer steps required');
  }
  const history = [];
  let w = w0;
  let stopped = false;
  for (let step = 0; step <= steps; step++) {
    const error = w * k - v;
    const loss = 0.5 * error ** 2;
    const gradient = error * k;
    const readout = w * q;
    if (![w, loss, gradient, readout].every(Number.isFinite) || Math.max(Math.abs(w), loss, Math.abs(readout)) > 1e100) {
      stopped = true;
      break;
    }
    history.push({ step, w, loss, gradient, readout });
    if (step < steps) w -= eta * gradient;
  }
  const factor = 1 - eta * k * k;
  const regime = k === 0 || eta === 0 ? 'stationary' : Math.abs(factor) < 1 ? 'convergent' : Math.abs(factor) === 1 ? 'boundary' : 'divergent';
  return { history, factor, regime, stopped, requestedSteps: steps, completedSteps: Math.max(0, history.length - 1), optimum: k === 0 ? null : v / k };
}

export const TTT_EXPERIMENTS = [
  { id: 'S0', model: 'original', resolution: 256, purpose: 'smoke', epochs: 2, stepsPerEpoch: 10 },
  { id: 'B0', model: 'original', resolution: null, purpose: 'baseline' },
  { id: 'B1', model: 'centroid', resolution: null, purpose: 'centroid' },
  { id: 'B2', model: 'centroid', resolution: null, purpose: 'inner_steps' },
  { id: 'H0', model: 'original', resolution: 512, purpose: 'high_resolution' },
  { id: 'H1', model: 'centroid', resolution: 512, purpose: 'high_resolution' },
];

/** Each job is one single-GPU run. Speed must be measured for that configuration. */
export function estimateTTTCost(jobs, gpuCount = 1) {
  if (!Number.isInteger(gpuCount) || gpuCount < 1) throw new RangeError('Positive integer GPU count required');
  if (!jobs.length) return { complete: false, gpuHours: null, idealWallHours: null, missing: [], runCount: 0 };
  const missing = jobs.filter(j => typeof j.secondsPerStep !== 'number' || !Number.isFinite(j.secondsPerStep) || j.secondsPerStep <= 0).map(j => j.id);
  const runCount = jobs.reduce((sum, j) => sum + j.seeds, 0);
  if (missing.length) return { complete: false, gpuHours: null, idealWallHours: null, missing, runCount };
  let total = 0, longest = 0;
  for (const job of jobs) {
    if (![job.stepsPerEpoch, job.epochs, job.seeds].every(x => Number.isInteger(x) && x > 0)) throw new RangeError('Positive integer training counts required');
    const hours = job.stepsPerEpoch * job.epochs * job.secondsPerStep / 3600;
    total += hours * job.seeds;
    longest = Math.max(longest, hours);
  }
  return { complete: true, gpuHours: total, idealWallHours: Math.max(total / gpuCount, longest), missing: [], runCount };
}

export function makeTTTPlan({ ids = ['S0', 'B0', 'B1'], resolution = 256, seeds = 1, epochs = 100, stepsPerEpoch = 100, gpuCount = 1, secondsPerStep = {} } = {}) {
  if (![256, 512].includes(resolution) || ![1, 3].includes(seeds) || ![epochs, stepsPerEpoch, gpuCount].every(x => Number.isInteger(x) && x > 0)) throw new RangeError('Invalid plan settings');
  const jobs = TTT_EXPERIMENTS.filter(x => ids.includes(x.id)).map(x => ({
    id: x.id, model: x.model, purpose: x.purpose, resolution: x.resolution || resolution,
    epochs: x.epochs || epochs, stepsPerEpoch: x.stepsPerEpoch || stepsPerEpoch,
    seeds: x.id === 'S0' ? 1 : seeds,
    secondsPerStep: typeof secondsPerStep[x.id] === 'number' && secondsPerStep[x.id] > 0 && Number.isFinite(secondsPerStep[x.id]) ? secondsPerStep[x.id] : null,
  }));
  return {
    schema: 'irstd-ttt-plan-v1', status: 'draft_not_executed', task: 'single_frame_IRSTD', method_family: 'TTT_layers_not_Tent_SAR',
    baseline_identity: 'UNCONFIRMED', candidate_dataset: 'NUAA-SIRST', split_manifest: 'SET_BEFORE_TRAINING',
    fixed_controls: ['decoder', 'split', 'supervised_loss', 'initialization_source', 'paired_seeds', 'evaluation_threshold_and_matching'],
    test_labels_for_inner_updates: false, cross_image_state_carry: false,
    inner_loss: 'FOLLOW_CONFIRMED_BASELINE_NOT_ASSUMED_ENTROPY',
    inner_steps: 'SET_FROM_BASELINE; change only this factor for B2', seed_values: 'SET_BEFORE_TRAINING',
    resources: { gpuCount, execution: 'independent_single_GPU_runs', memory_fit: 'NOT_MEASURED' },
    jobs, estimate: estimateTTTCost(jobs, gpuCount),
    estimate_excludes: ['validation', 'checkpoint_IO', 'startup', 'queueing', 'debugging'],
    note: 'S0 is a 20-step smoke check, not a performance result. Timing inputs must be measured per configuration. Ideal wall time is a lower bound, not a completion promise.',
  };
}
