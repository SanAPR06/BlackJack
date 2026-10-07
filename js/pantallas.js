/* Pantallas: sin saldo, resumen de la sesión, continuar / inicio y picar el mazo.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
function showBroke(){
  const opts=[...new Set([T().buyMin,T().presets[1],S.initial])].sort((a,b)=>a-b);
  $('brokeTxt').textContent=`Tu saldo (${fmt(S.balance)}) no alcanza para la apuesta mínima de la mesa ${T().name}: ${fmt(T().min*2)} (2 manos de ${fmt(T().min)}). ¿Quieres recomprar fichas?`;
  $('brokeBtns').innerHTML=opts.map(v=>`<button class="btn" data-rebuy="${v}">+ ${fmt(v)}</button>`).join('');
  $('broke').hidden=false;
}
function rebuy(v){
  S.balance+=v;S.bank+=v;S.rebuys+=v; // la ganancia total no se altera: es dinero que pusiste
  $('broke').hidden=true;S.msg=`Recompra de ${fmt(v)}. Coloca tus apuestas.`;render();
}
function endSession(){
  $('broke').hidden=true;S.phase='summary';S.dealer=[];S.cur=null;mkSpots();$('cut').innerHTML='';
  LS.del('bj-save');SAVED=null;S.sumSaved=false;S.hlId=0;S.boardTable=S.table; // la sesión terminó: ya no hay partida que continuar
  S.msg='Sesión terminada.';render();
}
function buildSummary(){
  const st=S.stats,total=st.won+st.lost+st.push,res=S.balance-S.bank;
  const row=(a,b,c='')=>`<div class="crow"><span>${a}</span><b class="${c}">${b}</b></div>`;
  const score=S.ratings.reduce((a,b)=>a+b,0),avg=S.ratings.length?Math.round(score/S.ratings.length):0;
  const saveRow=S.sumSaved?'':st.rounds>=BOARD_MIN_ROUNDS
    ?`<div class="lbsave"><p>Guarda tu resultado en la tabla de líderes</p><div class="row"><input id="lbName" maxlength="20" placeholder="Tu nombre" value="${esc(LS.get('bj-name')||'')}"><button class="btn" id="lbSave">Guardar</button></div></div>`
    :`<p>Juega al menos ${BOARD_MIN_ROUNDS} rondas para entrar a la tabla de líderes.</p>`;
  $('cut').innerHTML=`<p>RESUMEN DE LA SESIÓN</p>
    <div class="ctile" style="margin-bottom:10px;padding:14px"><small>Score final</small><b style="font-size:46px;color:#d8c898">${score.toLocaleString('en-US')}</b>
      <div style="font-size:12px;color:#bdb9a9;margin-top:2px">${S.ratings.length?`${S.ratings.length} rondas calificadas · promedio ${avg} / 100`:'Sin rondas calificadas'}</div></div>
    <div class="ctiles"><div class="ctile"><small>Resultado</small><b class="${res>=0?'pos':'neg'}">${res>=0?'+':'-'}${fmt(Math.abs(res))}</b></div>
      <div class="ctile"><small>Rondas</small><b>${st.rounds}</b></div>
      <div class="ctile"><small>Manos</small><b>${total}</b></div></div>
    <div style="text-align:left">
    ${row('Manos ganadas / empatadas / perdidas',`${st.won} / ${st.push} / ${st.lost}`)}
    ${row('Blackjacks conseguidos',st.bjs||0)}
    ${row('Porcentaje de manos ganadas',total?Math.round(st.won/total*100)+'%':'—')}
    ${row('Mejor racha de manos ganadas',st.best)}
    ${S.ratings.length?row('Calificación promedio de juego',Math.round(S.ratings.reduce((a,b)=>a+b,0)/S.ratings.length)+' / 100'):''}
    ${S.ratings.length?row('Mejor / peor ronda',Math.max(...S.ratings)+' / '+Math.min(...S.ratings)):''}
    ${row('Ganancia en sidebets y bonos',(S.sbProfit>=0?'+':'-')+fmt(Math.abs(S.sbProfit)),S.sbProfit>=0?'pos':'neg')}
    ${row('Apuesta promedio por mano',fmt(Math.round(avgBetOf(st)*100)/100))}
    ${row('Rendimiento (ganancia ÷ apuesta promedio)',(unitsOf(res,st)>=0?'+':'')+unitsOf(res,st).toFixed(1)+' unidades',unitsOf(res,st)>=0?'pos':'neg')}
    ${row('Saldo más alto alcanzado',fmt(st.peak))}
    ${row('Total puesto (inicial + recompras)',fmt(S.bank))}
    ${row('Saldo final',fmt(S.balance))}</div>
    ${saveRow}<div id="lb" class="lbwrap">${boardHTML(S.boardTab,10,S.hlId)}</div>
    <div class="row" style="margin-top:18px"><button class="btn" id="sumGo">Nuevo juego</button></div>`;
}
function resumeGame(){
  applyTable();updateMusic();
  if(S.shoe.length<=CUT)newShoe();
  S.phase=S.needCut?'cut':'bet';$('cut').innerHTML='';
  S.msg=S.needCut?'Zapato barajado (8 mazos). Pica el mazo para continuar.':'Elige el número de manos y coloca tus apuestas.';
  render();
}
function refundPending(){
  if(S.phase==='bet')for(const s of S.spots)S.balance+=s.main+s.pp+s.p3;
  else if(S.phase==='play')for(const s of S.spots)for(const h of s.hands)S.balance+=h.bet;
}
function goHome(){
  // devuelve las apuestas que aún no se han resuelto
  refundPending();
  S.dealer=[];S.cur=null;S.hole=true;mkSpots();
  S.pick=S.table;S.boardTable=S.table;headerTable(S.table);
  S.phase='start';S.msg='Inicio. Continúa el zapato actual o empieza una sesión nueva (puedes cambiar de mesa).';$('cut').innerHTML='';render();
}
function askHome(kind='home'){
  if(S.busy||S.phase==='start'||S.phase==='summary')return;
  const risk=S.phase==='bet'||S.phase==='play',cancel=risk?' La ronda en curso se cancelará y se te devolverán las apuestas pendientes.':'';
  S.modalAct=kind;
  $('mtxt').textContent=kind==='end'?'¿Terminar el juego y ver el resumen de la sesión?'+cancel+' Ya no podrás continuar este zapato.'
    :'¿Salir a la pantalla inicial?'+cancel+' Podrás continuar este zapato o empezar uno nuevo.';
  $('mYes').textContent=kind==='end'?'Terminar juego':'Salir al inicio';
  $('modal').hidden=false;
}
document.addEventListener('click',e=>{
  const id=e.target.id,tb=e.target.closest('button.tbl'); // (el body también lleva data-table: por eso se busca el botón)
  if(tb)pickTable(tb.dataset.table);
  else if(e.target.dataset&&e.target.dataset.bank)$('bankIn').value=e.target.dataset.bank;
  else if(id==='bankGo')startGame($('bankIn').value);
  else if(id==='resumeGo')resumeGame();
  else if(id==='loadGo')loadGame();
  else if(id==='payBtn'){const f=$('felt'),o=f.classList.toggle('open');e.target.setAttribute('aria-expanded',o);e.target.textContent=o?'Ocultar pagos':'Ver pagos y bote'}
  else if(id==='biSkip')finishBuyin();
  else if(id==='lbSave')saveToBoard();
  else if(e.target.dataset&&e.target.dataset.lb){S.boardTab=e.target.dataset.lb;$('lb').innerHTML=boardHTML(S.boardTab,S.phase==='summary'?10:5,S.hlId)}
  else if(e.target.dataset&&e.target.dataset.rebuy)rebuy(+e.target.dataset.rebuy);
  else if(id==='brokeNo')endSession();
  else if(id==='sumGo'){S.started=false;S.phase='start';S.msg='Elige tu saldo inicial para comenzar.';$('cut').innerHTML='';render()}
  else if(id==='homeBtn')askHome('home');
  else if(id==='endBtn')askHome('end');
  else if(id==='mNo'||id==='modal')$('modal').hidden=true;
  else if(id==='mYes'){$('modal').hidden=true;if(S.modalAct==='end'){refundPending();endSession()}else goHome()}
});
/* ---------- picar el mazo ---------- */
const CUT_MIN=40,CUT_MAX=SHOE_SIZE-40;
function buildCut(){
  sfx('shuffle');
  S.cutPos=Math.round(SHOE_SIZE/2);
  $('cut').innerHTML=`<p>PICA EL MAZO: elige dónde cortar el zapato</p>
    <div class="stack"><div class="blk a" id="cutA"></div><div class="blk b" id="cutB"></div></div>
    <input type="range" id="cutRange" min="${CUT_MIN}" max="${CUT_MAX}" value="${S.cutPos}">
    <div class="row"><button class="btn" id="cutGo">Picar aquí</button><button class="btn alt" id="cutRnd">Al azar</button></div>`;
  updateCut();
}
function updateCut(){
  const k=S.cutPos,a=$('cutA'),b=$('cutB');if(!a)return;
  a.style.width=(k/SHOE_SIZE*100)+'%';b.style.width=((SHOE_SIZE-k)/SHOE_SIZE*100)+'%';
  a.textContent=k;b.textContent=SHOE_SIZE-k;
}
async function doCut(k){
  if(S.busy)return;S.busy=true;S.cutPos=k;sfx('cut');
  const a=$('cutA'),b=$('cutB');updateCut();
  $('cutRange').disabled=true;$('cutGo').disabled=$('cutRnd').disabled=true;
  a.style.transform=`translate(${b.offsetWidth}px,-26px)`;b.style.transform=`translateX(${-a.offsetWidth}px)`;
  await sleep(1000);
  S.shoe=S.shoe.slice(k).concat(S.shoe.slice(0,k));
  S.phase='bet';S.needCut=false;S.busy=false;S.msg='Mazo picado. Elige el número de manos y coloca tus apuestas.';render();
}
document.addEventListener('input',e=>{if(e.target.id==='cutRange'){S.cutPos=+e.target.value;updateCut()}});
document.addEventListener('click',e=>{
  if(e.target.id==='cutGo')doCut(S.cutPos);
  else if(e.target.id==='cutRnd'){const k=CUT_MIN+rand(CUT_MAX-CUT_MIN+1);$('cutRange').value=k;doCut(k)}
});
function clearAll(){for(const s of S.spots){S.balance+=s.main+s.pp+s.p3;s.main=s.pp=s.p3=0}render()}
function setHands(n){
  const old=S.spots;
  for(let i=n;i<old.length;i++)S.balance+=old[i].main+old[i].pp+old[i].p3;
  S.nHands=n;S.spots=Array.from({length:n},(_,i)=>old[i]||{main:0,pp:0,p3:0,hands:[],split:false});
  render();
}
function repeat(){
  clearAll();
  const L=S.last;if(!L)return;
  setHands(L.length);
  const need=L.reduce((a,b)=>a+b.main+b.pp+b.p3,0);
  if(need>S.balance){S.msg='Saldo insuficiente para repetir la apuesta.';render();return}
  L.forEach((b,i)=>{S.balance-=b.main+b.pp+b.p3;Object.assign(S.spots[i],b)});
  S.msg='Apuesta repetida.';render();
}

/* ---------- round flow ---------- */

/* tabla de pagos de una mesa, consultable desde la pantalla de inicio sin sentarse */
function showPays(){
  const t=TABLES[S.pick]||TABLES.caracas,pps=document.querySelectorAll('#felt .prints .pp');
  $('payTitle').textContent='Pagos · Mesa '+t.name;
  $('payBody').innerHTML=
    `<div class="pp"><h4>Reglas de ${t.name}</h4><div><span>Apuesta por mano</span><i></i><b>${fmt(t.min)} – ${fmt(t.max)}</b></div>
      <div><span>Sidebets</span><i></i><b>${fmt(sideMin())} – ${fmt(t.max/10)}</b></div>
      <div><span>Rendición</span><i></i><b>${t.min<SURR_MIN?fmt(SURR_MIN)+' o más':'permitida'}</b></div></div>`+
    (pps[0]?'<div class="pp">'+pps[0].innerHTML+'</div>':'')+(pps[1]?'<div class="pp">'+pps[1].innerHTML+'</div>':'')+
    `<div class="pp"><h4>Premios de ${t.name}</h4>${prizeRows(t)}</div>
     <div class="pp"><h4>Mega Jackpot</h4><div class="mega"><span>A♠ A♠ A♠ en el 21+3 · paga el bote de la mesa</span></div><div class="mega big"><b>${fmt(POTS[t.id]!=null?POTS[t.id]:t.seed)}</b></div></div>`;
  $('payModal').hidden=false;
}
document.addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('#payView'))showPays();
  else if(e.target===$('payModal')||(e.target.closest&&e.target.closest('#payClose')))$('payModal').hidden=true;
});
