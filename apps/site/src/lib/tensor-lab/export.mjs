// Give constructors explicit floating semantics when leaving the simulator.
export function exportPython(lesson, code) {
  const translated = code.split('\n').map(line => {
    const commentAt = line.indexOf('#'), source = commentAt < 0 ? line : line.slice(0, commentAt);
    const insertions = [], pattern = /torch\.(?:tensor|arange|ones|zeros)\s*\(/g;
    for (const match of source.matchAll(pattern)) {
      let depth = 1, i = match.index + match[0].length;
      for (; i < source.length && depth; i++) { if (source[i] === '(') depth++; if (source[i] === ')') depth--; }
      if (!depth) insertions.push(i);
    }
    let output = source;
    for (const i of insertions.sort((a,b)=>b-a)) output = output.slice(0,i)+'.to(torch.float64)'+output.slice(i);
    return output + (commentAt < 0 ? '' : line.slice(commentAt));
  });
  let output = Object.keys(lesson.initial())[0];
  for (let i = translated.length - 1; i >= 0; i--) {
    const expression = translated[i].split('#')[0].trim();
    if (!expression) continue;
    const assignment = expression.match(/^([A-Za-z_]\w*)\s*=/);
    if (assignment) output = assignment[1];
    else { output = '_lab_output'; translated[i] = '_lab_output = ' + translated[i]; }
    break;
  }
  return ['import torch', '', '# Inputs from LearnPyTorch Tensor Lab', '# The lab uses floating-point numbers; exported constructors convert explicitly.',
    ...Object.entries(lesson.initial()).map(([name,t]) => `${name} = torch.tensor(${JSON.stringify(t.values)}, dtype=torch.float64).reshape(${t.shape.length ? t.shape.join(', ') : '()'})`), '', translated.join('\n'), '', `print(${output})`, `print('shape:', ${output}.shape)`, ''].join('\n');
}
