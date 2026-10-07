/* Interfaz: dibujado de la mesa, cartas, eventos de apuestas y pantalla de inicio / entrada a la mesa.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
const movedIds=new Set(),chipSeen=new Set(); // chipSeen: fichas de doble ya animadas
const cardState=new Map(); // id -> 'back' | 'up'; solo las cartas nuevas se animan
function cardHTML(c,hidden,sideways){
  const st=cardState.get(c.id);
  if(hidden){
    const fly=st===undefined?' fly':'';cardState.set(c.id,'back');if(fly)sfx('deal');
    return`<div class="card back${fly}"></div>`;
  }
  let anim=st===undefined?' fly':st==='back'?' flip':'';
  if(movedIds.has(c.id)){anim=' mv';movedIds.delete(c.id)} // carta que pasa a la nueva mano al dividir
  if(anim===' flip')sfx('flip');else if(anim)sfx('deal');
  if(st!=='up'){const v=hilo(c);S.count+=v;S.seen[v>0?'low':v<0?'high':'mid']++;S.seenRank[c.r]=(S.seenRank[c.r]||0)+1} // cuenta la carta al verse por primera vez
  cardState.set(c.id,'up');
  if(c.r==='JK')return`<div class="card joker${sideways?' rot':''}${anim}"><span>★</span><span>JOKER</span></div>`;
  return`<div class="card ${isRed(c.s)?'red':''}${sideways?' rot':''}${anim}"><span>${c.r}</span><span>${c.s}</span></div>`;
}
function render(){
  $('bal').textContent=fmt(S.balance);
  $('tot').textContent=fmt(tableBet());$('pot').textContent=fmt(S.pot);$('potFelt').textContent=fmt(S.pot);
  $('score').textContent=S.ratings.reduce((a,b)=>a+b,0).toLocaleString('en-US');
  $('shoe').textContent=S.shoe.length+' ('+Math.min(100,Math.round(S.shoe.length/SHOE_SIZE*100))+'%)';
  const fill=$('shoeFill');fill.style.width=Math.min(100,S.shoe.length/SHOE_SIZE*100)+'%';fill.classList.toggle('low',S.shoe.length<=CUT);
  const sp=$('sbp');sp.textContent=(S.sbProfit>=0?'+':'-')+fmt(Math.abs(S.sbProfit));sp.className=S.sbProfit>=0?'pos':'neg';
  // solo cuentan como "en juego" las apuestas aún sin resolver (los sidebets se resuelven al repartir)
  const risk=S.phase==='bet'?tableBet():S.phase==='play'?S.spots.reduce((a,s)=>a+s.hands.reduce((x,h)=>x+h.bet,0),0):0;
  const gain=S.balance+risk-S.bank,gt=$('gt');
  gt.textContent=(gain>=0?'+':'-')+fmt(Math.abs(gain));gt.className=gain>=0?'pos':'neg';
  $('msg').textContent=S.msg;
  $('tip').innerHTML=bonusTips().join('');
  $('rating').innerHTML=S.phase==='done'?ratingHTML():'';
  placeCutCard();
  // en el celular, con varias manos la página es larga: se lleva la vista a la mano que juega
  if(S.phase==='play'&&S.cur&&!S.busy&&innerWidth<=720){
    const key=S.cur.join('-');
    if(S._scrollKey!==key){S._scrollKey=key;setTimeout(()=>{const el=document.querySelector('.hand.cur');if(el)el.scrollIntoView({block:'center',behavior:'smooth'})},80)}
  }else if(S.phase!=='play')S._scrollKey=null;
  if(S.started&&(S.phase==='bet'||S.phase==='done'||S.phase==='cut'))saveGame(); // guardado automático entre rondas
  if($('strat').classList.contains('open'))renderPanel(); // el resaltado sigue a la mano actual
  const away=S.phase==='start'||S.phase==='summary';
  for(const id of ['homeBtn','endBtn']){$(id).style.display=away?'none':'';$(id).disabled=S.busy}
  const pre=S.phase==='cut'||S.phase==='start'||S.phase==='summary'||S.phase==='buyin';
  $('spots').style.display=pre?'none':'';$('felt').style.display=pre?'none':'';
  const nSp=S.spots.length,per=(innerWidth>720&&(innerWidth<900||matchMedia('(pointer:coarse)').matches))?150:112; // en pantallas táctiles grandes las manos son más anchas
  const needW=nSp*per+(nSp-1)*8+44; // ancho que pide la fila en U; si no cabe (iPad con muchas manos) pasa a 2 filas
  const wrap=innerWidth>720&&needW>innerWidth;
  $('spots').className='spots'+(nSp>=6&&!wrap?' many':'')+(wrap?' wrap4':'')+(S.phase!=='bet'?' playing':'')+(nSp<=2?' f2':nSp<=4?' f4':'');
  if(pre){if(!$('cut').innerHTML)({start:buildStart,summary:buildSummary,cut:buildCut,buyin:buildBuyin})[S.phase]()}else $('cut').innerHTML='';
  // sin saldo para la apuesta mínima (2 manos): ofrecer recompra
  if(S.phase==='bet'&&!S.busy&&$('broke').hidden&&S.balance<T().min*2&&tableBet()===0)showBroke();
  // dealer
  $('dcards').innerHTML=S.dealer.map((c,i)=>cardHTML(c,S.hole&&i===1)).join('');
  $('dtotal').textContent=S.dealer.length?(S.hole?cv(S.dealer[0])===11?'A':cv(S.dealer[0]):total(S.dealer)):'';
  // spots
  const bet=S.phase==='bet';
  $('spots').innerHTML=S.spots.map((s,i)=>{
    const hands=s.hands.map((h,j)=>{
      const cur=S.cur&&S.cur[0]===i&&S.cur[1]===j;
      const t=total(h.cards);
      return`<div class="hand ${cur?'cur':''}"><div class="cards">${h.cards.map(c=>cardHTML(c,false,c.id===h.dblCard)).join('')}</div>
        <div class="total">${t}${h.bj?' · BJ':''}${t>21?' · pasado':''}</div>
        ${h.res?`<div class="res ${h.net>0?'pos':h.net<0?'neg':''}">${h.res}</div>`:''}</div>`;
    }).join('');
    const mk=(k,l,v)=>`<div class="bet ${v?'has':''} ${k==='main'?'main':''}${k==='main'&&s.split?' sm':''}" data-i="${i}" data-k="${k}">${l}<b>${v?fmt(v):''}</b></div>`;
    // doblar: la ficha extra cae debajo del círculo de esa mano
    const mkDbl=j=>{const h=s.hands[j];if(!(h&&h.doubled))return'';const k=`${i}-${j}-d`;
      const c=`<div class="bet main has dbl${s.split?' sm':''}${chipSeen.has(k)?'':' drop'}"><small>Doble</small><b>${fmt(h.bet/2)}</b></div>`;if(!chipSeen.has(k))sfx('chip');chipSeen.add(k);return c};
    // dividir: el círculo de la segunda apuesta aparece al lado del principal
    const mainCol=`<div class="bcol">${mk('main','Apuesta',s.main)}${mkDbl(0)}</div>`;
    let splitCol='';
    for(let n=1;n<s.hands.length;n++){const h=s.hands[n],k=`${i}-s${h.sid}`,amt=h.doubled?h.bet/2:h.bet;
      splitCol+=`<div class="bcol"><div class="bet main has sm spl${chipSeen.has(k)?'':' drop'}"><small>Apuesta</small><b>${fmt(amt)}</b></div>${mkDbl(n)}</div>`;if(!chipSeen.has(k))sfx('chip');chipSeen.add(k)}
    // posición en la U: t va de -1 (izquierda) a 1 (derecha); el centro baja y los extremos se inclinan hacia el dealer
    const nS=S.spots.length,t=nS>1?(i-(nS-1)/2)/((nS-1)/2):0,amp=nS>=5?48:nS>=3?34:0;
    const ty=Math.round((1-t*t)*amp),rot=Math.round(-t*(nS>=3?7:3.5)*10)/10;
    return`<div class="spot ${S.cur&&S.cur[0]===i?'active':''}" style="--ty:${ty}px;--rot:${rot}deg"><div class="num">MANO ${i+1}</div>
      <div class="bets">${mk('pp','Par Perf.',s.pp)}${mk('p3','21+3',s.p3)}</div>
      <div class="mainrow">${mainCol}${splitCol}</div>${hands}</div>`;
  }).join('');
  // setup
  $('setup').innerHTML=bet?'<span>Manos:</span>'+[2,3,4,5,6,7].map(n=>`<button class="btn alt ${n===S.nHands?'on':''}" data-n="${n}">${n}</button>`).join(''):'';
  $('tray').innerHTML=bet?T().chips.map(c=>`<button class="chip c${c} ${c===S.chip?'sel':''}" data-c="${c}" title="${fmt(c)}">${chipLabel(c)}</button>`).join(''):'';
  // actions
  const A=$('actions');
  if(bet){
    const sideOk=v=>!v||(v>=sideMin()&&v<=sideMax());
    const ready=S.spots.every(s=>s.main>=T().min&&s.main<=T().max&&sideOk(s.pp)&&sideOk(s.p3));
    A.innerHTML=`<button class="btn" id="deal" ${ready&&!S.busy?'':'disabled'}>Repartir</button>
      <button class="btn alt" id="rep" ${S.last&&!S.busy?'':'disabled'}>Repetir apuesta</button>
      <button class="btn alt" id="clr">Limpiar</button>`;
  }else if(S.phase==='play'&&S.cur&&!S.busy){
    const h=S.spots[S.cur[0]].hands[S.cur[1]],s=S.spots[S.cur[0]];
    const can2=h.cards.length===2;
    A.innerHTML=`<button class="btn act" data-a="hit"><i>+</i>Pedir</button>
      <button class="btn act" data-a="stand"><i>&minus;</i>Plantarse</button>
      <button class="btn act" data-a="double" ${can2&&S.balance>=h.bet?'':'disabled'}><i>&times;2</i>Doblar</button>
      <button class="btn act" data-a="split" ${canSplit(s,h)?'':'disabled'}><i>&lt;&gt;</i>Dividir</button>
      <button class="btn act" data-a="surrender" ${canSurrender(s,h)?'':'disabled'} title="Devuelve la mitad de la apuesta. Solo como primera jugada${T().min<SURR_MIN?' y con apuesta de '+fmt(SURR_MIN)+' o más':''}"><i>&frac12;</i>Rendirse</button>`;
  }else if(S.phase==='done'){
    const g=S.gamble;
    A.innerHTML=(g?`<div class="gamble"><b>Doble o nada</b> · arriesgas ${fmt(g.amt)}${g.card?'<span class="gcard">'+cardHTML(g.card)+'</span>':''}<button class="btn act" data-g="red">♥ Rojo</button><button class="btn act" data-g="black">♠ Negro</button><button class="btn alt" data-g="cash">Cobrar</button></div>`:'')+`<button class="btn" id="next">Nueva ronda</button>`;
  }else A.innerHTML='';
  $('log').innerHTML=S.log.slice(0,40).map(l=>`<div><span>${l.text}</span><b class="${l.amt>0?'pos':l.amt<0?'neg':''}">${l.amt>0?'+':''}${l.amt?fmt(l.amt):''}</b></div>`).join('')||'<div style="opacity:.5">Sin movimientos aún.</div>';
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-n],[data-c],[data-k],[data-a],[data-g],#deal,#rep,#clr,#next');if(!t||S.busy&&!t.dataset.k)return;
  if(lpFired&&t.dataset.k){lpFired=false;return} // el toque largo ya vació la apuesta: no sumar otra ficha
  if(S.phase==='bet'){
    if(t.dataset.n){setHands(+t.dataset.n)}
    else if(t.dataset.c){S.chip=+t.dataset.c;sfx('chip');render()}
    else if(t.dataset.k){
      const s=S.spots[+t.dataset.i],k=t.dataset.k,cap=k==='main'?T().max:sideMax();
      if(s[k]+S.chip>cap){S.msg=`Límite de la mesa ${T().name}: ${fmt(cap)}${k==='main'?' por mano':' en sidebets'}.`;sfx('bust');render();return}
      if(S.balance>=S.chip){S.balance-=S.chip;s[k]+=S.chip;sfx('chip')}
      render();
    }
    else if(t.id==='clr')clearAll();
    else if(t.id==='rep')repeat();
    else if(t.id==='deal')deal();
  }else if(t.dataset.a)act(t.dataset.a);
  else if(t.dataset.g)gamble(t.dataset.g);
  else if(t.id==='next')nextRound();
});
function clearBetSpot(t){
  const s=S.spots[+t.dataset.i],k=t.dataset.k;
  if(s[k])sfx('chip');S.balance+=s[k];s[k]=0;render();
}
document.addEventListener('contextmenu',e=>{
  const t=e.target.closest('[data-k]');if(!t||S.phase!=='bet')return;e.preventDefault();
  clearBetSpot(t);
});
/* celular: mantener presionado un círculo de apuesta (medio segundo) lo vacía, como el clic derecho */
let lpTimer=null,lpFired=false;
document.addEventListener('pointerdown',e=>{
  const t=e.target.closest&&e.target.closest('[data-k]');if(!t||S.phase!=='bet'||e.pointerType==='mouse')return;
  lpFired=false;clearTimeout(lpTimer);
  lpTimer=setTimeout(()=>{lpFired=true;clearBetSpot(t);if(navigator.vibrate)navigator.vibrate(25)},550);
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(lpTimer)));
/* ---------- saldo inicial ---------- */
function buildStart(){
  const pt=TABLES[S.pick]||TABLES.caracas;
  const sv=!S.started&&SAVED?`<div class="resume"><p>Partida guardada · Mesa ${(TABLES[SAVED.table]||TABLES.caracas).name} · saldo ${fmt(SAVED.balance)} · ${SAVED.stats.rounds} rondas · ${SAVED.shoe.length} cartas en el zapato</p>
    <button class="btn" id="loadGo">Continuar partida guardada</button></div><p>— o inicia una nueva (reemplaza la guardada) —</p>`:'';
  const resume=S.started?`<div class="resume"><p>Mesa ${T().name} · saldo ${fmt(S.balance)} · ${S.shoe.length} cartas restantes</p>
    <button class="btn" id="resumeGo">Continuar zapato actual</button></div><p>— o empieza una sesión nueva —</p>`:sv;
  const tiles=TABLE_ORDER.map(id=>{const x=TABLES[id];
    return`<button class="tbl ${id===pt.id?'on':''}" data-table="${id}"><i class="sw sw-${id}"></i><b>${x.name}</b><span>Apuesta ${fmt(x.min)} – ${fmt(x.max)}</span><small>Saldo ${fmt(x.buyMin)} – ${fmt(x.buyMax)}</small><em class="tag">${x.tag}</em><em class="ener" title="Intensidad de la música y del ambiente">${'●'.repeat(x.energy)}${'○'.repeat(4-x.energy)}</em></button>`}).join('');
  const dv=S.initial>=pt.buyMin&&S.initial<=pt.buyMax?S.initial:pt.presets[1];
  S.boardTable=pt.id; // la tabla de líderes sigue a la mesa que marcas
  $('cut').innerHTML=`${resume}<p>ELIGE TU MESA</p><div class="tbls">${tiles}</div>
    <p>SALDO INICIAL · MESA ${pt.name.toUpperCase()}</p>
    <div class="row">${pt.presets.map(b=>`<button class="btn alt" data-bank="${b}">${fmt(b)}</button>`).join('')}</div>
    <div class="row"><input type="number" id="bankIn" min="${pt.buyMin}" max="${pt.buyMax}" step="5" value="${dv}">
    <button class="btn ${S.started||SAVED?'alt':''}" id="bankGo">${S.started?'Nueva sesión':SAVED?'Nueva partida':'Continuar'}</button></div>
    <p>Para sentarte: mínimo ${fmt(pt.buyMin)} · máximo ${fmt(pt.buyMax)}</p>
    <div id="lb" class="lbwrap">${boardHTML(S.boardTab,5,0)}</div>`;
}
function startGame(v){
  const pt=TABLES[S.pick]||TABLES.caracas;
  v=Math.round(+v/5)*5;
  if(!(v>=pt.buyMin))v=pt.buyMin;if(v>pt.buyMax)v=pt.buyMax; // el saldo se limita al rango de la mesa
  S.table=pt.id;S.boardTable=pt.id;applyTable();
  S.stats={rounds:0,won:0,lost:0,push:0,streak:0,best:0,peak:v,betSum:0,betN:0,bjs:0};S.rebuys=0;S.ratings=[];S.dec=[];S.rate=null;S.boostUntil=0;
  newShoe();S.started=true;S.sbProfit=0;S.log=[];S.dealer=[];S.cur=null;mkSpots();
  S.initial=S.balance=S.bank=v;S.phase='buyin';S.busy=true;$('cut').innerHTML='';S.msg='Cambiando tu efectivo por fichas…';render();
  AUDIO.rot=0;updateMusic(); // la música cambia (con fundido) al estilo de la mesa elegida. Luego: animación de entrada, efectivo → fichas
}
/* ---------- entrada a la mesa: pones el efectivo y el dealer te da fichas ---------- */
function chipBreakdown(v){ // reparte el saldo en fichas de todas las denominaciones de la mesa (pocas chicas, el resto en las grandes)
  const ch=T().chips,w=[.08,.14,.22,.30],cnt=ch.map(()=>0);let rest=v;
  for(let i=0;i<ch.length-1;i++){const n=Math.min(10,Math.floor(v*(w[i]||.2)/ch[i]));cnt[i]=n;rest-=n*ch[i]}
  for(let i=ch.length-1;i>=0;i--){const n=Math.floor(rest/ch[i]);cnt[i]+=n;rest-=n*ch[i]}
  return ch.map((c,i)=>({c,n:cnt[i]})).filter(s=>s.n>0);
}
function buildBuyin(){
  const v=S.initial,stacksData=chipBreakdown(v);
  const nb=Math.min(9,Math.max(3,Math.round(Math.log10(v)*2))),base=(nb*120+1100)/1000;
  const bills=Array.from({length:nb},(_,i)=>`<i class="bill" style="--i:${i};--x:${Math.round((Math.random()-.5)*16)}px;--r:${((Math.random()-.5)*8).toFixed(1)}deg">$</i>`).join('');
  const timers=S._bi=[],at=(ms,fn)=>timers.push(setTimeout(fn,ms));
  let last=0;
  const stacks=stacksData.map((s,si)=>{
    const vis=Math.min(s.n,9);
    const chips=Array.from({length:vis},(_,k)=>{const d=base+si*.2+k*.05;last=Math.max(last,d);at(d*1000+300,()=>sfx('chip'));
      return`<span class="chip c${s.c}" style="--k:${k};--d:${d.toFixed(2)}s">${chipLabel(s.c)}</span>`}).join('');
    return`<div class="bi-stack"><div class="bi-chipcol">${chips}</div><div class="bi-lab" style="--ld:${(base+si*.2+.35).toFixed(2)}s">×${s.n.toLocaleString('en-US')}</div></div>`;
  }).join('');
  $('cut').innerHTML=`<div class="buyin"><div class="bi-title" id="biTitle">Entregas ${fmt(v)} en efectivo…</div>
    <div class="bi-stage"><div class="bi-dealer">DEALER</div><div class="bi-cash" id="biCash">${bills}</div><div class="bi-chips">${stacks}</div></div>
    <div class="row"><button class="btn alt" id="biSkip">Saltar</button></div></div>`;
  for(let i=0;i<nb;i++)at(i*120+100,()=>sfx('bills'));
  at(nb*120+650,()=>{const c=$('biCash');if(c)c.classList.add('take');const t=$('biTitle');if(t)t.textContent='El dealer cuenta tu efectivo y te cambia por fichas…';sfx('bills')});
  at((last+.6)*1000,()=>{const t=$('biTitle');if(t)t.textContent=`Listo: ${fmt(v)} en fichas. ¡Buena suerte!`;sfx('bonus')});
  at((last+1.3)*1000,finishBuyin);
}
function finishBuyin(){
  if(S.phase!=='buyin')return;
  (S._bi||[]).forEach(clearTimeout);S._bi=[];
  S.busy=false;S.phase='cut';S.msg='Zapato barajado (8 mazos). Pica el mazo para empezar.';$('cut').innerHTML='';render();
}
/* ---------- calificación de la ronda (1-100) según la estrategia básica ---------- */
