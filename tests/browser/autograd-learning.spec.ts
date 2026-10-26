import {test,expect} from '@playwright/test';
const live='http://127.0.0.1:4523';
const route='/en/learn/learnpytorch/autograd/';
let preview:string;
test.beforeAll(async({request})=>{
 expect((await request.post('/api/login',{data:{password:'local-demo-password'}})).ok()).toBeTruthy();
 const release=await(await request.post('/api/releases',{data:{}})).json();
 await expect.poll(async()=>{const {releases}=await(await request.get('/api/releases')).json();return releases.find((r:{id:string})=>r.id===release.id)?.status;},{timeout:90000}).toBe('ready');
 preview=release.previewUrl;expect((await request.get(preview)).ok()).toBeTruthy();expect((await request.post(`/api/releases/${release.id}/publish`,{data:{}})).ok()).toBeTruthy();
});

test('gradient predictions are captured before backward; traces, keyboard and progress work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(live+route);
 await page.locator('[data-ag-backward]').click();await expect(page.locator('[data-ag-feedback]')).toHaveText('Enter a finite numerical prediction.');
 await page.locator('[data-ag-prediction]').fill('0');await page.locator('[data-ag-backward]').click();
 await expect(page.locator('[data-ag-buffer-w]')).toHaveText('None');
 await page.locator('[data-ag-prediction]').fill('-16');await page.locator('[data-ag-all]').click();await page.locator('[data-ag-check]').click();
 await expect(page.locator('[data-ag-feedback]')).toContainText('That prediction differs');
 await page.locator('[data-ag-reset]').click();
 for(const [index,prediction] of [['0','-16'],['1','5']]){
  await page.locator('[data-ag-example]').selectOption({value:index});await page.locator('[data-ag-prediction]').fill(prediction);await page.locator('[data-ag-backward]').click();
  await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-feedback]')).toContainText('Finish the backward trace');
  await page.locator('[data-ag-next]').click();await expect(page.locator('[data-ag-event]')).toHaveText('∂loss/∂loss = 1');
  await page.locator('[data-ag-next]').click();await expect(page.locator('.ag-active')).toHaveCount(1);
  await page.locator('[data-ag-all]').click();await expect(page.locator('[data-ag-buffer-w]')).toHaveText(prediction);
  await page.locator('[data-ag-node="0"]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-ag-node="0"]')).toBeFocused();
  await expect(page.locator('[data-ag-inspector]')).toContainText('Local derivative');
  await page.locator('[data-ag-check]').click();
 }
 await expect(page.locator('[data-ag-success]')).toBeVisible();await expect(page.locator('[data-ag-progress]')).toContainText('1 / 4');
 await page.locator('[data-ag-play]').click();await expect(page.locator('[data-ag-play]')).toHaveText('Pause');
 await page.locator('[data-ag-play]').click();await expect(page.locator('[data-ag-play]')).toHaveText('Play backward');
 await page.reload();await expect(page.locator('[data-ag-progress]')).toContainText('1 / 4');expect(errors).toEqual([]);
});

test('detach and accumulation show actual parameter buffers and export runnable settings',async({page})=>{
 await page.goto(live+route);await page.locator('[data-ag-mission="detach"]').click();
 await expect(page.locator('.ag-cut')).toHaveCount(1);await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();
 await expect(page.locator('[data-ag-buffer-w]')).toHaveText('None');await expect(page.locator('[data-ag-buffer-b]')).toHaveText('-8');
 await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeHidden();
 await page.locator('[data-ag-detach]').uncheck();await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeVisible();
 await page.locator('[data-ag-mission="accumulation"]').click();
 for(let i=0;i<2;i++){await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();}
 await expect(page.locator('[data-ag-buffer-w]')).toHaveText('-32');await page.locator('[data-ag-node="0"]').click();await expect(page.locator('[data-ag-inspector]')).toContainText('so far: -16');
 await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeHidden();
 await page.locator('[data-ag-clear]').check();
 for(let i=0;i<2;i++){await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();}
 await expect(page.locator('[data-ag-buffer-w]')).toHaveText('-16');await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeVisible();
 const downloading=page.waitForEvent('download');await page.locator('[data-ag-export]').click();const stream=await(await downloading).createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);const source=Buffer.concat(chunks).toString();expect(source).toContain('range(2)');expect(source).toContain('zero_grad(set_to_none=True)');
 await page.locator('[data-ag-graph]').screenshot({path:'test-results/autograd-graph.png'});
});

test('training order repair changes model and loss; invalid settings invalidate old success',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(live+route);await page.locator('[data-ag-mission="training"]').click();await page.locator('[data-ag-train]').click();await page.locator('[data-ag-all]').click();await page.locator('[data-ag-check]').click();
 await expect(page.locator('[data-ag-training-metrics]')).toContainText('error: 9');await expect(page.locator('[data-ag-success]')).toBeHidden();
 await page.locator('[data-ag-stage="backward"] [data-ag-move="-1"]').click();await page.locator('[data-ag-train]').click();
 await page.locator('[data-ag-next]').click();await expect(page.locator('[data-ag-training-metrics]')).toContainText('Step 1 / 12');
 await page.locator('[data-ag-all]').click();await expect(page.locator('[data-ag-training-metrics]')).toContainText('0.000971932');await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeVisible();
 await expect(page.locator('[data-ag-fit] svg')).toHaveAttribute('role','img');await expect(page.locator('[data-ag-loss] .ag-model')).toBeVisible();
 await page.locator('[data-ag-training-controls]').screenshot({path:'test-results/autograd-training.png'});
 await page.locator('[data-ag-rate]').fill('1');await expect(page.locator('[data-ag-success]')).toBeHidden();await page.locator('[data-ag-train]').click();await page.locator('[data-ag-all]').click();await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeHidden();
 await page.locator('[data-ag-rate]').fill('');await page.locator('[data-ag-train]').click();await expect(page.locator('[data-ag-feedback]')).toHaveAttribute('data-kind','error');expect(errors).toEqual([]);
});

test('three localized mobile pages, hub, alias, search and authenticated preview work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 for(const locale of ['en','fr','zh-cn']){
  await page.setViewportSize({width:320,height:800});await page.goto(`${live}/${locale}/learn/learnpytorch/autograd/`);await expect(page.locator('[data-ag-node="0"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  if(locale!=='zh-cn')expect(await page.locator('.autograd-learning').innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',new RegExp(`/${locale}/learn/learnpytorch/autograd/$`));
  await expect(page.locator('a[href="https://beian.miit.gov.cn/"]')).toHaveText('京ICP备2024092234号-1');
  await page.locator('[data-ag-mission="training"]').click();await page.locator('[data-ag-train]').click();await page.locator('[data-ag-all]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
 await page.locator('[data-ag-training-controls]').screenshot({path:'test-results/autograd-mobile.png'});
 await page.goto(`${live}/learn/learnpytorch/autograd/`);await expect(page).toHaveURL(/\/(zh-cn|en|fr)\/learn\/learnpytorch\/autograd\/$/);
 await page.locator('.languages a[lang="en"]').click();await expect(page.locator('[data-ag-node="0"]')).toBeVisible();await page.locator('[data-open-search]').click();await page.locator('#search-input').fill('Autograd');await expect(page.locator('#search-results a[href*="/learnpytorch/autograd/"]').first()).toBeVisible();await page.keyboard.press('Escape');
 await page.goto(live+'/en/learn/');await expect(page.locator('a[href="/en/learn/learnpytorch/autograd/"]').first()).toBeVisible();
 await page.request.post('/api/login',{data:{password:'local-demo-password'}});const url=new URL(preview,'http://127.0.0.1:4521');await page.goto(url.href);await page.goto(`${url.origin}${url.pathname}en/learn/learnpytorch/autograd/`);
 await expect(page.locator('[data-ag-node="0"]')).toBeVisible();await expect(page.locator('.languages a[lang="fr"]')).toHaveAttribute('href',`${url.pathname}fr/learn/learnpytorch/autograd/`);
 await page.locator('[data-ag-prediction]').fill('-16');await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();await expect(page.locator('[data-ag-buffer-w]')).toHaveText('-16');expect(errors).toEqual([]);
});

test('storage denial and reduced motion leave all controls usable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('disabled');}}));await page.emulateMedia({reducedMotion:'reduce'});await page.goto(live+route);await expect(page.locator('[data-ag-storage]')).toBeVisible();await expect(page.locator('[data-ag-play]')).toBeDisabled();await page.locator('[data-ag-mission="detach"]').click();await page.locator('[data-ag-detach]').uncheck();await page.locator('[data-ag-backward]').click();await page.locator('[data-ag-all]').click();await page.locator('[data-ag-check]').click();await expect(page.locator('[data-ag-success]')).toBeVisible();
});
