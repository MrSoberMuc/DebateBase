/* Automatische Tests für Phase 5, Etappe 2: Quellen-Folgeantwort und Prüfstatus (3.12.0).
 * Aufruf: node tests/phase5-etappe2.test.mjs */
import { browser, test, assert, newPage, go, finish } from './harness.mjs';

async function setup(opts = {}, width = 390) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]');
  return { ctx, page };
}
async function add(page, q, key) {
  await page.fill('#rq', q); await page.waitForTimeout(80);
  await page.click(`#radd [data-act=reply-add]${key ? `[data-v="${key}"]` : ' >> nth=0'}`); await page.waitForTimeout(100);
}

await test('Folgeantwort mit Quelle, Post selbst ohne Link, Kopieren', async () => {
  const { ctx, page } = await setup({ permissions: ['clipboard-read', 'clipboard-write'] });
  await add(page, 'Vereinte Nationen', 'entries:e2');
  const post = await page.inputValue('#ptext');
  assert(!post.includes('http') && !post.includes('Quelle'), post);
  const f = await page.inputValue('#pfollow');
  assert(f.startsWith('Quelle: Charta der Vereinten Nationen'), f);
  await page.click('[data-act=follow-copy]'); await page.waitForTimeout(100);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === f, 'kopiert');
  assert((await page.textContent('#toast')).includes('Folgeantwort kopiert'), 'Meldung');
  await page.fill('#pfollow', 'Quelle: https://www.example.org/sehr/langer/pfad');
  assert((await page.textContent('#pfcount')).startsWith('31 /'), await page.textContent('#pfcount'));
  await page.click('[data-act=post-reset]');
  assert(await page.inputValue('#pfollow') === f, 'Neu erzeugen stellt Folgeantwort wieder her');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Teilweise belegt: Warnung, vorsichtige Formulierung, ausschaltbar', async () => {
  const { ctx, page } = await setup();
  await add(page, 'Westfälischer Friede', 'entries:e1');
  assert((await page.inputValue('#ptext')).startsWith('Nach bisherigen Belegen spricht einiges dafür: '), await page.inputValue('#ptext'));
  const w = await page.textContent('#pwarn');
  assert(w.includes('Westfälischer Friede 1648') && w.includes('Teilweise belegt') && w.includes('vorsichtig formuliert'), w);
  assert((await page.textContent('#post .stack')).includes('vorsichtig formuliert'), 'im Aufbau markiert');
  await page.uncheck('#phedge'); await page.waitForTimeout(80);
  assert(!(await page.inputValue('#ptext')).startsWith('Nach bisherigen'), 'ausgeschaltet');
  assert((await page.textContent('#pwarn')).includes('ausgeschaltet'), 'Warnung bleibt');
  await page.click('#pwarn [data-act=open-item]');
  assert((await page.textContent('#sheet h2.t')).includes('Westfälischer Friede'), 'Eintrag öffnet');
  await ctx.close();
});

await test('In Prüfung: Hinweis; widerlegter Eintrag wird nicht verwendet', async () => {
  const { ctx, page } = await setup();
  await add(page, 'Anteil erneuerbarer Energien', 'entries:e5');
  assert((await page.textContent('#pwarn')).includes('noch nicht geprüft'), await page.textContent('#pwarn'));
  /* widerlegte Behauptung bleibt als Widerlegung nutzbar, ohne Warnung */
  await page.click('#rsel [data-act=reply-del]'); await page.waitForTimeout(80);
  await add(page, 'Impfstoffe Autismus', 'entries:e9');
  assert((await page.inputValue('#ptext')).includes('gilt als widerlegt'), await page.inputValue('#ptext'));
  assert(await page.locator('#pwarn').count() === 0, 'keine Warnung beim Widerlegen');
  await ctx.close();
});

await test('Ohne Quelle: Hinweis statt Folgeantwort', async () => {
  const { ctx, page } = await setup();
  await add(page, 'Abschreckung');
  assert((await page.textContent('#pfollow-sec')).includes('keine verknüpfte Quelle') && await page.locator('#pfollow').count() === 0, await page.textContent('#pfollow-sec'));
  await ctx.close();
});

await test('Handy (360 px): keine Überbreite, Bildschirmfoto', async () => {
  const { ctx, page } = await setup({}, 360);
  await add(page, 'Westfälischer Friede', 'entries:e1');
  await add(page, 'Vereinte Nationen', 'entries:e2');
  assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Überbreite');
  await page.locator('#post').screenshot({ path: '/tmp/phase5-e2.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
