import { learningCopy, learningPaths as mambaPaths, lessonPath } from './learning';
import { gitLearningCopy, gitLearningPath } from './git-learning';
import { tensorLearningCopy, tensorLearningPath } from './tensor-learning';

import { attentionCopy, attentionPath } from './attention-learning';
import { autogradCopy, autogradPath } from './autograd-learning';

// Source-authored courses share the hub, canonical sitemap and default aliases.
export const learningCourses = [
  { path: lessonPath(), copy: learningCopy },
  { path: gitLearningPath, copy: gitLearningCopy },
  { path: tensorLearningPath, copy: tensorLearningCopy },
  { path: autogradPath, copy: autogradCopy },
  { path: attentionPath, copy: attentionCopy },
];
export const allLearningPaths = [...mambaPaths, gitLearningPath, tensorLearningPath, autogradPath, attentionPath];
