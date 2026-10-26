"""Run with a Python environment containing CPU PyTorch: python tests/tensor-lab/conformance.py."""
import json
import pathlib
import subprocess
import torch

root = pathlib.Path(__file__).resolve().parents[2]
cases = json.loads(subprocess.check_output(['node', 'tests/tensor-lab/conformance.mjs'], cwd=root))
for i, case in enumerate(cases):
    # Inputs are trusted repository test fixtures, never user-submitted code.
    env = {'torch': torch}
    # The simulator intentionally has no dtype model: use floating inputs for reductions.
    code = case['code']
    class FloatTorch:
        def tensor(self, *args, **kwargs):
            return torch.tensor(*args, dtype=torch.float64, **kwargs)
        def arange(self, *args, **kwargs):
            return torch.arange(*args, dtype=torch.float64, **kwargs)
        def ones(self, *args, **kwargs):
            return torch.ones(*args, dtype=torch.float64, **kwargs)
        def zeros(self, *args, **kwargs):
            return torch.zeros(*args, dtype=torch.float64, **kwargs)
    env['torch'] = FloatTorch()
    exec(code, env)
    actual = env['y']
    assert list(actual.shape) == case['shape'], (i, 'shape')
    expected = torch.tensor(case['values'], dtype=torch.float64).reshape(actual.shape)
    torch.testing.assert_close(actual, expected, rtol=1e-5, atol=1e-5)
    assert list(actual.stride()) == case['strides'], (i, 'stride', actual.stride(), case['strides'])
print(f'{len(cases)} cases match PyTorch {torch.__version__}: values, shapes, and strides.')

exports = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {exportPython} from './apps/site/src/lib/tensor-lab/export.mjs'; "
    "import {lessons,sandbox} from './apps/site/src/lib/tensor-lab/lessons.mjs'; "
    "console.log(JSON.stringify([...lessons.map(l=>exportPython(l,l.solution)),"
    "exportPython(sandbox,sandbox.starter), exportPython(sandbox,'x.transpose(0, 1)')]))"
], cwd=root))
import contextlib
import io
for source in exports:
    with contextlib.redirect_stdout(io.StringIO()):
        exec(source, {})
print(f'{len(exports)} exported Python experiments execute successfully with real PyTorch.')
