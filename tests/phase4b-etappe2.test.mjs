/* Automatische Tests für Phase 4B, Etappe 2: KI-Antwort einlesen und Vorschau.
 * Aufruf: node tests/phase4b-etappe2.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, browser, test, assert, newPage, go, finish } from './harness.mjs';

const FIX = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ki-antwort-beispiel.json'), 'utf8');
async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));
async function kiOn(page) { await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150); }
async function paste(page, text) {
  await go(page, 'einstellungen'); await page.click('#sec-ki [data-act=ki-imp-open]');
  await page.fill('#ki-answer', text); await page.click('[data-act=ki-imp-check]'); await page.waitForTimeout(150);
}
const footer = page => page.locator('#sheet .card:has-text("Würde angelegt")').textContent();

await test('„KI-Antwort einfügen“ nur bei eingeschalteter Erweiterung, an allen Stellen', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=pruefen]');
  assert(await page.locator('[data-act=ki-imp-open]').count() === 0, 'aus: kein Knopf');
  await kiOn(page);
  assert(await page.locator('#sec-ki [data-act=ki-imp-open]').count() === 1, 'Optionen');
  await go(page, 'diskussion');
  assert(await page.locator('#view [data-act=ki-imp-open]').count() === 1, 'Behauptung prüfen');
  await page.click('[data-act=disc-mode][data-v=antwort]');
  assert(await page.locator('#view [data-act=ki-imp-open]').count() === 1, 'Antwort entwerfen');
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.'); await page.click('[data-act=ki-start][data-v=antwort]'); await page.waitForTimeout(100);
  assert(await page.locator('#sheet [data-act=ki-imp-open]').count() === 1, 'im Prompt-Fenster');
  await page.click('#sheet [data-act=ki-imp-open]');
  assert(await page.isVisible('#ki-answer'), 'öffnet Einfügen');
  await ctx.close();
});

await test('Vorschau: Zählung, Hinweise, Dubletten, Status „Neu“, Speichern noch gesperrt, Daten unverändert', async () => {
  const { ctx, page } = await withSample();
  await kiOn(page);
  const before = await dump(page);
  await paste(page, FIX);
  const t = await page.textContent('#sheet');
  assert(t.includes('Gelesen: 4 Einträge · 3 Quellen · 1 Karte · 3 Verknüpfungen'), t.slice(0, 300));
  assert(t.includes('Hinweise (') && t.includes('Typ „Blog“ ist unbekannt') && t.includes('unbekannte Kennung'), 'Hinweise');
  assert(t.includes('Ähnlich wie vorhandener Eintrag „Die EU hat 28 Mitgliedstaaten“') && t.includes('Vorhanden: „Charta der Vereinten Nationen“'), 'Dubletten');
  assert(!(await page.isChecked('input[name=ki-e][value=n4]')) && await page.isChecked('input[name=ki-e][value=n1]'), 'Vorauswahl');
  assert(await page.inputValue('select[name=ki-s][data-ref=q2]') === 'existing', 'Quelle: vorhandene verwenden');
  assert(t.includes('Status: Neu') && t.includes('Von der KI genannt, ungeprüft'), 'Kennzeichnung');
  assert(!(await page.locator('#ki-eval').getAttribute('open') !== null), 'Einschätzung zugeklappt');
  assert((await footer(page)).includes('3 Einträge · 2 neue Quellen · 1 Karte · 3 Verknüpfungen'), await footer(page));
  assert(await page.isDisabled('#sheet button:has-text("Übernehmen")'), 'Übernehmen gesperrt');
  assert(await dump(page) === before, 'Daten verändert');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Auswahl ändern: Verknüpfungen entfallen, Quelle überspringen, umdeuten, Richtung umdrehen', async () => {
  const { ctx, page } = await withSample();
  await kiOn(page); await paste(page, FIX);
  await page.click('label.checkline:has-text("Die KI meinte die Behauptung der Gegenseite")');
  assert((await page.textContent('#sheet')).includes('„Brexit: Austritt des Vereinigten Königreichs aus der EU“ unterstützt „Die EU wird immer größer“'), 'umgedeutet');
  await page.locator('input[name=ki-lr]').first().check(); await page.waitForTimeout(80);
  assert((await page.textContent('#sheet')).includes('„Die EU hat 28 Mitgliedstaaten“ widerspricht „Brexit: Austritt'), 'Richtung umgedreht');
  await page.selectOption('select[name=ki-s][data-ref=q1]', 'skip');
  assert((await footer(page)).includes('1 neue Quelle'), await footer(page));
  await page.uncheck('input[name=ki-e][value=n1]');
  const t = await page.textContent('#sheet');
  assert(t.includes('Entfällt, weil ein beteiligter Eintrag nicht angelegt wird') && (await footer(page)).includes('2 Einträge') && (await footer(page)).includes('1 Verknüpfung'), await footer(page));
  await ctx.close();
});

await test('Fehler und Wiederholen: leer, abgeschnitten, „Andere Antwort einfügen“', async () => {
  const { ctx, page } = await withSample();
  await kiOn(page);
  await paste(page, '');
  assert((await page.textContent('#sheet .err')).includes('nichts eingefügt'), 'leer');
  await page.fill('#ki-answer', FIX.slice(0, 700)); await page.click('[data-act=ki-imp-check]'); await page.waitForTimeout(100);
  assert(/abgeschnitten|nicht ganz kopiert/.test(await page.textContent('#sheet .err')), 'abgeschnitten');
  assert((await page.inputValue('#ki-answer')).length === 700, 'Text bleibt stehen');
  await page.fill('#ki-answer', 'Hier das Ergebnis:\n```json\n' + FIX + '\n```'); await page.click('[data-act=ki-imp-check]'); await page.waitForTimeout(100);
  assert(await page.isVisible('#sheet .kirow'), 'Vorschau nach Korrektur');
  await page.click('[data-act=ki-imp-reset]');
  assert(await page.inputValue('#ki-answer') === '', 'zurückgesetzt');
  await ctx.close();
});

await test('Antworttext der KI anzeigen und kopieren', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await kiOn(page);
  const data = JSON.parse(FIX); data.aufgabe = 'antwort'; data.antwort = 'Das stimmt so nicht mehr: Seit dem Brexit hat die EU 27 Mitglieder [n1].';
  await paste(page, JSON.stringify(data));
  await page.click('[data-act=ki-ans-copy]'); await page.waitForTimeout(100);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === data.antwort, 'Antworttext');
  await ctx.close();
});

await test('Offline und Handy (360 px, dunkel): Vorschau ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.DebateBase.Repo.setSetting('theme', 'dunkel'));
  await kiOn(page);
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await paste(page, FIX);
  await page.click('#ki-eval summary');
  const ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  assert(ok, 'Überbreite');
  await page.locator('#sheet .sec').first().screenshot({ path: '/tmp/phase4b-vorschau.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
