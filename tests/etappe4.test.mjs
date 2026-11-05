/* Automatische Tests für Etappe 4: Android-Teilen (Web Share Target).
 * Android schickt geteilte Inhalte als POST-Formular an ./teilen. Das wird hier
 * nachgestellt, indem die Seite genau so ein Formular abschickt.
 * Aufruf: node tests/etappe4.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, browser, test, assert, newPage, reload, go, finish } from './harness.mjs';

async function ready(ctx) {
  const page = await newPage(ctx);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  return page;
}
/* Schickt ein Formular wie Android (multipart/form-data, POST) an ./teilen */
async function share(page, fields) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }),
    page.evaluate(f => {
      const form = document.createElement('form');
      form.method = 'POST'; form.action = 'teilen'; form.enctype = 'multipart/form-data';
      for (const [k, v] of Object.entries(f)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); }
      document.body.appendChild(form); form.submit();
    }, fields)
  ]);
  await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await page.waitForTimeout(150);
}
const posts = page => page.evaluate(() => window.DebateBase.Repo.db.posts);
const inbox = page => page.evaluate(() => DB.getAll('inbox'));

await test('Manifest: share_target mit POST und multipart, ohne Manifestfehler', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const t = m.share_target;
  assert(t && t.method === 'POST' && t.enctype === 'multipart/form-data' && t.action === './teilen', 'share_target');
  assert(t.params.text === 'text' && t.params.url === 'url' && t.params.title === 'title', 'params');
  const ctx = await browser.newContext(); const page = await ready(ctx);
  const cdp = await ctx.newCDPSession(page);
  const man = await cdp.send('Page.getAppManifest');
  assert(!man.errors.length, JSON.stringify(man.errors));
  await ctx.close();
});

await test('Text und Link in getrennten Feldern: getrennt übernommen, Original unverändert gespeichert', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { title: '', text: 'Das ist der Beitragstext.\nZweite Zeile.', url: 'https://x.com/nutzer/status/1111111111?s=46&t=abc' });
  assert(await page.isVisible('h2.t:has-text("Geteilter X-Beitrag")'), 'Entwurf nicht angezeigt');
  assert(!(await page.url()).includes('geteilt='), 'Adresse nicht bereinigt');
  assert(await page.inputValue('#p-url') === 'https://x.com/nutzer/status/1111111111', 'Link: ' + await page.inputValue('#p-url'));
  assert(await page.inputValue('#p-text') === 'Das ist der Beitragstext.\nZweite Zeile.', 'Text');
  assert(await page.isVisible('text=X-Link geprüft'), 'Prüfhinweis');
  assert((await posts(page)).length === 0, 'vor Entscheidung gespeichert');
  assert((await inbox(page)).length === 1, 'nicht im Eingang');
  await page.fill('#p-topic', 'Politik');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(250);
  await reload(page);
  const p = (await posts(page))[0];
  assert(p && p.handle === 'nutzer' && p.tweetId === '1111111111' && p.topic === 'Politik', JSON.stringify(p));
  assert(p.shared && p.shared.url === 'https://x.com/nutzer/status/1111111111?s=46&t=abc' && p.shared.text.replace(/\r\n/g, '\n') === 'Das ist der Beitragstext.\nZweite Zeile.', 'Original verändert: ' + JSON.stringify(p.shared));
  assert((await inbox(page)).length === 0, 'Eingang nicht geleert');
  await ctx.close();
});

await test('Alles im Textfeld (Text + Link), Feld „url“ leer', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { text: 'Spannende These zur Energiepolitik https://twitter.com/jemand/status/2222222222', url: '' });
  assert(await page.inputValue('#p-url') === 'https://x.com/jemand/status/2222222222', 'Link');
  assert(await page.inputValue('#p-text') === 'Spannende These zur Energiepolitik', 'Text: ' + await page.inputValue('#p-text'));
  await page.click('form[data-form=post] button[value=behauptung]'); await page.waitForTimeout(250);
  assert(await page.isVisible('h2.t:has-text("Neuer Eintrag")'), 'Eintragsformular');
  assert(await page.inputValue('#f-title') === 'Spannende These zur Energiepolitik', 'Titel vorbelegt');
  await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(250);
  const r = await page.evaluate(() => { const D = window.DebateBase.Repo.db; return { e: D.entries[0], p: D.posts[0] }; });
  assert(r.e.postId === r.p.id && r.p.convertedTo.includes(r.e.id) && r.e.type === 'behauptung', 'Verbindung');
  await ctx.close();
});

await test('Nur Link übergeben: deutlicher Hinweis, Text bleibt leer, nichts wird abgerufen', async () => {
  const ctx = await browser.newContext(); const external = [];
  ctx.on('request', r => { if (/x\.com|twitter\.com/.test(new URL(r.url()).hostname)) external.push(r.url()); });
  const page = await ready(ctx);
  await share(page, { text: 'https://x.com/a/status/3333333333?s=20', url: '' });
  assert(await page.isVisible('text=X hat nur den Link übergeben, keinen Beitragstext.'), 'Hinweis fehlt');
  assert(await page.inputValue('#p-text') === '', 'Text nicht leer');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(250);
  assert((await posts(page))[0].tweetId === '3333333333', 'Nur-Link nicht speicherbar');
  assert(!external.length, 'Es wurde X abgerufen: ' + external.join(', '));
  await ctx.close();
});

await test('Link im Feld „url“ und zusätzlich im Text: Link wird nur einmal entfernt, Text sauber', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { title: 'Beitrag auf X', text: 'Kurzer Text https://x.com/b/status/4444444444', url: 'https://x.com/b/status/4444444444' });
  assert(await page.inputValue('#p-text') === 'Kurzer Text', 'Text: ' + await page.inputValue('#p-text'));
  await page.click('details.card summary');
  assert(await page.isVisible('dd:has-text("Beitrag auf X")'), 'Titel in Originaldaten');
  await ctx.close();
});

await test('Doppelter Beitrag wird erkannt, Speichern nicht möglich', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { text: 'Erstes Mal', url: 'https://x.com/c/status/5555555555' });
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(250);
  await share(page, { text: 'Zweites Mal', url: 'https://twitter.com/c/status/5555555555?s=19' });
  assert(await page.isVisible('text=Dieser Beitrag ist bereits gespeichert'), 'Duplikat nicht erkannt');
  assert(await page.locator('form[data-form=post]').count() === 0, 'Speichern trotzdem möglich');
  await page.click('[data-act=share-discard]'); await page.click('[data-act=share-discard]'); await page.waitForTimeout(200);
  assert((await posts(page)).length === 1 && (await inbox(page)).length === 0, 'nach Verwerfen');
  await ctx.close();
});

await test('Fremder Link (nicht X): Warnung, Link wird nicht als Beitragslink übernommen', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { text: 'Interessanter Artikel', url: 'https://www.example.org/artikel' });
  assert(await page.isVisible('text=Der geteilte Link stammt nicht von X oder Twitter'), 'Warnung');
  assert(await page.inputValue('#p-url') === '', 'Fremdlink übernommen');
  assert(await page.inputValue('#p-text') === 'Interessanter Artikel', 'Text');
  await ctx.close();
});

await test('Später entscheiden: bleibt im Eingang, Hinweis auf Dashboard, auch nach Neustart', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { text: 'Für später https://x.com/d/status/6666666666' });
  await page.click('form[data-form=post] [data-act=close]');
  await reload(page);
  assert(await page.isVisible('text=1 geteilter Beitrag wartet'), 'Dashboard-Hinweis');
  await page.click('[data-act=share-next]');
  assert(await page.inputValue('#p-text') === 'Für später', 'Entwurf nicht wieder geöffnet');
  await go(page, 'einstellungen');
  assert(await page.isVisible('text=Eingang ansehen (1)'), 'Eingang in Einstellungen');
  await ctx.close();
});

await test('Mehrere geteilte Beiträge nacheinander abarbeiten', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await share(page, { text: 'Eins https://x.com/e/status/7000000001' });
  await page.click('form[data-form=post] [data-act=close]');
  await share(page, { text: 'Zwei https://x.com/e/status/7000000002' });
  assert(await page.isVisible('text=2 warten'), 'Anzahl');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(300);
  assert(await page.isVisible('h2.t:has-text("Geteilter X-Beitrag")'), 'nächster Beitrag nicht geöffnet');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(300);
  const t = (await posts(page)).map(p => p.text).sort();
  assert(JSON.stringify(t) === '["Eins","Zwei"]' && (await inbox(page)).length === 0, JSON.stringify(t));
  await ctx.close();
});

await test('Teilen funktioniert auch offline', async () => {
  const ctx = await browser.newContext(); const page = await ready(ctx);
  await ctx.setOffline(true);
  await share(page, { text: 'Offline geteilt', url: 'https://x.com/f/status/8888888888' });
  assert(await page.isVisible('h2.t:has-text("Geteilter X-Beitrag")'), 'Entwurf offline');
  await page.click('form[data-form=post] button[value=save]'); await page.waitForTimeout(250);
  assert((await posts(page))[0].text === 'Offline geteilt', 'offline nicht gespeichert');
  await ctx.close();
});

await test('Entwurf bei 360 px ohne Überbreite, Screenshot', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await share(page, { text: 'https://x.com/sehr_langer_nutzername_123/status/9999999999999999999?s=46&t=abcdefghijklmnop', url: '' });
  const ok = await page.evaluate(() => document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth && document.documentElement.scrollWidth <= 360);
  fs.mkdirSync(path.join(ROOT, 'tests', 'screens'), { recursive: true });
  await page.locator('#sheet').screenshot({ path: path.join(ROOT, 'tests/screens/7-geteilt-nur-link.png') });
  assert(ok, 'Überbreite');
  assert(!page.errors.length, 'JS-Fehler: ' + page.errors.join(' | '));
  await ctx.close();
});

await finish();
