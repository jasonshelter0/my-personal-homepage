import { Tensor, binary, matmul, execute, equal } from './engine.mjs';
export const lessons = [
  {
    id: 'axes', number: '01', title: 'A change of perspective', short: 'Reorder the axes', category: 'SHAPE & AXES', duration: '5 min',
    intro: 'An image is more than a list of numbers. Each value belongs to a pixel and a color channel. Move the axes without losing those relationships.',
    goal: 'Turn x from [height, width, channel] into y with [channel, height, width]. Keep every pixel in the right place.',
    concept: 'reshape changes how a sequence is grouped. permute changes which axis comes first. Equal shapes do not guarantee equal values.',
    starter: '# x has shape [2, 3, 2]\n# Move channels to the first axis.\ny = x.reshape(2, 2, 3)',
    initial(seed = 0) { return { x: new Tensor(Array.from({length:12}, (_,i) => seed ? (i * 7 + seed * 3) % 23 : i + 1), [2, 3, 2], { axes: ['height', 'width', 'channel'] }) }; },
    target: ({x}) => x.permute(2, 0, 1),
    hints: ['Read the original axes as 0 = height, 1 = width, 2 = channel.', 'The new order is old axis 2, then old axis 0, then old axis 1.', 'Try y = x.permute(2, 0, 1). Watch the cell values, not just the shape.'],
    solution: 'y = x.permute(2, 0, 1)',
    takeaway: 'You preserved which pixel each value belongs to. permute reorders axes and shares storage; reshape alone cannot perform this axis swap.',
    transfer: 'In a notebook, convert a [batch, height, width, channel] tensor to [batch, channel, height, width]. Which axis stays in place?',
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.permute.html'
  },
  {
    id: 'broadcast', number: '02', title: 'Give every row its space', short: 'Make broadcasting click', category: 'REDUCTION & BROADCASTING', duration: '6 min',
    intro: 'Subtract each row’s average. A small change to the shape of the means decides where those values are reused.',
    goal: 'Create y by subtracting the mean of each row of x from that same row. Each output row should have mean zero.',
    concept: 'Broadcasting aligns axes from the right. Dimensions must match, or one must be 1. keepdim=True leaves a size-one axis where you reduced.',
    starter: '# x has shape [3, 3]\n# This runs, but does it center each row?\nmeans = x.mean(dim=1)\ny = x - means',
    initial(seed = 0) { const shape = seed ? [2 + seed % 2, 4] : [3, 3]; return { x: new Tensor(Array.from({length:shape[0]*shape[1]}, (_,i) => seed ? ((i * 5 + seed * 3) % 19) + Math.floor(i / 4) * 4 : [1,2,6,4,8,9,3,5,16][i]), shape, { axes: ['row', 'feature'] }) }; },
    target: ({x}) => binary(x, x.reduce(1, true, true), '-'),
    hints: ['On this square input, [3] aligns with columns. A successful run can still mean the wrong thing.', 'You need one mean per row, with shape [3, 1]. Keep axis 1 when reducing.', 'Use means = x.mean(dim=1, keepdim=True), then y = x - means.'],
    solution: 'means = x.mean(dim=1, keepdim=True)\ny = x - means',
    takeaway: 'The means have one column, so each row reuses its own mean. Your solution also worked on rectangular inputs where the original code fails.',
    transfer: 'Given x with shape [batch, time, features], subtract the mean across time for each batch item and feature. Which dim should you reduce?',
    docs: 'https://docs.pytorch.org/docs/stable/notes/broadcasting.html'
  },
  {
    id: 'batch', number: '03', title: 'Keep the batch together', short: 'Connect batched matrices', category: 'BATCHED MATRIX MULTIPLICATION', duration: '7 min',
    intro: 'Compare every query to every key, independently for each batch item. The batch is a collection of separate matrix multiplications.',
    goal: 'Produce scores y with shape [batch, query, key]. Each score is the dot product of a query and a key in the same batch.',
    concept: 'For @, the last two axes are matrix axes. Leading axes represent batches. Swap the key and feature axes of k so the feature dimensions contract.',
    starter: '# q: [batch, query, feature] = [2, 2, 3]\n# k: [batch, key, feature]   = [2, 4, 3]\ny = q @ k',
    initial(seed = 0) { return { q: new Tensor(Array.from({length:12}, (_,i) => (i * (seed + 1) + 2) % 7), [2,2,3], {axes:['batch','query','feature']}), k: new Tensor(Array.from({length:24}, (_,i) => (i * 3 + seed + 1) % 5), [2,4,3], {axes:['batch','key','feature']}) }; },
    target: ({q,k}) => matmul(q, k.transpose(-2, -1)),
    hints: ['The contracting feature axes both have size 3. They need to be the last axis of q and the second-last axis of k.', 'Change k from [2, 4, 3] to [2, 3, 4], leaving the batch axis alone.', 'Try y = q @ k.transpose(-2, -1).'],
    solution: 'y = q @ k.transpose(-2, -1)',
    takeaway: 'Each batch now contains a query-by-key score matrix. You contracted feature axes while keeping batches independent—the shape pattern behind attention scores.',
    transfer: 'For q [B, H, Q, D] and k [B, H, K, D], predict the result shape of q @ k.transpose(-2, -1).',
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.matmul.html'
  },
  {
    id: 'flatten', number: '04', title: 'One row per example',
    starter: '# x: [batch, height, width] = [2, 2, 3]\ny = x.flatten()',
    solution: 'y = x.flatten(start_dim=1)',
    initial(seed = 0) { const shape = seed ? [seed + 1, 2 + seed % 2, 3] : [2, 2, 3]; return { x: values(shape, seed, ['batch', 'height', 'width']) }; },
    target: ({x}) => x.flatten(1),
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.flatten.html'
  },
  {
    id: 'squeeze', number: '05', title: 'Keep the single example',
    starter: '# x: [batch, feature, singleton] = [1, 3, 1]\ny = x.squeeze()',
    solution: 'y = x.squeeze(-1)',
    initial(seed = 0) { return { x: values(seed ? [1 + seed % 2, 3 + seed, 1] : [1, 3, 1], seed, ['batch', 'feature', 'singleton']) }; },
    target: ({x}) => x.squeeze(-1),
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.squeeze.html'
  },
  {
    id: 'channel-bias', number: '06', title: 'A bias for each channel',
    starter: '# x: [batch, channel, height, width] = [2, 3, 2, 3]\n# bias: [channel] = [3]\ny = x + bias',
    solution: 'y = x + bias.reshape(1, -1, 1, 1)',
    initial(seed = 0) { const channels = seed ? seed + 2 : 3; return { x: values([2, channels, 2, seed ? 4 : 3], seed, ['batch', 'channel', 'height', 'width']), bias: new Tensor(Array.from({length:channels}, (_,i) => (i + 1) * 4 + seed), [channels], {axes:['channel']}) }; },
    target: ({x,bias}) => binary(x, bias.reshape(1, -1, 1, 1), '+'),
    docs: 'https://docs.pytorch.org/docs/stable/notes/broadcasting.html'
  },
  {
    id: 'pool', number: '07', title: 'Summarize the image, keep its channels',
    starter: '# x: [batch, channel, height, width] = [2, 3, 2, 2]\ny = x.mean(dim=1)',
    solution: 'y = x.mean(dim=-1).mean(dim=-1)',
    initial(seed = 0) { return { x: values(seed ? [1 + seed % 2, 3, 2 + seed, 4] : [2, 3, 2, 2], seed, ['batch', 'channel', 'height', 'width']) }; },
    target: ({x}) => x.reduce(-1, false, true).reduce(-1, false, true),
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.nn.AdaptiveAvgPool2d.html'
  },
  {
    id: 'linear', number: '08', title: 'A linear layer from tensor operations',
    starter: '# x: [batch, time, input] = [2, 3, 3]\n# weight: [output, input] = [4, 3]; bias: [output] = [4]\ny = x @ weight + bias',
    solution: 'y = x @ weight.transpose(-2, -1) + bias',
    initial(seed = 0) { const input = seed ? 2 + seed : 3, output = seed ? 3 + seed : 4; return { x: values([2, seed ? 2 + seed : 3, input], seed, ['batch', 'time', 'feature']), weight: values([output, input], seed + 2, ['output', 'feature']), bias: values([output], seed + 4, ['output']) }; },
    target: ({x,weight,bias}) => binary(matmul(x, weight.transpose(-2, -1)), bias, '+'),
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html'
  },
  {
    id: 'softmax', number: '09', title: 'Choose what competes for probability',
    starter: '# scores: [batch, query, key] = [2, 3, 3]\n# For each query, probabilities over keys must sum to one.\ny = scores.softmax(dim=1)',
    solution: 'y = scores.softmax(dim=-1)',
    initial(seed = 0) { const shape = seed ? [2, 2 + seed, 4] : [2, 3, 3]; return { scores: new Tensor(Array.from({length:shape.reduce((a,b)=>a*b,1)}, (_,i) => ((i * 7 + seed * 3) % 13) - 6 + (seed === 2 ? 1000 : seed === 3 ? -1000 : 0)), shape, {axes:['batch','query','key']}) }; },
    target: ({scores}) => scores.softmax(-1),
    docs: 'https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.softmax.html'
  }
];
function values(shape, seed, axes) {
  return new Tensor(Array.from({length:shape.reduce((a,b)=>a*b,1)}, (_,i) => ((i * 7 + seed * 3) % 19) - 5), shape, {axes});
}
export const sandbox = {
  id: 'sandbox', number: '∞', title: 'Follow your curiosity', short: 'Open playground', category: 'FREE EXPLORATION', duration: 'Your pace',
  intro: 'A small space for big “what ifs”. Create a tensor, change its shape, or try an operation from the API guide. Every step leaves a trace.',
  goal: 'Explore freely. Try changing dim, adding keepdim=True, or transposing a tensor before a reshape.',
  concept: 'Select any step to inspect its values, axes, and storage. Reset brings you back to this starting point.',
  starter: 'x = torch.arange(12).reshape(3, 4)\nmeans = x.mean(dim=1, keepdim=True)\ny = x - means',
  initial: () => ({ x: new Tensor(Array.from({length:12}, (_,i) => i), [3,4], {axes:['row','column']}) }),
  hints: ['Try y = x.transpose(0, 1).', 'Try y = x.sum(dim=0, keepdim=True).', 'Create your own input with torch.tensor([[1, 2], [3, 4]]).'],
  docs: 'https://docs.pytorch.org/docs/stable/tensors.html'
};
export function validate(lesson, code) {
  for (let seed = 0; seed < 4; seed++) {
    const input = lesson.initial(seed), expected = lesson.target(input); let actual;
    try { actual = execute(code, input).env.y; } catch (e) { return {ok:false, message: seed ? `The visible example may work, but a fresh input failed. ${e.message}` : e.message}; }
    if (!equal(actual, expected)) {
      if (!(actual instanceof Tensor)) return {ok:false, message:'Assign your answer to y so we can check it.'};
      if (JSON.stringify(actual.shape) !== JSON.stringify(expected.shape)) return {ok:false, message:`Expected y with shape [${expected.shape}], got [${actual.shape}]. Follow the labeled axes.`};
      return {ok:false, message: seed ? 'Your solution needs to work on fresh inputs too. Use the input tensors rather than hard-coded answers.' : 'The shape matches, but the values do not. Compare your result with the target; look for the first outlined cell.'};
    }
  }
  return {ok:true, message:'Shape and values match on this example and 3 fresh inputs.'};
}
