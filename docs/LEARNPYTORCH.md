# LearnPyTorch tensor lab

Entry: `/learn/learnpytorch/`. Full lessons are available at `/zh-cn/learn/learnpytorch/`, `/en/learn/learnpytorch/` and `/fr/learn/learnpytorch/`.

The lab contains nine challenges: axis permutation, row centering with broadcasting, batched matrix multiplication, flattening while preserving batches, targeted squeeze, channel-wise bias, global average pooling, linear-layer forward computation, and softmax over attention keys. Each challenge starts with an incorrect program and a visual target. Learners can inspect intermediate values, axis labels, strides and shared storage; passing requires matching both shape and values on four inputs. Hints, a free playground, local progress, shareable code links and runnable Python downloads support further practice.

It runs entirely in a normal JavaScript browser. No Python installation, GPU, account or execution server is required. This is a bounded educational simulator of a documented PyTorch subset, not the PyTorch runtime. It supports small nonempty floating-point tensors, at most four axes and 4,096 elements, and a limited expression grammar. It does not implement autograd, training, devices, arbitrary Python or the complete PyTorch API. Python exports use float64 to match simulator arithmetic and require real PyTorch in the learner's own Python environment.

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

`npm test` includes numerical operations, malformed syntax, allocation limits, generated-input validation, exports and translation schema coverage. The 14 engine tests can also be run directly with `node --test tests/tensor-lab/engine.test.mjs`. `npm run test:e2e -- tests/browser/tensor-learning.spec.ts` exercises lesson completion, trace inspection, exports, persistence, storage denial, translated mobile layouts, search, language switching and authenticated preview. Run the repository typecheck and production build before release.


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
