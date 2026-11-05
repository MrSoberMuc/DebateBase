/* Gesamttest: Funktionen aus Version 2, die in den Etappen 1–4 noch keinen eigenen Test hatten.
 * Aufruf: node tests/etappe5.test.mjs */
import { browser, test, assert, newPage, counts, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}

await test('„Für X kopieren“: Text mit Prüfstatus und Quelle, höchstens 280 Zeichen', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await go(page, 'wissen'); await page.click('#list [data-id=e2]');
  await page.click('[data-act=copyx]'); await page.waitForTimeout(150);
  const t = await page.evaluate(() => navigator.clipboard.readText());
  assert(t.startsWith('Gründung der Vereinten Nationen – ') && t.includes('(Belegt)') && t.includes('Quelle: Charta der Vereinten Nationen'), t);
  assert(t.length <= 280, 'zu lang: ' + t.length);
  await page.click('[data-act=close]');
  await go(page, 'diskussion'); await page.fill('#dq', 'abschreckung');
  await page.click('#dres [data-act=copyx][data-k=args]'); await page.waitForTimeout(150);
  const a = await page.evaluate(() => navigator.clipboard.readText());
  assert(a.startsWith('Abschreckung verhindert Großmachtkriege: ') && a.length <= 280, a);
  await ctx.close();
});

await test('Dashboard: Kacheln, „Neue Recherche“, Statusfilter, offene Recherchen', async () => {
  const { ctx, page } = await withSample();
  assert(await page.locator('.tile b').first().textContent() === '12', 'Kachel');
  await page.click('[data-act=new-research]');
  assert(await page.inputValue('#f-type') === 'frage' && await page.inputValue('#f-status') === 'pruefung', 'Vorbelegung');
  await page.fill('#f-title', 'Neue offene Frage'); await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(150);
  assert(await page.isVisible('text=Offene Recherchen (3)'), 'offene Recherchen');
  await page.click('.legend [data-act=goto-status][data-v=widerlegt]'); await page.waitForTimeout(120);
  assert(await page.evaluate(() => location.hash) === '#wissen' && await page.locator('#list .card').count() === 1, 'Statusfilter');
  await page.evaluate(() => { location.hash = 'dashboard'; }); await page.waitForTimeout(80);
  await page.click('.tile[data-go=quellen]'); await page.waitForTimeout(80);
  assert(await page.evaluate(() => location.hash) === '#quellen', 'Kachel-Navigation');
  await ctx.close();
});

await test('Wissensbibliothek: Sortierung A–Z, Themenfilter, Tag-Vorschläge, Zusatzfelder je Typ', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen');
  await page.selectOption('#fSort', 'titel');
  assert((await page.locator('#list h3').first().textContent()).startsWith('Anteil'), 'Sortierung');
  await page.selectOption('#fTopic', 'Geschichte');
  assert(await page.locator('#list .card').count() === 2, 'Themenfilter');
  await page.click('[data-act=reset-filters]');
  await page.click('.fab');
  await page.click('[data-act=addtag] >> nth=0');
  assert((await page.inputValue('#f-tags')).length > 0, 'Tag-Vorschlag');
  await page.selectOption('#f-type', 'definition');
  assert(await page.isHidden('[data-f=reason]') && await page.isVisible('[data-f=claimCore]'), 'Zusatzfelder Definition');
  await page.selectOption('#f-type', 'behauptung');
  assert(await page.isVisible('[data-f=reason]') && await page.isVisible('[data-f=conclusion]'), 'Zusatzfelder Behauptung');
  await page.click('form[data-form=entry] button[type=submit]');
  assert(await page.isVisible('text=Bitte gib einen Titel ein.'), 'Pflichtfeld Titel');
  await ctx.close();
});

await test('Verknüpfung bearbeiten (Richtung, Art, Notiz) und löschen', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen'); await page.click('#list [data-id=e6]');
  await page.click('.lk >> nth=0 >> [data-act=edit-link]');
  await page.selectOption('#lk-type', 'zitiert'); await page.fill('#lk-note', 'geändert');
  assert((await page.textContent('#lk-prev')).includes('zitiert'), 'Vorschau');
  await page.click('form[data-form=link] button[type=submit]'); await page.waitForTimeout(150);
  await reload(page);
  let l = await page.evaluate(() => window.DebateBase.Repo.db.links.find(x => x.note === 'geändert'));
  assert(l && l.type === 'zitiert', 'Bearbeitung nicht gespeichert');
  await go(page, 'wissen'); await page.click('#list [data-id=e6]');
  const before = (await counts(page)).l;
  await page.click('.lk >> nth=0 >> [data-act=del-link]'); await page.click('.lk >> nth=0 >> [data-act=del-link]'); await page.waitForTimeout(150);
  await reload(page);
  assert((await counts(page)).l === before - 1, 'nicht gelöscht');
  await ctx.close();
});

await test('X-Beitrag bearbeiten und löschen (Eintrag verliert Herkunftsverweis)', async () => {
  const { ctx, page } = await withSample();
  await page.click('.actions [data-act=new-post]');
  await page.fill('#p-url', 'https://x.com/z/status/123'); await page.fill('#p-text', 'Ursprung');
  await page.click('form[data-form=post] button[value=fakt]'); await page.waitForTimeout(200);
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(200);
  const pid = await page.evaluate(() => window.DebateBase.Repo.db.posts[0].id);
  await page.evaluate(id => { location.hash = 'diskussion'; }, pid); await page.waitForTimeout(80);
  await page.click(`[data-act=open-post][data-id="${pid}"]`);
  await page.click('[data-act=edit-post]'); await page.fill('#p-text', 'Ursprung bearbeitet');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(150);
  await page.click(`[data-act=open-post][data-id="${pid}"]`);
  await page.click('[data-act=del-post]'); await page.click('[data-act=del-post]'); await page.waitForTimeout(150);
  await reload(page);
  const r = await page.evaluate(() => ({ p: window.DebateBase.Repo.db.posts.length, e: window.DebateBase.Repo.db.entries.find(e => e.title === 'Ursprung bearbeitet' || e.title === 'Ursprung'), iss: window.DebateBase.checkIntegrity() }));
  assert(r.p === 0 && r.e && r.e.postId === '' && !r.iss.length, JSON.stringify(r));
  await ctx.close();
});

await test('Diskussionsmodus: „Nur belegte“, Tag-Schnellwahl, „Als neuen Eintrag speichern“', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion');
  await page.fill('#dq', 'klima');
  const all = await page.locator('#dres article').count();
  await page.click('[data-act=disc-only]');
  const only = await page.locator('#dres article').count();
  assert(only < all && only > 0, `alle ${all}, belegt ${only}`);
  await page.click('[data-act=disc-tag] >> nth=0');
  assert((await page.inputValue('#dq')).length > 0, 'Tag-Schnellwahl');
  await page.fill('#dq', 'Neues Stichwort');
  await page.click('[data-act=disc-save]');
  assert(await page.inputValue('#f-title') === 'Neues Stichwort', 'Vorbelegung');
  await ctx.close();
});

await test('Quelle: ungültiger Link abgewiesen, „Zitiert in“, Bearbeiten', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'quellen'); await page.click('.fab');
  await page.fill('#s-title', 'Q'); await page.fill('#s-url', 'www.ohne-protokoll.de');
  await page.click('form[data-form=source] button[type=submit]');
  assert(await page.isVisible('text=Der Link muss mit http:// oder https:// beginnen.'), 'Linkprüfung');
  await page.click('[data-act=close]');
  await page.click('#slist [data-id=s4]');
  assert(await page.isVisible('text=Zitiert in 1 Einträgen'), 'Zitiert in');
  await page.click('[data-act=edit-source]'); await page.fill('#s-year', '2014');
  await page.click('form[data-form=source] button[type=submit]'); await page.waitForTimeout(150);
  await reload(page);
  assert(await page.evaluate(() => window.DebateBase.Repo.db.sources.find(s => s.id === 's4').year) === '2014', 'nicht gespeichert');
  await ctx.close();
});

await test('Hell/Dunkel über den Knopf oben und „Beispieldaten wiederherstellen“ mit Bestätigung', async () => {
  const { ctx, page } = await withSample();
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#themeBtn'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(before !== after, 'Farbe unverändert');
  await page.evaluate(() => DB.write({ put: { entries: [{ id: 'eigen', title: 'Eigener', type: 'fakt', status: 'neu', tags: [], sourceIds: [], created: 1, updated: 1 }] } }));
  await reload(page);
  await go(page, 'einstellungen'); await page.click('[data-act=reset-sample]');
  assert(await page.isDisabled('#dg-go'), 'ohne Bestätigung möglich');
  await page.fill('#dg-word', 'zurücksetzen'); await page.click('#dg-go'); await page.waitForTimeout(250);
  await reload(page);
  const r = await page.evaluate(() => ({ n: window.DebateBase.Repo.db.entries.length, own: window.DebateBase.Repo.db.entries.some(e => e.id === 'eigen'), bk: window.DebateBase.Repo.backups[0].counts.entries }));
  assert(r.n === 12 && !r.own && r.bk === 13, JSON.stringify(r));
  await ctx.close();
});

await test('Tastatur: alle Bereiche über Tab erreichbar, Fokus sichtbar', async () => {
  const { ctx, page } = await withSample();
  let reached = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const h = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'));
    if (h) reached.add(h);
  }
  assert(['#dashboard', '#wissen', '#argumente', '#quellen', '#diskussion', '#einstellungen'].every(h => reached.has(h)), 'erreicht: ' + [...reached]);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== 'none', 'Fokus nicht sichtbar');
  await ctx.close();
});

await finish();
