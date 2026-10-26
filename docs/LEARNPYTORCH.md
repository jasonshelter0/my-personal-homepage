# LearnPyTorch tensor lab

Entry: `/learn/learnpytorch/`. Full lessons are available at `/zh-cn/learn/learnpytorch/`, `/en/learn/learnpytorch/` and `/fr/learn/learnpytorch/`.

The lab contains nine challenges: axis permutation, row centering with broadcasting, batched matrix multiplication, flattening while preserving batches, targeted squeeze, channel-wise bias, global average pooling, linear-layer forward computation, and softmax over attention keys. Each challenge starts with an incorrect program and a visual target. Learners can inspect intermediate values, axis labels, strides and shared storage; passing requires matching both shape and values on four inputs. Hints, a free playground, local progress, shareable code links and runnable Python downloads support further practice.

It runs entirely in a normal JavaScript browser. No Python installation, GPU, account or execution server is required. This is a bounded educational simulator of a documented PyTorch subset, not the PyTorch runtime. It supports small nonempty floating-point tensors, at most four axes and 4,096 elements, and a limited expression grammar. The tensor chapter does not implement autograd, training, devices, arbitrary Python or the complete PyTorch API. The separate scalar autograd chapter is described below. Python exports use float64 to match simulator arithmetic and require real PyTorch in the learner's own Python environment.

## Source

- `apps/site/src/components/TensorLearningLesson.astro`: native page structure.
- `apps/site/src/content/learn/learnpytorch/*.json`: complete localized teaching and interface text.
- `apps/site/src/lib/tensor-lab/engine.mjs`: tensor operations and bounded parser; no eval or dynamic code execution.
- `apps/site/src/lib/tensor-lab/lessons.mjs`: generated inputs, targets and checks against fresh inputs.
- `apps/site/src/lib/tensor-lab/export.mjs`: Python exports.
- `apps/site/src/lib/tensor-lab/app.js`: browser interactions and visual rendering.
- `apps/site/src/styles/tensor-lab.css`: theme-aware layout, including a keyboard-accessible expanded workspace.

The learning catalog, explicit route mapping and normal Astro build include the page in the hub, language navigation, sitemap and Pagefind. Bundled assets and links retain authenticated preview prefixes. No CMS schema or database changes are required. Updates should rebuild from the currently published snapshot, inspect authenticated preview, then publish through the existing release workflow; see `LEARN_CODEX_HANDOFF.md`.

Progress stays in browser localStorage; storage failure does not prevent learning. Code is included in the URL fragment only when shared and is never executed as JavaScript. Downloads and lesson rendering use local browser data. No private admin APIs are queried by this lesson.

## Checks

`npm test` includes numerical operations, malformed syntax, allocation limits, generated-input validation, exports and translation schema coverage. The 15 engine tests can also be run directly with `node --test tests/tensor-lab/engine.test.mjs`. `npm run test:e2e -- tests/browser/tensor-learning.spec.ts` exercises lesson completion, trace inspection, exports, persistence, storage denial, translated mobile layouts, search, language switching and authenticated preview. Run the repository typecheck and production build before release.


## Expanded curriculum

| Lesson | Mistake to diagnose | Transfer skill |
| --- | --- | --- |
| 4. Flatten | `flatten()` also removes the batch axis | `flatten(start_dim=1)` and axis ranges |
| 5. Squeeze | `squeeze()` drops a batch of size one | Remove only the intended singleton axis |
| 6. Channel bias | A vector silently aligns with width on a square example | Broadcast with `[1, C, 1, 1]` and inferred channel count |
| 7. Pooling | Reducing channels discards the representation | Reduce spatial axes and track shifted axis positions |
| 8. Linear layer | Stored weights use `[out, in]` order | Apply one projection and bias across leading dimensions |
| 9. Softmax | Normalizing queries instead of keys has the wrong meaning | Choose the competition axis and handle large finite scores |

`flatten(start_dim=0, end_dim=-1)` and `softmax(dim)` are implemented in the bounded parser, with strict method-specific keyword validation. Softmax subtracts each group's maximum before exponentiation. Flatten preserves logical ordering; its storage-copy behavior follows the existing conservative reshape policy, so some noncontiguous PyTorch views are copied here. Scalar flatten and softmax are supported. Existing three-lesson progress and share URLs remain valid; progress totals and next-lesson navigation derive from the curriculum.

Official references are linked beside each lesson: [flatten](https://docs.pytorch.org/docs/stable/generated/torch.flatten.html), [squeeze](https://docs.pytorch.org/docs/stable/generated/torch.squeeze.html), [Linear](https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html), and [softmax](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.softmax.html). The optional `python tests/tensor-lab/conformance.py` compares values, shapes and strides with an installed CPU PyTorch and executes every lesson's exported reference program. It is separate from browser execution; no Python runtime is shipped to visitors.


## Visual explanations

The lab can replay a recorded execution, pause, and step in either direction. Playback starts only on request and stops when the code, lesson, selected frame or page visibility changes. The difference view displays actual `y - target` values when shapes match. It is disabled for missing or incompatible outputs.

Clicking a matrix-product cell shows its actual multiplicative terms and total, including a broadcast bias when present. Explanations follow recorded operand provenance, so changed user code is explained rather than replaced with the reference solution. Long dot products show their first twelve terms and clearly state the limit. The softmax lesson includes a query selector, raw scores, output bars and row sum, so a wrong normalization axis becomes visible. All views include numerical labels, keyboard controls and localized explanations; animations are not required to learn.

## Visual autograd chapter

`/learn/learnpytorch/autograd/` adds four missions in all three languages:

1. Predict `w.grad` on two distinct examples and trace the chain rule, including both contributions through a shared error node.
2. Repair a detached weight path while observing that the bias can still receive a gradient.
3. Compare per-pass derivatives with accumulated leaf `.grad` buffers across fresh forward graphs.
4. Repair the order of zeroing, forward, backward and SGD updates; compare the fitted line and loss over twelve steps. Passing is checked on two datasets.

This is a separate first-order scalar autodiff engine, not tensor autograd or a Python interpreter. It supports `+`, `-`, `*`, `/` and detach, with graph/allocation/numerical limits. Non-leaf diagram derivatives are explanatory adjoints, not automatically retained PyTorch `.grad`. Graph replay shows partial contributions and partial buffers rather than revealing final values early. No animation starts automatically. The graph uses keyboard-selectable HTML buttons, numeric explanations, and outside lanes for long edges; charts include exact tables. Python exports reproduce the selected settings using float64 and real PyTorch.

Source: `components/AutogradLearningLesson.astro`, `lib/autograd-lab/{engine.mjs,app.js}`, `content/learn/autograd/*.json` and `styles/autograd-lab.css`. Progress uses the independent `learnpytorch-autograd-v1` localStorage key; storage denial leaves the lab usable. The original tensor engine and progress are unaffected.

Validation: `tests/autograd-lab/engine.test.mjs` checks derivatives, shared nodes, detach, buffers, bounds, ordering and numerical SGD trajectories. Optional `PYTORCH_PYTHON=/path/to/python node tests/autograd-lab/compare-pytorch.mjs` checks 32 graph/backward passes, all 24 operation permutations plus six rate/accumulation variants, and executes 19 exported programs against installed CPU PyTorch. `tests/browser/autograd-learning.spec.ts` covers missions, playback, prediction capture, keyboard use, persistence, export, translated 320px layouts, search, aliases and authenticated preview prefixes.

Teaching references: [PyTorch autograd](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html) and [zeroing gradients](https://docs.pytorch.org/tutorials/recipes/recipes/zeroing_out_gradients.html).
