/* Automatische Tests für Phase 5, Etappe 1: Post-Formate für X (3.11.0).
 * Aufruf: node tests/phase5-etappe1.test.mjs */
import { browser, test, assert, newPage, go, finish } from './harness.mjs';

async function withSample(opts = {}) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, 390);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
async function openWithClaim(page) {
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]');
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.');
  await page.click('[data-act=reply-suggest]'); await page.waitForTimeout(150);
}
const count = async page => +(await page.textContent('#pcount')).match(/^(\d+)/)[1];

await test('Ohne Einträge kein Post; bestehender Entwurf bleibt unverändert', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]');
  assert(await page.locator('#post').count() === 0, 'kein Post ohne Auswahl');
  await openWithClaim(page);
  const d = await page.textContent('#draft');
  assert(d.includes('Zur Aussage „Die EU hat 28 Mitgliedstaaten“:') && d.includes('Belege:'), 'alter Entwurf: ' + d);
  assert(await page.isVisible('#post'), 'Post-Karte sichtbar');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Drei Post-Arten, Zähler bis 280, Aufbau mit Herkunft', async () => {
  const { ctx, page } = await withSample();
  await openWithClaim(page);
  assert(await page.locator('#ptype button').count() === 3, 'drei Post-Arten');
  const a = await page.inputValue('#ptext');
  assert(a.length > 0 && !a.includes('Oft heißt es') && !/\[\d/.test(a), 'Antwort: ' + a);
  assert(await count(page) <= 280, 'Zähler');
  const aufbau = await page.textContent('#post .stack');
  assert(aufbau.includes('Kernaussage') && aufbau.includes('aus [1]'), aufbau);
  await page.click('[data-act=post-type][data-v=eigen]');
  const e = await page.inputValue('#ptext');
  assert(e.startsWith('Oft heißt es: „Die EU hat 28 Mitgliedstaaten“'), 'eigen: ' + e);
  await page.click('[data-act=post-type][data-v=zitat]');
  assert(!(await page.inputValue('#ptext')).includes('Oft heißt es'), 'zitat');
  assert(await page.getAttribute('[data-act=post-type][data-v=zitat]', 'aria-pressed') === 'true', 'Auswahl markiert');
  await ctx.close();
});

await test('Abschluss wählbar: Rückfrage', async () => {
  const { ctx, page } = await withSample();
  await openWithClaim(page);
  await page.selectOption('#pclose', 'frage'); await page.waitForTimeout(80);
  assert((await page.inputValue('#ptext')).endsWith('Worauf stützt du deine Aussage?'), await page.inputValue('#ptext'));
  await page.click('[data-act=post-type][data-v=eigen]');
  assert((await page.inputValue('#ptext')).endsWith('Welche Quellen kennt ihr dazu?'), 'eigen Rückfrage');
  await ctx.close();
});

await test('Bearbeiten: Zähler live, Warnung über 280, Neu erzeugen, Kopieren', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await openWithClaim(page);
  const orig = await page.inputValue('#ptext');
  await page.fill('#ptext', 'Kurz. https://www.destatis.de/ein/sehr/langer/link');
  assert(await count(page) === 6 + 23, 'Link zählt 23: ' + await page.textContent('#pcount'));
  assert(await page.isHidden('#pover'), 'keine Warnung');
  await page.click('[data-act=post-copy]'); await page.waitForTimeout(100);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === 'Kurz. https://www.destatis.de/ein/sehr/langer/link', 'kopiert bearbeiteten Text');
  await page.fill('#ptext', 'x'.repeat(290));
  assert(await page.isVisible('#pover') && (await page.getAttribute('#pcount', 'class')).includes('over'), 'Warnung');
  await page.click('[data-act=post-copy]'); await page.waitForTimeout(100);
  assert((await page.textContent('#toast')).includes('länger als 280'), 'Warnung beim Kopieren');
  /* Bearbeitung bleibt bei Änderung der Auswahl erhalten */
  await page.fill('#rq', 'Vereinte Nationen');
  await page.click('#radd [data-act=reply-add] >> nth=0'); await page.waitForTimeout(100);
  assert(await page.inputValue('#ptext') === 'x'.repeat(290) && (await page.textContent('#post')).includes('Neu erzeugen'), 'Bearbeitung bleibt');
  await page.click('[data-act=post-reset]');
  const fresh = await page.inputValue('#ptext');
  assert(fresh !== 'x'.repeat(290) && fresh.length > 0, 'neu erzeugt');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Nichts wird gespeichert', async () => {
  const { ctx, page } = await withSample();
  const before = await page.evaluate(() => DB.readAll().then(d => JSON.stringify(d.entries.length + '/' + d.posts.length)));
  await openWithClaim(page);
  await page.click('[data-act=post-type][data-v=eigen]'); await page.fill('#ptext', 'Test');
  const after = await page.evaluate(() => DB.readAll().then(d => JSON.stringify(d.entries.length + '/' + d.posts.length)));
  assert(before === after, before + ' → ' + after);
  await ctx.close();
});

await test('Handy (360 px): keine Überbreite, Bildschirmfoto', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx, 360);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await openWithClaim(page);
  for (const t of ['antwort', 'eigen', 'zitat']) {
    await page.click(`[data-act=post-type][data-v=${t}]`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, t + ': Überbreite');
  }
  await page.locator('#post').screenshot({ path: '/tmp/phase5-post.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
