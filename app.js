/* DebateBase 3 – Oberfläche
 * Übernommen aus Version 2. Geändert wurde vor allem die Datenschicht (Repo):
 * Sie speichert jetzt jeden Datensatz einzeln in IndexedDB (siehe db.js).
 */
(function(){
'use strict';
var APP_VERSION='3.0.0-etappe1';
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var uid=function(p){return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var DAY=864e5, now=Date.now();
var ICON={
 home:'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13"/>',
 scale:'<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7z"/>',
 doc:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>',
 sliders:'<path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'
};
function ic(n,s){s=s||20;return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[n]+'</svg>'}

var TYPES={definition:'Definition',fakt:'Fakt',statistik:'Statistik',studie:'Studie',behauptung:'Behauptung',argument:'Argument',gegenargument:'Gegenargument',meinung:'Meinung',frage:'Offene Frage'};
var STATUS={neu:'Neu',pruefung:'In Prüfung',belegt:'Belegt',teilweise:'Teilweise belegt',widerlegt:'Widerlegt',umstritten:'Umstritten',veraltet:'Veraltet'};
var TOPICS=['Geschichte','Internationale Beziehungen','Politik','Wissenschaft','Gesellschaft','Wirtschaft'];
var SKINDS=['Primärquelle','Studie','Fachartikel','Statistik','Offizielle Seite','Nachrichten','Sonstiges'];

/* ---------- Beispieldaten (nur auf Wunsch) ---------- */
function seed(){
 var t=function(d){return now-d*DAY};
 var E=function(id,title,type,topic,status,tags,src,d,desc){return {id:id,title:title,type:type,topic:topic,status:status,tags:tags,sourceIds:src,description:desc,created:t(d),updated:t(d)}};
 return {
  links:[
   {id:'l1',type:'relativiert',fromK:'entries',fromId:'e4',toK:'args',toId:'a1',note:'Beispielverknüpfung',created:t(24)},
   {id:'l2',type:'unterstuetzt',fromK:'entries',fromId:'e6',toK:'args',toId:'a2',note:'Beispielverknüpfung',created:t(19)},
   {id:'l3',type:'ergaenzt',fromK:'entries',fromId:'e7',toK:'entries',toId:'e6',note:'Beispielverknüpfung',created:t(17)},
   {id:'l4',type:'basiert',fromK:'entries',fromId:'e10',toK:'args',toId:'a4',note:'Beispielverknüpfung',created:t(6)},
   {id:'l5',type:'basiert',fromK:'entries',fromId:'e11',toK:'args',toId:'a3',note:'Beispielverknüpfung',created:t(3)}],posts:[],
  sources:[
   {id:'s1',title:'Charta der Vereinten Nationen',publisher:'Vereinte Nationen',year:'1945',kind:'Primärquelle',url:'https://www.un.org/en/about-us/un-charter',note:'Gründungsdokument der UNO.',created:t(35)},
   {id:'s2',title:'Scientific Assessment of Ozone Depletion: 2022',publisher:'WMO / UNEP',year:'2022',kind:'Studie',url:'https://csl.noaa.gov/assessments/ozone/2022/',note:'Vierjähriger Sachstandsbericht.',created:t(18)},
   {id:'s3',title:'Erneuerbare Energien in Zahlen',publisher:'Umweltbundesamt',year:'2024',kind:'Statistik',url:'https://www.umweltbundesamt.de/themen/klima-energie/erneuerbare-energien/erneuerbare-energien-in-zahlen',note:'Jahreswerte werden regelmäßig aktualisiert.',created:t(12)},
   {id:'s4',title:'Quantifying the consensus on anthropogenic global warming in the scientific literature',publisher:'Cook et al., Environmental Research Letters',year:'2013',kind:'Studie',url:'https://doi.org/10.1088/1748-9326/8/2/024024',note:'',created:t(20)},
   {id:'s5',title:'NATO Expansion: What Gorbachev Heard',publisher:'National Security Archive, George Washington University',year:'2017',kind:'Primärquelle',url:'https://nsarchive.gwu.edu',note:'Sammlung freigegebener Gesprächsprotokolle.',created:t(30)},
   {id:'s6',title:'Retraction of Wakefield et al. (1998)',publisher:'The Lancet',year:'2010',kind:'Studie',url:'https://www.thelancet.com',note:'',created:t(8)},
   {id:'s7',title:'Sovereignty, International Relations, and the Westphalian Myth',publisher:'Andreas Osiander, International Organization 55(2)',year:'2001',kind:'Fachartikel',url:'https://doi.org/10.1162/00208180151140577',note:'',created:t(40)},
   {id:'s8',title:'Länder der EU',publisher:'Europäische Union',year:'2024',kind:'Offizielle Seite',url:'https://european-union.europa.eu',note:'',created:t(50)}
  ],
  entries:[
   E('e9','Impfstoffe verursachen Autismus','behauptung','Wissenschaft','widerlegt',['Gesundheit','Desinformation'],['s6'],8,'Die Behauptung geht auf eine Studie von Andrew Wakefield (1998) zurück, die 2010 von The Lancet zurückgezogen wurde. Große Kohortenstudien fanden keinen Zusammenhang zwischen der MMR-Impfung und Autismus.'),
   E('e10','Wirtschaftssanktionen als außenpolitisches Mittel','meinung','Internationale Beziehungen','umstritten',['Sanktionen','Außenpolitik'],[],6,'Position: Sanktionen sind ein wirksames Mittel, um Verhalten zu ändern. Die Forschung zeigt gemischte Ergebnisse; der Erfolg hängt stark von Zielsetzung, Breite und Durchsetzung ab.'),
   E('e11','Reparationen und der Aufstieg der NSDAP','frage','Geschichte','neu',['Weimarer Republik','Zwischenkriegszeit'],[],3,'Wie stark trugen die Reparationsforderungen nach 1919 zum Aufstieg der NSDAP bei, verglichen mit der Weltwirtschaftskrise ab 1929? Literatur zu Young-Plan und Lausanner Konferenz 1932 sichten.'),
   E('e5','Anteil erneuerbarer Energien am Stromverbrauch in Deutschland','statistik','Politik','pruefung',['Energie','Klima'],['s3'],12,'Laut Umweltbundesamt lag der Anteil erneuerbarer Energien am Bruttostromverbrauch 2023 bei rund 52 %. Aktuelle Jahreszahl und Berechnungsgrundlage vor der Verwendung noch einmal prüfen.'),
   E('e12','Peer-Review','definition','Wissenschaft','belegt',['Methodik','Publikationswesen'],[],15,'Begutachtungsverfahren, bei dem unabhängige Fachleute ein Manuskript vor der Veröffentlichung prüfen. Es filtert Fehler, garantiert aber keine Richtigkeit.'),
   E('e7','Ozonschicht und Montrealer Protokoll','studie','Wissenschaft','belegt',['Klima','Umweltpolitik','FCKW'],['s2'],18,'Das Montrealer Protokoll (1987) regelt den Ausstieg aus FCKW. Der UNEP/WMO-Bericht 2022 erwartet, dass sich die Ozonschicht außerhalb der Polargebiete bis etwa 2040 erholt, über der Antarktis bis etwa 2066.'),
   E('e6','Wissenschaftlicher Konsens zum Klimawandel','studie','Wissenschaft','belegt',['Klima','Konsens'],['s4'],20,'Mehrere Auswertungen der Fachliteratur kommen zu dem Ergebnis, dass über 97 % der Studien mit Positionierung den menschlichen Einfluss auf das Klima bestätigen (Cook et al. 2013). Spätere Arbeiten nennen Werte über 99 %.'),
   E('e4','Beinahe-Eskalationen im Kalten Krieg','gegenargument','Internationale Beziehungen','belegt',['Kalter Krieg','Abschreckung','Atomwaffen'],[],25,'Gegen die Annahme einer stabilen nuklearen Abschreckung: In der Kubakrise 1962 und beim Fehlalarm des sowjetischen Frühwarnsystems 1983 (Stanislaw Petrow) stand die Welt nach Einschätzung vieler Historiker knapp vor einer Eskalation.'),
   E('e3','Gab es 1990 ein NATO-Versprechen zur Nichterweiterung?','behauptung','Internationale Beziehungen','umstritten',['NATO','Russland','Deutsche Einheit'],['s5'],30,'Belegt sind mündliche Äußerungen wie James Bakers „not one inch“ (Februar 1990) im Kontext der deutschen Einheit. Ein verbindliches schriftliches Versprechen existiert nicht; im Zwei-plus-Vier-Vertrag findet sich keine solche Zusage. Die Deutung bleibt strittig.'),
   E('e2','Gründung der Vereinten Nationen','fakt','Internationale Beziehungen','belegt',['UNO','1945'],['s1'],35,'Die UN-Charta trat am 24. Oktober 1945 in Kraft. 51 Staaten waren Gründungsmitglieder, heute hat die UNO 193 Mitgliedstaaten.'),
   E('e1','Westfälischer Friede 1648','definition','Geschichte','teilweise',['Frühe Neuzeit','Souveränität','Westfälisches System'],['s7'],40,'Die Verträge von Münster und Osnabrück beendeten 1648 den Dreißigjährigen Krieg. Sie gelten klassisch als Geburtsstunde des modernen Staatensystems souveräner Staaten. Die neuere Forschung sieht das als nachträgliche Konstruktion („Westfälischer Mythos“).'),
   E('e8','Die EU hat 28 Mitgliedstaaten','behauptung','Politik','veraltet',['EU','Brexit'],['s8'],50,'Diese Angabe galt bis zum Austritt des Vereinigten Königreichs am 31. Januar 2020. Seitdem hat die EU 27 Mitgliedstaaten.')
  ],
  args:[
   {id:'a1',title:'Abschreckung verhindert Großmachtkriege',claim:'Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.',counter:'Der Zusammenhang ist nicht beweisbar, da das Ausbleiben eines Krieges viele Ursachen haben kann. Zudem gab es Beinahe-Katastrophen (Kubakrise 1962, Fehlalarm 1983), und Stellvertreterkriege fanden trotzdem statt.',topic:'Internationale Beziehungen',status:'umstritten',sourceIds:[],created:t(25)},
   {id:'a2',title:'Der Klimawandel ist rein natürlich',claim:'Das Klima hat sich schon immer verändert, also ist die heutige Erwärmung natürlich.',counter:'Frühere Klimawandel hatten identifizierbare Ursachen wie Orbitalzyklen oder Vulkanismus. Für die aktuelle Erwärmung zeigen Messungen (u. a. Kohlenstoff-Isotope, Abkühlung der Stratosphäre bei Erwärmung der unteren Atmosphäre), dass der verstärkte Treibhauseffekt durch menschliche CO₂-Emissionen die Ursache ist.',topic:'Wissenschaft',status:'belegt',sourceIds:['s4'],created:t(20)},
   {id:'a3',title:'Der Versailler Vertrag führte zwangsläufig zum Zweiten Weltkrieg',claim:'Der Vertrag von 1919 machte einen neuen Krieg unvermeidlich.',counter:'Der Vertrag war belastend und wurde propagandistisch genutzt. Weltwirtschaftskrise, die Schwäche der Weimarer Institutionen und Entscheidungen einzelner Akteure 1930 bis 1933 waren aber ebenso entscheidend. „Zwangsläufig“ blendet Handlungsspielräume aus.',topic:'Geschichte',status:'umstritten',sourceIds:[],created:t(22)},
   {id:'a4',title:'Sanktionen wirken nie',claim:'Sanktionen haben noch nie ein Regime zum Einlenken gebracht.',counter:'Es gibt Fälle mit teilweisem Erfolg, etwa die Sanktionen gegen das Apartheid-Regime in Südafrika oder den Druck, der zum Iran-Atomabkommen 2015 beitrug. Der Erfolg hängt von Ziel und Durchsetzung ab; pauschale Aussagen in beide Richtungen sind angreifbar.',topic:'Internationale Beziehungen',status:'teilweise',sourceIds:[],created:t(7)}
  ]
 };
}

/* ================= Datenschicht (IndexedDB, Write-through) =================
 * Die Oberfläche liest aus einer Kopie im Arbeitsspeicher (schnell).
 * Jede Änderung wird sofort als Transaktion in IndexedDB geschrieben.
 * Schlägt das Schreiben fehl, wird der Stand neu aus der Datenbank geladen,
 * damit Anzeige und gespeicherte Daten nie auseinanderlaufen. */
var COLS=['entries','sources','args','links','posts'];
var TAX={entries:1,args:1,posts:1};
var MAX_BACKUPS=5;
function emptyDb(){return {entries:[],sources:[],args:[],links:[],posts:[],settings:{theme:'system'},meta:{}}}
function byCreated(a,b){return (b.created||0)-(a.created||0)}
var Repo={
 db:null,ready:false,persistent:false,error:'',backups:[],persisted:null,
 fromRows:function(d){
  var db=emptyDb();
  COLS.forEach(function(c){db[c]=(d[c]||[]).slice().sort(byCreated)});
  (d.settings||[]).forEach(function(r){db.settings[r.key]=r.value});
  (d.meta||[]).forEach(function(r){db.meta[r.key]=r.value});
  db.settings.theme=db.settings.theme||'system';
  this.backups=(d.backups||[]).sort(function(a,b){return b.at-a.at});
  return db},
 load:function(){var self=this;
  return DB.open().then(function(){return DB.readAll()}).then(function(d){
   self.db=self.fromRows(d);self.ready=true;self.persistent=true;
   if(!self.db.meta.schema){
    self.db.meta.schema=DB.VERSION;self.db.meta.firstStart=Date.now();self.db.meta.appVersion=APP_VERSION;
    return DB.write({put:{meta:[{key:'schema',value:DB.VERSION},{key:'firstStart',value:self.db.meta.firstStart},{key:'appVersion',value:APP_VERSION}]}})}
  }).catch(function(e){self.db=emptyDb();self.ready=false;self.persistent=false;self.error=e&&e.message?e.message:String(e)})},
 reload:function(){var self=this;return DB.readAll().then(function(d){self.db=self.fromRows(d);self.persistent=true})},
 commit:function(ch,tax){
  var self=this,t=Date.now();ch=ch||{};ch.put=ch.put||{};
  if(!self.ready){self.persistent=false;updateSaved();return Promise.resolve()}
  ch.put.meta=(ch.put.meta||[]).concat([{key:'lastSaved',value:t}]);
  if(tax){var x=taxonomy();ch.clear=(ch.clear||[]).concat(['topics','tags']);ch.put.topics=x.topics;ch.put.tags=x.tags}
  return DB.write(ch).then(function(){
   self.db.meta.lastSaved=t;self.persistent=true;updateSaved();
   var ls=document.getElementById('lastSaved');if(ls)ls.textContent=fmtSaved(t)},
  function(e){
   self.persistent=false;updateSaved();toast('Nicht gespeichert: '+e.message,true);
   e.shown=true;
   return self.reload().then(function(){render()},function(){}).then(function(){throw e})})},
 all:function(c){return this.db[c]},
 get:function(c,id){return this.db[c].filter(function(x){return x.id===id})[0]},
 put:function(c,o){var a=this.db[c],i=a.map(function(x){return x.id}).indexOf(o.id);if(i>=0)a[i]=o;else a.unshift(o);
  var p={};p[c]=[o];return this.commit({put:p},TAX[c])},
 remove:function(c,id){
  var D=this.db,del={},put={entries:[],args:[],posts:[]},mark=function(col,o){if(put[col].indexOf(o)<0)put[col].push(o)};
  del[c]=[id];D[c]=D[c].filter(function(x){return x.id!==id});
  if(c==='entries'||c==='args'){
   var gone=D.links.filter(function(l){return (l.fromK===c&&l.fromId===id)||(l.toK===c&&l.toId===id)});
   del.links=gone.map(function(l){return l.id});
   D.links=D.links.filter(function(l){return gone.indexOf(l)<0})}
  if(c==='entries'){D.posts.forEach(function(p){if((p.convertedTo||[]).indexOf(id)>=0){p.convertedTo=p.convertedTo.filter(function(x){return x!==id});mark('posts',p)}})}
  if(c==='posts'){D.entries.forEach(function(e){if(e.postId===id){e.postId='';mark('entries',e)}})}
  if(c==='sources'){['entries','args'].forEach(function(col){D[col].forEach(function(e){var s=e.sourceIds||[];if(s.indexOf(id)>=0){e.sourceIds=s.filter(function(x){return x!==id});mark(col,e)}})})}
  return this.commit({del:del,put:put},TAX[c])},
 /* Ersetzt alle Datensätze (Zurücksetzen, Löschen, Wiederherstellen). */
 replace:function(nd){var self=this,put={};
  COLS.forEach(function(c){self.db[c]=Array.isArray(nd[c])?nd[c].slice().sort(byCreated):[];put[c]=self.db[c]});
  return this.commit({clear:COLS.slice(),put:put},true)},
 /* Fügt viele Datensätze auf einmal hinzu bzw. ersetzt gleiche IDs. */
 bulkPut:function(out){var self=this,put={};
  COLS.forEach(function(c){var list=out[c]||[];put[c]=list;list.forEach(function(o){var a=self.db[c],i=a.map(function(x){return x.id}).indexOf(o.id);if(i>=0)a[i]=o;else a.push(o)})});
  return this.commit({put:put},true)},
 setSetting:function(k,v){this.db.settings[k]=v;return this.commit({put:{settings:[{key:k,value:v}]}})},
 /* Automatische Sicherung vor gefährlichen Vorgängen. Die neuesten 5 bleiben erhalten. */
 addBackup:function(reason){var self=this;
  if(!self.ready)return Promise.resolve(false);
  var snap={};COLS.forEach(function(c){snap[c]=self.db[c]});snap=JSON.parse(JSON.stringify(snap));
  var b={id:uid('b'),at:Date.now(),reason:reason,app:'DebateBase',appVersion:APP_VERSION,schema:DB.VERSION,counts:counts(snap),db:snap};
  var all=[b].concat(self.backups),keep=all.slice(0,MAX_BACKUPS),drop=all.slice(MAX_BACKUPS);
  return DB.write({put:{backups:[b]},del:{backups:drop.map(function(x){return x.id})}}).then(function(){self.backups=keep;return true},
   function(e){toast('Sicherung fehlgeschlagen, Vorgang abgebrochen: '+e.message,true);e.shown=true;throw e})}
};
function counts(d){var c={};COLS.forEach(function(k){c[k]=(d[k]||[]).length});return c}
/* Themen und Tags werden automatisch aus den Datensätzen gepflegt. */
function taxonomy(){
 var T={},G={},add=function(m,k){k=String(k||'').trim();if(!k)return;var n=norm(k);(m[n]=m[n]||{name:k,count:0}).count++};
 Repo.db.entries.forEach(function(e){add(T,e.topic);(e.tags||[]).forEach(function(t){add(G,t)})});
 Repo.db.args.forEach(function(a){add(T,a.topic)});
 Repo.db.posts.forEach(function(p){add(T,p.topic)});
 var vals=function(m){return Object.keys(m).map(function(k){return m[k]})};
 return {topics:vals(T),tags:vals(G)}}
/* Prüfung der gespeicherten Daten: findet Verweise ins Leere. Löscht nichts. */
function checkIntegrity(){
 var D=Repo.db,iss=[],set=function(c){var s={};D[c].forEach(function(x){s[x.id]=1});return s};
 var S=set('sources'),E=set('entries'),A=set('args'),P=set('posts'),K={entries:E,args:A};
 ['entries','args'].forEach(function(c){D[c].forEach(function(o){var n=(o.sourceIds||[]).filter(function(s){return !S[s]}).length;if(n)iss.push('„'+o.title+'“ verweist auf '+n+(n===1?' fehlende Quelle':' fehlende Quellen'))})});
 D.links.forEach(function(l){if(!(K[l.fromK]&&K[l.fromK][l.fromId])||!(K[l.toK]&&K[l.toK][l.toId]))iss.push('Verknüpfung '+l.id+' verweist auf einen fehlenden Eintrag')});
 D.entries.forEach(function(e){if(e.postId&&!P[e.postId])iss.push('„'+e.title+'“ verweist auf einen fehlenden X-Beitrag')});
 D.posts.forEach(function(p){var n=(p.convertedTo||[]).filter(function(x){return !E[x]}).length;if(n)iss.push('X-Beitrag '+(p.handle?'@'+p.handle:p.id)+' verweist auf '+n+' fehlende Einträge')});
 var tw={};D.posts.forEach(function(p){if(p.tweetId){if(tw[p.tweetId])iss.push('X-Beitrag '+p.tweetId+' ist doppelt gespeichert');tw[p.tweetId]=1}});
 return iss}

/* ---------- Hilfen ---------- */
var ui={route:'dashboard',q:'',type:'',topic:'',status:'',sort:'neu',sq:'',skind:'',aq:'',dq:'',donly:false,focusImport:false};
var ROUTES=[['dashboard','Dashboard','Start','home','Übersicht über deine Wissensdatenbank'],['wissen','Wissensbibliothek','Wissen','book','Fakten, Definitionen, Studien und mehr'],['argumente','Argumentationsarchiv','Argumente','scale','Behauptungen mit Gegenargumenten'],['quellen','Quellenarchiv','Quellen','doc','Belege und Fundstellen'],['diskussion','Diskussionsmodus','Diskussion','chat','Schnell nachschlagen und kopieren'],['einstellungen','Einstellungen','Optionen','sliders','Darstellung und Daten']];
function norm(s){return String(s||'').toLowerCase()}
function matches(hay,q){var ts=norm(q).split(/\s+/).filter(Boolean),h=norm(hay);return ts.every(function(t){return h.indexOf(t)>=0})}
function fmtDate(ts){return new Date(ts).toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'})}
function rel(ts){var d=Math.floor((Date.now()-ts)/DAY);if(d<=0)return 'heute';if(d===1)return 'gestern';if(d<30)return 'vor '+d+' Tagen';var m=Math.floor(d/30);return m===1?'vor 1 Monat':'vor '+m+' Monaten'}
function stChip(s){return '<span class="chip st st-'+s+'">'+esc(STATUS[s]||s)+'</span>'}
function srcTitles(ids){return (ids||[]).map(function(i){var s=Repo.get('sources',i);return s?s.title:''}).filter(Boolean)}
function toast(m,bad){var t=$('#toast');t.textContent=m;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},bad?5000:2200)}
function copy(text,msg){
 var done=function(){toast(msg||'In die Zwischenablage kopiert')};
 var fb=function(){var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){toast('Kopieren nicht möglich. Text bitte markieren.')}ta.remove()};
 try{navigator.clipboard.writeText(text).then(done,fb)}catch(e){fb()}
}
function armed(btn,lbl){
 if(btn.dataset.armed)return true;
 btn.dataset.armed='1';btn.dataset.label=btn.innerHTML;btn.innerHTML=lbl||'Sicher? Noch einmal tippen';btn.classList.add('armed');
 setTimeout(function(){if(btn.isConnected&&btn.dataset.armed){delete btn.dataset.armed;btn.innerHTML=btn.dataset.label;btn.classList.remove('armed')}},4000);
 return false}
function opts(map,sel,all){var h=all?'<option value="">'+all+'</option>':'';Object.keys(map).forEach(function(k){h+='<option value="'+k+'"'+(k===sel?' selected':'')+'>'+esc(map[k])+'</option>'});return h}
function arrOpts(a,sel,all){var h=all?'<option value="">'+all+'</option>':'';a.forEach(function(k){h+='<option'+(k===sel?' selected':'')+'>'+esc(k)+'</option>'});return h}
function allTopics(){var s=TOPICS.slice();Repo.all('entries').concat(Repo.all('args')).forEach(function(e){if(e.topic&&s.indexOf(e.topic)<0)s.push(e.topic)});return s}
function parseTags(v){var seen={},out=[];String(v).split(/[,;]+/).forEach(function(t){t=t.trim().replace(/^#/,'');if(t&&!seen[norm(t)]){seen[norm(t)]=1;out.push(t)}});return out}
function xText(kind,o){
 var txt,src;
 if(kind==='args'){txt=o.title+': '+o.counter}else{txt=o.title+' – '+o.description+(o.status?' ('+STATUS[o.status]+')':'')}
 src=srcTitles(o.sourceIds)[0];
 var tail=src?' Quelle: '+src:'';
 if((txt+tail).length>280){txt=txt.slice(0,Math.max(0,277-tail.length))+'…'}
 return txt+tail}

/* ---------- Sheet ---------- */
function openSheet(html){var s=$('#sheet');s.innerHTML=html;$('#overlay').hidden=false;document.body.style.overflow='hidden';s.scrollTop=0}
function closeSheet(){$('#overlay').hidden=true;document.body.style.overflow='';$('#sheet').innerHTML=''}
function sheetHead(t,extra){return '<div class="sheet-h"><h2 class="t">'+esc(t)+'</h2><button class="icon-btn" data-act="close" aria-label="Schließen">'+ic('x')+'</button></div>'+(extra||'')}
function sourcePicker(sel){
 var S=Repo.all('sources');
 if(!S.length)return '<p class="note">Noch keine Quellen vorhanden. Lege zuerst Quellen im Quellenarchiv an.</p>';
 return '<div class="pick">'+S.map(function(s){return '<label><input type="checkbox" name="src" value="'+esc(s.id)+'"'+((sel||[]).indexOf(s.id)>=0?' checked':'')+'><span>'+esc(s.title)+' <small style="color:var(--muted)">'+esc(s.publisher||'')+'</small></span></label>'}).join('')+'</div>'}
function checkedSources(f){return [].slice.call(f.querySelectorAll('input[name=src]:checked')).map(function(i){return i.value})}

/* ---------- Eintrag ---------- */
function entryForm(id,preset){
 var e=id?Repo.get('entries',id):Object.assign({type:'fakt',status:'neu',topic:'',tags:[],sourceIds:[],title:'',description:''},preset||{});
 var used={};(e.tags||[]).forEach(function(t){used[norm(t)]=1});
 var cnt={};Repo.all('entries').forEach(function(x){(x.tags||[]).forEach(function(t){cnt[t]=(cnt[t]||0)+1})});
 var sug=Object.keys(cnt).filter(function(t){return !used[norm(t)]}).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,8);
 openSheet(sheetHead(id?'Eintrag bearbeiten':'Neuer Eintrag')+
 '<form data-form="entry" data-id="'+esc(id||'')+'" class="stack" novalidate>'+
 '<div class="field"><label for="f-title">Titel</label><input id="f-title" name="title" required maxlength="200" value="'+esc(e.title)+'" placeholder="z. B. Gründung der Vereinten Nationen"></div>'+
 '<div class="field"><label for="f-desc">Beschreibung</label><textarea id="f-desc" name="description" placeholder="Kernaussage in eigenen Worten">'+esc(e.description)+'</textarea></div>'+
 '<div class="two"><div class="field"><label for="f-type">Inhaltstyp</label><select id="f-type" name="type">'+opts(TYPES,e.type)+'</select></div>'+
 '<div class="field"><label for="f-status">Prüfstatus</label><select id="f-status" name="status">'+opts(STATUS,e.status)+'</select></div></div>'+
 '<div class="field"><label for="f-topic">Themengebiet</label><input id="f-topic" name="topic" list="topics" value="'+esc(e.topic)+'" placeholder="Auswählen oder neu eingeben"><datalist id="topics">'+allTopics().map(function(t){return '<option value="'+esc(t)+'">'}).join('')+'</datalist></div>'+
 '<div class="field"><label for="f-tags">Tags (durch Komma getrennt)</label><input id="f-tags" name="tags" value="'+esc((e.tags||[]).join(', '))+'" placeholder="z. B. NATO, Kalter Krieg">'+
 (sug.length?'<div class="chips" style="flex-wrap:wrap">'+sug.map(function(t){return '<button type="button" data-act="addtag" data-v="'+esc(t)+'">+ '+esc(t)+'</button>'}).join('')+'</div>':'')+'</div>'+
 extraFields(e)+'<input type="hidden" name="postId" value="'+esc(e.postId||'')+'">'+
 '<div class="field"><span class="lbl">Quellen verknüpfen</span>'+sourcePicker(e.sourceIds)+'</div>'+
 '<p class="err" id="err" hidden></p>'+
 '<div class="btns"><button type="button" class="btn" data-act="close">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form>')}
function saveEntry(f){
 var d=new FormData(f),title=String(d.get('title')).trim(),id=f.dataset.id;
 if(!title){var er=$('#err');er.textContent='Bitte gib einen Titel ein.';er.hidden=false;$('#f-title').focus();return}
 var old=id?Repo.get('entries',id):null,t=Date.now();
 /* Felder, die diese Version nicht kennt (z. B. aus einem Import), bleiben erhalten. */
 var o=Object.assign({},old||{},{id:id||uid('e'),title:title,description:String(d.get('description')).trim(),type:d.get('type'),status:d.get('status'),topic:String(d.get('topic')).trim(),tags:parseTags(d.get('tags')),sourceIds:checkedSources(f),postId:String(d.get('postId')||''),claimCore:String(d.get('claimCore')||'').trim(),reason:String(d.get('reason')||'').trim(),evidence:String(d.get('evidence')||'').trim(),limits:String(d.get('limits')||'').trim(),conclusion:String(d.get('conclusion')||'').trim(),created:old?old.created:t,updated:t});
 var pid=o.postId;Repo.put('entries',o).then(function(){var p=pid&&Repo.get('posts',pid);if(p){p.convertedTo=p.convertedTo||[];if(p.convertedTo.indexOf(o.id)<0){p.convertedTo.push(o.id);return Repo.put('posts',p)}}}).then(function(){closeSheet();render();toast(id?'Eintrag gespeichert':'Eintrag angelegt')})}
function entryDetail(id){
 var e=Repo.get('entries',id);if(!e)return;
 var S=(e.sourceIds||[]).map(function(i){return Repo.get('sources',i)}).filter(Boolean);
 openSheet(sheetHead(e.title,'<div class="meta"><span class="chip">'+esc(TYPES[e.type]||e.type)+'</span>'+stChip(e.status)+'</div>')+
 (e.description?'<p class="body" style="margin:0">'+esc(e.description)+'</p>':'<p class="note">Keine Beschreibung.</p>')+
 extraView(e)+postOrigin(e)+'<dl><dt>Themengebiet</dt><dd>'+esc(e.topic||'–')+'</dd><dt>Tags</dt><dd>'+((e.tags||[]).length?e.tags.map(function(t){return '<span class="chip tag">'+esc(t)+'</span>'}).join(' '):'–')+'</dd><dt>Erstellt</dt><dd>'+fmtDate(e.created)+'</dd><dt>Geändert</dt><dd>'+fmtDate(e.updated||e.created)+'</dd></dl>'+
 '<div class="sec"><h2>Quellen</h2>'+(S.length?S.map(function(s){return '<button class="row" data-act="open-source" data-id="'+esc(s.id)+'"><div><b>'+esc(s.title)+'</b><small>'+esc(s.publisher||'')+(s.year?', '+esc(s.year):'')+'</small></div></button>'}).join(''):'<p class="note">Keine Quelle verknüpft.</p>')+'</div>'+
 linkSection('entries',id)+delNote('entries',id)+'<div class="btns"><button class="btn" data-act="edit-entry" data-id="'+esc(id)+'">'+ic('edit',18)+'Bearbeiten</button><button class="btn" data-act="copyx" data-k="entries" data-id="'+esc(id)+'">'+ic('copy',18)+'Für X kopieren</button><button class="btn danger" data-act="del-entry" data-id="'+esc(id)+'">'+ic('trash',18)+'Löschen</button></div>')}

/* ---------- Quelle ---------- */
function sourceForm(id){
 var s=id?Repo.get('sources',id):{title:'',publisher:'',year:'',kind:'Studie',url:'',note:''};
 openSheet(sheetHead(id?'Quelle bearbeiten':'Neue Quelle')+
 '<form data-form="source" data-id="'+esc(id||'')+'" class="stack" novalidate>'+
 '<div class="field"><label for="s-title">Titel</label><input id="s-title" name="title" required value="'+esc(s.title)+'"></div>'+
 '<div class="field"><label for="s-pub">Autor oder Herausgeber</label><input id="s-pub" name="publisher" value="'+esc(s.publisher)+'"></div>'+
 '<div class="two"><div class="field"><label for="s-year">Jahr</label><input id="s-year" name="year" inputmode="numeric" maxlength="4" value="'+esc(s.year)+'"></div>'+
 '<div class="field"><label for="s-kind">Art</label><select id="s-kind" name="kind">'+arrOpts(SKINDS,s.kind)+'</select></div></div>'+
 '<div class="field"><label for="s-url">Link</label><input id="s-url" name="url" type="url" inputmode="url" placeholder="https://" value="'+esc(s.url)+'"></div>'+
 '<div class="field"><label for="s-note">Notiz</label><textarea id="s-note" name="note">'+esc(s.note)+'</textarea></div>'+
 '<p class="err" id="err" hidden></p>'+
 '<div class="btns"><button type="button" class="btn" data-act="close">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form>')}
function saveSource(f){
 var d=new FormData(f),title=String(d.get('title')).trim(),id=f.dataset.id;
 if(!title){var er=$('#err');er.textContent='Bitte gib einen Titel ein.';er.hidden=false;return}
 var url=String(d.get('url')).trim();
 if(url&&!/^https?:\/\//i.test(url)){var er2=$('#err');er2.textContent='Der Link muss mit http:// oder https:// beginnen.';er2.hidden=false;return}
 var old=id?Repo.get('sources',id):null;
 var o=Object.assign({},old||{},{id:id||uid('s'),title:title,publisher:String(d.get('publisher')).trim(),year:String(d.get('year')).trim(),kind:d.get('kind'),url:url,note:String(d.get('note')).trim(),created:old?old.created:Date.now()});
 Repo.put('sources',o).then(function(){closeSheet();render();toast(id?'Quelle gespeichert':'Quelle angelegt')})}
function citedBy(id){return Repo.all('entries').filter(function(e){return (e.sourceIds||[]).indexOf(id)>=0})}
function sourceDetail(id){
 var s=Repo.get('sources',id);if(!s)return;var C=citedBy(id);
 openSheet(sheetHead(s.title,'<div class="meta"><span class="chip">'+esc(s.kind)+'</span></div>')+
 '<dl><dt>Von</dt><dd>'+esc(s.publisher||'–')+'</dd><dt>Jahr</dt><dd>'+esc(s.year||'–')+'</dd><dt>Link</dt><dd>'+(s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">'+esc(s.url)+'</a>':'–')+'</dd><dt>Notiz</dt><dd>'+esc(s.note||'–')+'</dd></dl>'+
 '<div class="sec"><h2>Zitiert in '+C.length+' Einträgen</h2>'+C.map(function(e){return '<button class="row" data-act="open-entry" data-id="'+esc(e.id)+'"><div><b>'+esc(e.title)+'</b></div>'+stChip(e.status)+'</button>'}).join('')+'</div>'+
 (C.length?'<p class="note">Beim Löschen wird die Quelle aus '+C.length+(C.length===1?' Eintrag':' Einträgen')+' entfernt.</p>':'')+'<div class="btns"><button class="btn" data-act="edit-source" data-id="'+esc(id)+'">'+ic('edit',18)+'Bearbeiten</button><button class="btn danger" data-act="del-source" data-id="'+esc(id)+'">'+ic('trash',18)+'Löschen</button></div>')}

/* ---------- Argumentationskarte ---------- */
function argForm(id){
 var a=id?Repo.get('args',id):{title:'',claim:'',counter:'',topic:'',status:'neu',sourceIds:[]};
 openSheet(sheetHead(id?'Argumentationskarte bearbeiten':'Neue Argumentationskarte')+
 '<form data-form="arg" data-id="'+esc(id||'')+'" class="stack" novalidate>'+
 '<div class="field"><label for="a-title">Titel</label><input id="a-title" name="title" required value="'+esc(a.title)+'"></div>'+
 '<div class="field"><label for="a-claim">Behauptung der Gegenseite</label><textarea id="a-claim" name="claim">'+esc(a.claim)+'</textarea></div>'+
 '<div class="field"><label for="a-counter">Gegenargument</label><textarea id="a-counter" name="counter">'+esc(a.counter)+'</textarea></div>'+
 '<div class="two"><div class="field"><label for="a-topic">Themengebiet</label><input id="a-topic" name="topic" list="topics2" value="'+esc(a.topic)+'"><datalist id="topics2">'+allTopics().map(function(t){return '<option value="'+esc(t)+'">'}).join('')+'</datalist></div>'+
 '<div class="field"><label for="a-status">Prüfstatus</label><select id="a-status" name="status">'+opts(STATUS,a.status)+'</select></div></div>'+
 '<div class="field"><span class="lbl">Quellen verknüpfen</span>'+sourcePicker(a.sourceIds)+'</div>'+
 '<p class="err" id="err" hidden></p>'+
 '<div class="btns"><button type="button" class="btn" data-act="close">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form>')}
function saveArg(f){
 var d=new FormData(f),title=String(d.get('title')).trim(),id=f.dataset.id;
 if(!title){var er=$('#err');er.textContent='Bitte gib einen Titel ein.';er.hidden=false;return}
 var old=id?Repo.get('args',id):null;
 var o=Object.assign({},old||{},{id:id||uid('a'),title:title,claim:String(d.get('claim')).trim(),counter:String(d.get('counter')).trim(),topic:String(d.get('topic')).trim(),status:d.get('status'),sourceIds:checkedSources(f),created:old?old.created:Date.now()});
 Repo.put('args',o).then(function(){closeSheet();render();toast(id?'Karte gespeichert':'Karte angelegt')})}
function argDetail(id){
 var a=Repo.get('args',id);if(!a)return;
 var S=(a.sourceIds||[]).map(function(i){return Repo.get('sources',i)}).filter(Boolean);
 openSheet(sheetHead(a.title,'<div class="meta">'+stChip(a.status)+(a.topic?'<span class="chip">'+esc(a.topic)+'</span>':'')+'</div>')+
 '<div class="cols"><div class="pane pro"><small>Behauptung</small><span class="body">'+esc(a.claim||'–')+'</span></div><div class="pane con"><small>Gegenargument</small><span class="body">'+esc(a.counter||'–')+'</span></div></div>'+
 '<div class="sec"><h2>Quellen</h2>'+(S.length?S.map(function(s){return '<button class="row" data-act="open-source" data-id="'+esc(s.id)+'"><div><b>'+esc(s.title)+'</b><small>'+esc(s.publisher||'')+'</small></div></button>'}).join(''):'<p class="note">Keine Quelle verknüpft.</p>')+'</div>'+
 linkSection('args',id)+delNote('args',id)+'<div class="btns"><button class="btn" data-act="edit-arg" data-id="'+esc(id)+'">'+ic('edit',18)+'Bearbeiten</button><button class="btn" data-act="copyx" data-k="args" data-id="'+esc(id)+'">'+ic('copy',18)+'Für X kopieren</button><button class="btn danger" data-act="del-arg" data-id="'+esc(id)+'">'+ic('trash',18)+'Löschen</button></div>')}

/* ================= Verknüpfungen ================= */
var LTYPES={unterstuetzt:['Unterstützt','Wird unterstützt von'],widerspricht:['Widerspricht','Wird widersprochen von'],ergaenzt:['Ergänzt','Wird ergänzt von'],relativiert:['Relativiert','Wird relativiert von'],basiert:['Basiert auf','Grundlage für'],zitiert:['Zitiert','Wird zitiert von']};
var KINDNAME={entries:'Wissenseintrag',args:'Argumentationskarte'};
function itemOf(k,id){return (k==='entries'||k==='args')?Repo.get(k,id):null}
function linksOf(k,id){return Repo.all('links').filter(function(l){return (l.fromK===k&&l.fromId===id)||(l.toK===k&&l.toId===id)})}
function linkView(l,k,id){
 var out=(l.fromK===k&&l.fromId===id);
 var pk=out?l.toK:l.fromK,pid=out?l.toId:l.fromId,lt=LTYPES[l.type]||[l.type,l.type];
 return {out:out,label:lt[out?0:1],pk:pk,pid:pid,partner:itemOf(pk,pid)}}
function linkText(k,id){return linksOf(k,id).map(function(l){var v=linkView(l,k,id);return v.label+' '+(v.partner?v.partner.title:'')+' '+(l.note||'')}).join(' ')}
function linkBadge(k,id){var n=linksOf(k,id).length;return n?'<span class="chip tag">'+ic('link',13)+n+(n===1?' Verknüpfung':' Verknüpfungen')+'</span>':''}
function delNote(k,id){var n=linksOf(k,id).length;return n?'<p class="note">Beim Löschen werden auch '+n+(n===1?' Verknüpfung':' Verknüpfungen')+' entfernt.</p>':''}
function openItem(k,id){if(k==='args')argDetail(id);else entryDetail(id)}
function linkSection(k,id){
 var L=linksOf(k,id);
 var rows=L.map(function(l){var v=linkView(l,k,id);if(!v.partner)return '';
  return '<div class="lk lk-'+esc(l.type)+'"><button class="lk-main" data-act="open-item" data-k="'+v.pk+'" data-id="'+esc(v.pid)+'"><small>'+esc(v.label)+' · '+KINDNAME[v.pk]+'</small><b>'+esc(v.partner.title)+'</b>'+(l.note?'<span>'+esc(l.note)+'</span>':'')+'</button>'+
  '<button class="icon-btn sm" data-act="edit-link" data-id="'+esc(l.id)+'" data-ck="'+k+'" data-cid="'+esc(id)+'" aria-label="Verknüpfung bearbeiten">'+ic('edit',18)+'</button>'+
  '<button class="icon-btn sm" data-act="del-link" data-id="'+esc(l.id)+'" data-ck="'+k+'" data-cid="'+esc(id)+'" aria-label="Verknüpfung löschen">'+ic('trash',18)+'</button></div>'}).join('');
 return '<div class="sec"><div class="sec-h"><h2>Verknüpfungen ('+L.length+')</h2><button class="link" data-act="new-link" data-ck="'+k+'" data-cid="'+esc(id)+'">+ Verknüpfung</button></div>'+(rows||'<p class="note">Noch keine Verknüpfungen. Verbinde diesen Eintrag z. B. mit einer Studie oder einem Gegenargument.</p>')+'</div>'}
function partnerOptions(k,id,sel){
 var h='<option value="">Bitte wählen</option>';
 var grp=function(name,col){var a=Repo.all(col).filter(function(x){return !(col===k&&x.id===id)}).sort(function(a,b){return a.title.localeCompare(b.title,'de')});
  if(!a.length)return '';return '<optgroup label="'+name+'">'+a.map(function(x){var v=col+':'+x.id;return '<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc((col==='entries'?(TYPES[x.type]||x.type)+' · ':'')+x.title)+'</option>'}).join('')+'</optgroup>'};
 return h+grp('Wissenseinträge','entries')+grp('Argumentationskarten','args')}
function linkForm(lid,k,id){
 var l=lid?Repo.get('links',lid):null,out=true,partner='',type='unterstuetzt',note='';
 if(l){out=(l.fromK===k&&l.fromId===id);partner=out?l.toK+':'+l.toId:l.fromK+':'+l.fromId;type=l.type;note=l.note||''}
 var me=itemOf(k,id);
 openSheet(sheetHead(lid?'Verknüpfung bearbeiten':'Neue Verknüpfung','<p class="note" style="margin:0">Von: '+esc(me?me.title:'')+'</p>')+
 '<form data-form="link" data-id="'+esc(lid||'')+'" data-ck="'+k+'" data-cid="'+esc(id)+'" class="stack" novalidate>'+
 '<div class="field"><label for="lk-type">Art der Verknüpfung</label><select id="lk-type" name="type">'+Object.keys(LTYPES).map(function(t){return '<option value="'+t+'"'+(t===type?' selected':'')+'>'+LTYPES[t][0]+'</option>'}).join('')+'</select></div>'+
 '<div class="field"><label for="lk-dir">Richtung</label><select id="lk-dir" name="dir"><option value="out"'+(out?' selected':'')+'>Dieser Eintrag → Partner</option><option value="in"'+(out?'':' selected')+'>Partner → dieser Eintrag</option></select></div>'+
 '<div class="field"><label for="lk-partner">Partner</label><select id="lk-partner" name="partner">'+partnerOptions(k,id,partner)+'</select></div>'+
 '<div class="field"><label for="lk-note">Notiz (optional)</label><input id="lk-note" name="note" maxlength="300" value="'+esc(note)+'" placeholder="z. B. Tabelle 2 der Studie"></div>'+
 '<p class="note" id="lk-prev"></p><p class="err" id="err" hidden></p>'+
 '<div class="btns"><button type="button" class="btn" data-act="back-item" data-ck="'+k+'" data-cid="'+esc(id)+'">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form>');
 updateLinkPreview()}
function updateLinkPreview(){
 var f=document.querySelector('form[data-form=link]');if(!f)return;
 var me=itemOf(f.dataset.ck,f.dataset.cid),sel=f.querySelector('#lk-partner'),pv=$('#lk-prev');
 var pt=sel.value?sel.options[sel.selectedIndex].text:'…',t=LTYPES[f.querySelector('#lk-type').value][0],out=f.querySelector('#lk-dir').value==='out';
 var a=me?me.title:'Dieser Eintrag';pv.textContent='„'+(out?a:pt)+'“ '+t.toLowerCase()+' „'+(out?pt:a)+'“.'}
function saveLink(f){
 var d=new FormData(f),k=f.dataset.ck,id=f.dataset.cid,lid=f.dataset.id,er=$('#err');
 var raw=String(d.get('partner')||''),cut=raw.indexOf(':'),p=cut>0?[raw.slice(0,cut),raw.slice(cut+1)]:[];
 if(p.length!==2||!itemOf(p[0],p[1])){er.textContent='Bitte wähle einen Partner aus.';er.hidden=false;return}
 var out=d.get('dir')==='out',old=lid?Repo.get('links',lid):null;
 var o=Object.assign({},old||{},{id:lid||uid('l'),type:d.get('type'),fromK:out?k:p[0],fromId:out?id:p[1],toK:out?p[0]:k,toId:out?p[1]:id,note:String(d.get('note')).trim(),created:old?old.created:Date.now()});
 var dup=Repo.all('links').some(function(l){return l.id!==o.id&&l.type===o.type&&l.fromK===o.fromK&&l.fromId===o.fromId&&l.toK===o.toK&&l.toId===o.toId});
 if(dup){er.textContent='Diese Verknüpfung existiert bereits.';er.hidden=false;return}
 Repo.put('links',o).then(function(){closeSheet();render();openItem(k,id);toast(lid?'Verknüpfung gespeichert':'Verknüpfung angelegt')})}

/* ================= Zusatzfelder ================= */
var FIELDS=[['claimCore','Kernaussage','Die Aussage in einem Satz'],['reason','Begründung','Warum gilt oder gilt die Aussage nicht?'],['evidence','Evidenz / Beleg','Welche Daten oder Belege stützen sie?'],['limits','Einschränkungen','Wann oder wo gilt sie nicht?'],['conclusion','Eigene Schlussfolgerung','Was folgt für dich daraus?']];
var ALL5=['claimCore','reason','evidence','limits','conclusion'];
var FIELD_BY_TYPE={definition:['claimCore','limits'],fakt:['claimCore','evidence','limits'],statistik:['claimCore','evidence','limits'],studie:['claimCore','evidence','limits','conclusion'],behauptung:ALL5,argument:ALL5,gegenargument:ALL5,meinung:['claimCore','reason','conclusion'],frage:['claimCore','reason','conclusion']};
function fieldRelevant(type,key,val){return (FIELD_BY_TYPE[type]||ALL5).indexOf(key)>=0||!!String(val||'').trim()}
function extraFields(e){
 return '<div class="stack" id="extra">'+FIELDS.map(function(f){return '<div class="field" data-f="'+f[0]+'"'+(fieldRelevant(e.type,f[0],e[f[0]])?'':' hidden')+'><label for="x-'+f[0]+'">'+f[1]+' (optional)</label><textarea class="sm" id="x-'+f[0]+'" name="'+f[0]+'" placeholder="'+f[2]+'">'+esc(e[f[0]])+'</textarea></div>'}).join('')+'</div>'}
function toggleExtra(){var t=$('#f-type');if(!t)return;document.querySelectorAll('#extra .field').forEach(function(el){var key=el.dataset.f,v=el.querySelector('textarea').value;el.hidden=!fieldRelevant(t.value,key,v)})}
function extraView(e){
 var parts=FIELDS.filter(function(f){return String(e[f[0]]||'').trim()});
 return parts.length?'<div class="cols">'+parts.map(function(f){return '<div class="pane"><small>'+f[1]+'</small><span class="body">'+esc(e[f[0]])+'</span></div>'}).join('')+'</div>':''}

/* ================= Speicherstatus ================= */
function fmtSaved(ts){var d=new Date(ts),today=new Date().toDateString()===d.toDateString();return (today?'heute ':d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+' ')+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function updateSaved(){
 var el=$('#saved');if(!el||!Repo.db)return;var ts=Repo.db.meta&&Repo.db.meta.lastSaved;
 if(!Repo.ready){el.className='bad';el.textContent='Nicht dauerhaft gespeichert (nur Arbeitsspeicher)'}
 else if(!Repo.persistent){el.className='bad';el.textContent='Letzte Änderung nicht gespeichert'}
 else{el.className='';el.textContent=ts?'Automatisch gespeichert '+fmtSaved(ts):'Gespeichert auf diesem Gerät'}}

/* ================= X-Beiträge ================= */
var XHOSTS=['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com','mobile.x.com'];
function parseXUrl(u){
 u=String(u||'').trim();if(!u)return null;
 try{var x=new URL(u);if(XHOSTS.indexOf(x.hostname.toLowerCase())<0)return null;
  var m=x.pathname.match(/^\/([^\/]+)\/status(?:es)?\/(\d+)/)||x.pathname.match(/^\/(i)\/(?:web\/)?status\/(\d+)/);
  if(!m)return null;var h=m[1]==='i'?'':m[1];
  return {handle:h,tweetId:m[2],url:'https://x.com/'+(h||'i/web')+'/status/'+m[2]}}catch(e){return null}}
/* Trennt geteilten Text in Link und Beitragstext. */
function parseShared(raw){
 raw=String(raw||'');var m=raw.match(/https?:\/\/[^\s]+/g)||[];
 for(var i=0;i<m.length;i++){if(parseXUrl(m[i]))return {url:m[i],text:raw.replace(m[i],'').replace(/\s+\n/g,'\n').trim()}}
 return {url:'',text:raw.trim()}}
/* Für das Android-Teilen vorbereitet (wird in Etappe 4 angebunden). */
function handleSharedPayload(p){var s=parseShared([p.text,p.url].filter(Boolean).join(' '));postForm(null,{url:s.url||p.url||'',text:s.text||p.title||''})}
window.DebateBaseShare=handleSharedPayload;
function postTitle(p){var t=String(p.text||'').replace(/\s+/g,' ').trim();if(!t)return p.handle?'Beitrag von @'+p.handle:'X-Beitrag';var s=t.split(/(?<=[.!?])\s/)[0];return (s.length>90?s.slice(0,87).trimEnd()+'…':s)}
function postCard(p){
 var n=(p.convertedTo||[]).filter(function(i){return Repo.get('entries',i)}).length;
 return '<article class="card" role="button" tabindex="0" data-act="open-post" data-id="'+esc(p.id)+'"><div class="meta"><span class="chip">'+(p.handle?'@'+esc(p.handle):'X-Beitrag')+'</span>'+(p.url?'':'<span class="chip tag">ohne Link</span>')+(n?'<span class="chip tag">'+n+(n===1?' Eintrag':' Einträge')+' erstellt</span>':'')+'</div>'+
 '<p class="clamp" style="color:var(--fg);margin-top:8px">'+esc(p.text||p.url)+'</p><div class="foot">'+(p.topic?'<span>'+esc(p.topic)+'</span>':'')+'<span>'+rel(p.created)+'</span></div></article>'}
function postsSection(){var P=Repo.all('posts');
 return '<div class="sec" style="margin-top:8px"><h2>Gespeicherte X-Beiträge ('+P.length+')</h2>'+(P.length?P.map(postCard).join(''):empty('Noch keine Beiträge. Füge einen X-Link oder Beitragstext ein.'))+'</div>'}
function postForm(id,preset){
 var p=id?Repo.get('posts',id):Object.assign({url:'',text:'',topic:'',note:''},preset||{});
 openSheet(sheetHead(id?'X-Beitrag bearbeiten':'X-Beitrag erfassen')+
 '<p class="note">Füge Link und Text von Hand ein. Du kannst auch beides in das Textfeld einfügen, der Link wird dann erkannt und abgetrennt.</p>'+
 '<form data-form="post" data-id="'+esc(id||'')+'" class="stack" novalidate>'+
 '<div class="field"><label for="p-url">Link zum Beitrag</label><input id="p-url" name="url" inputmode="url" autocomplete="off" placeholder="https://x.com/name/status/123…" value="'+esc(p.url)+'"></div>'+
 '<div class="field"><label for="p-text">Beitragstext</label><textarea id="p-text" name="text" placeholder="Text des Beitrags">'+esc(p.text)+'</textarea></div>'+
 '<div class="field"><label for="p-topic">Thema zuordnen</label><input id="p-topic" name="topic" list="topics3" value="'+esc(p.topic)+'" placeholder="Bestehendes Thema wählen oder neu eingeben"><datalist id="topics3">'+allTopics().map(function(t){return '<option value="'+esc(t)+'">'}).join('')+'</datalist></div>'+
 '<div class="field"><label for="p-note">Eigene Notiz (optional)</label><textarea class="sm" id="p-note" name="note">'+esc(p.note)+'</textarea></div>'+
 '<p class="err" id="err" hidden></p>'+
 '<div class="btns"><button type="submit" class="btn primary" name="mode" value="save">Speichern</button></div>'+
 (id?'':'<div class="btns"><button type="submit" class="btn" name="mode" value="fakt">Speichern + Wissenseintrag</button><button type="submit" class="btn" name="mode" value="behauptung">Speichern + Behauptung</button></div>')+
 '<div class="btns"><button type="button" class="btn" data-act="close">Abbrechen</button></div></form>')}
function savePost(f,mode){
 var d=new FormData(f),id=f.dataset.id,er=$('#err'),url=String(d.get('url')).trim(),text=String(d.get('text')).trim();
 if(!url&&!text){er.textContent='Bitte gib einen Link oder einen Beitragstext ein.';er.hidden=false;return}
 var x=null;
 if(url){x=parseXUrl(url);if(!x){er.textContent='Das ist kein gültiger X-Link. Erwartet wird z. B. https://x.com/name/status/123456.';er.hidden=false;$('#p-url').focus();return}
  var dup=Repo.all('posts').filter(function(p){return p.id!==id&&p.tweetId===x.tweetId})[0];
  if(dup){er.textContent='Dieser Beitrag ist bereits gespeichert.';er.hidden=false;return}}
 var old=id?Repo.get('posts',id):null;
 var o=Object.assign({},old||{},{id:id||uid('p'),url:x?x.url:'',handle:x?x.handle:'',tweetId:x?x.tweetId:'',text:text,topic:String(d.get('topic')).trim(),note:String(d.get('note')).trim(),convertedTo:old?old.convertedTo||[]:[],created:old?old.created:Date.now()});
 Repo.put('posts',o).then(function(){closeSheet();render();
  if(mode==='fakt'||mode==='behauptung')postToEntry(o.id,mode);else toast('Beitrag gespeichert')})}
function postToEntry(pid,mode){
 var p=Repo.get('posts',pid);if(!p)return;
 entryForm(null,{title:postTitle(p),description:p.text,type:mode,status:'neu',topic:p.topic,postId:p.id,evidence:''})}
function postDetail(id){
 var p=Repo.get('posts',id);if(!p)return;
 var E=(p.convertedTo||[]).map(function(i){return Repo.get('entries',i)}).filter(Boolean);
 openSheet(sheetHead(p.handle?'Beitrag von @'+p.handle:'X-Beitrag','<div class="meta">'+(p.topic?'<span class="chip">'+esc(p.topic)+'</span>':'')+'<span class="chip tag">'+fmtDate(p.created)+'</span></div>')+
 '<p class="body" style="margin:0">'+esc(p.text||'(kein Text gespeichert)')+'</p>'+
 (p.url?'<p style="margin:0"><a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer" style="color:var(--accent);overflow-wrap:anywhere">'+esc(p.url)+'</a></p>':'')+
 (p.note?'<dl><dt>Notiz</dt><dd>'+esc(p.note)+'</dd></dl>':'')+
 '<div class="sec"><h2>Daraus erstellt ('+E.length+')</h2>'+(E.length?E.map(function(e){return '<button class="row" data-act="open-entry" data-id="'+esc(e.id)+'"><div><b>'+esc(e.title)+'</b><small>'+esc(TYPES[e.type]||e.type)+'</small></div>'+stChip(e.status)+'</button>'}).join(''):'<p class="note">Noch kein Eintrag aus diesem Beitrag erstellt.</p>')+'</div>'+
 '<div class="btns"><button class="btn" data-act="post-entry" data-id="'+esc(id)+'" data-v="fakt">Als Wissenseintrag</button><button class="btn" data-act="post-entry" data-id="'+esc(id)+'" data-v="behauptung">Als Behauptung</button></div>'+
 '<div class="btns"><button class="btn" data-act="edit-post" data-id="'+esc(id)+'">'+ic('edit',18)+'Bearbeiten</button><button class="btn danger" data-act="del-post" data-id="'+esc(id)+'">'+ic('trash',18)+'Löschen</button></div>')}
function postOrigin(e){
 var p=e.postId?Repo.get('posts',e.postId):null;if(!p)return '';
 return '<div class="sec"><h2>Herkunft</h2><button class="row" data-act="open-post" data-id="'+esc(p.id)+'"><div><b>X-Beitrag'+(p.handle?' von @'+esc(p.handle):'')+'</b><small>'+esc((p.text||p.url).slice(0,120))+'</small></div></button></div>'}

/* ================= Sicherung, Prüfung, Import ================= */
function buildExport(){var D=Repo.db;return {app:'DebateBase',version:3,schema:DB.VERSION,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),counts:counts(D),entries:D.entries,sources:D.sources,args:D.args,links:D.links,posts:D.posts}}
function validateDb(d){
 var errs=[],warns=[],out={entries:[],sources:[],args:[],links:[],posts:[]},names=Object.keys(out);
 if(!d||typeof d!=='object'||Array.isArray(d))return {ok:false,errs:['Die Datei enthält kein DebateBase-Objekt.'],warns:warns,out:out,st:{}};
 if(d.app&&d.app!=='DebateBase')errs.push('Die Datei stammt nicht aus DebateBase („'+d.app+'“).');
 if(!names.some(function(k){return Array.isArray(d[k])}))errs.push('Es wurden keine Listen mit Datensätzen gefunden (entries, sources, args, links, posts).');
 names.forEach(function(k){if(d[k]!=null&&!Array.isArray(d[k]))errs.push('„'+k+'“ muss eine Liste sein.')});
 if(errs.length)return {ok:false,errs:errs,warns:warns,out:out,st:{}};
 var S=function(v){return typeof v==='string'?v:(v==null?'':String(v))},N=function(v){return typeof v==='number'&&isFinite(v)?v:Date.now()},seen={};
 var A=function(v){return Array.isArray(v)?v.filter(function(x){return typeof x==='string'}):[]};
 var base=function(k,o,i){if(!o||typeof o!=='object'||Array.isArray(o)){warns.push(k+' Nr. '+(i+1)+': kein gültiger Datensatz, übersprungen');return false}
  if(!o.id||typeof o.id!=='string'){warns.push(k+' Nr. '+(i+1)+': ohne ID, übersprungen');return false}
  if(seen[k+o.id]){warns.push(k+' '+o.id+': doppelte ID, übersprungen');return false}seen[k+o.id]=1;return true};
 d.entries&&d.entries.forEach(function(o,i){if(!base('Eintrag',o,i))return;var t=S(o.title).trim();if(!t){warns.push('Eintrag '+o.id+': ohne Titel, übersprungen');return}
  var ty=TYPES[o.type]?o.type:'fakt',st=STATUS[o.status]?o.status:'neu';if(ty!==o.type)warns.push('Eintrag „'+t+'“: unbekannter Typ, „Fakt“ gesetzt');if(st!==o.status)warns.push('Eintrag „'+t+'“: unbekannter Prüfstatus, „Neu“ gesetzt');
  var r={id:o.id,title:t,description:S(o.description),type:ty,status:st,topic:S(o.topic),tags:A(o.tags),sourceIds:A(o.sourceIds),postId:S(o.postId),created:N(o.created),updated:N(o.updated||o.created)};
  FIELDS.forEach(function(f){r[f[0]]=S(o[f[0]])});out.entries.push(r)});
 d.sources&&d.sources.forEach(function(o,i){if(!base('Quelle',o,i))return;var t=S(o.title).trim();if(!t){warns.push('Quelle '+o.id+': ohne Titel, übersprungen');return}
  var k=SKINDS.indexOf(o.kind)>=0?o.kind:'Sonstiges',u=S(o.url).trim();if(u&&!/^https?:\/\//i.test(u)){warns.push('Quelle „'+t+'“: ungültiger Link entfernt');u=''}
  out.sources.push({id:o.id,title:t,publisher:S(o.publisher),year:S(o.year),kind:k,url:u,note:S(o.note),created:N(o.created)})});
 d.args&&d.args.forEach(function(o,i){if(!base('Karte',o,i))return;var t=S(o.title).trim();if(!t){warns.push('Karte '+o.id+': ohne Titel, übersprungen');return}
  out.args.push({id:o.id,title:t,claim:S(o.claim),counter:S(o.counter),topic:S(o.topic),status:STATUS[o.status]?o.status:'neu',sourceIds:A(o.sourceIds),created:N(o.created)})});
 d.posts&&d.posts.forEach(function(o,i){if(!base('Beitrag',o,i))return;var tx=S(o.text).trim(),u=S(o.url).trim(),x=u?parseXUrl(u):null;
  if(!tx&&!x){warns.push('Beitrag '+o.id+': weder Text noch gültiger X-Link, übersprungen');return}
  out.posts.push({id:o.id,url:x?x.url:'',handle:x?x.handle:'',tweetId:x?x.tweetId:'',text:tx,topic:S(o.topic),note:S(o.note),convertedTo:A(o.convertedTo),created:N(o.created)})});
 var ids=function(col,imp){var s={};Repo.all(col).forEach(function(x){s[x.id]=1});imp.forEach(function(x){s[x.id]=1});return s};
 var E=ids('entries',out.entries),Ar=ids('args',out.args),So=ids('sources',out.sources),dropped=0;
 [out.entries,out.args].forEach(function(a){a.forEach(function(x){var n=x.sourceIds.length;x.sourceIds=x.sourceIds.filter(function(s){return So[s]});dropped+=n-x.sourceIds.length})});
 if(dropped)warns.push(dropped+' Quellenverweis(e) ohne vorhandene Quelle entfernt');
 d.links&&d.links.forEach(function(o,i){if(!base('Verknüpfung',o,i))return;
  var ok=o.type&&LTYPES[o.type]&&(o.fromK==='entries'||o.fromK==='args')&&(o.toK==='entries'||o.toK==='args')&&S(o.fromId)&&S(o.toId);
  if(!ok){warns.push('Verknüpfung '+o.id+': ungültige Art oder Endpunkte, übersprungen');return}
  var has=function(k,id){return (k==='entries'?E:Ar)[id]};
  if(!has(o.fromK,o.fromId)||!has(o.toK,o.toId)){warns.push('Verknüpfung '+o.id+': verweist auf nicht vorhandenen Eintrag, übersprungen');return}
  if(o.fromK===o.toK&&o.fromId===o.toId){warns.push('Verknüpfung '+o.id+': verbindet einen Eintrag mit sich selbst, übersprungen');return}
  out.links.push({id:o.id,type:o.type,fromK:o.fromK,fromId:o.fromId,toK:o.toK,toId:o.toId,note:S(o.note),created:N(o.created)})});
 var st={};names.forEach(function(k){var ex={};Repo.all(k).forEach(function(x){ex[x.id]=1});st[k]={neu:0,ueber:0};out[k].forEach(function(x){if(ex[x.id])st[k].ueber++;else st[k].neu++})});
 var total=names.reduce(function(a,k){return a+out[k].length},0);
 if(!total)errs.push('Die Datei enthält keine gültigen Datensätze.');
 return {ok:errs.length===0,errs:errs,warns:warns,out:out,st:st}}
var pending=null;
function importPreview(r){
 var L={entries:'Wissenseinträge',sources:'Quellen',args:'Argumentationskarten',links:'Verknüpfungen',posts:'X-Beiträge'};
 var h=sheetHead(r.ok?'Import prüfen':'Import nicht möglich');
 if(r.errs.length)h+='<div class="card"><p class="err">'+r.errs.map(esc).join('<br>')+'</p></div>';
 if(r.ok)h+='<div class="card"><dl>'+Object.keys(L).map(function(k){return '<dt>'+L[k]+'</dt><dd>'+r.out[k].length+' ('+r.st[k].neu+' neu, '+r.st[k].ueber+' überschreiben)</dd>'}).join('')+'</dl></div>';
 if(r.warns.length)h+='<div class="sec"><h2>Hinweise ('+r.warns.length+')</h2><div class="card"><ul style="margin:0;padding-left:18px;font-size:.875rem">'+r.warns.slice(0,8).map(function(w){return '<li>'+esc(w)+'</li>'}).join('')+(r.warns.length>8?'<li>… und '+(r.warns.length-8)+' weitere</li>':'')+'</ul></div></div>';
 h+=r.ok?'<p class="note">Vorhandene Daten mit gleicher ID werden überschrieben, alles andere bleibt erhalten. Vorher wird automatisch eine Sicherung angelegt.</p><div class="btns"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="confirm-import">Importieren</button></div>':'<div class="btns"><button class="btn" data-act="close">Schließen</button></div>';
 openSheet(h)}
function doImport(){
 var raw=$('#imp').value.trim();if(!raw){toast('Bitte zuerst JSON einfügen oder Datei wählen');return}
 var d;try{d=JSON.parse(raw)}catch(e){pending=null;importPreview({ok:false,errs:['Das ist kein gültiges JSON: '+e.message],warns:[],out:{},st:{}});return}
 pending=validateDb(d);importPreview(pending)}
function applyImport(){
 if(!pending||!pending.ok)return;var r=pending;pending=null;
 Repo.addBackup('Vor Import').then(function(){return Repo.bulkPut(r.out)}).then(function(){closeSheet();render();toast('Import abgeschlossen')})}
function dangerSheet(kind){
 var w=kind==='wipe'?'LÖSCHEN':'ZURÜCKSETZEN',D=Repo.db;
 openSheet(sheetHead(kind==='wipe'?'Alle Daten löschen?':'Auf Beispieldaten zurücksetzen?')+
 '<div class="card"><p style="color:var(--fg)">Betroffen sind '+D.entries.length+' Einträge, '+D.sources.length+' Quellen, '+D.args.length+' Karten, '+D.links.length+' Verknüpfungen und '+D.posts.length+' X-Beiträge.'+(kind==='wipe'?' Danach ist die Datenbank leer.':' Deine eigenen Daten werden durch die Beispieldaten ersetzt.')+'</p></div>'+
 '<p class="note">Vor dem Vorgang wird automatisch eine Sicherung angelegt. Du kannst sie danach in den Einstellungen wiederherstellen. Es werden die letzten '+MAX_BACKUPS+' Sicherungen aufbewahrt. Exportiere wichtige Daten zusätzlich als JSON.</p>'+
 '<div class="field"><label for="dg-word">Tippe '+w+', um zu bestätigen</label><input id="dg-word" autocomplete="off" autocapitalize="characters" data-word="'+w+'"></div>'+
 '<div class="btns"><button class="btn" data-act="close">Abbrechen</button><button class="btn danger" id="dg-go" data-act="do-danger" data-v="'+kind+'" disabled>'+(kind==='wipe'?'Endgültig löschen':'Zurücksetzen')+'</button></div>')}
function doDanger(kind){
 Repo.addBackup(kind==='wipe'?'Vor Löschen aller Daten':'Vor Zurücksetzen').then(function(){
  return Repo.replace(kind==='wipe'?{}:seed())}).then(function(){closeSheet();render();toast(kind==='wipe'?'Alle Daten gelöscht':'Beispieldaten wiederhergestellt')})}
function restoreBackup(id){
 var bk=Repo.backups.filter(function(b){return b.id===id})[0];if(!bk||!bk.db)return;
 var data=JSON.parse(JSON.stringify(bk.db)); /* Kopie, bevor die Sicherungsliste sich ändert */
 Repo.addBackup('Vor Wiederherstellung').then(function(){return Repo.replace(data)}).then(function(){render();toast('Sicherung wiederhergestellt')})}

/* ================= Einstellungen ================= */
function bkCounts(c){c=c||{};return (c.entries||0)+' Einträge, '+(c.sources||0)+' Quellen, '+(c.args||0)+' Karten, '+(c.links||0)+' Verknüpfungen, '+(c.posts||0)+' X-Beiträge'}
function viewSettings(){
 var th=Repo.db.settings.theme,D=Repo.db,ts=D.meta&&D.meta.lastSaved,iss=checkIntegrity();
 var prot=Repo.persisted===true?'Aktiv':Repo.persisted===false?'Nicht gewährt (Chrome entscheidet selbst; nach der Installation meist aktiv)':'Unbekannt';
 return '<section class="sec"><h2>Darstellung</h2><div class="seg">'+[['system','System'],['hell','Hell'],['dunkel','Dunkel']].map(function(p){return '<button data-act="set-theme" data-v="'+p[0]+'" aria-pressed="'+(th===p[0])+'">'+p[1]+'</button>'}).join('')+'</div></section>'+
 '<section class="sec"><h2>Datensicherheit</h2><div class="card"><dl><dt>Einträge</dt><dd>'+D.entries.length+'</dd><dt>Quellen</dt><dd>'+D.sources.length+'</dd><dt>Karten</dt><dd>'+D.args.length+'</dd><dt>Verknüpfungen</dt><dd>'+D.links.length+'</dd><dt>X-Beiträge</dt><dd>'+D.posts.length+'</dd>'+
 '<dt>Speicher</dt><dd>'+(Repo.ready?'IndexedDB auf diesem Gerät':'Nur Arbeitsspeicher, geht beim Schließen verloren')+'</dd>'+
 '<dt>Schutz vor Löschen</dt><dd>'+prot+'</dd><dt>Belegt</dt><dd id="usage">…</dd><dt>Datenbank</dt><dd>Version '+DB.VERSION+'</dd>'+
 '<dt>Zuletzt gespeichert</dt><dd id="lastSaved">'+(ts?fmtSaved(ts):'–')+'</dd></dl></div>'+
 (Repo.error?'<div class="card alert"><p><b>Speicherfehler:</b> '+esc(Repo.error)+'</p></div>':'')+
 '<p class="note">Jede Änderung wird sofort automatisch gespeichert. Die Daten verlassen dein Gerät nicht.</p></section>'+
 '<section class="sec"><div class="sec-h"><h2>Datenprüfung</h2><button class="link" data-act="check-data">Erneut prüfen</button></div><div class="card">'+
 (iss.length?'<p style="color:var(--fg)">'+iss.length+(iss.length===1?' Auffälligkeit':' Auffälligkeiten')+' gefunden. Es wurde nichts verändert.</p><ul class="issues">'+iss.slice(0,10).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+(iss.length>10?'<li>… und '+(iss.length-10)+' weitere</li>':'')+'</ul>':'<p style="color:var(--fg)">Keine Auffälligkeiten. Alle Verweise zeigen auf vorhandene Datensätze.</p>')+'</div></section>'+
 '<section class="sec"><h2>Automatische Sicherungen ('+Repo.backups.length+')</h2>'+
 (Repo.backups.length?Repo.backups.map(function(b){return '<div class="card bk"><div><b>'+fmtSaved(b.at)+'</b><small>'+esc(b.reason)+'</small><small>'+bkCounts(b.counts)+'</small></div><button class="btn" data-act="restore-backup" data-id="'+esc(b.id)+'">Wiederherstellen</button></div>'}).join(''):'<p class="note">Noch keine Sicherung. Vor jedem Import, Zurücksetzen, Löschen und Wiederherstellen wird automatisch eine angelegt (die letzten '+MAX_BACKUPS+' bleiben erhalten).</p>')+'</section>'+
 '<section class="sec"><h2>Export</h2><button class="btn block" data-act="export">Vollständigen Export (JSON) anzeigen</button><textarea class="mono" id="exp" readonly hidden aria-label="Export"></textarea><button class="btn block" id="expCopy" data-act="copy-export" hidden>'+ic('copy',18)+'JSON kopieren</button><p class="note">Der Export enthält Einträge, Quellen, Karten, Verknüpfungen und X-Beiträge. Der Download als Datei folgt in Etappe 2.</p></section>'+
 '<section class="sec" id="sec-import"><h2>Import</h2><textarea class="mono" id="imp" placeholder="JSON hier einfügen" aria-label="Import"></textarea><input type="file" id="impFile" accept=".json,application/json,text/plain" aria-label="JSON-Datei wählen"><button class="btn block" data-act="import">Prüfen und importieren</button><p class="note">Hier kannst du den Export aus Version 2 einfügen. Die Struktur wird geprüft, bevor etwas geändert wird. Ein ausführlicher Migrationsassistent folgt in Etappe 2.</p></section>'+
 '<section class="sec"><h2>X-Beiträge</h2><button class="btn block" data-act="new-post">'+ic('link',18)+'X-Beitrag erfassen</button>'+
 '<div class="card"><div class="meta"><b style="font-family:var(--f-display)">Android-Teilen</b><span class="chip st st-pruefung">Folgt in Etappe 4</span></div><p style="margin-top:8px">Teilen aus der X-App direkt nach DebateBase wird angebunden, sobald die App installierbar ist (Manifest und Service Worker). Bis dahin X-Beiträge bitte über „X-Beitrag erfassen“ einfügen.</p></div></section>'+
 '<section class="sec"><h2>Zurücksetzen</h2><button class="btn block" data-act="reset-sample">Beispieldaten wiederherstellen</button><button class="btn block danger" data-act="wipe">Alle Daten löschen</button></section>'+
 '<p class="note">DebateBase '+esc(APP_VERSION)+'. Installation, Offline-Betrieb und Teilen folgen in den nächsten Etappen. Beispieldaten dienen nur zur Demonstration, bitte Fakten vor der Verwendung selbst prüfen.</p>'}
function paintUsage(){var el=$('#usage');if(!el)return;DB.estimate().then(function(e){if(!el.isConnected)return;el.textContent=e&&e.usage!=null?(e.usage/1048576).toFixed(2).replace('.',',')+' MB':'Unbekannt'})}

/* ================= Zusätzliche Ereignisse ================= */
document.addEventListener('change',function(ev){var i=ev.target.id;
 if(i==='f-type')toggleExtra();
 else if(i==='lk-type'||i==='lk-dir'||i==='lk-partner')updateLinkPreview();
 else if(i==='p-text')splitShared()});
document.addEventListener('paste',function(ev){if(ev.target.id==='p-text')setTimeout(splitShared,0)});
document.addEventListener('input',function(ev){if(ev.target.id==='dg-word'){$('#dg-go').disabled=ev.target.value.trim().toUpperCase()!==ev.target.dataset.word}});
function splitShared(){var t=$('#p-text'),u=$('#p-url');if(!t||!u||u.value.trim())return;var s=parseShared(t.value);if(s.url){u.value=s.url;t.value=s.text;toast('Link erkannt und abgetrennt')}}

/* ---------- Karten ---------- */
function entryCard(e){
 return '<article class="card" role="button" tabindex="0" data-act="open-entry" data-id="'+esc(e.id)+'"><div class="meta"><span class="chip">'+esc(TYPES[e.type]||e.type)+'</span>'+stChip(e.status)+'</div><h3>'+esc(e.title)+'</h3>'+((e.description||e.claimCore)?'<p class="clamp">'+esc(e.description||e.claimCore)+'</p>':'')+
 '<div class="foot">'+linkBadge('entries',e.id)+(e.topic?'<span>'+esc(e.topic)+'</span>':'')+(e.tags||[]).slice(0,3).map(function(t){return '<span class="chip tag">'+esc(t)+'</span>'}).join('')+'</div></article>'}
function argCard(a){
 return '<article class="card" role="button" tabindex="0" data-act="open-arg" data-id="'+esc(a.id)+'"><div class="meta">'+stChip(a.status)+(a.topic?'<span class="chip">'+esc(a.topic)+'</span>':'')+'</div><h3>'+esc(a.title)+'</h3>'+
 '<div class="cols"><div class="pane pro"><small>Behauptung</small><span class="clamp" style="-webkit-line-clamp:2">'+esc(a.claim)+'</span></div><div class="pane con"><small>Gegenargument</small><span class="clamp" style="-webkit-line-clamp:3">'+esc(a.counter)+'</span></div></div>'+(linksOf('args',a.id).length?'<div class="foot">'+linkBadge('args',a.id)+'</div>':'')+'</article>'}
function srcCard(s){
 var n=citedBy(s.id).length;
 return '<article class="card" role="button" tabindex="0" data-act="open-source" data-id="'+esc(s.id)+'"><div class="meta"><span class="chip">'+esc(s.kind)+'</span>'+(s.year?'<span class="chip tag">'+esc(s.year)+'</span>':'')+'</div><h3>'+esc(s.title)+'</h3><p>'+esc(s.publisher||'')+'</p><div class="foot"><span>Zitiert in '+n+(n===1?' Eintrag':' Einträgen')+'</span></div></article>'}
function empty(t){return '<div class="empty">'+t+'</div>'}

/* ---------- Dashboard ---------- */
function isEmptyDb(){return COLS.every(function(c){return !Repo.all(c).length})}
function welcomeCard(){
 if(!Repo.ready)return '<div class="card alert"><h3>Speichern nicht möglich</h3><p>'+esc(Repo.error||'Die Datenbank konnte nicht geöffnet werden.')+' Änderungen gehen beim Schließen verloren. Bitte die Seite in Chrome (nicht im Inkognito-Modus) öffnen.</p></div>';
 if(!isEmptyDb())return '';
 return '<div class="card welcome"><h3>Willkommen bei DebateBase 3</h3><p>Deine Datenbank auf diesem Gerät ist noch leer. Übernimm deine Daten aus Version 2 oder schau dich mit Beispieldaten um.</p>'+
 '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="goto-import">Daten aus Version 2 übernehmen</button><button class="btn" data-act="load-sample">Beispieldaten laden</button></div></div>'}
function viewDashboard(){
 var E=Repo.all('entries'),S=Repo.all('sources'),A=Repo.all('args');
 var open=E.filter(function(e){return e.type==='frage'||e.status==='pruefung'}).sort(function(a,b){return (b.updated||0)-(a.updated||0)});
 var recent=[].concat(E.map(function(o){return {k:'Wissen',a:'open-entry',o:o,t:o.created}}),S.map(function(o){return {k:'Quelle',a:'open-source',o:o,t:o.created}}),A.map(function(o){return {k:'Argument',a:'open-arg',o:o,t:o.created}})).sort(function(a,b){return b.t-a.t}).slice(0,6);
 var cnt={};E.forEach(function(e){cnt[e.status]=(cnt[e.status]||0)+1});
 var keys=Object.keys(STATUS).filter(function(k){return cnt[k]});
 return welcomeCard()+'<div class="tiles"><button class="tile" data-go="wissen"><b>'+E.length+'</b><span>Wissens&shy;einträge</span></button><button class="tile" data-go="quellen"><b>'+S.length+'</b><span>Quellen</span></button><button class="tile" data-go="argumente"><b>'+A.length+'</b><span>Argumentations&shy;karten</span></button></div><p class="note" style="margin-top:-8px">'+Repo.all('links').length+' Verknüpfungen · '+Repo.all('posts').length+' X-Beiträge</p>'+
 '<section class="sec"><h2>Neu anlegen</h2><div class="actions"><button class="btn primary" data-act="new-entry">'+ic('plus',18)+'Neuer Eintrag</button><button class="btn" data-act="new-source">'+ic('plus',18)+'Neue Quelle</button><button class="btn" data-act="new-arg">'+ic('plus',18)+'Neue Karte</button><button class="btn" data-act="new-research">'+ic('search',18)+'Neue Recherche</button><button class="btn block" style="grid-column:1/-1" data-act="new-post">'+ic('link',18)+'X-Beitrag erfassen</button></div></section>'+
 '<section class="sec"><div class="sec-h"><h2>Offene Recherchen ('+open.length+')</h2></div>'+(open.length?open.map(function(e){return '<button class="row" data-act="open-entry" data-id="'+esc(e.id)+'"><div><b>'+esc(e.title)+'</b><small>'+esc(TYPES[e.type]||e.type)+(e.topic?' · '+esc(e.topic):'')+'</small></div>'+stChip(e.status)+'</button>'}).join(''):empty('Keine offenen Recherchen. Offene Fragen und Einträge „In Prüfung“ erscheinen hier.'))+'</section>'+
 (recent.length?'<section class="sec"><h2>Zuletzt hinzugefügt</h2>'+recent.map(function(r){return '<button class="row" data-act="'+r.a+'" data-id="'+esc(r.o.id)+'"><span class="kind">'+r.k+'</span><div><b>'+esc(r.o.title)+'</b><small>'+rel(r.t)+'</small></div></button>'}).join('')+'</section>':'')+
 (keys.length?'<section class="sec"><h2>Prüfstatus der Einträge</h2><div class="bar" role="img" aria-label="Verteilung der Prüfstatus">'+keys.map(function(k){return '<span style="flex:'+cnt[k]+';--c:var(--st-'+k+')"></span>'}).join('')+'</div><div class="legend">'+keys.map(function(k){return '<button class="chip st st-'+k+'" data-act="goto-status" data-v="'+k+'">'+STATUS[k]+' '+cnt[k]+'</button>'}).join('')+'</div></section>':'')}

/* ---------- Wissensbibliothek ---------- */
function viewLibrary(){
 var topics=allTopics();
 return '<div class="toolbar"><label class="search">'+ic('search',18)+'<input id="q" type="search" placeholder="Titel, Beschreibung, Tags suchen" value="'+esc(ui.q)+'" autocomplete="off" aria-label="Suche"></label>'+
 '<div class="chips" id="stChips"></div>'+
 '<div class="filters"><select class="sel" id="fType" aria-label="Inhaltstyp">'+opts(TYPES,ui.type,'Alle Typen')+'</select><select class="sel" id="fTopic" aria-label="Themengebiet">'+arrOpts(topics,ui.topic,'Alle Themen')+'</select><select class="sel" id="fSort" aria-label="Sortierung"><option value="neu"'+(ui.sort==='neu'?' selected':'')+'>Neueste</option><option value="geaendert"'+(ui.sort==='geaendert'?' selected':'')+'>Geändert</option><option value="titel"'+(ui.sort==='titel'?' selected':'')+'>A bis Z</option></select></div>'+
 '<div class="resultline"><span id="count"></span><button class="link" data-act="reset-filters">Filter zurücksetzen</button></div></div><div id="list" class="stack"></div>'+
 '<button class="fab" data-act="new-entry" aria-label="Neuer Eintrag">'+ic('plus',22)+'Neu</button>'}
function paintStChips(){var el=$('#stChips');if(!el)return;var all=[['','Alle']].concat(Object.keys(STATUS).map(function(k){return [k,STATUS[k]]}));el.innerHTML=all.map(function(p){return '<button data-act="f-status" data-v="'+p[0]+'" aria-pressed="'+(ui.status===p[0])+'">'+p[1]+'</button>'}).join('')}
function paintList(){
 var L=Repo.all('entries').filter(function(e){
  if(ui.type&&e.type!==ui.type)return false;if(ui.topic&&e.topic!==ui.topic)return false;if(ui.status&&e.status!==ui.status)return false;
  return !ui.q||matches([e.title,e.description,e.topic,(e.tags||[]).join(' '),TYPES[e.type],STATUS[e.status],e.claimCore,e.reason,e.evidence,e.limits,e.conclusion,linkText('entries',e.id)].join(' '),ui.q)});
 L.sort(function(a,b){return ui.sort==='titel'?a.title.localeCompare(b.title,'de'):ui.sort==='geaendert'?(b.updated||0)-(a.updated||0):(b.created||0)-(a.created||0)});
 $('#list').innerHTML=L.length?L.map(entryCard).join(''):empty(Repo.all('entries').length?'Keine Einträge gefunden. Passe Suche oder Filter an.':'Noch keine Einträge. Tippe auf „Neu“, um den ersten anzulegen.');
 $('#count').textContent=L.length+' von '+Repo.all('entries').length+' Einträgen';paintStChips()}

/* ---------- Argumente ---------- */
function viewArgs(){return '<label class="search">'+ic('search',18)+'<input id="aq" type="search" placeholder="Karten durchsuchen" value="'+esc(ui.aq)+'" autocomplete="off" aria-label="Suche"></label><div id="alist" class="stack"></div><button class="fab" data-act="new-arg" aria-label="Neue Karte">'+ic('plus',22)+'Neu</button>'}
function paintArgs(){var L=Repo.all('args').filter(function(a){return !ui.aq||matches([a.title,a.claim,a.counter,a.topic,STATUS[a.status],linkText('args',a.id)].join(' '),ui.aq)});
 $('#alist').innerHTML=L.length?L.map(argCard).join(''):empty('Keine Argumentationskarten gefunden.')}

/* ---------- Quellen ---------- */
function viewSources(){return '<div class="toolbar"><label class="search">'+ic('search',18)+'<input id="sq" type="search" placeholder="Quellen durchsuchen" value="'+esc(ui.sq)+'" autocomplete="off" aria-label="Suche"></label><select class="sel" id="sKind" aria-label="Art">'+arrOpts(SKINDS,ui.skind,'Alle Arten')+'</select></div><div id="slist" class="stack"></div><button class="fab" data-act="new-source" aria-label="Neue Quelle">'+ic('plus',22)+'Neu</button>'}
function paintSources(){var L=Repo.all('sources').filter(function(s){return (!ui.skind||s.kind===ui.skind)&&(!ui.sq||matches([s.title,s.publisher,s.year,s.kind,s.note].join(' '),ui.sq))});
 $('#slist').innerHTML=L.length?L.map(srcCard).join(''):empty('Keine Quellen gefunden.')}

/* ---------- Diskussionsmodus ---------- */
function viewDisc(){
 var cnt={};Repo.all('entries').forEach(function(e){(e.tags||[]).forEach(function(t){cnt[t]=(cnt[t]||0)+1})});
 var top=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,8);
 return '<label class="search">'+ic('search',18)+'<input id="dq" type="search" placeholder="Stichwort aus der Diskussion" value="'+esc(ui.dq)+'" autocomplete="off" aria-label="Schnellsuche"></label>'+
 '<div class="chips"><button data-act="disc-only" aria-pressed="'+ui.donly+'">Nur belegte Einträge</button>'+top.map(function(t){return '<button data-act="disc-tag" data-v="'+esc(t)+'" aria-pressed="false">'+esc(t)+'</button>'}).join('')+'</div><button class="btn block" data-act="new-post">'+ic('link',18)+'X-Beitrag erfassen</button><div id="dres" class="stack"></div>'}
function paintDisc(){
 var q=ui.dq.trim(),el=$('#dres');
 if(!q){el.innerHTML=empty('Gib ein Stichwort ein oder tippe auf einen Tag. Treffer lassen sich mit einem Tipp als Text für X kopieren.')+postsSection();return}
 var ok=function(s){return !ui.donly||s==='belegt'};
 var E=Repo.all('entries').filter(function(e){return ok(e.status)&&matches([e.title,e.description,e.topic,(e.tags||[]).join(' '),e.claimCore,e.reason,e.evidence,e.limits,e.conclusion,linkText('entries',e.id)].join(' '),q)});
 var A=Repo.all('args').filter(function(a){return ok(a.status)&&matches([a.title,a.claim,a.counter,a.topic,linkText('args',a.id)].join(' '),q)});
 var h='';
 if(E.length)h+='<h2>Wissen ('+E.length+')</h2>'+E.map(function(e){return '<article class="card"><div class="meta"><span class="chip">'+esc(TYPES[e.type]||e.type)+'</span>'+stChip(e.status)+'</div><h3>'+esc(e.title)+'</h3><p class="clamp">'+esc(e.description)+'</p><div class="btns" style="margin-top:10px"><button class="btn" data-act="copyx" data-k="entries" data-id="'+esc(e.id)+'">'+ic('copy',18)+'Für X kopieren</button><button class="btn" data-act="open-entry" data-id="'+esc(e.id)+'">Öffnen</button></div></article>'}).join('');
 if(A.length)h+='<h2>Argumente ('+A.length+')</h2>'+A.map(function(a){return '<article class="card"><div class="meta">'+stChip(a.status)+'</div><h3>'+esc(a.title)+'</h3><div class="cols"><div class="pane con"><small>Gegenargument</small><span class="clamp">'+esc(a.counter)+'</span></div></div><div class="btns" style="margin-top:10px"><button class="btn" data-act="copyx" data-k="args" data-id="'+esc(a.id)+'">'+ic('copy',18)+'Für X kopieren</button><button class="btn" data-act="open-arg" data-id="'+esc(a.id)+'">Öffnen</button></div></article>'}).join('');
 var P=Repo.all('posts').filter(function(p){return matches([p.text,p.url,p.handle,p.topic,p.note].join(' '),q)});if(P.length)h+='<h2>X-Beiträge ('+P.length+')</h2>'+P.map(postCard).join('');
 if(!h)h=empty('Nichts zu „'+esc(q)+'“ gefunden.');
 h+='<button class="btn block" data-act="disc-save">'+ic('plus',18)+'Als neuen Eintrag speichern</button>';
 el.innerHTML=h}

/* ---------- Darstellung ---------- */
function applyTheme(){var r=document.documentElement,t=Repo.db.settings.theme;if(t==='hell')r.setAttribute('data-theme','light');else if(t==='dunkel')r.setAttribute('data-theme','dark');else r.removeAttribute('data-theme');
 var dark=t==='dunkel'||(t==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);$('#themeBtn').innerHTML=ic(dark?'sun':'moon',22);
 document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content',dark?'#0B1118':'#F1F4F9');m.removeAttribute('media')})}

/* ---------- Render ---------- */
function render(){
 var R=ROUTES.filter(function(r){return r[0]===ui.route})[0]||ROUTES[0];
 $('#title').textContent=R[1];$('#sub').textContent=R[4];document.title='DebateBase – '+R[1];updateSaved();
 $('#nav').innerHTML='<div>'+ROUTES.map(function(r){return '<a href="#'+r[0]+'" aria-label="'+r[1]+'"'+(r[0]===ui.route?' aria-current="page"':'')+'>'+ic(r[3],22)+'<span>'+r[2]+'</span></a>'}).join('')+'</div>';
 var v={dashboard:viewDashboard,wissen:viewLibrary,argumente:viewArgs,quellen:viewSources,diskussion:viewDisc,einstellungen:viewSettings}[R[0]];
 $('#view').innerHTML=v();
 if(R[0]==='wissen')paintList();if(R[0]==='argumente')paintArgs();if(R[0]==='quellen')paintSources();if(R[0]==='diskussion')paintDisc();
 if(R[0]==='einstellungen'){paintUsage();if(ui.focusImport){ui.focusImport=false;var s=$('#sec-import');if(s){s.scrollIntoView({block:'start'});$('#imp').focus({preventScroll:true})}}}
 applyTheme()}
function route(){var h=location.hash.slice(1);ui.route=ROUTES.some(function(r){return r[0]===h})?h:'dashboard';closeSheet();render();if(!ui.focusImport)window.scrollTo(0,0)}

/* ---------- Ereignisse ---------- */
function delDone(kind,id,msg){var c={entry:'entries',source:'sources',arg:'args'}[kind];Repo.remove(c,id).then(function(){closeSheet();render();toast(msg)})}
document.addEventListener('click',function(ev){
 var go=ev.target.closest('[data-go]');if(go){location.hash=go.dataset.go;return}
 if(ev.target.id==='overlay'){closeSheet();return}
 var b=ev.target.closest('[data-act]');if(!b)return;
 var a=b.dataset.act,id=b.dataset.id,v=b.dataset.v;
 switch(a){
  case 'close':closeSheet();break;
  case 'toggle-theme':var cur=document.documentElement.getAttribute('data-theme');var dark=cur?cur==='dark':matchMedia('(prefers-color-scheme: dark)').matches;Repo.setSetting('theme',dark?'hell':'dunkel');applyTheme();if(ui.route==='einstellungen')render();break;
  case 'set-theme':Repo.setSetting('theme',v);render();break;
  case 'new-entry':entryForm(null,ui.route==='wissen'&&ui.topic?{topic:ui.topic}:null);break;
  case 'new-research':entryForm(null,{type:'frage',status:'pruefung'});break;
  case 'new-source':sourceForm();break;
  case 'new-arg':argForm();break;
  case 'open-entry':entryDetail(id);break;
  case 'open-source':sourceDetail(id);break;
  case 'open-arg':argDetail(id);break;
  case 'edit-entry':entryForm(id);break;
  case 'edit-source':sourceForm(id);break;
  case 'edit-arg':argForm(id);break;
  case 'del-entry':if(armed(b))delDone('entry',id,'Eintrag gelöscht');break;
  case 'del-source':if(armed(b))delDone('source',id,'Quelle gelöscht');break;
  case 'del-arg':if(armed(b))delDone('arg',id,'Karte gelöscht');break;
  case 'copyx':copy(xText(b.dataset.k,Repo.get(b.dataset.k,id)),'Text für X kopiert');break;
  case 'addtag':var ti=$('#f-tags');ti.value=(ti.value.trim()?ti.value.trim().replace(/,$/,'')+', ':'')+v;b.remove();break;
  case 'f-status':ui.status=v;paintList();break;
  case 'reset-filters':ui.q=ui.type=ui.topic=ui.status='';ui.sort='neu';render();break;
  case 'goto-status':ui.status=v;ui.q=ui.type=ui.topic='';location.hash='wissen';if(ui.route==='wissen')render();break;
  case 'disc-only':ui.donly=!ui.donly;b.setAttribute('aria-pressed',ui.donly);paintDisc();break;
  case 'disc-tag':ui.dq=v;$('#dq').value=v;paintDisc();break;
  case 'disc-save':entryForm(null,{title:ui.dq.trim()});break;
  case 'export':var x=$('#exp');x.value=JSON.stringify(buildExport(),null,2);x.hidden=false;$('#expCopy').hidden=false;x.focus();x.select();break;
  case 'copy-export':copy($('#exp').value,'Export kopiert');break;
  case 'import':doImport();break;
  case 'confirm-import':applyImport();break;
  case 'reset-sample':dangerSheet('reset');break;
  case 'wipe':dangerSheet('wipe');break;
  case 'do-danger':doDanger(v);break;
  case 'restore-backup':if(armed(b,'Sicher? Tippen'))restoreBackup(id);break;
  case 'check-data':render();toast('Datenprüfung abgeschlossen');break;
  case 'goto-import':ui.focusImport=true;if(ui.route==='einstellungen')render();else location.hash='einstellungen';break;
  case 'load-sample':if(isEmptyDb())Repo.replace(seed()).then(function(){render();toast('Beispieldaten geladen')});break;
  case 'new-post':postForm();break;
  case 'open-post':postDetail(id);break;
  case 'edit-post':postForm(id);break;
  case 'del-post':if(armed(b)){Repo.remove('posts',id).then(function(){closeSheet();render();toast('Beitrag gelöscht')})}break;
  case 'post-entry':closeSheet();postToEntry(id,v);break;
  case 'open-item':openItem(b.dataset.k,id);break;
  case 'new-link':linkForm(null,b.dataset.ck,b.dataset.cid);break;
  case 'edit-link':linkForm(id,b.dataset.ck,b.dataset.cid);break;
  case 'back-item':openItem(b.dataset.ck,b.dataset.cid);break;
  case 'del-link':if(armed(b,'Löschen?')){var ck=b.dataset.ck,cid=b.dataset.cid;Repo.remove('links',id).then(function(){render();openItem(ck,cid);toast('Verknüpfung gelöscht')})}break;
 }});
document.addEventListener('keydown',function(ev){
 if(ev.key==='Escape'&&!$('#overlay').hidden){closeSheet();return}
 if((ev.key==='Enter'||ev.key===' ')&&ev.target.getAttribute&&ev.target.getAttribute('role')==='button'){ev.preventDefault();ev.target.click()}});
document.addEventListener('input',function(ev){var i=ev.target.id;
 if(i==='q'){ui.q=ev.target.value;paintList()}else if(i==='aq'){ui.aq=ev.target.value;paintArgs()}else if(i==='sq'){ui.sq=ev.target.value;paintSources()}else if(i==='dq'){ui.dq=ev.target.value;paintDisc()}});
document.addEventListener('change',function(ev){var i=ev.target.id,v=ev.target.value;
 if(i==='fType'){ui.type=v;paintList()}else if(i==='fTopic'){ui.topic=v;paintList()}else if(i==='fSort'){ui.sort=v;paintList()}else if(i==='sKind'){ui.skind=v;paintSources()}
 else if(i==='impFile'&&ev.target.files[0]){var r=new FileReader();r.onload=function(){$('#imp').value=String(r.result);toast('Datei geladen. Jetzt „Prüfen und importieren“ tippen.')};r.onerror=function(){toast('Datei konnte nicht gelesen werden',true)};r.readAsText(ev.target.files[0])}});
document.addEventListener('submit',function(ev){ev.preventDefault();var f=ev.target,k=f.dataset.form;if(k==='entry')saveEntry(f);else if(k==='source')saveSource(f);else if(k==='arg')saveArg(f);else if(k==='link')saveLink(f);else if(k==='post')savePost(f,ev.submitter&&ev.submitter.value)});
window.addEventListener('hashchange',route);
/* Speicherfehler wurden bereits angezeigt; nicht zusätzlich als unbehandelt melden. */
window.addEventListener('unhandledrejection',function(ev){if(ev.reason&&ev.reason.shown)ev.preventDefault()});
if(window.matchMedia)try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(Repo.db)applyTheme()})}catch(e){}

/* ---------- Start ---------- */
DB.onBlocked=function(){toast('Bitte andere geöffnete DebateBase-Tabs schließen.',true)};
DB.onVersionChange=function(){Repo.ready=false;updateSaved();toast('Eine neue Version ist aktiv. Bitte die App neu laden.',true)};
Repo.load().then(function(){
 updateSaved();route();
 var iss=Repo.ready?checkIntegrity():[];
 if(iss.length)toast('Datenprüfung: '+iss.length+' Auffälligkeiten, siehe Einstellungen',true);
 return DB.requestPersist().then(function(p){Repo.persisted=p;if(ui.route==='einstellungen')render()});
});
/* Für automatische Tests */
window.DebateBase={Repo:Repo,checkIntegrity:checkIntegrity,buildExport:buildExport,version:APP_VERSION};
})();
