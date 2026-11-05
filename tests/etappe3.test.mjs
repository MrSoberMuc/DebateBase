/* Automatische Tests für Etappe 3: Installierbarkeit, Offline-Betrieb, Updates.
 * Aufruf: node tests/etappe3.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, OVERRIDES, browser, test, assert, newPage, counts, reload, go, finish, V2_EXPORT } from './harness.mjs';

function pngSize(file) { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
async function swReady(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
}

await test('Manifest: Pflichtangaben vorhanden, Icons existieren in richtiger Größe', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert(m.name && m.short_name && m.display === 'standalone' && m.lang === 'de', 'Grundangaben');
  assert(m.start_url.startsWith('./') && m.scope === './', 'Pfade müssen relativ sein (GitHub Pages Unterordner)');
  const any = m.icons.filter(i => i.purpose === 'any').map(i => i.sizes), mask = m.icons.filter(i => i.purpose === 'maskable');
  assert(any.includes('192x192') && any.includes('512x512') && mask.length, 'Icons 192/512/maskable');
  for (const i of m.icons) {
    const [w, h] = pngSize(path.join(ROOT, i.src));
    assert(`${w}x${h}` === i.sizes, i.src + ' ist ' + w + 'x' + h);
  }
});

await test('Chrome meldet die App als installierbar (keine Installierbarkeitsfehler)', async () => {
  /* Normales (nicht privates) Profil, sonst meldet Chrome „in-incognito“ */
  const { chromium } = await import('/opt/npm-tools/node_modules/playwright/index.js').then(m => m.default || m);
  const dir = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'db-profil-'));
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: '/usr/bin/google-chrome', headless: true });
  const page = await newPage(ctx);
  await swReady(page);
  const cdp = await ctx.newCDPSession(page);
  const man = await cdp.send('Page.getAppManifest');
  assert(!man.errors.length, 'Manifestfehler: ' + JSON.stringify(man.errors));
  const inst = await cdp.send('Page.getInstallabilityErrors');
  assert(!inst.installabilityErrors.length, 'Fehler: ' + JSON.stringify(inst.installabilityErrors));
  await ctx.close();
});

await test('Service Worker speichert alle App-Dateien, keine Anfragen außerhalb des App-Ordners', async () => {
  const ctx = await browser.newContext(); const outside = [];
  ctx.on('request', r => { const u = new URL(r.url()); if (u.hostname === '127.0.0.1' && !u.pathname.startsWith('/DebateBase/')) outside.push(u.pathname); });
  const page = await newPage(ctx);
  await swReady(page);
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys.find(k => k.startsWith('debatebase-app-'))); return (await c.keys()).map(r => new URL(r.url).pathname); });
  for (const f of ['index.html', 'app.js', 'db.js', 'migrate.js', 'styles.css', 'manifest.json', 'icons/icon-192.png']) assert(cached.includes('/DebateBase/' + f), 'nicht im Cache: ' + f);
  assert(!outside.length, 'Anfragen außerhalb: ' + outside.join(', '));
  await ctx.close();
});

await test('Offline: Start, Navigation, Anlegen, Suche, Bearbeiten, Löschen, Export und Import', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true }); const page = await newPage(ctx);
  await swReady(page);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await ctx.setOffline(true);
  await page.goto(BASE + '?quelle=app');
  await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  assert(await page.isVisible('#saved:has-text("Offline")'), 'Offline-Anzeige fehlt');
  for (const r of ['wissen', 'argumente', 'quellen', 'diskussion', 'einstellungen', 'dashboard']) { await go(page, r); assert(await page.locator('#view').count(), r); }
  // anlegen
  await page.click('.actions [data-act=new-entry]');
  await page.fill('#f-title', 'Offline angelegt'); await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(150);
  // suchen + bearbeiten
  await go(page, 'wissen'); await page.fill('#q', 'offline angelegt');
  assert(await page.locator('#list .card').count() === 1, 'Suche offline');
  await page.click('#list .card'); await page.click('[data-act=edit-entry]');
  await page.fill('#f-title', 'Offline geändert'); await page.click('form[data-form=entry] button[type=submit]'); await page.waitForTimeout(150);
  // löschen (Quelle)
  await go(page, 'quellen'); await page.click('#slist [data-id=s8]');
  await page.click('[data-act=del-source]'); await page.click('[data-act=del-source]'); await page.waitForTimeout(150);
  // Export
  await go(page, 'einstellungen');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sec-backup [data-act=download]')]);
  const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert(data.entries.some(e => e.title === 'Offline geändert') && data.sources.length === 7, 'Export offline unvollständig');
  // Import
  await page.click('[data-act=open-migration]'); await page.fill('#mig-text', JSON.stringify(V2_EXPORT));
  await page.click('[data-act=mig-check]'); await page.click('[data-act=mig-apply]'); await page.waitForSelector('text=Import abgeschlossen');
  await page.click('[data-act=close]');
  // Neustart offline
  await reload(page);
  const c = await counts(page);
  assert(c.e === 16 && c.s === 9, 'Nach Neustart offline: ' + JSON.stringify(c));
  assert(await page.evaluate(() => window.DebateBase.Repo.db.entries.some(e => e.title === 'Offline geändert')), 'Änderung fehlt');
  assert(!page.errors.length, 'JS-Fehler: ' + page.errors.join(' | '));
  await ctx.close();
});

await test('Einstellungen zeigen App-Status, Offline bereit und Installationsanleitung', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await swReady(page); await go(page, 'einstellungen');
  assert(await page.isVisible('text=Bereit: startet auch ohne Internet'), 'Offline-Status');
  assert(await page.isVisible('text=Im Browser geöffnet'), 'App-Status');
  const hasPrompt = await page.evaluate(() => !!window.DebateBase.pwa.prompt);
  assert(hasPrompt ? await page.isVisible('text=DebateBase als App installieren') : await page.isVisible('text=So installierst du DebateBase'), 'Installationshinweis');
  await ctx.close();
});

await test('Update: neue Version wird erkannt, Hinweis erscheint, Daten bleiben erhalten, alter Cache weg', async () => {
  const ctx = await browser.newContext(); const page = await newPage(ctx);
  await swReady(page);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  OVERRIDES['/service-worker.js'] = sw.replace(/var VERSION = '[^']+'/, "var VERSION = 'test-neu'");
  try {
    await page.evaluate(() => window.DebateBase.pwa.reg.update());
    await page.waitForSelector('#update:not([hidden])', { timeout: 15000 });
    await Promise.all([page.waitForEvent('load'), page.click('[data-act=apply-update]')]);
    await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
    const keys = await page.evaluate(() => caches.keys());
    assert(keys.includes('debatebase-app-test-neu') && keys.filter(k => k.startsWith('debatebase-app-')).length === 1, 'Caches: ' + keys);
    assert((await counts(page)).e === 12, 'Daten nach Update');
    assert(await page.isHidden('#update'), 'Hinweis noch sichtbar');
  } finally { delete OVERRIDES['/service-worker.js']; }
  await ctx.close();
});

await test('Icons als Bild für die Sichtkontrolle', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 390);
  await swReady(page); await go(page, 'einstellungen');
  fs.mkdirSync(path.join(ROOT, 'tests', 'screens'), { recursive: true });
  await page.locator('#sec-app').screenshot({ path: path.join(ROOT, 'tests/screens/6-app-status.png') });
  await ctx.close();
});

await finish();
