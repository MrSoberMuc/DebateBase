/* Automatische Tests für Phase 4, Etappe 4: Widerspruchs- und Zusammenhangsanalyse.
 * Aufruf: node tests/phase4-etappe4.test.mjs */
import { BASE, browser, test, assert, newPage, go, finish } from './harness.mjs';

async function withSample(opts = {}, width) {
  const ctx = await browser.newContext(opts); const page = await newPage(ctx, width);
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  return { ctx, page };
}
const dump = page => page.evaluate(() => DB.readAll().then(d => JSON.stringify(['entries', 'sources', 'args', 'links', 'posts'].map(k => d[k].slice().sort((a, b) => a.id < b.id ? -1 : 1)))));
async function analyse(page, text) {
  await go(page, 'diskussion');
  if (await page.isVisible('[data-act=disc-mode][data-v=pruefen][aria-pressed=false]')) await page.click('[data-act=disc-mode][data-v=pruefen]');
  await page.fill('#ctext', text);
  await page.click('[data-act=check-run]'); await page.waitForTimeout(200);
}
const grp = (page, n, rel) => page.locator(`#cres article.claim >> nth=${n} >> .relgrp.rel-${rel}`);

await test('Widerspruchskandidat: veralteter Eintrag, mit Grundlage, Quelle und Hinweis in der Übersicht', async () => {
  const { ctx, page } = await withSample();
  await analyse(page, 'Die EU hat 28 Mitgliedstaaten.');
  const g = await grp(page, 0, 'widersprechend').textContent();
  assert(g.includes('Widersprechende Inhalte (Kandidaten) (1)') && g.includes('Die EU hat 28 Mitgliedstaaten') && g.includes('Grundlage: gleichartiger Eintrag ist als „Veraltet“ markiert'), g);
  assert((await grp(page, 0, 'quellen').textContent()).includes('Länder der EU'), 'verwandte Quelle');
  assert((await page.textContent('#csum')).includes('Mit Widerspruchskandidaten: 1'), 'Übersicht');
  assert((await page.textContent('#cres article.claim .openq')).includes('Widerspruchskandidat gefunden'), 'offene Frage');
  assert((await page.textContent('#cres article.claim .rel')).includes('Hinweise, keine Urteile'), 'Kennzeichnung');
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await test('Argumentationskarte und vorhandene Verknüpfungen werden genutzt', async () => {
  const { ctx, page } = await withSample();
  await analyse(page, 'Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.');
  const w = await grp(page, 0, 'widersprechend').textContent();
  assert(w.includes('Abschreckung verhindert Großmachtkriege') && w.includes('„Behauptung der Gegenseite“') && w.includes('Status gilt für ihr Gegenargument'), w);
  const r = await grp(page, 0, 'relativierend').textContent();
  assert(r.includes('Beinahe-Eskalationen im Kalten Krieg') && r.includes('über Verknüpfung'), r);
  await analyse(page, 'Das Klima hat sich schon immer verändert, also ist die heutige Erwärmung natürlich.');
  const w2 = await grp(page, 0, 'widersprechend').textContent();
  assert(w2.includes('Wissenschaftlicher Konsens zum Klimawandel') && w2.includes('unterstützt die Karte'), w2);
  await ctx.close();
});

await test('Unterstützend, verneint, ergänzend und nur thematisch verwandt werden unterschieden', async () => {
  const { ctx, page } = await withSample();
  await analyse(page, 'Impfstoffe verursachen keinen Autismus. Die UN-Charta trat 1945 in Kraft. Der Kalte Krieg war eine spannende Zeit.');
  const u0 = await grp(page, 0, 'unterstuetzend').textContent();
  assert(u0.includes('Impfstoffe verursachen Autismus') && u0.includes('Verneinung nur auf einer Seite'), u0);
  assert((await grp(page, 1, 'unterstuetzend').textContent()).includes('Gründung der Vereinten Nationen'), 'Fakt');
  assert(await grp(page, 2, 'widersprechend').count() === 0 && await grp(page, 2, 'unterstuetzend').count() === 0, 'kein Widerspruch aus Themennähe');
  assert((await grp(page, 2, 'thematisch').textContent()).includes('kein Widerspruch oder Beleg erkennbar'), 'thematisch');
  await ctx.close();
});

await test('Ergebnis führt zum gespeicherten Eintrag; nichts wird gespeichert', async () => {
  const { ctx, page } = await withSample();
  const before = await dump(page);
  await analyse(page, 'Die EU hat 27 Mitgliedstaaten. Sanktionen wirken nie.');
  const u = await grp(page, 0, 'unterstuetzend').textContent();
  assert(u.includes('Zahl weicht ab (27 ↔ 28)'), u);
  await grp(page, 1, 'widersprechend').locator('[data-act=open-item]').first().click();
  assert((await page.textContent('#sheet h2.t')).includes('Sanktionen wirken nie'), 'Karte öffnet');
  await page.click('[data-act=close]');
  await grp(page, 0, 'quellen').locator('[data-act=open-source]').first().click();
  assert((await page.textContent('#sheet h2.t')).includes('Länder der EU'), 'Quelle öffnet');
  assert(await dump(page) === before, 'Datenbank verändert');
  await ctx.close();
});

await test('Ohne passende Daten: klarer Hinweis, keine erfundenen Zusammenhänge', async () => {
  const { ctx, page } = await withSample();
  await analyse(page, 'Mein Hund mag lange Spaziergänge im Regen.');
  const t = await page.textContent('#cres article.claim .rel');
  assert(t.includes('Kein gespeicherter Eintrag und keine Argumentationskarte passt'), t);
  await ctx.close();
});

await test('Offline und Handy (360 px, dunkel): Zusammenhänge ohne Überbreite', async () => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2 }); const page = await newPage(ctx, 360);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.DebateBase.pwa.offline === 'ja', null, { timeout: 15000 });
  await page.click('[data-act=load-sample]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.DebateBase.Repo.setSetting('theme', 'dunkel'));
  await ctx.setOffline(true);
  await page.goto(BASE); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  await analyse(page, 'Der Klimawandel ist rein natürlich. Die EU hat 28 Mitgliedstaaten. Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.');
  assert(await page.locator('#cres .relgrp.rel-widersprechend').count() === 3, 'offline Analyse');
  assert(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Überbreite');
  await page.locator('#cres article.claim').first().screenshot({ path: '/tmp/phase4-zusammenhang.png' });
  assert(page.errors.length === 0, page.errors.join('; '));
  await ctx.close();
});

await finish();
