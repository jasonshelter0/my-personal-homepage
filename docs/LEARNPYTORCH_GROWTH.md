# LearnPyTorch launch and learning plan

The product promise is: **debug the invisible parts of PyTorch in your browser**. The audience is a Python programmer who can write code but struggles to reason about tensor shapes, gradients or attention. A successful visit should end with an explanation the learner can give to someone else.

## What this release delivers

- Nineteen short challenges: nine tensor lessons, four autograd missions and six attention challenges. Every attention repair is checked on three distinct inputs; the causal challenges also test independence from a changed future key/value.
- A prominent no-install entry, a complete course map, combined progress and a resume link that follows the last chapter. Chapters stay open; no registration or prerequisite lock.
- A shareable hook: **Can your model see the future?** Toggle a causal mask, change the last token and watch the first token's output stop changing.
- Reproducible attention links containing bounded settings and example/selection identifiers. PNG visual cards contain the actual weights and control settings. Python downloads reproduce the experiment in real PyTorch.
- Three localized social-preview images, searchable static explanations, language alternates and canonical chapter pages. Fragment links select individual challenges; they are not separate indexed pages.
- Follow-on chapter links and autograd mission deep links. Existing tensor progress and code-sharing URLs remain compatible.

The new chapter is `/learn/learnpytorch/attention/`; the quick demo is `/en/learn/learnpytorch/attention/#attention-causal`. The course entry is `/learn/learnpytorch/`.

## Why this direction

[Learn Git Branching](https://github.com/pcottle/learnGitBranching) joins a visible state, a concrete objective and executable actions. [Transformer Explainer](https://github.com/poloclub/transformer-explainer) provides an interactive walkthrough of a real transformer. LearnPyTorch's opportunity is a sequence of small debugging challenges with numerical inspection and code transfer. This is a design hypothesis, not evidence that traffic or retention will increase.

The attention lab uses hand-authored toy vectors and a single head; it does not run a language model or imply that attention weights explain a model's reasoning. Its mathematics is checked against [PyTorch scaled dot-product attention](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html). All animations and visual state must remain optional for understanding; numerical labels, keyboard controls and exported code are part of the core lesson.

## Ready-to-edit launch copy

English:

> Can your model see the future? I built a browser challenge where you change a future token and watch an earlier output move. Fix the causal mask and the leak disappears. LearnPyTorch now has 19 visual debugging challenges covering tensors, autograd and attention, with runnable PyTorch exports. No account or GPU needed. Try it: https://www.jasonshelter.com/en/learn/learnpytorch/attention/#attention-causal

Chinese:

> 你的模型是不是偷看了未来？我做了一个浏览器小挑战：改变未来词元，前面词元的输出也跟着变化；修好因果掩码，信息泄漏就消失了。LearnPyTorch 现在有 19 个可视化调试挑战，覆盖张量、自动微分与注意力，还能导出真正的 PyTorch 代码。无需账号或 GPU。来试试：https://www.jasonshelter.com/zh-cn/learn/learnpytorch/attention/#attention-causal

French:

> Votre modèle voit-il le futur ? J’ai créé un défi dans le navigateur : modifiez un token futur et observez une sortie antérieure changer. Corrigez le masque causal et la fuite disparaît. LearnPyTorch propose 19 défis visuels sur les tenseurs, autograd et l’attention, avec export PyTorch. Sans compte ni GPU : https://www.jasonshelter.com/fr/learn/learnpytorch/attention/#attention-causal

These are drafts for the owner to adapt. This release does not post announcements, contact communities or purchase promotion.

## A 30-second demonstration

1. Open the causal challenge directly in immersive mode.
2. Run “Change the future token” with the starter settings; point to the nonzero output change.
3. Enable the causal mask. Show the zero upper triangle and rerun the probe: output change is zero.
4. Select a blocked matrix cell to show the score, zero weight and weighted values.
5. End with the short challenge URL. Pair a downloaded visual card with its copied experiment link; the printed URL on the image opens the challenge, while the copied link reproduces all settings.

## The next evidence to collect

Start with five Python learners. Ask them to open the causal link without coaching, explain what changed, repair it, and attempt a second challenge. Observe where they stop rather than telling them where to click. Ask what the arrows, axes and mask mean. Use their failures to revise the first minute before adding another large chapter.

For a launch, track these outcomes with a consistent definition:

| Question | Useful measure | Decision it informs |
| --- | --- | --- |
| Does the hook attract relevant people? | Visits to the chapter from each launch link | Which explanation or demo resonates |
| Can they start unaided? | First meaningful control change after entry | Whether the first screen teaches the interaction |
| Do they learn and continue? | First repair passed, then a different challenge attempted | Feedback and next-step clarity |
| Is it worth sharing? | Experiment links/cards used and referred visits | Whether sharing carries a useful insight |
| Does it remain useful? | Voluntary return visits and code-export use | Whether to deepen practice or add a topic |

No analytics collector is installed by this release, so these funnel or retention measures are not yet known. Local progress is a convenience for learners, not an aggregate metric. Existing access logs can estimate page requests, but cannot establish lesson completion or unique learners. Begin with observed sessions; choose and disclose a minimal measurement approach before claiming growth.

Suggested expansion after feedback: convolution and receptive fields; optimizer trajectories and learning-rate failures; then batching/padding and multi-head attention. Each new lesson should have a visible state, a plausible mistake, a test on fresh inputs and a useful export.
