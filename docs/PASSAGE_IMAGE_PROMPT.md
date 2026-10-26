# 文章主旨配图提示词

这份提示词用于把任意文章转化为与站内默认配图协调的宽幅封面。将文章放在末尾的 `PASSAGE` 中即可。英文版通常对图像模型更稳定；它刻意只固定视觉语法，不固定主体、构图或隐喻。

```text
Read the passage below and first infer its central idea, emotional undertone, and most
interesting tension or relationship. Do not merely illustrate the nouns mentioned in
the text. Translate the passage into one clear, memorable visual metaphor, choosing
the subject and composition freely.

Create a wide editorial vector illustration for a thoughtful personal website. Keep
it minimal, atmospheric, intelligent, and quietly intriguing: a deep navy background,
subtle blue-slate structures and fine lines, restrained mint/teal highlights, generous
negative space, soft depth from faint grids, contours, or translucent layers, and one
strong focal idea. Geometric systems, maps, constellations, diagrams, pages, paths,
signals, natural forms, or an unexpected hybrid are all possible, but use only what
serves this particular passage. Let the visual metaphor determine the composition.

Aim for the feeling of a precise field note or conceptual atlas rather than a generic
stock illustration. The image should remain legible as a small website thumbnail and
reward a closer look at full size. Use a limited palette centered on dark navy
(approximately #0f172a), mint teal (approximately #5eead4), and muted slate blues.
Subtle gradients and glow are welcome when they add depth. If a tiny editorial label
would enrich the image, include at most a few short words in understated uppercase or
monospace type; otherwise use no text. Do not add a logo, paragraph, border, mockup,
watermark, or decorative numbering.

Landscape composition, approximately 8:5 (such as 1200×760). Clean vector finish,
crisp but not sterile, original rather than templated. Avoid photorealism, busy detail,
bright multicolor palettes, glossy 3D rendering, cute cartoon styling, and literal
scene-by-scene summary. Preserve room for interpretation and creative surprise.

PASSAGE:
[paste the full passage, summary, or draft here]
```

使用时不必先为模型总结文章；原文往往能提供更好的隐喻素材。文章很长时，可粘贴全文加一句“最希望读者带走的是……”。若首次结果太直白，只需追加：`Make the metaphor less literal and explore a more surprising relationship from the passage.`
