import { learningCopy, learningPaths as mambaPaths, lessonPath } from './learning';
import { gitLearningCopy, gitLearningPath } from './git-learning';

// Source-authored courses share the hub, canonical sitemap and default aliases.
export const learningCourses = [
  { path: lessonPath(), copy: learningCopy },
  { path: gitLearningPath, copy: gitLearningCopy },
];
export const allLearningPaths = [...mambaPaths, gitLearningPath];
