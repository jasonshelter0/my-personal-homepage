import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {autogradCopy,autogradPath} from '../apps/site/src/lib/autograd-learning';
import {learningCourses,allLearningPaths} from '../apps/site/src/lib/learning-catalog';
test('autograd numerical engine and training behavior',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const output=execFileSync(process.execPath,['--test','tests/autograd-lab/engine.test.mjs'],{env,encoding:'utf8'});assert.match(output,/tests 10/);
});
test('autograd translations and catalog are complete',()=>{
 function paths(v:unknown,p=''):string[]{if(typeof v==='string'){assert.ok(v.trim(),p);return[p];}return Object.entries(v as object).flatMap(([k,c])=>paths(c,`${p}.${k}`));}
 for(const [locale,copy] of Object.entries(autogradCopy)){assert.deepEqual(paths(copy),paths(autogradCopy.en));assert.equal(copy.missions.length,4);if(locale!=='zh-CN')assert.doesNotMatch(JSON.stringify(copy),/[\u3400-\u9fff]/);}
 assert.ok(allLearningPaths.includes(autogradPath));assert.ok(learningCourses.some(c=>c.path===autogradPath));
});
