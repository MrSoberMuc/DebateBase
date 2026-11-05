/* Automatische Tests für Phase 4, Etappe 2: Quellenanalyse.
 * Aufruf: node tests/phase4-etappe2.test.mjs */
import fs from 'node:fs';
import { browser, test, assert, newPage, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const src = (page, id) => page.evaluate(i => DB.getAll('sources').then(r => r.find(s => s.id === i)), id);
const save = async page => { await page.click('form[data-form=source] button[type=submit]'); await page.waitForTimeout(150); };

await test('Bestehende Quelle: Anzeige „nicht angegeben“, Werte und Zusatzfelder bleiben beim Bearbeiten erhalten', async () => {
  const { ctx, page } = await withSample();
  await page.evaluate(() => DB.write({ put: { sources: [{ id: 'alt', title: 'Alte Quelle', publisher: 'Autor oder Herausgeber in einem Feld', year: '2001', kind: 'Podcast', url: 'https://example.org', note: 'n', created: 3, eigenesFeld: { x: 1 } }] } }));
  await reload(page);
  const before = await src(page, 'alt');
  await go(page, 'quellen'); await page.click('#slist [data-id=alt]');
  const t = await page.textContent('#sheet');
  assert(t.includes('Autor') && t.includes('nicht angegeben') && t.includes('nicht geprüft'), 'Anzeige');
  assert(t.includes('Doku 2/6'), 'Vollständigkeit (Herausgeber + Jahr; Methodik zählt bei „Podcast“ nicht): ' + t.match(/Doku \d+\/\d+/));
  await page.click('[data-act=edit-source]');
  assert(await page.inputValue('#s-kind') === 'Podcast', 'unbekannte Art bleibt ausgewählt');
  await save(page);
  const after = await src(page, 'alt');
  for (const k of Object.keys(before)) assert(JSON.stringify(before[k]) === JSON.stringify(after[k]), 'verändert: ' + k);
  for (const k of ['author', 'date', 'method', 'keyClaims', 'limitations', 'conflicts']) assert(after[k] === '', 'neues Feld nicht leer: ' + k);
  assert(after.coi === '', 'Interessenkonflikte: nicht geprüft');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Neue Felder speichern, nach Neustart vorhanden, Vollständigkeit 7/7', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'quellen'); await page.click('[data-act=new-source]');
  await page.fill('#s-title', 'Testquelle Methodik');
  await page.fill('#s-pub', 'Testinstitut'); await page.fill('#s-author', 'Muster, M.');
  await page.selectOption('#s-kind', 'Studie'); await page.fill('#s-date', '2023-05-15');
  await page.click('details.eval summary');
  await page.fill('#s-method', 'Befragung von 2.000 Personen'); await page.fill('#s-keyClaims', 'Aussage eins\nAussage zwei');
  await page.fill('#s-limitations', 'Nur Deutschland'); await page.selectOption('#s-coi', 'ja');
  assert(await page.isVisible('#s-conflicts'), 'Feld für Konflikte erscheint');
  await save(page);
  assert((await page.textContent('#err')).includes('Interessenkonflikt'), 'Konflikt ohne Beschreibung abgelehnt');
  await page.fill('#s-conflicts', 'Finanziert von Verband X'); await save(page);
  await reload(page);
  const s = await page.evaluate(() => window.DebateBase.Repo.db.sources.find(x => x.title === 'Testquelle Methodik'));
  assert(s.year === '2023' && s.date === '2023-05-15', 'Jahr aus Datum: ' + s.year);
  assert(s.author === 'Muster, M.' && s.method && s.keyClaims === 'Aussage eins\nAussage zwei' && s.limitations && s.coi === 'ja' && s.conflicts, JSON.stringify(s));
  await go(page, 'quellen'); await page.click(`#slist [data-id="${s.id}"]`);
  const t = await page.textContent('#sheet');
  assert(t.includes('Doku 7/7') && t.includes('15. Mai 2023') && t.includes('Vorhanden: Finanziert von Verband X'), t.slice(0, 400));
  await ctx.close();
});

await test('Prüfungen: Jahr und Datum müssen zusammenpassen; „Keine bekannt“ leert den Konflikttext', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'quellen'); await page.click('#slist [data-id=s4]'); await page.click('[data-act=edit-source]');
  await page.fill('#s-date', '2015-01-01'); await save(page);
  assert((await page.textContent('#err')).includes('passen nicht zusammen'), 'Widerspruch Jahr/Datum');
  await page.fill('#s-date', '2013-05-15');
  await page.click('details.eval summary'); await page.selectOption('#s-coi', 'keine');
  assert(!(await page.isVisible('#s-conflicts')), 'Konfliktfeld versteckt');
  await save(page);
  const s = await src(page, 's4');
  assert(s.coi === 'keine' && s.conflicts === '' && s.year === '2013', JSON.stringify(s));
  await ctx.close();
});

await test('Verknüpfte Behauptungen: Behauptungen und Argumentationskarten, die die Quelle nennen', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'quellen'); await page.click('#slist [data-id=s4]');
  let t = await page.textContent('#src-claims');
  assert(t.includes('Verknüpfte Behauptungen (1)') && t.includes('Der Klimawandel ist rein natürlich') && t.includes('Argumentationskarte'), t);
  assert(await page.isVisible('text=Zitiert in 1 Einträgen'), 'bisherige Anzeige bleibt');
  await page.click('[data-act=close]'); await page.click('#slist [data-id=s6]');
  t = await page.textContent('#src-claims');
  assert(t.includes('Impfstoffe verursachen Autismus') && t.includes('Behauptung') && t.includes('Widerlegt'), t);
  await page.click('#src-claims [data-act=open-entry]');
  assert((await page.textContent('#sheet h2.t')).includes('Impfstoffe'), 'Eintrag öffnet');
  await page.click('[data-act=close]'); await page.click('#slist [data-id=s8]');
  assert((await page.textContent('#src-claims')).includes('Die EU hat 28 Mitgliedstaaten'), 's8');
  await ctx.close();
});

await test('Suche findet Quellen über Autor und Kernaussagen, mit Begründung', async () => {
  const { ctx, page } = await withSample();
  await page.evaluate(() => window.DebateBase.Repo.put('sources', Object.assign({}, window.DebateBase.Repo.get('sources', 's4'), { author: 'John Cook', keyClaims: 'Konsens über menschengemachte Erwärmung' })));
  await go(page, 'quellen'); await page.fill('#sq', 'Cook');
  assert(await page.locator('#slist .card').first().getAttribute('data-id') === 's4', 'Autor');
  await page.fill('#sq', 'menschengemachte');
  assert((await page.textContent('#slist .why')).includes('Kernaussagen'), 'Begründung');
  assert(await page.locator('#slist [data-id=s4] .chip:has-text("Doku")').count() === 1, 'Doku-Anzeige auf der Karte');
  await ctx.close();
});

await test('Export und Import: neue Quellenfelder bleiben vollständig erhalten', async () => {
  const { ctx, page } = await withSample({ acceptDownloads: true });
  await page.evaluate(() => window.DebateBase.Repo.put('sources', Object.assign({}, window.DebateBase.Repo.get('sources', 's2'), { author: 'WMO', date: '2022-11-01', method: 'Sachstandsbericht', keyClaims: 'K', limitations: 'L', coi: 'ja', conflicts: 'C' })));
  await go(page, 'einstellungen');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sec-backup [data-act=download]')]);
  const file = await dl.path(), data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const s2 = data.sources.find(s => s.id === 's2');
  assert(s2.author === 'WMO' && s2.date === '2022-11-01' && s2.coi === 'ja' && s2.conflicts === 'C', 'Export');
  const ctx2 = await browser.newContext(); const p2 = await newPage(ctx2);
  await go(p2, 'einstellungen'); await p2.click('[data-act=open-migration]');
  await p2.setInputFiles('#mig-file', file); await p2.waitForTimeout(150);
  await p2.click('[data-act=mig-check]'); await p2.waitForTimeout(150);
  await p2.click('#mig-go'); await p2.waitForTimeout(400);
  const imp = await src(p2, 's2');
  assert(JSON.stringify(imp) === JSON.stringify(s2), 'Import weicht ab');
  await ctx2.close(); await ctx.close();
});

await test('Handy (360 px): Formular mit Bewertung und Detailansicht ohne Überbreite', async () => {
  const { ctx, page } = await withSample({ deviceScaleFactor: 2 }, 360);
  await go(page, 'quellen'); await page.click('#slist [data-id=s5]'); await page.click('[data-act=edit-source]');
  await page.click('details.eval summary'); await page.selectOption('#s-coi', 'ja');
  await page.fill('#s-conflicts', 'Sehrlangeswortohneleerzeichendasnichtumbrechenkannundtrotzdemnichtherausragensoll');
  let ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  assert(ok, 'Formular');
  await save(page); await page.click('#slist [data-id=s5]');
  ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  assert(ok, 'Detailansicht');
  await page.screenshot({ path: '/tmp/phase4-quelle.png', fullPage: false });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
