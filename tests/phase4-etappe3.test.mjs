/* Automatische Tests für Phase 4, Etappe 3: Behauptungsanalyse.
 * Aufruf: node tests/phase4-etappe3.test.mjs */
import { BASE, browser, test, assert, newPage, counts, reload, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));
const TEXT = '@nutzer Die EU hat 28 Mitgliedstaaten, aber das weiß ja keiner. Experten sagen, Sanktionen wirken nie. Ich finde das lächerlich. Warum sagt das niemand? #EU https://t.co/abc';
async function analyse(page, text = TEXT) {
  await go(page, 'diskussion');
  await page.click('[data-act=disc-mode][data-v=pruefen]');
  await page.fill('#ctext', text);
  await page.click('[data-act=check-run]'); await page.waitForTimeout(150);
}

await test('Umschalter im Diskussionsmodus: Suchen bleibt wie bisher, „Behauptung prüfen“ zeigt Hinweis „keine KI“', async () => {
  const { ctx, page } = await withSample();
  await go(page, 'diskussion');
  assert(await page.getAttribute('[data-act=disc-mode][data-v=suche]', 'aria-pressed') === 'true', 'Standard: Suchen');
  await page.fill('#dq', 'nato');
  assert(await page.isVisible('#dres h2:has-text("Wissen (1)")'), 'Suche');
  await page.click('[data-act=disc-mode][data-v=pruefen]');
  assert(await page.isVisible('#ctext') && (await page.textContent('.hint-rules')).includes('keine KI'), 'Prüfansicht');
  await page.click('[data-act=disc-mode][data-v=suche]');
  assert(await page.inputValue('#dq') === 'nato', 'Suchbegriff bleibt erhalten');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Analyse: Aussagen getrennt, Einordnung mit „unsicher“, passende Einträge, offene Fragen', async () => {
  const { ctx, page } = await withSample();
  await analyse(page);
  assert((await page.textContent('#csum')).includes('5 Aussagen erkannt'), await page.textContent('#csum'));
  assert((await page.textContent('#csum')).includes('1 Link entfernt') && (await page.textContent('#csum')).includes('@nutzer'), 'Bereinigung angezeigt');
  const cards = page.locator('#cres article.claim');
  assert(await cards.count() === 5, 'Karten');
  assert(await page.locator('#cres article.claim .chip:has-text("unsicher")').count() === 5, 'jede Aussage als unsicher gekennzeichnet');
  const c1 = await cards.nth(0).textContent();
  assert(c1.includes('Die EU hat 28 Mitgliedstaaten') && c1.includes('Möglicherweise überprüfbare Behauptung') && c1.includes('Veraltet') && c1.includes('Woher stammt die Zahl?'), c1);
  const c3 = await cards.nth(2).textContent();
  assert(c3.includes('Sanktionen wirken nie') && c3.includes('Argumentationskarte') && c3.includes('Vage Angabe') && c3.includes('Gibt es Gegenbeispiele?'), c3);
  assert((await cards.nth(3).textContent()).includes('Eher Meinung oder Wertung'), 'Meinung');
  assert((await cards.nth(4).textContent()).includes('Frage'), 'Frage');
  assert(c1.includes('wird hier nicht beurteilt'), 'kein Urteil über Stützen/Widersprechen');
  await cards.nth(0).locator('[data-act=open-item]').click();
  assert((await page.textContent('#sheet h2.t')).includes('Die EU hat 28 Mitgliedstaaten'), 'Eintrag öffnet');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Nichts wird automatisch gespeichert; Ergebnis bleibt beim Wechseln, nach Neustart leer', async () => {
  const { ctx, page } = await withSample();
  const before = await dump(page);
  await analyse(page);
  await go(page, 'wissen'); await go(page, 'diskussion');
  assert(await page.locator('#cres article.claim').count() === 5 && (await page.inputValue('#ctext')).includes('Mitgliedstaaten'), 'bleibt in der Sitzung');
  assert(await dump(page) === before, 'Datenbank verändert');
  await reload(page); await go(page, 'diskussion');
  assert(await page.isVisible('#dq'), 'nach Neustart wieder Suche');
  await page.click('[data-act=disc-mode][data-v=pruefen]');
  assert(await page.inputValue('#ctext') === '' && await page.isVisible('#cres .empty'), 'nicht gespeichert');
  await ctx.close();
});

await test('„Als Eintrag speichern“: Formular vorbelegt, erst nach Bestätigung gespeichert', async () => {
  const { ctx, page } = await withSample();
  await analyse(page);
  const n = (await counts(page)).e;
  await page.click('#cres article.claim >> nth=2 >> [data-act=check-save]');
  assert(await page.inputValue('#f-title') === 'Experten sagen, Sanktionen wirken nie.' && await page.inputValue('#f-type') === 'behauptung' && await page.inputValue('#f-status') === 'neu', 'Vorbelegung');
  assert(await page.inputValue('#x-claimCore') === 'Experten sagen, Sanktionen wirken nie.' && await page.inputValue('#f-tags') === 'EU', 'Kernaussage und Hashtag');
  assert((await counts(page)).e === n, 'vor dem Speichern nichts gespeichert');
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(200);
  assert((await counts(page)).e === n + 1, 'gespeichert');
  assert(await page.locator('#cres article.claim').count() === 5, 'Ergebnis noch sichtbar');
  await page.click('#cres article.claim >> nth=3 >> [data-act=check-save]');
  assert(await page.inputValue('#f-type') === 'meinung', 'Meinung als Meinung');
  await ctx.close();
});

await test('Start aus einem X-Beitrag; gespeicherte Behauptung wird mit dem Beitrag verknüpft', async () => {
  const { ctx, page } = await withSample();
  await page.evaluate(() => window.DebateBase.Repo.put('posts', { id: 'p_t', url: 'https://x.com/a/status/1', handle: 'a', tweetId: '1', text: 'Impfstoffe verursachen Autismus, das zeigt eine Studie! Unglaublich.', topic: '', note: '', convertedTo: [], created: Date.now() }));
  await go(page, 'diskussion'); await page.click('[data-act=open-post][data-id=p_t]');
  await page.click('[data-act=post-check]'); await page.waitForTimeout(150);
  assert(await page.evaluate(() => location.hash) === '#diskussion' && await page.locator('#cres article.claim').count() === 2, 'Analyse aus Beitrag');
  assert((await page.textContent('#view')).includes('Aus X-Beitrag von @a'), 'Herkunft angezeigt');
  const c1 = await page.textContent('#cres article.claim >> nth=0');
  assert(c1.includes('Impfstoffe verursachen Autismus') && c1.includes('Widerlegt') && c1.includes('Stimmt die Zuschreibung?'), c1);
  await page.click('#cres article.claim >> nth=0 >> [data-act=check-save]');
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; const e = D.entries.find(x => x.postId === 'p_t'); return { e: !!e, conv: D.posts.find(p => p.id === 'p_t').convertedTo.includes(e && e.id) }; });
  assert(r.e && r.conv, 'Verknüpfung mit Beitrag: ' + JSON.stringify(r));
  /* Auswahl aus der Liste gespeicherter Beiträge */
  await page.click('[data-act=check-clear]');
  await page.click('details.card summary'); await page.click('[data-act=check-post][data-id=p_t]');
  assert((await page.inputValue('#ctext')).startsWith('Impfstoffe'), 'Beitrag gewählt');
  await ctx.close();
});

await test('Kopieren einer Aussage; leerer Text gibt Hinweis', async () => {
  const { ctx, page } = await withSample({ permissions: ['clipboard-read', 'clipboard-write'] });
  await analyse(page);
  await page.click('#cres article.claim >> nth=0 >> [data-act=check-copy]'); await page.waitForTimeout(150);
  assert(await page.evaluate(() => navigator.clipboard.readText()) === 'Die EU hat 28 Mitgliedstaaten', 'Kopie');
  await page.click('[data-act=check-clear]');
  await page.click('[data-act=check-run]');
  assert((await page.textContent('#toast')).includes('Text einfügen'), 'Hinweis');
  await ctx.close();
});

await test('Offline: Behauptungsanalyse ohne Internet', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await analyse(page, 'Die EU hat 28 Mitgliedstaaten.');
  assert((await page.textContent('#cres')).includes('Veraltet'), 'offline');
  await ctx.close();
});

await test('Handy (360 px, hell und dunkel): keine Überbreite, keine Fehler', async () => {
  const { ctx, page } = await withSample({ deviceScaleFactor: 2 }, 360);
  for (const theme of ['hell', 'dunkel']) {
    await page.evaluate(t => window.DebateBase.Repo.setSetting('theme', t), theme);
    await analyse(page, TEXT + ' Einsehrsehrlangeswortohneleerzeichendasnichtumbrechenwillundtrotzdempassenmuss hat 5 %.');
    assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, theme + ': Überbreite');
  }
  await page.screenshot({ path: '/tmp/phase4-pruefen.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
