/* Automatische Tests für Etappe 2: Migrationsassistent, Datei-Export, Wiederherstellung.
 * Aufruf: node tests/etappe2.test.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, browser, test, assert, newPage, counts, reload, go, finish, V2_EXPORT } from './harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
async function migrate(page, text, opts = {}) {
  await page.evaluate(() => { location.hash = 'einstellungen'; });
  await page.waitForTimeout(80);
  await page.click('[data-act=open-migration]');
  if (opts.file) await page.setInputFiles('#mig-file', opts.file);
  else await page.fill('#mig-text', text);
  if (opts.file) await page.waitForSelector('text=Geladen:');
  await page.click('[data-act=mig-check]');
}
async function applyAndWait(page) {
  await page.click('[data-act=mig-apply]');
  await page.waitForSelector('text=Schritt 3 von 3');
}

await test('Assistent: V2-Export mit Extrafeld importieren, Nachkontrolle, Protokoll, Persistenz', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  const d = clone(V2_EXPORT); d.entries[0].eigenesFeld = { a: [1, 'b'] };
  await migrate(page, JSON.stringify(d));
  assert(await page.isVisible('text=DebateBase Version 2'), 'Format nicht erkannt');
  assert(await page.isHidden('input[name=mig-mode]').catch(() => true), 'Modus-Auswahl bei leerer DB sichtbar');
  await applyAndWait(page);
  assert(await page.isVisible('text=Nachkontrolle: 9 von 9 Datensätzen korrekt gespeichert.'), 'Nachkontrolle fehlt');
  await page.click('[data-act=close]');
  await reload(page);
  const c = await counts(page);
  assert(c.e === 3 && c.s === 2 && c.a === 1 && c.l === 2 && c.p === 1, JSON.stringify(c));
  const r = await page.evaluate(() => ({ x: window.DebateBase.Repo.db.entries.find(e => e.id === 'e_v2a').eigenesFeld, log: window.DebateBase.Repo.db.meta.migrations }));
  assert(JSON.stringify(r.x) === '{"a":[1,"b"]}', 'Extrafeld verloren');
  assert(r.log.length === 1 && r.log[0].verified === 9, 'Protokoll: ' + JSON.stringify(r.log));
  await go(page, 'einstellungen');
  assert(await page.isVisible('text=Letzte Importe'), 'Protokoll nicht angezeigt');
  await ctx.close();
});

await test('Abgeschnittener Text: verständliche Fehlermeldung, nichts gespeichert', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await migrate(page, JSON.stringify(V2_EXPORT).slice(0, 300));
  assert(await page.isVisible('text=abgeschnitten'), 'Hinweis fehlt');
  assert((await counts(page)).e === 0, 'Es wurde gespeichert');
  await ctx.close();
});

await test('Gleiche Datei zweimal: alles schon vorhanden, Import-Knopf gesperrt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await migrate(page, JSON.stringify(V2_EXPORT)); await applyAndWait(page); await page.click('[data-act=close]');
  await migrate(page, JSON.stringify(V2_EXPORT));
  assert(await page.isVisible('text=Es werden 0 Datensätze gespeichert.'), 'Zählung');
  assert(await page.isDisabled('#mig-go'), 'Knopf nicht gesperrt');
  await ctx.close();
});

await test('Konflikte: vorhandene behalten / ersetzen / beide behalten', async () => {
  const changed = clone(V2_EXPORT); changed.entries[0].title = 'Alpha geändert'; changed.sources[0].note = 'neue Notiz';
  for (const mode of ['skip', 'replace', 'copy']) {
    const ctx = await browser.newContext(); const page = await newPage(ctx);
    await migrate(page, JSON.stringify(V2_EXPORT)); await applyAndWait(page); await page.click('[data-act=close]');
    await migrate(page, JSON.stringify(changed));
    assert(await page.isVisible('text=2 Konflikte'), mode + ': Konflikte nicht angezeigt');
    await page.check(`input[name=mig-conflict][value=${mode}]`);
    if (mode !== 'skip') await applyAndWait(page);
    await reload(page);
    const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; return { titles: D.entries.map(e => e.title).sort(), e: D.entries.length, s: D.sources.length, iss: window.DebateBase.checkIntegrity(), copy: D.entries.find(e => e.title === 'Alpha geändert') }; });
    if (mode === 'skip') assert(r.e === 3 && !r.copy, 'skip: ' + JSON.stringify(r.titles));
    if (mode === 'replace') assert(r.e === 3 && r.copy && r.copy.id === 'e_v2a', 'replace: ' + JSON.stringify(r.titles));
    if (mode === 'copy') {
      assert(r.e === 4 && r.s === 3 && r.copy && r.copy.id !== 'e_v2a', 'copy: ' + JSON.stringify(r));
      assert(r.copy.sourceIds[0] !== 's_v2a' && r.copy.sourceIds.length === 1, 'Quellenverweis der Kopie nicht umgeschrieben');
    }
    assert(r.iss.length === 0, mode + ' Datenprüfung: ' + r.iss.join('; '));
    await ctx.close();
  }
});

await test('Komplett ersetzen: nur mit Bestätigung, Sicherung vorher, danach exakt Dateiinhalt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await migrate(page, JSON.stringify(V2_EXPORT));
  await page.check('input[name=mig-mode][value=replace]');
  assert(await page.isDisabled('#mig-go'), 'ohne Bestätigung freigegeben');
  await page.fill('#mig-word', 'ersetzen');
  assert(!(await page.isDisabled('#mig-go')), 'mit Bestätigung gesperrt');
  await applyAndWait(page);
  assert(await page.isVisible('text=Nachkontrolle: 9 von 9'), 'Nachkontrolle');
  await reload(page);
  const c = await counts(page);
  assert(c.e === 3 && c.s === 2 && c.l === 2, JSON.stringify(c));
  const bk = await page.evaluate(() => window.DebateBase.Repo.backups[0]);
  assert(bk.reason === 'Vor Wiederherstellung aus Datei' && bk.counts.entries === 12, 'Sicherung: ' + JSON.stringify(bk.counts));
  await ctx.close();
});

await test('Datei-Export: echter Download, Inhalt vollständig, Rundreise in neues Gerät identisch', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true }); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => DB.write({ put: { entries: [{ id: 'xx', title: 'Mit Sonderzeichen „ä“ \u{1F600}', type: 'fakt', status: 'neu', tags: [], sourceIds: [], created: 5, updated: 5, frei: [1, { a: null }] }] } }));
  await reload(page);
  assert(await page.isVisible('text=noch keine Sicherungsdatei heruntergeladen'), 'Hinweis auf Dashboard fehlt');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.card [data-act=download]')]);
  assert(/^debatebase-sicherung-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'Dateiname ' + dl.suggestedFilename());
  const file = path.join(os.tmpdir(), dl.suggestedFilename());
  await dl.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(data.app === 'DebateBase' && data.version === 3 && data.entries.length === 13 && data.links.length === 5, 'Inhalt');
  assert(data.entries.find(e => e.id === 'xx').title.includes('\u{1F600}'), 'Sonderzeichen');
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => !!window.DebateBase.Repo.db.meta.lastExport), 'lastExport nicht gesetzt');
  assert(await page.isHidden('text=noch keine Sicherungsdatei heruntergeladen'), 'Hinweis nicht verschwunden');
  const before = await page.evaluate(() => Migrate.stable(['entries', 'sources', 'args', 'links', 'posts'].map(c => window.DebateBase.Repo.db[c].slice().sort((a, b) => a.id < b.id ? -1 : 1))));
  // neues "Gerät": eigener Browser-Kontext, Datei über Dateiauswahl
  const ctx2 = await browser.newContext(); const p2 = await newPage(ctx2);
  await migrate(p2, '', { file });
  assert(await p2.isVisible('text=DebateBase 3 (Sicherungsdatei)'), 'Format V3');
  await applyAndWait(p2);
  await reload(p2);
  const after = await p2.evaluate(() => Migrate.stable(['entries', 'sources', 'args', 'links', 'posts'].map(c => window.DebateBase.Repo.db[c].slice().sort((a, b) => a.id < b.id ? -1 : 1))));
  assert(before === after, 'Rundreise nicht identisch');
  await ctx.close(); await ctx2.close();
});

await test('Fehler beim Speichern: nichts geändert, verständliche Meldung', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const orig = DB.write; DB.write = ch => (ch.put && ch.put.entries && ch.put.entries.length) ? Promise.reject(new Error('Der Speicher auf dem Gerät ist voll.')) : orig(ch); });
  await migrate(page, JSON.stringify(V2_EXPORT));
  await applyAndWait(page);
  assert(await page.isVisible('text=Import nicht durchgeführt'), 'Fehlerseite fehlt');
  assert(await page.isVisible('text=Es wurde nichts geändert.'), 'Hinweis fehlt');
  await reload(page);
  const c = await counts(page);
  assert(c.e === 12 && c.s === 8, 'Daten verändert: ' + JSON.stringify(c));
  await ctx.close();
});

await test('Version-1-Export (ohne Verknüpfungen und Beiträge) wird erkannt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  const v1 = { entries: V2_EXPORT.entries.map(e => ({ ...e, postId: undefined })), sources: V2_EXPORT.sources, args: V2_EXPORT.args };
  await migrate(page, JSON.stringify(v1));
  assert(await page.isVisible('text=DebateBase Version 1'), 'V1 nicht erkannt');
  await applyAndWait(page);
  assert(await page.isVisible('text=Import abgeschlossen'), 'nicht abgeschlossen');
  await ctx.close();
});

await test('Assistent bei 360 px ohne Überbreite und ohne JS-Fehler', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  const changed = clone(V2_EXPORT); changed.entries[0].type = 'zitat'; changed.entries.push({ id: 'ohne' });
  await migrate(page, JSON.stringify(V2_EXPORT)); await applyAndWait(page); await page.click('[data-act=close]');
  changed.entries[1].title = 'geändert';
  await migrate(page, JSON.stringify(changed));
  fs.mkdirSync(path.join(ROOT, 'tests', 'screens'), { recursive: true });
  const ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  await page.locator('#sheet').screenshot({ path: path.join(ROOT, 'tests/screens/4-vorschau.png') });
  assert(ok, 'Überbreite in der Vorschau');
  await page.check('input[name=mig-conflict][value=copy]');
  await applyAndWait(page);
  await page.locator('#sheet').screenshot({ path: path.join(ROOT, 'tests/screens/5-ergebnis.png') });
  assert(!page.errors.length, 'JS-Fehler: ' + page.errors.join(' | '));
  await ctx.close();
});

await finish();
