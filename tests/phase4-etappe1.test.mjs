/* Automatische Tests für Phase 4, Etappe 1: intelligente Suche in der App.
 * Aufruf: node tests/phase4-etappe1.test.mjs */
import fs from 'node:fs';
import { BASE, browser, test, assert, newPage, counts, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));

await test('Wissensbibliothek: Wortform, Relevanz, „Warum“-Zeile', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen');
  await page.fill('#q', 'Sanktion');
  assert(await page.locator('#list .card').count() === 1, 'Treffer');
  const why = await page.locator('#list .card .why').first().textContent();
  assert(why.startsWith('Warum:') && why.includes('Wortform „Sanktionen“'), why);
  assert((await page.textContent('#count')).includes('nach Relevanz'), 'Zählzeile');
  await page.fill('#q', 'Vereinte Nationen');
  assert(await page.locator('#list .card').first().getAttribute('data-id') === 'e2', 'UN-Eintrag zuerst');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Sortierung: Relevanz bei Suche, andere Sortierungen bleiben wählbar', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen');
  assert(await page.inputValue('#fSort') === 'relevanz', 'Standard ist Relevanz');
  await page.fill('#q', 'klima');
  const rel = await page.locator('#list .card').evaluateAll(n => n.map(x => x.dataset.id));
  assert(rel[0] === 'e6', 'Titel „…Klimawandel“ vor reinen Tag-Treffern: ' + rel);
  await page.selectOption('#fSort', 'titel');
  const abc = await page.locator('#list h3').allTextContents();
  assert(abc.join('|') === abc.slice().sort((a, b) => a.localeCompare(b, 'de')).join('|'), 'A bis Z');
  await page.fill('#q', '');
  await page.selectOption('#fSort', 'relevanz');
  const ids = await page.locator('#list .card').evaluateAll(n => n.map(x => x.dataset.id));
  assert(ids[0] === 'e8' || ids.length === 12, 'ohne Suche: alle Einträge'); /* wie „Neueste“ */
  await page.click('[data-act=reset-filters]');
  assert(await page.inputValue('#fSort') === 'relevanz', 'Zurücksetzen');
  await ctx.close();
});

await test('Teiltreffer mit Hinweis, wenn kein Eintrag alle Wörter enthält', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen');
  await page.fill('#q', 'Ozonschicht Sanktionen');
  assert(await page.isVisible('#list .partial'), 'Hinweis Teiltreffer');
  assert((await page.textContent('#count')).includes('Teiltreffer'), 'Zählzeile');
  assert((await page.locator('#list .why .miss').first().textContent()).includes('nicht gefunden'), 'fehlendes Wort benannt');
  await page.fill('#q', 'Quantenschaum');
  assert(await page.isVisible('#list .empty'), 'kein Treffer');
  await ctx.close();
});

await test('Diskussion, Argumente, Quellen: Begründungen und Rangfolge', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion');
  await page.fill('#dq', 'Kernwaffen');
  assert(await page.isVisible('#dres h2:has-text("Wissen (1)")'), 'verwandter Begriff in Diskussion');
  assert((await page.textContent('#dres .why')).includes('verwandter Begriff „Atomwaffen“'), 'Begründung');
  await go(page, 'argumente');
  await page.fill('#aq', 'Sanktion');
  assert(await page.locator('#alist .card').count() === 1 && await page.isVisible('#alist .why'), 'Argumente');
  await go(page, 'quellen');
  await page.fill('#sq', 'Ozon');
  assert(await page.locator('#slist .card').first().getAttribute('data-id') === 's2', 'Quellen');
  await ctx.close();
});

await test('Verwandte Inhalte in der Detailansicht; Verknüpfen übernimmt den Partner', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'wissen');
  await page.click('#list [data-id=e6]');
  assert(await page.isVisible('#related h2'), 'Abschnitt fehlt');
  const txt = await page.textContent('#related');
  assert(txt.includes('Anteil erneuerbarer Energien') && txt.includes('gemeinsamer Tag: Klima'), txt);
  assert(!txt.includes('Ozonschicht'), 'bereits verknüpfte Einträge erscheinen nicht doppelt');
  const before = (await counts(page)).l;
  await page.click('#related [data-act=link-related] >> nth=0');
  assert(await page.inputValue('#lk-partner') === 'entries:e5', 'Partner vorausgewählt: ' + await page.inputValue('#lk-partner'));
  await page.selectOption('#lk-type', 'ergaenzt');
  await page.click('form[data-form=link] button[type=submit]'); await page.waitForTimeout(150);
  assert((await counts(page)).l === before + 1, 'Verknüpfung gespeichert');
  await go(page, 'argumente'); await page.click('#alist [data-id=a4]');
  assert(await page.isVisible('#related'), 'auch bei Argumentationskarten');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Eigene verwandte Begriffe: speichern, nach Neustart wirksam, im Export enthalten, beim Import übernommen', async () => {
  const { ctx, page } = await withSample({ acceptDownloads: true });
  await go(page, 'wissen'); await page.fill('#q', 'Montreal-Abkommen');
  assert(await page.locator('#list .card:not(.partial)').count() === 0 || await page.isVisible('#list .partial') || await page.isVisible('#list .empty'), 'vorher kein vollständiger Treffer');
  await go(page, 'einstellungen');
  await page.fill('#syn-text', 'Montreal-Abkommen, Montrealer Protokoll\nnur ein Begriff\nBundeswehr, Streitkräfte, bundeswehr');
  await page.click('[data-act=save-syn]'); await page.waitForTimeout(150);
  await reload(page);
  const saved = await page.evaluate(() => window.DebateBase.Repo.db.settings.synonyms);
  assert(JSON.stringify(saved) === JSON.stringify([['Montreal-Abkommen', 'Montrealer Protokoll'], ['Bundeswehr', 'Streitkräfte']]), JSON.stringify(saved));
  await go(page, 'wissen'); await page.fill('#q', 'Montreal-Abkommen');
  assert(await page.locator('#list .card').first().getAttribute('data-id') === 'e7' && !(await page.isVisible('#list .partial')), 'eigene Gruppe wirkt');
  await go(page, 'einstellungen');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sec-backup [data-act=download]')]);
  const file = await dl.path(), data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(data.settings.synonyms.length === 2 && data.settings.theme, 'Export');
  /* Neues Gerät: Datei importieren */
  const ctx2 = await browser.newContext(); const p2 = await newPage(ctx2);
  await p2.evaluate(() => { location.hash = 'einstellungen'; }); await p2.waitForTimeout(80);
  await p2.click('[data-act=open-migration]');
  await p2.setInputFiles('#mig-file', file); await p2.waitForTimeout(150);
  await p2.click('[data-act=mig-check]'); await p2.waitForTimeout(150);
  await p2.click('#mig-go'); await p2.waitForTimeout(400);
  assert((await p2.evaluate(() => window.DebateBase.Repo.db.settings.synonyms || [])).length === 2, 'Import übernimmt Begriffe');
  await ctx2.close(); await ctx.close();
});

await test('Datenerhalt: Suchen und Ansehen verändert keinen gespeicherten Datensatz', async () => {
  const { ctx, page } = await withSample();
  await page.evaluate(() => DB.write({ put: { entries: [{ id: 'alt1', title: 'Alter Eintrag mit Zusatzfeld', type: 'fakt', status: 'neu', tags: ['Klima'], sourceIds: ['s4'], created: 7, updated: 7, eigenesFeld: { bleibt: [1, 'ä'] } }] } }));
  await reload(page);
  const before = await dump(page);
  for (const q of ['klima', 'UNO', 'Sanktoinen', 'Ozonschicht Sanktionen']) { await go(page, 'wissen'); await page.fill('#q', q); }
  await go(page, 'diskussion'); await page.fill('#dq', 'klima');
  await go(page, 'wissen'); await page.fill('#q', ''); await page.click('#list [data-id=alt1]'); await page.click('[data-act=close]');
  await page.click('#list [data-id=e6]'); await page.click('[data-act=close]');
  assert(await dump(page) === before, 'Daten wurden verändert');
  await ctx.close();
});

await test('Offline: analyse.js im App-Speicher, Suche funktioniert ohne Internet', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  const cached = await page.evaluate(() => caches.keys().then(k => caches.open(k.find(x => x.startsWith('debatebase-app-')))).then(c => c.keys()).then(r => r.map(x => new URL(x.url).pathname)));
  assert(cached.includes('/DebateBase/analyse.js'), 'analyse.js nicht im Cache');
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await ctx.setOffline(true);
  await page.goto(BASE + '#wissen'); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await page.fill('#q', 'Sanktion');
  assert(await page.locator('#list .card .why').count() === 1, 'Suche offline');
  await ctx.close();
});

await test('Handy-Darstellung (360 und 412 px): keine Überbreite mit langen Begründungen, hell und dunkel', async () => {
  for (const w of [360, 412]) {
    const { ctx, page } = await withSample({ deviceScaleFactor: 2 }, w);
    await page.evaluate(() => DB.write({ put: { entries: [{ id: 'lang', title: 'Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichenhersteller', type: 'fakt', status: 'neu', tags: ['Überlangertagohneleerzeichendasnichtumbricht'], sourceIds: [], created: 9e12, updated: 9e12 }] } }));
    await reload(page);
    for (const theme of ['hell', 'dunkel']) {
      await page.evaluate(t => window.DebateBase.Repo.setSetting('theme', t), theme);
      await go(page, 'wissen'); await page.fill('#q', 'Donaudampfschifffahrtsgesellschaftskapitaensmuetze ueberlangertag');
      let sw = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(sw <= w, `${w}px ${theme} Wissen: ${sw}`);
      await page.fill('#q', ''); await page.click('#list [data-id=e6]');
      sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector('#sheet').scrollWidth - document.querySelector('#sheet').clientWidth + 1));
      assert(sw <= w, `${w}px ${theme} Detail: ${sw}`);
      await page.click('[data-act=close]');
      await go(page, 'einstellungen');
      assert(await page.evaluate(() => document.documentElement.scrollWidth) <= w, `${w}px ${theme} Optionen`);
    }
    if (w === 412) { await go(page, 'wissen'); await page.fill('#q', 'Kernwaffen'); await page.screenshot({ path: '/tmp/phase4-suche.png' }); await page.click('#list .card'); await page.screenshot({ path: '/tmp/phase4-verwandt.png', fullPage: false }); }
    assert(page.errors.length === 0, page.errors.join('; '));
    await ctx.close();
  }
});

await finish();
