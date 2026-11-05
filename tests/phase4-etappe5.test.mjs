/* Automatische Tests für Phase 4, Etappe 5: Antwortassistent.
 * Aufruf: node tests/phase4-etappe5.test.mjs */
import { BASE, browser, test, assert, newPage, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));
async function openReply(page) { await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]'); }

await test('Dritter Umschalter „Antwort entwerfen“; Suchen und Prüfen bleiben unverändert', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion');
  assert(await page.locator('#dseg button').count() === 3, 'drei Umschalter');
  await openReply(page);
  assert((await page.textContent('.hint-rules')).includes('Keine KI, keine neuen Fakten'), 'Hinweis');
  assert(await page.isVisible('#rdraft .empty'), 'ohne Auswahl kein Entwurf');
  await page.click('[data-act=disc-mode][data-v=suche]'); await page.fill('#dq', 'nato');
  assert(await page.isVisible('#dres h2:has-text("Wissen (1)")'), 'Suche');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Vorschlag aus der Zusammenhangsanalyse, drei Stile, Belege und Kennzeichnung', async () => {
  const { ctx, page } = await withSample();
  await openReply(page);
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.');
  await page.click('[data-act=reply-suggest]'); await page.waitForTimeout(150);
  assert((await page.textContent('#rsel')).includes('Die EU hat 28 Mitgliedstaaten') && (await page.textContent('#rsel')).includes('widerspricht'), await page.textContent('#rsel'));
  let t = await page.textContent('#draft');
  assert(t.includes('Sachlich und neutral') && t.includes('Zur Aussage „Die EU hat 28 Mitgliedstaaten“:') && t.includes('Seitdem hat die EU 27 Mitgliedstaaten.') && t.includes('Belege:'), t);
  assert((await page.textContent('#rdraft .sec')).includes('Länder der EU'), 'Quelle in der Belegliste');
  await page.click('[data-act=reply-style][data-v=argument]');
  assert((await page.textContent('#draft')).includes('Erstens:'), 'argumentativ');
  await page.click('[data-act=reply-style][data-v=kurz]');
  t = await page.textContent('#draft');
  const n = +t.match(/(\d+) Zeichen für X/)[1];
  assert(t.includes('Kurz und pointiert') && n <= 280, 'kurz: ' + n);
  await ctx.close();
});

await test('Nicht belegte Aussagen werden markiert; Kopieren mit und ohne Belege', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await openReply(page);
  await page.fill('#rq', 'Abschreckung');
  await page.click('#radd [data-act=reply-add] >> nth=0'); await page.waitForTimeout(100);
  assert(await page.isVisible('#draft .unb') && (await page.textContent('#draft')).includes('nicht belegt: keine Quelle verknüpft'), 'Markierung');
  assert((await page.textContent('#draft')).includes('1 Aussage nicht belegt'), 'Zähler');
  await page.click('[data-act=reply-copy]'); await page.waitForTimeout(100);
  const full = await page.evaluate(() => navigator.clipboard.readText());
  assert(full.includes('[1 – nicht belegt') && full.includes('Belege:'), full);
  await page.click('[data-act=reply-copyx]'); await page.waitForTimeout(100);
  const x = await page.evaluate(() => navigator.clipboard.readText());
  assert(!x.includes('[1') && !x.includes('Belege:'), x);
  assert((await page.textContent('#toast')).includes('nicht belegte'), 'Warnung beim Kopieren');
  await ctx.close();
});

await test('Einträge hinzufügen und entfernen; Beleg öffnet den Eintrag', async () => {
  const { ctx, page } = await withSample();
  await openReply(page);
  await page.fill('#rq', 'Vereinte Nationen');
  await page.click('#radd [data-act=reply-add] >> nth=0'); await page.waitForTimeout(100);
  await page.fill('#rq', 'Peer-Review');
  await page.click('#radd [data-act=reply-add] >> nth=0'); await page.waitForTimeout(100);
  assert((await page.textContent('#rselh')).includes('(2)'), 'zwei gewählt');
  assert(await page.locator('#radd [data-act=reply-add][data-v="entries:e12"]').count() === 0, 'bereits gewählte nicht erneut angeboten');
  await page.click('#rsel [data-act=reply-del] >> nth=1'); await page.waitForTimeout(100);
  assert((await page.textContent('#rselh')).includes('(1)'), 'entfernt');
  await page.click('#rdraft .sec [data-act=open-item] >> nth=0');
  assert((await page.textContent('#sheet h2.t')).includes('Gründung der Vereinten Nationen'), 'Eintrag öffnet');
  await ctx.close();
});

await test('Aus „Behauptung prüfen“ direkt zur Antwort', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=pruefen]');
  await page.fill('#ctext', 'Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.');
  await page.click('[data-act=check-run]'); await page.waitForTimeout(150);
  await page.click('#cres [data-act=check-reply] >> nth=0'); await page.waitForTimeout(200);
  assert(await page.getAttribute('[data-act=disc-mode][data-v=antwort]', 'aria-pressed') === 'true', 'Umschalter');
  assert((await page.inputValue('#rclaim')).startsWith('Atomwaffen haben seit 1945'), 'Behauptung übernommen');
  const sel = await page.textContent('#rsel');
  assert(sel.includes('Abschreckung verhindert Großmachtkriege') && sel.includes('Beinahe-Eskalationen im Kalten Krieg'), sel);
  assert((await page.textContent('#draft')).includes('Der Zusammenhang ist nicht beweisbar'), 'Gegenargument der Karte im Entwurf');
  await ctx.close();
});

await test('Nichts wird gespeichert; Auswahl bleibt in der Sitzung, nach Neustart leer', async () => {
  const { ctx, page } = await withSample();
  const before = await dump(page);
  await openReply(page);
  await page.fill('#rclaim', 'Impfstoffe verursachen Autismus.');
  await page.click('[data-act=reply-suggest]'); await page.waitForTimeout(150);
  await go(page, 'wissen'); await go(page, 'diskussion');
  assert((await page.textContent('#rsel')).includes('Impfstoffe verursachen Autismus'), 'Sitzung');
  assert(await dump(page) === before, 'Datenbank verändert');
  await reload(page); await openReply(page);
  assert(await page.inputValue('#rclaim') === '' && await page.isVisible('#rdraft .empty'), 'nicht gespeichert');
  await ctx.close();
});

await test('Offline und Handy (360 px, dunkel): ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.DebateBase.Repo.setSetting('theme', 'dunkel'));
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await openReply(page);
  await page.fill('#rclaim', 'Der Klimawandel ist rein natürlich und das weiß jeder.');
  await page.click('[data-act=reply-suggest]'); await page.waitForTimeout(150);
  for (const s of ['sachlich', 'argument', 'kurz']) {
    await page.click(`[data-act=reply-style][data-v=${s}]`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, s + ': Überbreite');
  }
  assert(await page.isVisible('#draft'), 'offline Entwurf');
  await page.locator('#draft').screenshot({ path: '/tmp/phase4-antwort.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
