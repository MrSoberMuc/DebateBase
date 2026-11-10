/* Automatische Tests für Phase 5, Etappe 4: Entwürfe speichern (3.14.0).
 * Aufruf: node tests/phase5-etappe4.test.mjs */
import { browser, test, assert, newPage, go, reload, counts, finish } from './harness.mjs';

async function setup(opts = {}, width = 390) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
async function openReply(page) { await go(page, 'diskussion'); await page.click('[data-act=disc-mode][data-v=antwort]'); await page.waitForTimeout(60); }
async function add(page, q, key) { await page.fill('#rq', q); await page.waitForTimeout(80); await page.click(`#radd [data-act=reply-add][data-v="${key}"]`); await page.waitForTimeout(80); }
const stored = page => page.evaluate(() => DB.getAll('meta').then(r => (r.find(x => x.key === 'xDrafts') || {}).value || []));

await test('Bearbeiteten Post als Entwurf speichern; übersteht Neuladen; Daten unverändert', async () => {
  const { ctx, page } = await setup();
  const before = await counts(page);
  await openReply(page);
  assert(await page.locator('#drafts').count() === 0, 'ohne Entwürfe keine Liste');
  await page.fill('#rclaim', 'Die EU hat 28 Mitgliedstaaten.');
  await add(page, 'Vereinte Nationen', 'entries:e2');
  await page.click('[data-act=post-type][data-v=eigen]');
  await page.fill('#ptext', 'Mein bearbeiteter Post.');
  await page.fill('#pfollow', 'Quelle: meine Angabe');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  assert((await page.textContent('#toast')).includes('Entwurf gespeichert'), 'Meldung');
  let S = await stored(page);
  assert(S.length === 1 && S[0].text === 'Mein bearbeiteter Post.' && S[0].follow === 'Quelle: meine Angabe' && S[0].type === 'eigen' && S[0].keys[0] === 'entries:e2', JSON.stringify(S));
  assert(JSON.stringify(await counts(page)) === JSON.stringify(before), 'Einträge unverändert');
  await reload(page); await openReply(page);
  assert((await page.textContent('#drafts summary')).includes('Gespeicherte Entwürfe (1)'), 'Liste nach Neuladen');
  assert((await page.textContent('#drafts')).includes('Mein bearbeiteter Post.') && (await page.textContent('#drafts')).includes('Eigener Post'), await page.textContent('#drafts'));
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Entwurf öffnen stellt Text und Einstellungen wieder her; aktualisieren und als neuen speichern', async () => {
  const { ctx, page } = await setup();
  await openReply(page);
  await add(page, 'Vereinte Nationen', 'entries:e2');
  await page.selectOption('#pclose', 'frage'); await page.waitForTimeout(60);
  const auto = await page.inputValue('#ptext');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  /* alles zurücksetzen */
  await page.click('[data-act=post-type][data-v=zitat]'); await page.click('#rsel [data-act=reply-del]'); await page.waitForTimeout(60);
  await reload(page); await openReply(page);
  await page.click('#drafts summary');
  await page.click('[data-act=draft-open]'); await page.waitForTimeout(150);
  assert(await page.inputValue('#ptext') === auto, 'Text wiederhergestellt');
  assert(await page.inputValue('#pclose') === 'frage' && await page.getAttribute('[data-act=post-type][data-v=antwort]', 'aria-pressed') === 'true', 'Einstellungen');
  assert((await page.textContent('#rsel')).includes('Gründung der Vereinten Nationen'), 'Einträge');
  assert((await page.textContent('#post')).includes('Geöffneter Entwurf'), 'Hinweis');
  await page.fill('#ptext', 'Geändert.');
  await page.click('[data-act=draft-save][data-v=update]'); await page.waitForTimeout(150);
  let S = await stored(page);
  assert(S.length === 1 && S[0].text === 'Geändert.' && S[0].updated >= S[0].created, JSON.stringify(S));
  await page.fill('#ptext', 'Variante B.');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  S = await stored(page);
  assert(S.length === 2 && S[0].text === 'Variante B.' && S[1].text === 'Geändert.', S.map(x => x.text).join('|'));
  await ctx.close();
});

await test('Thread-Entwurf mit bearbeitetem Teil', async () => {
  const { ctx, page } = await setup();
  await openReply(page);
  await add(page, 'Vereinte Nationen', 'entries:e2'); await add(page, 'Ozonschicht', 'entries:e7'); await add(page, 'Konsens Klimawandel', 'entries:e6');
  await page.click('[data-act=post-type][data-v=thread]'); await page.waitForTimeout(80);
  const n = await page.locator('#tparts textarea.tp').count();
  await page.fill('#tp-0', '1/' + n + ' Eigener Anfang.');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  await reload(page); await openReply(page);
  await page.click('#drafts summary'); await page.click('[data-act=draft-open]'); await page.waitForTimeout(150);
  assert(await page.locator('#tparts textarea.tp').count() === n && await page.inputValue('#tp-0') === '1/' + n + ' Eigener Anfang.', 'Teile wiederhergestellt');
  assert((await page.textContent('#drafts')).includes(n + ' Teile'), 'Liste zeigt Teile');
  await ctx.close();
});

await test('Entwurf löschen mit Bestätigung; gelöschter Eintrag wird beim Öffnen gemeldet', async () => {
  const { ctx, page } = await setup();
  await openReply(page);
  await add(page, 'Peer-Review', 'entries:e12');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  /* Eintrag löschen, Entwurf trotzdem öffnen */
  await page.evaluate(() => window.DebateBase.Repo.remove('entries', 'e12')); await page.waitForTimeout(100);
  await reload(page); await openReply(page);
  await page.click('#drafts summary'); await page.click('[data-act=draft-open]'); await page.waitForTimeout(150);
  assert((await page.textContent('#toast')).includes('inzwischen gelöscht'), await page.textContent('#toast'));
  await page.click('#drafts summary').catch(() => {});
  await page.click('[data-act=draft-del]');
  assert((await stored(page)).length === 1, 'erster Tipp löscht nicht');
  await page.click('[data-act=draft-del]'); await page.waitForTimeout(150);
  assert((await stored(page)).length === 0 && await page.locator('#drafts').count() === 0, 'gelöscht');
  await ctx.close();
});

await test('Handy (360 px): Liste ohne Überbreite, Bildschirmfoto', async () => {
  const { ctx, page } = await setup({}, 360);
  await openReply(page);
  await add(page, 'Vereinte Nationen', 'entries:e2');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  await page.click('[data-act=post-type][data-v=thread]');
  await page.click('[data-act=draft-save][data-v=new]'); await page.waitForTimeout(150);
  await page.click('#drafts summary'); await page.waitForTimeout(60);
  assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Überbreite');
  await page.locator('#drafts').screenshot({ path: '/tmp/phase5-drafts.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
