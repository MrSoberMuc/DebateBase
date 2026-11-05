/* Automatische Tests: Schnellprüfung mit KI-Anfrage auf dem Dashboard (Version 3.9.0).
 * Aufruf: node tests/dashboard-quick.test.mjs */
import { BASE, browser, test, assert, newPage, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));

await test('Karte steht ganz oben; ohne KI-Erweiterung: Prüfen und Hinweis zum Einschalten', async () => {
  const { ctx, page } = await withSample();
  assert(await page.evaluate(() => document.querySelector('#view').firstElementChild.id) === 'quick', 'nicht ganz oben');
  assert(await page.locator('[data-act=quick-ki]').count() === 0, 'KI-Knopf trotz „Aus“');
  await page.fill('#qtext', 'Die EU hat 28 Mitgliedstaaten.');
  await page.click('[data-act=quick-ki-on]'); await page.waitForTimeout(250);
  assert(await page.evaluate(() => location.hash) === '#einstellungen' && await page.isVisible('#sec-ki'), 'zu den Optionen');
  assert(await page.getAttribute('[data-act=ki-toggle][data-v=aus]', 'aria-pressed') === 'true', 'nicht automatisch eingeschaltet');
  await go(page, 'dashboard');
  assert(await page.inputValue('#qtext') === 'Die EU hat 28 Mitgliedstaaten.', 'Text bleibt erhalten');
  await page.click('[data-act=quick-check]'); await page.waitForTimeout(200);
  assert(await page.evaluate(() => location.hash) === '#diskussion' && await page.getAttribute('[data-act=disc-mode][data-v=pruefen]', 'aria-pressed') === 'true', 'Sprung zu Behauptung prüfen');
  assert(await page.inputValue('#ctext') === 'Die EU hat 28 Mitgliedstaaten.' && await page.locator('#cres article.claim').count() === 1, 'analysiert');
  assert(!(await page.isVisible('#ki-prompt')), 'kein Prompt-Fenster ohne KI');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Mit KI-Erweiterung: „KI-Anfrage erstellen“ analysiert und öffnet die Prompt-Vorschau', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150);
  const before = await dump(page);
  await go(page, 'dashboard');
  await page.fill('#qtext', '@jemand Sanktionen wirken nie. https://t.co/x');
  await page.click('[data-act=quick-ki]'); await page.waitForTimeout(300);
  assert(await page.evaluate(() => location.hash) === '#diskussion' && await page.locator('#cres article.claim').count() === 1, 'Analyse');
  assert(await page.isVisible('#ki-prompt'), 'Prompt-Vorschau offen');
  const p = await page.inputValue('#ki-prompt');
  assert(p.includes('Sanktionen wirken nie.') && !p.includes('@jemand') && p.includes('[a4]'), p.slice(0, 500));
  await page.click('[data-act=ki-copy]'); await page.waitForTimeout(150);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === p, 'kopiert');
  assert(await dump(page) === before, 'Daten verändert');
  await go(page, 'dashboard');
  assert(await page.inputValue('#qtext') === '', 'Feld nach dem Sprung geleert');
  await page.click('#quick [data-act=ki-imp-open]');
  assert(await page.isVisible('#ki-answer'), 'KI-Antwort einfügen vom Dashboard');
  await ctx.close();
});

await test('Leeres Feld: Hinweis, kein Sprung', async () => {
  const { ctx, page } = await withSample();
  await page.click('[data-act=quick-check]');
  assert((await page.textContent('#toast')).includes('Bitte zuerst eine Behauptung eingeben') && await page.evaluate(() => location.hash) !== '#diskussion', 'Hinweis');
  await ctx.close();
});

await test('Auch bei leerer Datenbank und auf dem Handy (360 px, dunkel) ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  assert(await page.isVisible('#quick') && await page.isVisible('[data-act=load-sample]'), 'leere Datenbank: Karte und Willkommen');
  await page.evaluate(() => window.DebateBase.Repo.setSetting('theme', 'dunkel'));
  await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150);
  await go(page, 'dashboard');
  assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Überbreite');
  await page.screenshot({ path: '/tmp/dashboard-quick.png' });
  await page.fill('#qtext', 'Test ohne passende Einträge.'); await page.click('[data-act=quick-ki]'); await page.waitForTimeout(300);
  assert(await page.isVisible('#ki-prompt'), 'Prompt auch ohne Einträge');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
