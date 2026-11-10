/* Automatische Tests für Phase 5, Etappe 3: Threads (3.13.0).
 * Aufruf: node tests/phase5-etappe3.test.mjs */
import { browser, test, assert, newPage, go, finish } from './harness.mjs';

async function setup(opts = {}, width = 390) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]');
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.');
  for (const [q, key] of [['Vereinte Nationen', 'entries:e2'], ['Westfälischer Friede', 'entries:e1'], ['Ozonschicht', 'entries:e7'], ['Konsens Klimawandel', 'entries:e6']]) {
    await page.fill('#rq', q); await page.waitForTimeout(80);
    await page.click(`#radd [data-act=reply-add][data-v="${key}"]`); await page.waitForTimeout(80);
  }
  await page.click('[data-act=post-type][data-v=thread]'); await page.waitForTimeout(80);
  return { ctx, page };
}
const parts = page => page.locator('#tparts textarea.tp').evaluateAll(a => a.map(x => x.value));

await test('Thread: nummerierte Teile, je ≤ 280 Zeichen, kein Einzelkopierknopf', async () => {
  const { ctx, page } = await setup();
  const P = await parts(page);
  assert(P.length >= 2, 'Teile: ' + P.length);
  P.forEach((t, i) => assert(t.startsWith((i + 1) + '/' + P.length + ' '), t.slice(0, 10)));
  assert(P[0].includes('Oft heißt es: „Die EU hat 28 Mitgliedstaaten“'), P[0]);
  const counts = await page.locator('#tparts [id^=tpc-]').allTextContents();
  assert(counts.every(c => +c.match(/^(\d+)/)[1] <= 280), counts.join());
  assert(await page.locator('#ptext').count() === 0 && await page.locator('[data-act=post-copy]').count() === 0, 'kein Einzeltext');
  assert((await page.textContent('#pfollow-sec')).includes('letzten Teil'), 'Folgeantwort-Hinweis für Thread');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Teil bearbeiten: Zähler live, Kopieren, bleibt bis „Neu erzeugen“', async () => {
  const { ctx, page } = await setup({ permissions: ['clipboard-read', 'clipboard-write'] });
  const P = await parts(page);
  await page.fill('#tp-1', '2/2 Geändert. https://example.org/ein/langer/link');
  assert((await page.textContent('#tpc-1')).startsWith((14 + 23) + ' /'), await page.textContent('#tpc-1'));
  await page.click('[data-act=tpart-copy][data-v="1"]'); await page.waitForTimeout(100);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === '2/2 Geändert. https://example.org/ein/langer/link', 'kopiert');
  assert((await page.textContent('#toast')).includes('Teil 2 kopiert'), 'Meldung');
  await page.fill('#tp-0', 'x'.repeat(300));
  assert((await page.getAttribute('#tpc-0', 'class')).includes('over'), 'rot über 280');
  /* andere Teile bleiben unverändert */
  assert((await parts(page))[2] === P[2] || P.length < 3, 'Teil 3 unverändert');
  await page.selectOption('#pclose', 'frage'); await page.waitForTimeout(80);
  const Q = await parts(page);
  assert(Q[Q.length - 1].endsWith('Welche Quellen kennt ihr dazu?'), 'Abschluss erzeugt Thread neu');
  await page.fill('#tp-0', 'Bearbeitet'); await page.click('[data-act=post-reset]');
  assert((await parts(page))[0] !== 'Bearbeitet', 'Neu erzeugen');
  await ctx.close();
});

await test('Wechsel zurück zur Antwort zeigt wieder Einzeltext', async () => {
  const { ctx, page } = await setup();
  await page.click('[data-act=post-type][data-v=antwort]');
  assert(await page.locator('#ptext').count() === 1 && await page.locator('#tparts').count() === 0, 'Einzeltext');
  await ctx.close();
});

await test('Handy (360 px): keine Überbreite, Bildschirmfoto', async () => {
  const { ctx, page } = await setup({}, 360);
  assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Überbreite');
  await page.locator('#tparts').screenshot({ path: '/tmp/phase5-thread.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
