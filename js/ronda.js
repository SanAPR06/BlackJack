/* Flujo de la ronda (repartir, jugar, dealer, resolver), y arranque del juego.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
async function deal(){
  S.busy=true;
  S.roundBase=S.balance+tableBet();S.bigPrize=false;S.gamble=null; // dinero antes de apostar: sirve para saber si la ronda, en total, ganó o perdió
  S.last=S.spots.map(s=>({main:s.main,pp:s.pp,p3:s.p3}));
  S.log=[];
  chipSeen.clear();S.dec=[];S.rate=null;
  S.phase='play';S.dealer=[];S.hole=true;S.cur=null;S.msg='Repartiendo…';
  for(const s of S.spots){S.stats.betSum=(S.stats.betSum||0)+s.main;S.stats.betN=(S.stats.betN||0)+1} // apuesta promedio por mano (para el rendimiento en unidades)
  saveGame(); // con las apuestas ya descontadas: recargar la página a mitad de ronda no devuelve la apuesta
  for(const s of S.spots)s.hands=[{cards:[],bet:s.main,done:false}];
  render();
  for(let pass=0;pass<2;pass++){
    for(const s of S.spots){s.hands[0].cards.push(draw());render();await sleep(300)}
    S.dealer.push(drawDealer());render();await sleep(300);
  }
  // sidebets
  const up=S.dealer[0];
  S.spots.forEach((s,i)=>{
    const c=s.hands[0].cards;
    if(s.pp){const r=perfectPair(c[0],c[1]);
      if(r){S.balance+=s.pp*(r.m+1);addLog(`Mano ${i+1} · ${r.n} (${r.m}:1)`,s.pp*r.m,r.m>=25?'jackpot':'sidewin')}else addLog(`Mano ${i+1} · Par Perfecto perdido`,-s.pp)}
    if(s.p3){S.pot+=s.p3*POT_RATE;savePot();const r=twentyOnePlus3([c[0],c[1],up]);
      if(r){
        const win=r.mega?S.pot:s.p3*r.m; // el MEGA JACKPOT paga todo el bote progresivo de la mesa
        S.balance+=s.p3+win;
        addLog(`Mano ${i+1} · 21+3 ${r.n} ${r.mega?'· bote '+fmt(win):'('+r.m+':1)'}`,win,r.mega?'mega':r.m>=30?'jackpot':'sidewin');
        if(r.mega){S.pot=T().seed;savePot();celebrate('mega',r.n,win)}else if(r.m>=100)celebrate('big',r.n,win);
      }else addLog(`Mano ${i+1} · 21+3 perdido`,-s.p3)}
    if(c.some(x=>x.r==='JK'))addLog(`Mano ${i+1} · ¡Joker comodín! Cuenta como blackjack`,0);
    if(hasPrize('reyreina')&&c.length===2&&c[0].s===c[1].s&&((c[0].r==='K'&&c[1].r==='Q')||(c[0].r==='Q'&&c[1].r==='K'))){
      const w=s.main*REYREINA;S.balance+=w;addLog(`Mano ${i+1} · Rey y Reina del mismo palo (${REYREINA}:1)`,w,'sidewin'); // premio inmediato de Madrid
    }
    s.hands[0].bj=isBJ(c);
    if(s.hands[0].bj){s.hands[0].done=true;S.stats.bjs=(S.stats.bjs||0)+1} // blackjacks naturales del jugador (cuentan aunque el dealer también lo tenga)
  });
  if(hasPrize('doble007'))for(let i=0;i<S.spots.length-1;i++){ // Monaco: dos manos contiguas con 7-7 cada una
    const a=S.spots[i].hands[0],b=S.spots[i+1].hands[0],is77=h=>h.cards.length===2&&h.cards.every(x=>x.r==='7');
    if(is77(a)&&is77(b)){const w=(a.bet+b.bet)*DOBLE007;S.balance+=w;addLog(`Manos ${i+1} y ${i+2} · ¡DOBLE 007! (${DOBLE007}:1 en cada mano)`,w,'jackpot');celebrate('big','DOBLE 007',w)}
  }
  // dealer peek
  const dBJ=isBJ(S.dealer);
  if((cv(up)>=10)&&dBJ){S.hole=false;S.msg='El dealer tiene Blackjack.';render();await sleep(600);finish();return}
  S.busy=false;proceed();
}
function proceed(){
  for(let i=0;i<S.spots.length;i++)for(let j=0;j<S.spots[i].hands.length;j++)
    if(!S.spots[i].hands[j].done){S.cur=[i,j];S.msg=`Mano ${i+1}${S.spots[i].split?' ('+(j+1)+')':''}: ¿qué haces?`;render();return}
  S.cur=null;dealerTurn();
}
async function act(a){
  const [i,j]=S.cur,s=S.spots[i],h=s.hands[j];
  if(a==='surrender'&&!canSurrender(s,h))return;
  const rec=recommend(s,h);
  S.dec.push({tag:`Mano ${i+1}${s.split?'.'+(j+1):''}`,hand:h.cards.map(x=>x.r).join(' '),up:S.dealer[0].r,act:a,rec,ok:a===rec});
  if(a==='hit'){
    // se espera a que termine el vuelo de la carta; si no, el siguiente render la cortaba
    S.busy=true;h.cards.push(draw());render();await sleep(550);S.busy=false;
    if(total(h.cards)>21)sfx('bust');
    if(total(h.cards)>=21)h.done=true;
  }
  else if(a==='stand')h.done=true;
  else if(a==='surrender'){h.surrendered=true;h.done=true;sfx('lose')} // al resolver la ronda se devuelve la mitad de la apuesta
  else if(a==='double'){
    S.busy=true;S.balance-=h.bet;h.bet*=2;h.doubled=true;
    render();await sleep(500);                 // primero cae la ficha, luego llega la carta
    const dc=draw();h.dblCard=dc.id;h.cards.push(dc);h.done=true;S.busy=false; // la carta de doble va acostada
  }
  else if(a==='split'){
    if(!canSplit(s,h))return;
    S.busy=true;S.balance-=h.bet;s.split=true;
    const c2=h.cards.pop();
    const nh={cards:[c2],bet:h.bet,done:false,split:true,sid:(s.sidN=(s.sidN||0)+1)};h.split=true;
    s.hands.splice(j+1,0,nh);
    movedIds.add(c2.id);render();await sleep(550);          // la carta pasa a la nueva mano
    h.cards.push(draw());render();await sleep(380);          // una carta nueva a cada mano
    nh.cards.push(draw());render();await sleep(380);
    if(total(h.cards)===21)h.done=true;
    if(total(nh.cards)===21)nh.done=true;
    S.busy=false;
  }
  render();proceed();
}
async function dealerTurn(){
  S.busy=true;S.hole=false;S.msg='Turno del dealer…';render();await sleep(600);
  const alive=S.spots.some(s=>s.hands.some(h=>!h.bj&&!h.surrendered&&total(h.cards)<=21));
  if(alive)while(total(S.dealer)<17){S.dealer.push(drawDealer());render();await sleep(600)}
  finish();
}
function finish(){
  S.hole=false;S.cur=null;
  const dt=total(S.dealer),dBJ=isBJ(S.dealer);
  let net=0;
  S.spots.forEach((s,i)=>s.hands.forEach((h,j)=>{
    const t=total(h.cards),tag=`Mano ${i+1}${s.split?'.'+(j+1):''}`;
    let pay=0,res;
    const kA=hasPrize('bKA')&&h.bj&&h.cards.some(c=>c.r==='K'&&c.s==='♠')&&h.cards.some(c=>c.r==='A'&&c.s==='♠');
    const joker=h.cards.some(c=>c.r==='JK');
    const bon=!h.bj?bonusFor(h):null;
    if(h.surrendered){pay=h.bet/2;res='Rendición'}
    else if(t>21){res='Pasado';}
    else if(h.bj&&!h.split){
      if(dBJ){pay=h.bet;res='Empate (BJ)'}
      else if(kA){pay=h.bet*(1+BONUS_KA);res=`K-A de picas ${BONUS_KA}:1`;addLog(`${tag} · K-A de Picas (${BONUS_KA}:1)`,h.bet*BONUS_KA,'jackpot');celebrate('big','K-A de Picas',h.bet*BONUS_KA)}
      else if(hasPrize('palo21')&&!joker&&h.cards[0].s===h.cards[1].s){pay=h.bet*(1+PALO21);res=`Blackjack de palo ${PALO21}:1`;addLog(`${tag} · Blackjack de palo (${PALO21}:1)`,h.bet*PALO21,'sidewin')}
      else{pay=h.bet*2.5;res=joker?'Joker comodín 3:2':'Blackjack 3:2'}
    }
    else if(bon){
      // el bono se paga sobre la apuesta ORIGINAL; si doblaste, la apuesta extra se resuelve normal contra el dealer
      const base=h.doubled?h.bet/2:h.bet,extra=h.doubled?(dt>21||t>dt?base*2:t===dt?base:0):0;
      pay=base*(1+bon.m)+extra;res=`${bon.n} ${bon.m}:1`;
      addLog(`${tag} · Premio ${bon.n} (${bon.m}:1)`,base*bon.m,bon.m>=BIG_PRIZE?'jackpot':'sidewin');
      if(bon.m>=BIG_PRIZE)celebrate('big',bon.n,base*bon.m)}
    else if(dBJ){res='Pierde'}
    else if(dt>21||t>dt){pay=h.bet*2;res='Gana';
      if(hasPrize('siesta')&&t===21&&dt===22){pay+=h.bet*SIESTA;res=`Siesta ${SIESTA+1}:1`;addLog(`${tag} · Siesta: 21 y el dealer se pasa con 22 (+${SIESTA}:1)`,h.bet*SIESTA,'sidewin')}}
    else if(t===dt){pay=h.bet;res='Empate'}
    else res='Pierde';
    h.net=pay-h.bet;h.res=res;S.balance+=pay;net+=h.net;
    const st=S.stats;
    if(h.net>0){st.won++;st.streak++;st.best=Math.max(st.best,st.streak)}else if(h.net<0){st.lost++;st.streak=0}else st.push++;
  }));
  // el sonido final depende del dinero TOTAL de la ronda (todas las manos + sidebets + premios), no de una mano suelta;
  // las fanfarrias quedan solo para los premios gordos (ya sonaron al cobrarlos)
  const roundNet=S.balance-S.roundBase;
  if(!S.bigPrize)setTimeout(()=>sfx(roundNet>0.001?'win':roundNet<-0.001?'lose':'push'),250);
  S.rate=roundRating();if(S.rate)S.ratings.push(S.rate.score);
  S.stats.rounds++;S.stats.peak=Math.max(S.stats.peak,S.balance);updateMusic();
  S.phase='done';S.busy=false;
  S.gamble=hasPrize('doble')&&roundNet>0.001?{amt:roundNet,n:0,card:null}:null; // Las Vegas: ofrecer doble o nada con la ganancia de la ronda
  S.msg=(dBJ?'Dealer Blackjack. ':dt>21?'Dealer se pasa ('+dt+'). ':'Dealer: '+dt+'. ')+'Resultado de la ronda: '+(roundNet>0.001?'+':roundNet<-0.001?'-':'')+fmt(Math.abs(roundNet));
  render();
}
const GAMBLE_MAX=3;
async function gamble(ch){ // doble o nada: color de la siguiente carta del zapato (50/50, sin ventaja para la casa)
  const g=S.gamble;if(!g||S.busy)return;
  if(ch==='cash'){S.gamble=null;S.msg='Cobraste tu ganancia.';render();return}
  S.busy=true;g.card=draw();S.msg='Doble o nada: se destapa la carta…';render();await sleep(900);
  const win=(ch==='red')===isRed(g.card.s);
  if(win){S.balance+=g.amt;S.log.unshift({text:'Doble o nada · ganaste',amt:g.amt});g.amt*=2;g.n++;sfx('win');S.msg='¡Doble o nada ganado! Ahora arriesgas '+fmt(g.amt)+'.';if(g.n>=GAMBLE_MAX){S.msg='¡Ganaste '+GAMBLE_MAX+' veces seguidas! Cobras '+fmt(g.amt)+'.';S.gamble=null}}
  else{S.balance-=g.amt;S.log.unshift({text:'Doble o nada · perdiste',amt:-g.amt});sfx('lose');S.msg='Doble o nada perdido ('+g.card.r+g.card.s+'). Pierdes '+fmt(g.amt)+'.';S.gamble=null}
  S.busy=false;render();
}
function nextRound(){
  S.gamble=null;
  S.phase='bet';S.dealer=[];S.hole=true;S.cur=null;mkSpots();
  S.msg='Elige el número de manos y coloca tus apuestas.';
  if(S.shoe.length<=CUT){newShoe();S.phase='cut';S.msg='Zapato barajado (8 mazos). Pica el mazo para continuar.'}
  render();
}
// instalable como app y disponible sin conexión (solo funciona servido por http/https, por ejemplo en GitHub Pages)
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
// al girar el iPad o el teléfono (o cambiar el tamaño) se recalcula la distribución
let rzT;['resize','orientationchange'].forEach(ev=>window.addEventListener(ev,()=>{clearTimeout(rzT);rzT=setTimeout(()=>render(),180)}));
newShoe();S.phase='start';S.msg='Elige tu mesa y tu saldo inicial para comenzar.';S.boardTable='caracas';applyTable();syncAudioUI();renderHof();render();
