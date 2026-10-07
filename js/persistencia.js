/* Datos guardados en el navegador: Salón de la fama, partida, bote por mesa, tabla de líderes, avisos y celebraciones.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
let HOF=[];
try{HOF=JSON.parse(localStorage.getItem('bj-hof')||'[]')}catch(e){}
if(!Array.isArray(HOF))HOF=[];
function renderHof(){
  const ol=$('hof');ol.textContent='';
  if(!HOF.length){const li=document.createElement('li');li.innerHTML='<span class="none">Nadie lo ha ganado aún</span>';ol.appendChild(li);return}
  for(const w of HOF){ // textContent: el nombre nunca se interpreta como HTML
    const li=document.createElement('li'),n=document.createElement('span'),a=document.createElement('em');
    n.textContent='★ '+w.n;a.textContent=fmt(w.a)+' · '+(w.t?w.t+' · ':'')+w.d;li.append(n,a);ol.appendChild(li);
  }
}
const winQueue=[];
function askWinner(amt){winQueue.push(amt);if($('nameModal').hidden)showNameModal()}
function showNameModal(){
  if(!winQueue.length)return;
  $('nameIn').value='';$('nameModal').hidden=false;setTimeout(()=>$('nameIn').focus(),50);
}
function saveWinner(){
  if(!winQueue.length)return;
  const name=$('nameIn').value.trim().slice(0,24);
  if(!name){$('nameIn').focus();return}
  const amt=winQueue.shift();
  HOF.unshift({n:name,a:amt,t:T().name,d:new Date().toLocaleDateString('es')});
  try{localStorage.setItem('bj-hof',JSON.stringify(HOF))}catch(e){}
  $('nameModal').hidden=true;renderHof();sfx('bonus');
  if(winQueue.length)setTimeout(showNameModal,400);
}
document.addEventListener('click',e=>{if(e.target.id==='nameGo')saveWinner()});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='nameIn')saveWinner()});

/* ---------- guardar partida y tabla de líderes (todo se guarda en este navegador) ---------- */
const LS={
  get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
const BOARD_MIN_ROUNDS=20;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let SAVED=LS.get('bj-save');
if(!SAVED||SAVED.v!==1||!Array.isArray(SAVED.shoe)||!SAVED.stats)SAVED=null;
/* bote progresivo de cada mesa: se conserva entre partidas y solo vuelve a su base cuando alguien lo gana */
const POTS=(()=>{const p=LS.get('bj-pots');return p&&typeof p==='object'?p:{}})();
const savePot=()=>{POTS[S.table]=S.pot;LS.set('bj-pots',POTS)};
/* Panel de premios exclusivos de la mesa (impreso en el paño) */
function prizeRows(t){
  const row=(a,b)=>`<div><span>${a}</span><i></i><b>${b}</b></div>`,rows=[];
  const has=id=>t.prizes.includes(id);
  rows.push(row('Blackjack','3 : 2'));
  if(t.jokers)rows.push(row(`Joker comodín (${t.jokers} en el zapato)`,'= Blackjack'));
  if(has('b678'))rows.push(row('6-7-8 · mismo palo',`${B678[0]} : 1 · ${B678[1]} : 1`));
  if(has('b777'))rows.push(row('7-7-7 · mismo palo',`${B777[0]} : 1 · ${B777[1]} : 1`));
  if(has('siesta'))rows.push(row('Siesta · 21 y dealer 22',`+${SIESTA} : 1`));
  if(has('doble007'))rows.push(row('Doble 007 · dos manos 7-7',`${DOBLE007} : 1`));
  if(has('rueda'))rows.push(row('Rueda de la fortuna · tras un Blackjack','giro gratis hasta x25'));
  if(has('doble'))rows.push(row('Doble o nada tras ganar','rojo / negro'));
  if(has('reyreina'))rows.push(row('Rey y Reina del mismo palo',`${REYREINA} : 1`));
  if(has('lluvia'))rows.push(row('Lluvia de Oros · 5 rojas',`${LLUVIA} : 1`));
  if(has('palo21'))rows.push(row('Blackjack de palo',`${PALO21} : 1`));
  if(has('bKA'))rows.push(row('K-A de picas',`${BONUS_KA} : 1`));
  if(has('picas21'))rows.push(row('21 de Picas',`${PICAS21} : 1`));
  for(const [n,m] of Object.entries(t.cnt))rows.push(row(`21 con ${n}${+n>=8?'+':''} cartas`,`${m} : 1`));
  return rows.join('');
}
function renderPrizes(t){const p=$('prizePanel');if(p)p.innerHTML=`<h4>Premios de ${t.name}</h4>${prizeRows(t)}`}
function headerTable(id){
  const t=TABLES[id]||TABLES.caracas,sub=document.querySelector('h1 small');
  document.body.dataset.table=t.id;renderPrizes(t);
  if(sub)sub.textContent=`MESA ${t.name.toUpperCase()} · PAGA 3:2`;
  const sr=$('surrRule'); // el mínimo de $10 para rendirse solo importa donde se puede apostar menos (Caracas, desde $5)
  if(sr)sr.textContent=t.min<SURR_MIN?`Rendición · apuesta de ${fmt(SURR_MIN)} o más`:'Rendición permitida';
  const lim=$('arcLimits'); // los límites van impresos en el paño, debajo de "El blackjack paga 3 a 2"
  const limTxt=`MESA ${t.name.toUpperCase()} · APUESTA ${fmt(t.min)} – ${fmt(t.max)} · SIDEBETS ${fmt(t.chips[0])} – ${fmt(t.max/10)}`;
  if(lim)lim.textContent=limTxt;
  const lm=$('limitsM');if(lm)lm.textContent=limTxt; // en el celular el texto del paño se muestra como línea normal (el SVG se vería diminuto)
}
function applyTable(){ // deja lista la mesa de la sesión: tema, fichas disponibles y bote
  const t=T();headerTable(t.id);
  if(!t.chips.includes(S.chip))S.chip=t.chips.includes(25)?25:t.chips[1];
  S.pot=POTS[t.id]>=t.seed?POTS[t.id]:t.seed;
}
function pickTable(id){ // en la pantalla de inicio: solo vista previa (tema y rangos), la sesión en curso no cambia de mesa
  if(!TABLES[id])return;S.pick=id;S.boardTable=id;headerTable(id);$('cut').innerHTML='';render();
}
function saveGame(){
  if(!S.started||!S.stats)return;
  const pend=S.phase==='bet'?tableBet():0; // las apuestas sin repartir se devuelven al guardar
  LS.set('bj-save',{v:1,t:Date.now(),table:S.table,balance:S.balance+pend,bank:S.bank,initial:S.initial,rebuys:S.rebuys,nHands:S.nHands,chip:S.chip,
    stats:S.stats,ratings:S.ratings,sbProfit:S.sbProfit,shoe:S.shoe.map(c=>c.r+c.s),count:S.count,seen:S.seen,seenRank:S.seenRank,needCut:S.needCut,cutReached:!!S.cutReached});
}
function loadGame(){
  const d=SAVED;if(!d)return;
  S.balance=d.balance;S.bank=d.bank;S.initial=d.initial;S.rebuys=d.rebuys||0;S.nHands=d.nHands||2;S.chip=d.chip||25;
  S.stats=d.stats;S.ratings=d.ratings||[];S.sbProfit=d.sbProfit||0;S.log=[];
  S.shoe=d.shoe.map(x=>({r:x.slice(0,-1),s:x.slice(-1)}));
  S.count=d.count||0;S.seen=d.seen||{low:0,mid:0,high:0};S.seenRank=d.seenRank||{};S.needCut=!!d.needCut;S.cutReached=!!d.cutReached;
  S.table=TABLES[d.table]?d.table:'caracas';S.pick=S.table;S.boardTable=S.table;applyTable();
  S.started=true;S.dealer=[];S.cur=null;S.dec=[];S.rate=null;mkSpots();
  SAVED=null;resumeGame();
}
/* La tabla no depende del dinero: compara RENDIMIENTO en unidades (ganancia ÷ apuesta promedio) y CALIFICACIÓN promedio, por liga de saldo inicial */
const avgBetOf=st=>st&&st.betN?st.betSum/st.betN:0;
const unitsOf=(res,st)=>avgBetOf(st)?res/avgBetOf(st):0;
const avgRating=()=>S.ratings.length?Math.round(S.ratings.reduce((a,b)=>a+b,0)/S.ratings.length):0;
function boardHTML(tab,n,hl){
  const raw=LS.get('bj-board'),all=(Array.isArray(raw)?raw:[]).filter(e=>typeof e.u==='number'&&typeof e.avg==='number');
  const key=tab==='avg'?'avg':'u',tb=TABLES[S.boardTable]?S.boardTable:S.table; // cada mesa tiene su propia tabla
  const list=all.filter(e=>e.tbl===tb).sort((a,b)=>b[key]-a[key]).slice(0,n);
  const tabs=`<div class="lbtabs"><button class="lbt ${key==='u'?'on':''}" data-lb="u">Mejor rendimiento</button><button class="lbt ${key==='avg'?'on':''}" data-lb="avg">Mejor calificación</button></div>`;
  // la tabla siempre es la de la mesa elegida (en el inicio, la que marques; en el resumen, la de tu sesión)
  const head=`<h5><i class="sw sw-${tb}"></i>Tabla de líderes · Mesa ${TABLES[tb].name}</h5>`;
  if(!list.length)return`${head}${tabs}<p class="lbnone">Aún no hay resultados en la mesa ${TABLES[tb].name}. Termina una sesión de ${BOARD_MIN_ROUNDS}+ rondas para entrar.</p>`;
  return`${head}${tabs}<table class="lb"><tr><th>#</th><th>Jugador</th><th>Rendimiento</th><th>Calificación</th><th>Rondas</th><th>Saldo inicial</th></tr>`+
    list.map((e,i)=>`<tr class="${e.id===hl?'me':''}" title="${esc(e.d||'')}"><td>${i+1}</td><td>${esc(e.n)}</td><td class="${e.u>=0?'pos':'neg'}">${e.u>=0?'+':''}${e.u.toFixed(1)} u</td><td>${e.avg}</td><td>${e.rounds}</td><td>${fmt(e.bank0||0)}</td></tr>`).join('')+
    `</table><p class="lbnote">Rendimiento = ganancia ÷ apuesta promedio (en unidades). Calificación = promedio de 1 a 100 según la estrategia básica. Mínimo ${BOARD_MIN_ROUNDS} rondas.</p>`;
}
function saveToBoard(){
  const name=($('lbName').value||'').trim().slice(0,20);
  if(!name){$('lbName').focus();return}
  const res=S.balance-S.bank;
  const e={id:Date.now(),n:name,res,u:Math.round(unitsOf(res,S.stats)*100)/100,avg:avgRating(),rounds:S.stats.rounds,bank0:S.initial,tbl:S.table,d:new Date().toLocaleDateString('es')};
  const raw=LS.get('bj-board'),arr=Array.isArray(raw)?raw:[];arr.push(e);
  if(arr.length>300)arr.splice(0,arr.length-300);
  LS.set('bj-board',arr);LS.set('bj-name',name);
  S.sumSaved=true;S.hlId=e.id;buildSummary();
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='lbName')saveToBoard()});

/* ---------- avisos breves (joker del dealer, carta de corte…) ---------- */
let toastT;
function toast(msg){
  const t=$('toast');if(!t)return;
  t.textContent=msg;t.hidden=false;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},3600);
}
/* la carta de corte (Caracas) aparece junto al zapato cuando se llega al corte */
function placeCutCard(){
  const cc=$('cutCard'),sh=$('shoeEl');if(!cc||!sh)return;
  cc.className='cutcard '+(T().cutCard||'yellow'); // amarilla, morada o roja según la mesa
  cc.hidden=!(S.cutReached&&T().cutCard&&S.started&&S.phase!=='start'&&S.phase!=='summary');
  if(!cc.hidden){cc.style.left=(sh.offsetLeft-58)+'px';cc.style.top=(sh.offsetTop+12)+'px'}
}

/* ---------- celebración de premios grandes ---------- */
let celT;
function celebrate(level,title,amt){
  flashLights('big');S.bigPrize=true; // premio gordo: luces, fanfarria y celebración (el sonido normal de ganar/perder se omite)
  if(S.stats)S.boostUntil=S.stats.rounds+5; // un premio grande sube la música una etapa durante unas rondas
  if(level==='mega')setTimeout(()=>askWinner(amt),3800); // tras la celebración, se pide el nombre
  const el=$('celebrate');el.className=level;
  $('celKick').textContent=level==='mega'?'¡Premio mayor!':'¡Gran premio!';
  $('celTitle').textContent=title;$('celAmt').textContent='+'+fmt(amt);
  const colors=['#d8c898','#b89b5e','#f1ecda','#3f9c6d'];
  $('confetti').innerHTML=Array.from({length:level==='mega'?80:40},()=>
    `<i style="left:${Math.random()*100}%;animation-delay:${Math.random()*1.4}s;animation-duration:${2+Math.random()*2.2}s;background:${colors[Math.floor(Math.random()*4)]}"></i>`).join('');
  el.hidden=false;clearTimeout(celT);celT=setTimeout(()=>{el.hidden=true},level==='mega'?7000:4200);
}

/* ---------- sidebets ---------- */
