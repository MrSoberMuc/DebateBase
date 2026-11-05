/* Automatische Tests für Phase 4B, Etappe 1: KI-Auftrag (Prompt kopieren).
 * Aufruf: node tests/phase4b-etappe1.test.mjs */
import { BASE, browser, test, assert, newPage, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));
async function kiOn(page) { await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150); }
async function check(page, text) {
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=pruefen]');
  await page.fill('#ctext', text); await page.click('[data-act=check-run]'); await page.waitForTimeout(150);
}
const TEXT = '@nutzer Die EU hat 28 Mitgliedstaaten. Sanktionen wirken nie. https://t.co/abc';

await test('Standardmäßig aus: keine KI-Knöpfe; Schalter in den Optionen, bleibt nach Neustart', async () => {
  const { ctx, page } = await withSample();
  await check(page, TEXT);
  assert(await page.locator('[data-act=ki-start]').count() === 0, 'KI-Knopf trotz „Aus“');
  await go(page, 'einstellungen');
  assert(await page.getAttribute('[data-act=ki-toggle][data-v=aus]', 'aria-pressed') === 'true', 'Standard Aus');
  assert((await page.textContent('#sec-ki')).includes('sendet nichts ins Internet'), 'Erklärung');
  await kiOn(page); await reload(page);
  await go(page, 'einstellungen');
  assert(await page.getAttribute('[data-act=ki-toggle][data-v=an]', 'aria-pressed') === 'true', 'nach Neustart an');
  await check(page, TEXT);
  assert(await page.locator('[data-act=ki-start][data-v=pruefen]').count() === 1, 'Knopf in Behauptung prüfen');
  await page.click('[data-act=disc-mode][data-v=antwort]');
  assert(await page.locator('[data-act=ki-start][data-v=antwort]').count() === 1, 'Knopf in Antwort entwerfen');
  await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=aus]'); await page.waitForTimeout(150);
  await go(page, 'diskussion');
  assert(await page.locator('[data-act=ki-start]').count() === 0, 'wieder weg');
  await ctx.close();
});

await test('Vorschau „Text prüfen“: passende Einträge, ohne @-Namen und Links, Auswahl ändert den Prompt', async () => {
  const { ctx, page } = await withSample();
  await kiOn(page); await check(page, TEXT);
  await page.click('[data-act=ki-start][data-v=pruefen]'); await page.waitForTimeout(150);
  let p = await page.inputValue('#ki-prompt');
  assert(p.includes('"""\nDie EU hat 28 Mitgliedstaaten. Sanktionen wirken nie.\n"""'), 'bereinigter Text');
  assert(!p.includes('@nutzer') && !p.includes('t.co'), '@-Name oder Link im Prompt');
  assert(p.includes('[e8]') && p.includes('[a4]') && p.includes('[s8] Länder der EU'), 'Einträge und Quellen');
  assert((await page.textContent('#ki-count')).includes('Zeichen'), 'Zeichenzahl');
  await page.uncheck('input[name=ki-item][value="entries:e8"]');
  p = await page.inputValue('#ki-prompt');
  assert(!p.includes('[e8]') && !p.includes('[s8]'), 'abgewählter Eintrag samt Quelle entfernt');
  await page.check('#ki-keep');
  p = await page.inputValue('#ki-prompt');
  assert(p.includes('@nutzer') && p.includes('https://t.co/abc'), 'auf Wunsch mitgeschickt');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Kopieren: Zwischenablage = Vorschau, Protokoll lokal, Daten unverändert, keine Netzwerkanfrage', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await kiOn(page);
  const before = await dump(page);
  const outside = []; page.on('request', r => { if (!r.url().startsWith(BASE)) outside.push(r.url()); });
  await check(page, TEXT);
  await page.click('[data-act=ki-start][data-v=pruefen]'); await page.waitForTimeout(150);
  assert(await page.evaluate(() => navigator.clipboard.readText().catch(() => '')) !== await page.inputValue('#ki-prompt'), 'vor dem Tipp nichts kopiert');
  const shown = await page.inputValue('#ki-prompt');
  await page.click('[data-act=ki-copy]'); await page.waitForTimeout(200);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === shown, 'Kopie weicht von Vorschau ab');
  assert(outside.filter(u => !/fonts\./.test(u)).length === 0, 'Anfragen nach außen: ' + outside.join(', '));
  assert(await dump(page) === before, 'Daten verändert');
  const log = await page.evaluate(() => window.DebateBase.Repo.db.meta.kiLog);
  assert(log.length === 1 && log[0].task === 'pruefen' && log[0].chars === shown.length && log[0].extras === false, JSON.stringify(log));
  await page.click('[data-act=close]'); await go(page, 'einstellungen');
  assert((await page.textContent('#ki-logcount')) === '1', 'Anzeige Protokoll');
  await page.click('[data-act=ki-log-clear]'); await page.click('[data-act=ki-log-clear]'); await page.waitForTimeout(150);
  assert((await page.evaluate(() => window.DebateBase.Repo.db.meta.kiLog)).length === 0, 'Protokoll gelöscht');
  await ctx.close();
});

await test('Vorschau „Antwort formulieren“: Stil, gewählte Einträge, Hinweis ohne Eingabe', async () => {
  const { ctx, page } = await withSample();
  await kiOn(page);
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]');
  await page.click('[data-act=ki-start][data-v=antwort]');
  assert((await page.textContent('#toast')).includes('Bitte zuerst'), 'Hinweis ohne Eingabe');
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.'); await page.click('[data-act=reply-suggest]'); await page.waitForTimeout(150);
  await page.click('[data-act=reply-style][data-v=kurz]');
  await page.click('[data-act=ki-start][data-v=antwort]'); await page.waitForTimeout(150);
  const p = await page.inputValue('#ki-prompt');
  assert(p.includes('im Stil „Kurz und pointiert“') && p.includes('[e8]') && p.includes('"antwort"'), p.slice(0, 600));
  assert((await page.textContent('#sheet h2.t')).includes('Antwort formulieren'), 'Titel');
  await ctx.close();
});

await test('Offline und Handy (360 px, dunkel): Vorschau ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  const cached = await page.evaluate(() => caches.keys().then(k => caches.open(k.find(x => x.startsWith('debatebase-app-')))).then(c => c.keys()).then(r => r.map(x => new URL(x.url).pathname)));
  assert(cached.includes('/DebateBase/ki.js'), 'ki.js nicht im Offline-Speicher');
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.DebateBase.Repo.setSetting('theme', 'dunkel'));
  await kiOn(page);
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await check(page, TEXT + ' Einsehrsehrlangeswortohneleerzeichendasnichtumbrechenwill.');
  await page.click('[data-act=ki-start][data-v=pruefen]'); await page.waitForTimeout(150);
  const ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  assert(ok, 'Überbreite');
  await page.screenshot({ path: '/tmp/phase4b-prompt.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
