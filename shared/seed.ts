import { contentHash } from './validation.ts';
import {
  LOCALES,
  type Snapshot,
  type Entry,
  type LocalizedContent,
  type Profile,
  type Locale,
} from './types.ts';
const localized = (title: string, summary: string, body: string): LocalizedContent => ({
  title,
  summary,
  body,
  reviewed: true,
  sourceHash: '',
});
function entry(
  id: string,
  type: Entry['type'],
  slug: string,
  translations: Record<Locale, LocalizedContent>,
  extra: Partial<Entry> = {},
): Entry {
  const h = contentHash(translations['zh-CN']);
  for (const l of LOCALES) translations[l].sourceHash = h;
  return {
    id,
    type,
    slug,
    status: 'published',
    sourceLocale: 'zh-CN',
    translations,
    coverId: null,
    tags: [],
    featured: true,
    order: 0,
    date: '2026-10-22',
    url: '',
    period: '',
    ...extra,
  };
}
const profile: Record<Locale, Profile> = {
  'zh-CN': {
    name: 'Jason',
    headline: '开发者、研究者，以及持续学习的人。',
    intro: '把好奇心变成作品。在这里记录技术、设计，以及那些值得慢慢想的问题。',
    about:
      '我喜欢在技术与设计的交汇处探索，尝试把复杂的问题变成清晰、可靠的体验。\n\n这个空间收集我的项目、学习笔记和一些不成熟的想法。我关注人工智能、开放工具，也关心一个按钮的位置、一段文字的节奏，以及产品如何融入日常。\n\n工作之外，我喜欢走路、阅读和摄影。**这里的经历与项目是演示内容，可以在编辑后台全部替换。**',
    seoDescription: 'Jason 的个人空间：项目、技术笔记与持续探索。演示内容。',
    reviewed: true,
    sourceHash: '',
  },
  en: {
    name: 'Jason',
    headline: 'Developer, researcher, and lifelong learner.',
    intro:
      'Turning curiosity into things that work. Notes on technology, design, and questions worth sitting with.',
    about:
      'I enjoy exploring the space between technology and design, turning complex problems into clear, dependable experiences.\n\nThis is a home for my projects, learning notes, and ideas in progress. I care about artificial intelligence and open tools, but also the placement of a button, the rhythm of a sentence, and how products fit into everyday life.\n\nAway from the screen, I enjoy walking, reading, and photography. **The projects and experience here are demo content, ready to be replaced in the studio.**',
    seoDescription:
      'Jason’s personal space: projects, technical notes, and ongoing explorations. Demo content.',
    reviewed: true,
    sourceHash: '',
  },
  fr: {
    name: 'Jason',
    headline: 'Développeur, chercheur, toujours en apprentissage.',
    intro:
      'Transformer la curiosité en projets concrets. Notes sur la technologie, le design et les questions qui méritent du temps.',
    about:
      'J’aime explorer la rencontre entre technologie et design, pour transformer des problèmes complexes en expériences claires et fiables.\n\nCet espace rassemble mes projets, mes notes et mes idées en cours. Je m’intéresse à l’intelligence artificielle et aux outils ouverts, mais aussi à la place d’un bouton, au rythme d’une phrase et à la façon dont un produit s’intègre au quotidien.\n\nLoin des écrans, j’aime marcher, lire et photographier. **Les projets et les expériences présentés sont des exemples, à remplacer dans le studio.**',
    seoDescription:
      'L’espace personnel de Jason : projets, notes techniques et explorations. Contenu de démonstration.',
    reviewed: true,
    sourceHash: '',
  },
};
for (const l of LOCALES) profile[l].sourceHash = contentHash(profile['zh-CN']);
export const seed: Snapshot = {
  schemaVersion: 1,
  revision: 1,
  settings: {
    sourceLocale: 'zh-CN',
    profile,
    accent: '#5eead4',
    background: '#0f172a',
    defaultLocale: 'zh-CN',
    sections: [
      { id: 'about', enabled: true },
      { id: 'experience', enabled: true },
      { id: 'projects', enabled: true },
      { id: 'writing', enabled: true },
    ],
    socials: [
      { id: 'github', label: 'GitHub', url: 'https://github.com/', icon: 'github' },
      { id: 'email', label: 'Email', url: 'mailto:hello@example.com', icon: 'email' },
      { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
    ],
    avatarId: null,
    resumeUrl: '',
    siteUrl: 'https://example.com',
  },
  media: [
    {
      id: 'atlas',
      filename: 'atlas.svg',
      path: '/media/atlas.svg',
      width: 1200,
      height: 750,
      alt: {
        'zh-CN': 'Atlas 项目的抽象地图与路径示意图',
        en: 'Abstract map and connected paths for the Atlas project',
        fr: 'Carte abstraite et chemins connectés du projet Atlas',
      },
      caption: {
        'zh-CN': 'Atlas · 演示项目',
        en: 'Atlas · demo project',
        fr: 'Atlas · projet de démonstration',
      },
    },
    {
      id: 'constellation',
      filename: 'constellation.svg',
      path: '/media/constellation.svg',
      width: 1200,
      height: 750,
      alt: {
        'zh-CN': '连接不同知识节点的星图',
        en: 'A constellation connecting different knowledge nodes',
        fr: 'Une constellation reliant différents nœuds de connaissances',
      },
      caption: {
        'zh-CN': 'Constellation · 演示项目',
        en: 'Constellation · demo project',
        fr: 'Constellation · projet de démonstration',
      },
    },
    {
      id: 'field-notes',
      filename: 'field-notes.svg',
      path: '/media/field-notes.svg',
      width: 1200,
      height: 750,
      alt: {
        'zh-CN': '简洁的笔记页面和薄荷色标记',
        en: 'Minimal notebook pages with mint annotations',
        fr: 'Pages de carnet minimalistes avec annotations menthe',
      },
      caption: {
        'zh-CN': '一些值得留下的观察',
        en: 'Observations worth keeping',
        fr: 'Des observations à conserver',
      },
    },
  ],
  entries: [
    entry(
      'project-atlas',
      'project',
      'atlas',
      {
        'zh-CN': localized(
          'Atlas — 给想法一个位置',
          '一个安静的知识整理空间，将零散的笔记连接成可探索的地图。',
          '## 从收集到理解\n\n收藏很容易，理解需要时间。Atlas 是一个用于探索知识整理方式的演示项目：将笔记放入上下文，通过主题和链接逐步建立联系。\n\n### 设计原则\n\n- 让书写比分类更简单\n- 用少量层级组织复杂信息\n- 保持数据可以导出\n\n这个项目展示的是一种产品思考方式，尚不是公开发布的产品。',
        ),
        en: localized(
          'Atlas — a place for ideas',
          'A quiet space for knowledge, connecting scattered notes into an explorable map.',
          '## From collecting to understanding\n\nCollecting is easy. Understanding takes time. Atlas is a demo exploration of personal knowledge tools: give notes context, then connect them through topics and links.\n\n### Design principles\n\n- Make writing easier than categorizing\n- Organize complexity with few layers\n- Keep data exportable\n\nThis project demonstrates a product direction; it is not a publicly released product.',
        ),
        fr: localized(
          'Atlas — une place pour les idées',
          'Un espace calme pour relier des notes éparses et construire une carte à explorer.',
          '## De la collecte à la compréhension\n\nCollecter est facile. Comprendre demande du temps. Atlas explore, à titre de démonstration, une approche des outils de connaissances personnelles : contextualiser les notes, puis les relier par thèmes et liens.\n\n### Principes de conception\n\n- Simplifier l’écriture avant le classement\n- Organiser la complexité avec peu de niveaux\n- Garder les données exportables\n\nCe projet illustre une direction de produit ; il ne s’agit pas d’un produit public.',
        ),
      },
      { coverId: 'atlas', tags: ['TypeScript', 'Design systems', 'Local-first'], order: 0 },
    ),
    entry(
      'project-constellation',
      'project',
      'constellation',
      {
        'zh-CN': localized(
          'Constellation — 研究的轨迹',
          '用简单的可视化串起论文、问题和实验，让研究过程留下可回溯的线索。',
          '## 看见问题之间的联系\n\n研究不是一条直线。这个演示项目以问题为中心组织论文与实验，并保留每次选择背后的理由。\n\n> 好的工具，应该让我们更容易提出下一个问题。\n\n### 实现方向\n\n使用结构化笔记记录假设，用图形呈现关系，同时保留可读的文本版本。',
        ),
        en: localized(
          'Constellation — traces of research',
          'Connecting papers, questions, and experiments with simple visualizations that preserve the research journey.',
          '## Seeing connections between questions\n\nResearch rarely follows a straight line. This demo organizes papers and experiments around questions and preserves the reasoning behind each decision.\n\n> A useful tool makes it easier to ask the next question.\n\n### Approach\n\nCapture hypotheses in structured notes, visualize their relationships, and keep a readable text version alongside them.',
        ),
        fr: localized(
          'Constellation — les traces de la recherche',
          'Relier articles, questions et expériences par des visualisations simples, pour conserver le cheminement de la recherche.',
          '## Voir les liens entre les questions\n\nLa recherche suit rarement une ligne droite. Cette démonstration organise les articles et les expériences autour des questions, tout en conservant les raisons de chaque décision.\n\n> Un outil utile nous aide à poser la prochaine question.\n\n### Approche\n\nConsigner les hypothèses dans des notes structurées, visualiser leurs relations et garder une version textuelle lisible.',
        ),
      },
      { coverId: 'constellation', tags: ['Research', 'Python', 'Visualization'], order: 1 },
    ),
    entry(
      'post-small-web',
      'post',
      'a-smaller-web',
      {
        'zh-CN': localized(
          '做一个更小、更安静的网站',
          '不急着填满每一个像素。关于留白、静态网页，以及建立自己的数字空间。',
          '## 给内容留出呼吸的空间\n\n一个个人网站不必承担所有任务。它可以只是一个稳定的地址，放几件认真做过的事，和一些仍在变化的想法。\n\n我想保留的东西很简单：清晰的文字、舒服的行距，以及不打断阅读的交互。\n\n## 静态不意味着停滞\n\n在编辑器里写作，发布时生成页面。内容可以不断更新，而读者收到的是轻巧、完整的文件。\n\n```js\nconst essentials = ["words", "space", "curiosity"];\n```\n\n这篇文章是用于检验排版、搜索和多语言切换的示例。',
        ),
        en: localized(
          'Building a smaller, quieter web',
          'Not every pixel needs filling. On whitespace, static pages, and making a digital space of your own.',
          '## Give content room to breathe\n\nA personal website does not need to do everything. It can be a stable address for a few carefully made things and some ideas that are still evolving.\n\nWhat I want to keep is simple: clear words, comfortable line spacing, and interactions that do not interrupt reading.\n\n## Static does not mean standing still\n\nWrite in an editor, generate pages when publishing. Content can keep changing while readers receive lightweight, complete files.\n\n```js\nconst essentials = ["words", "space", "curiosity"];\n```\n\nThis sample article is here to test typography, search, and language switching.',
        ),
        fr: localized(
          'Construire un web plus petit, plus calme',
          'Chaque pixel n’a pas besoin d’être rempli. À propos des espaces blancs, des pages statiques et d’un espace numérique personnel.',
          '## Laisser respirer le contenu\n\nUn site personnel n’a pas besoin de tout faire. Il peut offrir une adresse stable à quelques projets soignés et à des idées encore en mouvement.\n\nJe souhaite garder l’essentiel : des mots clairs, un interligne confortable et des interactions qui ne coupent pas la lecture.\n\n## Statique ne veut pas dire immobile\n\nÉcrire dans un éditeur, générer les pages au moment de publier. Le contenu évolue tandis que les lecteurs reçoivent des fichiers légers et complets.\n\n```js\nconst essentials = ["words", "space", "curiosity"];\n```\n\nCet article sert à vérifier la typographie, la recherche et le changement de langue.',
        ),
      },
      { coverId: 'field-notes', tags: ['Web', 'Design'], order: 0, date: '2026-10-18' },
    ),
    entry(
      'post-learning',
      'post',
      'notes-on-learning',
      {
        'zh-CN': localized(
          '把学习变成可以回看的东西',
          '记录问题，比记录答案更有用。一个简短的学习笔记方法。',
          '## 先写下问题\n\n开始读一篇文章之前，先记录你想弄清楚的事情。读完之后，再用自己的话解释一次。\n\n1. 我原来是怎么理解的？\n2. 哪个例子改变了我的理解？\n3. 我还不能解释什么？\n\n把没有想明白的地方保留下来，下一次学习就有了入口。\n\n这是一篇演示文章。',
        ),
        en: localized(
          'Make learning something you can revisit',
          'Keeping track of questions can be more useful than collecting answers. A small note-taking practice.',
          '## Start with a question\n\nBefore reading an article, write down what you hope to understand. Afterwards, explain it again in your own words.\n\n1. What did I think before?\n2. Which example changed my understanding?\n3. What can I still not explain?\n\nKeep the unresolved parts. They are an entry point for the next session.\n\nThis is a demonstration article.',
        ),
        fr: localized(
          'Rendre l’apprentissage consultable',
          'Garder une trace des questions est parfois plus utile que collectionner les réponses. Une petite pratique de prise de notes.',
          '## Commencer par une question\n\nAvant de lire un article, noter ce que l’on souhaite comprendre. Ensuite, l’expliquer à nouveau avec ses propres mots.\n\n1. Que pensais-je auparavant ?\n2. Quel exemple a changé ma compréhension ?\n3. Que suis-je encore incapable d’expliquer ?\n\nConserver les zones d’ombre offre un point de départ pour la prochaine séance.\n\nCeci est un article de démonstration.',
        ),
      },
      { tags: ['Learning', 'Notes'], order: 1, date: '2026-10-12' },
    ),
    entry(
      'page-now',
      'page',
      'now',
      {
        'zh-CN': localized(
          '此刻',
          '最近在关注什么，以及这个网站接下来会长成什么样。',
          '## 最近的关注\n\n- 让个人网站真正属于自己\n- 为长期写作建立一个简单的工作流\n- 在研究与实现之间找到节奏\n\n这是一个示例信息页，可在后台修改或删除。',
        ),
        en: localized(
          'Now',
          'What has my attention lately, and where this little website might go next.',
          '## Current interests\n\n- Making a personal website truly personal\n- Building a simple workflow for long-term writing\n- Finding a rhythm between research and implementation\n\nThis is a sample information page. Edit or remove it in the studio.',
        ),
        fr: localized(
          'En ce moment',
          'Ce qui retient mon attention et les prochaines directions possibles de ce petit site.',
          '## Centres d’intérêt actuels\n\n- Faire d’un site personnel un espace vraiment personnel\n- Construire une méthode simple pour écrire dans la durée\n- Trouver un rythme entre recherche et réalisation\n\nCette page d’information est un exemple. Modifiez-la ou supprimez-la dans le studio.',
        ),
      },
      { featured: false },
    ),
    entry(
      'exp-independent',
      'experience',
      'independent',
      {
        'zh-CN': localized(
          '独立探索 · 开发与研究',
          '围绕个人知识工具、网页体验和人工智能进行小规模实验。',
          '设计、开发并记录小型项目，将想法变成可以测试的原型。此经历为演示内容。',
        ),
        en: localized(
          'Independent exploration · Development & research',
          'Small experiments in personal knowledge tools, web experiences, and artificial intelligence.',
          'Designing, building, and documenting small projects to turn ideas into testable prototypes. This experience is demo content.',
        ),
        fr: localized(
          'Exploration indépendante · Développement et recherche',
          'Petites expériences autour des outils de connaissances, du web et de l’intelligence artificielle.',
          'Concevoir, développer et documenter de petits projets pour transformer les idées en prototypes testables. Cette expérience est fictive et sert de démonstration.',
        ),
      },
      { period: '2024 — 2026', tags: ['TypeScript', 'Python', 'Design'], order: 0 },
    ),
    entry(
      'exp-open',
      'experience',
      'open-learning',
      {
        'zh-CN': localized(
          '开放学习 · 工具与社区',
          '通过构建工具、阅读源码和分享笔记，练习把复杂概念讲清楚。',
          '从小问题开始，保持对细节的耐心。此经历为演示内容。',
        ),
        en: localized(
          'Open learning · Tools & community',
          'Building tools, reading source code, and sharing notes to practice explaining complex ideas clearly.',
          'Starting with small problems and staying patient with the details. This experience is demo content.',
        ),
        fr: localized(
          'Apprentissage ouvert · Outils et communauté',
          'Créer des outils, lire du code et partager des notes pour apprendre à expliquer clairement des idées complexes.',
          'Partir de petits problèmes et rester attentif aux détails. Cette expérience sert de démonstration.',
        ),
      },
      { period: '2022 — 2024', tags: ['Open source', 'Writing'], order: 1 },
    ),
  ],
};
