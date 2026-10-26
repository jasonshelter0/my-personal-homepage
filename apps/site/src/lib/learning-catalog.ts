import { learningCopy, learningPaths as mambaPaths, lessonPath } from './learning';
import { gitLearningCopy, gitLearningPath } from './git-learning';
import { tensorLearningCopy, tensorLearningPath } from './tensor-learning';

// Source-authored courses share the hub, canonical sitemap and default aliases.
export const learningCourses = [
  { path: lessonPath(), copy: learningCopy },
  { path: gitLearningPath, copy: gitLearningCopy },
  { path: tensorLearningPath, copy: tensorLearningCopy },
];
export const allLearningPaths = [...mambaPaths, gitLearningPath, tensorLearningPath];
