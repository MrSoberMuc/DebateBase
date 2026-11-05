/* Automatische Tests für Phase 4B, Etappe 3: KI-Antwort übernehmen.
 * Aufruf: node tests/phase4b-etappe3.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, browser, test, assert, newPage, counts, reload, go, finish } from './harness.mjs';

const FIX = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ki-antwort-beispiel.json'), 'utf8');
async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150);
  return { ctx, page };
}
async function paste(page, text) {
  await go(page, 'einstellungen'); await page.click('#sec-ki [data-act=ki-imp-open]');
  await page.fill('#ki-answer', text); await page.click('[data-act=ki-imp-check]'); await page.waitForTimeout(150);
}
const existing = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].filter(x => !x.origin).sort((a, b) => a.id < b.id ? -1 : 1)))));

await test('Übernehmen: Sicherung, eine Transaktion, Nachkontrolle; vorhandene Daten unverändert', async () => {
  const { ctx, page } = await withSample();
  const c0 = await counts(page), before = await existing(page);
  await paste(page, FIX);
  await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  const t = await page.textContent('#sheet');
  assert(t.includes('KI-Antwort übernommen') && t.includes('Angelegt: 3 Einträge · 2 Quellen · 1 Karte · 3 Verknüpfungen'), t.slice(0, 300));
  assert(t.includes('Nachkontrolle: 9 von 9') && t.includes('✓'), 'Nachkontrolle');
  const c1 = await counts(page);
  assert(c1.e === c0.e + 3 && c1.s === c0.s + 2 && c1.a === c0.a + 1 && c1.l === c0.l + 3, JSON.stringify([c0, c1]));
  assert(await existing(page) === before, 'vorhandene Datensätze verändert');
  const r = await page.evaluate(() => ({ b: window.DebateBase.Repo.backups.map(x => x.reason), iss: window.DebateBase.checkIntegrity(), st: window.DebateBase.Repo.db.entries.filter(e => e.origin).map(e => e.status) }));
  assert(r.b[0] === 'Vor Übernahme einer KI-Antwort', 'Sicherung: ' + r.b);
  assert(r.iss.length === 0, 'Datenprüfung: ' + r.iss.join('; '));
  assert(r.st.every(s => s === 'neu'), 'Status');
  await reload(page);
  assert((await counts(page)).e === c0.e + 3, 'nach Neustart gespeichert');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Kennzeichnung: Chip, Hinweis, Suche „KI-Vorschlag“, Dashboard mit Einträgen und Karten', async () => {
  const { ctx, page } = await withSample();
  await paste(page, FIX); await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  await page.click('#sheet [data-act=open-entry] >> nth=0');
  assert(await page.isVisible('#sheet .ki-chip') && (await page.textContent('#sheet .ki-note')).includes('Aus einer KI-Antwort übernommen'), 'Detail Eintrag');
  await page.click('[data-act=close]');
  await go(page, 'dashboard');
  const d = await page.textContent('#ki-dash');
  assert(d.includes('4 KI-Vorschläge sind noch ungeprüft') && d.includes('3 Einträge') && d.includes('1 Karte'), d);
  await page.click('[data-act=goto-ki]'); await page.waitForTimeout(150);
  assert(await page.evaluate(() => location.hash) === '#wissen' && await page.locator('#list .card').count() === 3 && await page.locator('#list .card .ki-chip').count() === 3, 'Wissen');
  await go(page, 'dashboard'); await page.click('[data-act=goto-ki-args]'); await page.waitForTimeout(150);
  assert(await page.locator('#alist .card').count() === 1 && await page.isVisible('#alist .ki-chip'), 'Argumente');
  await go(page, 'quellen'); await page.fill('#sq', 'Austrittsabkommen'); await page.click('#slist .card >> nth=0');
  assert((await page.textContent('#sheet .ki-note')).includes('Von einer KI genannt, ungeprüft'), 'Quelle');
  await page.click('[data-act=close]');
  /* Status ändern: aus dem Dashboard-Hinweis heraus */
  await go(page, 'wissen'); await page.fill('#q', 'KI-Vorschlag');
  const kiIds = await page.evaluate(() => window.DebateBase.Repo.db.entries.filter(e => e.origin).map(e => e.id));
  for (const id of kiIds) {
    await page.click(`#list [data-id="${id}"]`); await page.click('[data-act=edit-entry]');
    await page.selectOption('#f-status', 'belegt'); await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(150);
  }
  await go(page, 'dashboard');
  assert((await page.textContent('#ki-dash')).includes('1 KI-Vorschlag ist noch ungeprüft'), 'nach Prüfung nur noch die Karte');
  await ctx.close();
});

await test('Dieselbe Antwort erneut: alles als Dublette erkannt, nichts doppelt', async () => {
  const { ctx, page } = await withSample();
  await paste(page, FIX); await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  const c1 = await counts(page);
  await page.click('[data-act=ki-imp-reset]');
  await page.fill('#ki-answer', FIX); await page.click('[data-act=ki-imp-check]'); await page.waitForTimeout(150);
  assert(await page.isDisabled('[data-act=ki-apply]'), 'Übernehmen gesperrt, da nichts Neues');
  assert((await page.textContent('#sheet')).includes('Würde angelegt: 0 Einträge'), 'Zählung');
  assert(JSON.stringify(await counts(page)) === JSON.stringify(c1), 'unverändert');
  await ctx.close();
});

await test('Fehler beim Speichern: nichts gespeichert, verständliche Meldung', async () => {
  const { ctx, page } = await withSample();
  const c0 = await counts(page);
  await paste(page, FIX);
  await page.evaluate(() => { const w = DB.write; DB.write = c => (c && c.put && c.put.entries && c.put.entries.length ? Promise.reject(new Error('Testfehler beim Schreiben')) : w(c)); });
  await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  const t = await page.textContent('#sheet');
  assert(t.includes('KI-Antwort nicht übernommen') && t.includes('Es wurde nichts gespeichert'), t.slice(0, 200));
  assert(JSON.stringify(await counts(page)) === JSON.stringify(c0), 'Daten verändert');
  await ctx.close();
});

await test('Rückgängig über die automatische Sicherung; Export enthält die Herkunft', async () => {
  const { ctx, page } = await withSample({ acceptDownloads: true });
  const c0 = await counts(page);
  await paste(page, FIX); await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  await page.click('[data-act=close]'); await go(page, 'einstellungen');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sec-backup [data-act=download]')]);
  const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert(data.entries.filter(e => e.origin && e.origin.kind === 'ki').length === 3, 'Herkunft im Export');
  await page.click('[data-act=restore-backup] >> nth=0'); await page.click('[data-act=restore-backup] >> nth=0'); await page.waitForTimeout(400);
  assert(JSON.stringify(await counts(page)) === JSON.stringify(c0), 'Stand vor der Übernahme wiederhergestellt');
  await ctx.close();
});

await test('Offline und Handy (360 px): Übernehmen und Ergebnis ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await go(page, 'einstellungen'); await page.click('[data-act=ki-toggle][data-v=an]'); await page.waitForTimeout(150);
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await paste(page, FIX); await page.click('[data-act=ki-apply]'); await page.waitForTimeout(500);
  assert((await page.textContent('#sheet')).includes('Nachkontrolle: 9 von 9'), 'offline übernommen');
  const ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  assert(ok, 'Überbreite');
  await page.screenshot({ path: '/tmp/phase4b-uebernommen.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
