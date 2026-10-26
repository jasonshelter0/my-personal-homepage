import {execute} from '../../apps/site/src/lib/tensor-lab/engine.mjs';
import {lessons} from '../../apps/site/src/lib/tensor-lab/lessons.mjs';
const cases = [
  'x = torch.arange(12).reshape(2, 3, 2)\ny = x.permute(2, 0, 1)',
  'x = torch.arange(12).reshape(3, 4)\ny = x - x.mean(dim=1, keepdim=True)',
  'x = torch.arange(12).reshape(3, 4)\ny = x.sum(dim=0)',
  'x = torch.arange(12).reshape(3, 4)\ny = x.transpose(0, 1).reshape(2, 6)',
  'x = torch.tensor([[1], [2]])\ny = x + torch.tensor([10, 20, 30])',
  'x = torch.ones(2, 1, 3)\ny = x + torch.arange(4).reshape(4, 1)',
  'x = torch.arange(12).reshape(2, 2, 3)\nk = torch.arange(24).reshape(2, 4, 3)\ny = x @ k.transpose(-2, -1)',
  'x = torch.arange(12).reshape(2, 2, 3)\ny = x @ torch.arange(6).reshape(3, 2)',
  'x = torch.tensor([[1, 2], [3, 4]])\ny = x.unsqueeze(-1).squeeze(-1)',
  'y = torch.tensor([[5]]).squeeze()',
  'y = torch.arange(6).mean()',
  'y = torch.arange(6).reshape(-1, 2)',
  'y = torch.arange(12).reshape(2, 1, 2, 3).transpose(-2, -1)',
];
for (const lesson of lessons) for(let seed=0;seed<4;seed++) {
  const input=lesson.initial(seed);
  cases.push(Object.entries(input).map(([name,t])=>`${name} = torch.tensor([${t.values.join(',')}]).reshape(${t.shape.join(',')})`).join('\n')+'\n'+lesson.solution);
}
console.log(JSON.stringify(cases.map(code=>{const y=execute(code,{}).env.y;return {code,shape:y.shape,values:y.values,strides:y.strides};})));
