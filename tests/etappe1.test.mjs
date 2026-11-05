/* Automatische Tests für Etappe 1 (laufen in Chrome ohne Bildschirm).
 * Aufruf: node tests/etappe1.test.mjs
 * Benötigt Playwright und Google Chrome. Wird nicht für den Betrieb der App gebraucht. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, browser, test, assert, newPage, counts, idbCounts, reload, go, finish, V2_EXPORT } from './harness.mjs';
/* ---------------- Tests ---------------- */
await test('Erster Start: leere Datenbank, Willkommenskarte, keine Fehler', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  const c = await counts(page);
  assert(c.e === 0 && c.s === 0 && c.a === 0, 'Datenbank nicht leer');
  assert(await page.isVisible('text=Willkommen bei DebateBase 3'), 'Willkommenskarte fehlt');
  assert(await page.evaluate(() => window.DebateBase.Repo.ready), 'IndexedDB nicht bereit');
  const stores = await page.evaluate(() => DB.open().then(db => [...db.objectStoreNames]));
  for (const s of ['entries', 'args', 'sources', 'links', 'posts', 'topics', 'tags', 'settings', 'meta', 'inbox', 'backups']) assert(stores.includes(s), 'Store fehlt: ' + s);
  const idx = await page.evaluate(() => DB.open().then(db => { const t = db.transaction(['entries', 'links', 'posts']); return { e: [...t.objectStore('entries').indexNames], l: [...t.objectStore('links').indexNames], p: [...t.objectStore('posts').indexNames] }; }));
  assert(idx.e.includes('tags') && idx.e.includes('status') && idx.l.includes('from') && idx.p.includes('tweetId'), 'Indizes fehlen');
  assert(!page.errors.length, 'JS-Fehler: ' + page.errors.join(' | '));
  await ctx.close();
});

await test('Beispieldaten laden und nach Neuladen weiterhin vorhanden', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]');
  await page.waitForFunction(() => window.DebateBase.Repo.db.entries.length === 12);
  await reload(page);
  const c = await counts(page);
  assert(c.e === 12 && c.s === 8 && c.a === 4 && c.l === 5, 'Zählung nach Neuladen: ' + JSON.stringify(c));
  const i = await idbCounts(page);
  assert(i.entries === 12 && i.topics > 0 && i.tags > 0, 'IndexedDB/Taxonomie: ' + JSON.stringify(i));
  await ctx.close();
});

await test('Neuer Eintrag mit Quelle, Bearbeiten, Persistenz nach Neuladen', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  await page.click('.actions [data-act=new-entry]');
  await page.fill('#f-title', 'Mein Testeintrag');
  await page.fill('#f-desc', 'Mit Umlauten äöü und „Anführungszeichen“');
  await page.selectOption('#f-type', 'statistik');
  await page.selectOption('#f-status', 'pruefung');
  await page.fill('#f-topic', 'Neues Thema');
  await page.fill('#f-tags', 'Eins, zwei, #drei');
  await page.check('input[name=src][value=s3]');
  await page.fill('#x-evidence', 'Beleg XY');
  await page.click('form[data-form=entry] button[type=submit]');
  await page.waitForTimeout(200);
  await reload(page);
  let e = await page.evaluate(() => window.DebateBase.Repo.db.entries.find(x => x.title === 'Mein Testeintrag'));
  assert(e, 'Eintrag fehlt nach Neuladen');
  assert(e.type === 'statistik' && e.status === 'pruefung' && e.topic === 'Neues Thema', 'Felder falsch');
  assert(JSON.stringify(e.tags) === '["Eins","zwei","drei"]', 'Tags falsch: ' + e.tags);
  assert(e.sourceIds[0] === 's3' && e.evidence === 'Beleg XY', 'Quelle/Evidenz falsch');
  // bearbeiten
  await go(page, 'wissen');
  await page.fill('#q', 'Mein Testeintrag');
  await page.click('#list .card');
  await page.click('[data-act=edit-entry]');
  await page.fill('#f-title', 'Mein Testeintrag (geändert)');
  await page.click('form[data-form=entry] button[type=submit]');
  await page.waitForTimeout(200);
  await reload(page);
  e = await page.evaluate(() => window.DebateBase.Repo.db.entries.find(x => x.title === 'Mein Testeintrag (geändert)'));
  assert(e && e.updated >= e.created, 'Änderung nicht gespeichert');
  const topics = await page.evaluate(() => DB.getAll('topics').then(t => t.map(x => x.name)));
  assert(topics.includes('Neues Thema'), 'Thema nicht in topics-Store');
  await ctx.close();
});

await test('Löschen mit Kaskade: Verknüpfungen und Quellenverweise werden mit entfernt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  // Eintrag e4 hat Verknüpfung l1
  await page.evaluate(() => document.querySelector('[data-act=open-entry][data-id=e4]') || null);
  await page.evaluate(() => { location.hash = 'wissen'; });
  await page.waitForTimeout(80);
  await page.click('#list [data-id=e4]');
  await page.click('[data-act=del-entry]'); await page.click('[data-act=del-entry]');
  await page.waitForTimeout(200);
  // Quelle s4 wird von e6 und a2 zitiert
  await go(page, 'quellen');
  await page.click('#slist [data-id=s4]');
  await page.click('[data-act=del-source]'); await page.click('[data-act=del-source]');
  await page.waitForTimeout(200);
  await reload(page);
  const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; return { e4: !!D.entries.find(x => x.id === 'e4'), l1: !!D.links.find(x => x.id === 'l1'), s4: !!D.sources.find(x => x.id === 's4'), e6: D.entries.find(x => x.id === 'e6').sourceIds, a2: D.args.find(x => x.id === 'a2').sourceIds, iss: window.DebateBase.checkIntegrity() }; });
  assert(!r.e4 && !r.l1, 'Eintrag oder Verknüpfung noch da');
  assert(!r.s4 && !r.e6.includes('s4') && !r.a2.includes('s4'), 'Quellenverweise nicht bereinigt');
  assert(r.iss.length === 0, 'Datenprüfung meldet: ' + r.iss.join('; '));
  await ctx.close();
});

await test('Argumentationskarte und Verknüpfung anlegen, Duplikat wird abgewiesen', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  await go(page, 'argumente');
  await page.click('.fab');
  await page.fill('#a-title', 'Testkarte'); await page.fill('#a-claim', 'B'); await page.fill('#a-counter', 'G');
  await page.click('form[data-form=arg] button[type=submit]'); await page.waitForTimeout(150);
  const aid = await page.evaluate(() => window.DebateBase.Repo.db.args.find(a => a.title === 'Testkarte').id);
  await page.click(`#alist [data-id="${aid}"]`);
  await page.click('[data-act=new-link]');
  await page.selectOption('#lk-type', 'widerspricht');
  await page.selectOption('#lk-partner', 'entries:e2');
  await page.click('form[data-form=link] button[type=submit]'); await page.waitForTimeout(150);
  await page.click('[data-act=new-link]');
  await page.selectOption('#lk-type', 'widerspricht');
  await page.selectOption('#lk-partner', 'entries:e2');
  await page.click('form[data-form=link] button[type=submit]'); await page.waitForTimeout(100);
  assert(await page.isVisible('text=Diese Verknüpfung existiert bereits.'), 'Duplikat nicht erkannt');
  await reload(page);
  const n = await page.evaluate(id => window.DebateBase.Repo.db.links.filter(l => l.fromId === id || l.toId === id).length, aid);
  assert(n === 1, 'Verknüpfung nicht genau einmal gespeichert: ' + n);
  const viaIndex = await page.evaluate(id => DB.open().then(db => new Promise(r => { const q = db.transaction('links').objectStore('links').index('from').getAll(['args', id]); q.onsuccess = () => r(q.result.length); })), aid);
  assert(viaIndex === 1, 'Index "from" liefert ' + viaIndex);
  await ctx.close();
});

await test('X-Beitrag: Link-Erkennung, Duplikat, Umwandlung in Eintrag', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('.actions [data-act=new-post]');
  await page.fill('#p-text', 'Interessanter Beitrag. https://twitter.com/jemand/status/987654321?s=20');
  await page.dispatchEvent('#p-text', 'change');
  assert((await page.inputValue('#p-url')).includes('987654321'), 'Link nicht abgetrennt');
  await page.click('form[data-form=post] button[value=fakt]'); await page.waitForTimeout(200);
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(200);
  await page.click('.actions [data-act=new-post]');
  await page.fill('#p-url', 'https://x.com/jemand/status/987654321');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(100);
  assert(await page.isVisible('text=Dieser Beitrag ist bereits gespeichert.'), 'Duplikat nicht erkannt');
  await page.fill('#p-url', 'https://example.com/irgendwas');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(100);
  assert(await page.isVisible('text=Das ist kein gültiger X-Link'), 'Fremder Link nicht abgewiesen');
  await reload(page);
  const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; const p = D.posts[0]; const e = D.entries.find(x => x.postId === p.id); return { url: p.url, handle: p.handle, conv: p.convertedTo, e: e && e.id }; });
  assert(r.url === 'https://x.com/jemand/status/987654321' && r.handle === 'jemand', 'Beitrag falsch: ' + JSON.stringify(r));
  assert(r.e && r.conv.includes(r.e), 'Verbindung Beitrag ↔ Eintrag fehlt');
  await ctx.close();
});

await test('Import Version-2-Export in leere Datenbank: alles übernommen, Sicherung angelegt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=goto-import]');
  await page.fill('#mig-text', JSON.stringify(V2_EXPORT));
  await page.click('[data-act=mig-check]');
  assert(await page.isVisible('h2.t:has-text("Vorschau")'), 'Vorschau fehlt');
  await page.click('[data-act=mig-apply]'); await page.waitForSelector('text=Import abgeschlossen');
  await reload(page);
  const c = await counts(page);
  assert(c.e === 3 && c.s === 2 && c.a === 1 && c.l === 2 && c.p === 1, 'Zählung: ' + JSON.stringify(c));
  const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; return { b: D.entries.find(x => x.id === 'e_v2b'), p: D.posts[0], iss: window.DebateBase.checkIntegrity(), bk: window.DebateBase.Repo.backups.length }; });
  assert(r.b.reason === 'Grund B' && r.b.limits === 'Grenze B' && r.b.postId === 'p_v2a', 'Zusatzfelder fehlen');
  assert(r.p.convertedTo[0] === 'e_v2b' && r.p.note === 'meine Notiz', 'Beitrag unvollständig');
  assert(r.iss.length === 0, 'Datenprüfung: ' + r.iss.join('; '));
  assert(r.bk === 1, 'Keine Sicherung vor Import');
  await ctx.close();
});

await test('Sicherungen: Löschen aller Daten und Wiederherstellung', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  await go(page, 'einstellungen');
  await page.click('[data-act=wipe]');
  await page.fill('#dg-word', 'löschen');
  await page.click('#dg-go'); await page.waitForTimeout(250);
  assert((await counts(page)).e === 0, 'Nicht gelöscht');
  await reload(page);
  assert((await counts(page)).e === 0, 'Nach Neuladen nicht leer');
  await go(page, 'einstellungen');
  await page.click('[data-act=restore-backup]'); await page.click('[data-act=restore-backup]');
  await page.waitForTimeout(250);
  await reload(page);
  const c = await counts(page);
  assert(c.e === 12 && c.l === 5, 'Wiederherstellung unvollständig: ' + JSON.stringify(c));
  const bk = await page.evaluate(() => window.DebateBase.Repo.backups.map(b => b.reason));
  assert(bk.length === 2 && bk[0] === 'Vor Wiederherstellung', 'Sicherungsliste: ' + bk);
  await ctx.close();
});

await test('Höchstens 5 automatische Sicherungen werden aufbewahrt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.evaluate(async () => { for (let i = 0; i < 7; i++) await window.DebateBase.Repo.addBackup('Test ' + i); });
  const n = (await idbCounts(page)).backups;
  assert(n === 5, 'Anzahl Sicherungen: ' + n);
  await ctx.close();
});

await test('Suche und Filter in Wissensbibliothek, Quellen, Argumenten, Diskussion', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  await go(page, 'wissen');
  await page.fill('#q', 'klima');
  let n = await page.locator('#list .card').count();
  assert(n === 3, 'Suche "klima" ergibt ' + n);
  await page.click('[data-act=f-status][data-v=belegt]');
  n = await page.locator('#list .card').count();
  assert(n === 2, 'Status-Filter ergibt ' + n);
  await page.click('[data-act=reset-filters]');
  await page.selectOption('#fType', 'behauptung');
  n = await page.locator('#list .card').count();
  assert(n === 3, 'Typ-Filter ergibt ' + n);
  await go(page, 'quellen');
  await page.selectOption('#sKind', 'Studie');
  assert(await page.locator('#slist .card').count() === 3, 'Quellenfilter');
  await go(page, 'argumente');
  await page.fill('#aq', 'sanktionen');
  assert(await page.locator('#alist .card').count() === 1, 'Argumentsuche');
  await go(page, 'diskussion');
  await page.fill('#dq', 'nato');
  assert(await page.isVisible('#dres h2:has-text("Wissen (1)")'), 'Diskussionssuche');
  await ctx.close();
});

await test('Hell-/Dunkelmodus wird gespeichert', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await go(page, 'einstellungen');
  await page.click('[data-act=set-theme][data-v=dunkel]'); await page.waitForTimeout(150);
  await reload(page);
  assert(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'Dunkelmodus nicht gespeichert');
  await ctx.close();
});

await test('Datenprüfung erkennt Verweise ins Leere (ohne etwas zu löschen)', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.evaluate(() => DB.write({ put: { entries: [{ id: 'kaputt', title: 'Kaputt', type: 'fakt', status: 'neu', tags: [], sourceIds: ['gibtsnicht'], created: 1, updated: 1 }], links: [{ id: 'lx', type: 'zitiert', fromK: 'entries', fromId: 'kaputt', toK: 'args', toId: 'fehlt', created: 1 }] } }));
  await reload(page);
  const iss = await page.evaluate(() => window.DebateBase.checkIntegrity());
  assert(iss.length === 2, 'Erwartet 2 Auffälligkeiten, gefunden: ' + iss.length);
  assert((await counts(page)).l === 1, 'Es wurde etwas gelöscht');
  await go(page, 'einstellungen');
  assert(await page.isVisible('text=2 Auffälligkeiten gefunden'), 'Anzeige in Einstellungen fehlt');
  await ctx.close();
});

await test('Unbekannte Zusatzfelder bleiben beim Bearbeiten erhalten', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.evaluate(() => DB.write({ put: { entries: [{ id: 'xf', title: 'Mit Extrafeld', type: 'fakt', status: 'neu', tags: [], sourceIds: [], created: 1, updated: 1, eigenesFeld: 'bleibt' }] } }));
  await reload(page);
  await go(page, 'wissen');
  await page.click('#list [data-id=xf]'); await page.click('[data-act=edit-entry]');
  await page.fill('#f-title', 'Mit Extrafeld 2');
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(150);
  await reload(page);
  const v = await page.evaluate(() => window.DebateBase.Repo.db.entries.find(e => e.id === 'xf').eigenesFeld);
  assert(v === 'bleibt', 'Extrafeld verloren');
  await ctx.close();
});

await test('Keine horizontale Überbreite bei 360 px (alle Bereiche, hell und dunkel)', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx, 360);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  for (const r of ['dashboard', 'wissen', 'argumente', 'quellen', 'diskussion', 'einstellungen']) {
    await go(page, r);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(w <= 360, `${r}: Breite ${w}px`);
  }
  await go(page, 'wissen'); await page.click('#list .card >> nth=0');
  const w = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth);
  assert(w, 'Detailansicht zu breit');
  assert(!page.errors.length, 'JS-Fehler: ' + page.errors.join(' | '));
  await ctx.close();
});

await test('Tastatur: Karte mit Enter öffnen, Escape schließt', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(150);
  await go(page, 'wissen');
  await page.focus('#list .card >> nth=0'); await page.keyboard.press('Enter');
  assert(!(await page.isHidden('#overlay')), 'Enter öffnet nicht');
  await page.keyboard.press('Escape');
  assert(await page.isHidden('#overlay'), 'Escape schließt nicht');
  await ctx.close();
});

/* Screenshots zur Sichtkontrolle */
{
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 390);
  fs.mkdirSync(path.join(ROOT, 'tests', 'screens'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'tests/screens/1-start-leer.png') });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(ROOT, 'tests/screens/2-dashboard.png') });
  await go(page, 'einstellungen'); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(ROOT, 'tests/screens/3-einstellungen.png'), fullPage: true });
  await ctx.close();
}

await finish();
