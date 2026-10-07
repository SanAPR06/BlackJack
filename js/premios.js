/* Sidebets (Par Perfecto y 21+3) y premios exclusivos de cada mesa.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
function perfectPair(a,b){
  if(a.r==='JK'||b.r==='JK')return null;
  if(a.r!==b.r)return null;
  if(a.s===b.s)return{n:'Par Perfecto',m:25};
  if(isRed(a.s)===isRed(b.s))return{n:'Par del Mismo Color',m:12};
  return{n:'Par Mixto',m:6};
}
function twentyOnePlus3(cards){
  if(cards.some(c=>c.r==='JK'))return null;
  // premios especiales (tienen prioridad sobre las combinaciones normales)
  if(cards.every(c=>c.r==='A'&&c.s==='♠'))return{n:'MEGA JACKPOT A♠ A♠ A♠',m:0,mega:true}; // paga el bote de la mesa
  if(cards.every(c=>c.s==='♠')&&['Q','K','A'].every(r=>cards.some(c=>c.r===r)))return{n:'Escalera Real de Picas',m:250};
  if(cards.every(c=>c.r==='A'))return{n:'Trío de Ases',m:100};
  const idx=cards.map(c=>RANKS.indexOf(c.r)+1);
  const flush=cards.every(c=>c.s===cards[0].s);
  const trips=cards.every(c=>c.r===cards[0].r);
  const chk=v=>{v=[...v].sort((a,b)=>a-b);return v[1]===v[0]+1&&v[2]===v[1]+1};
  const straight=chk(idx)||chk(idx.map(v=>v===1?14:v));
  if(trips&&flush)return{n:'Trío del Mismo Palo',m:100};
  if(straight&&flush)return{n:'Escalera de Color',m:40};
  if(trips)return{n:'Trío',m:30};
  if(straight)return{n:'Escalera',m:10};
  if(flush)return{n:'Color',m:5};
  return null;
}
function flashLights(level){ // titileo de luces: solo con premios y blackjack
  const v=$('vibe');v.className='';void v.offsetWidth; // reinicia la animación si ya estaba corriendo
  v.className='flash'+(level==='big'?' big':'');
  if(navigator.vibrate)navigator.vibrate(level==='big'?[60,40,60,40,120]:[40,30,40]); // vibración en el celular al ganar un premio
}
function addLog(text,amt,snd='bonus'){if(amt>0)sfx(snd);S.log.unshift({text,amt});if(amt!==0)S.sbProfit+=amt}
/* Premios exclusivos de cada mesa (el 21+3 y el Par Perfecto están en todas). Cada premio de mano paga N:1 sobre la apuesta de la mano. */
const hasPrize=id=>T().prizes.includes(id);
const isRedCard=c=>c.s==='♥'||c.s==='♦';
function bonusFor(h){
  const c=h.cards,t=total(c),found=[];
  if(c.some(x=>x.r==='JK'))return null;                                    // el Joker comodín ya paga por sí mismo
  if(t===21){
    const cnt=T().cnt,m=cnt[Math.min(c.length,8)];                          // 21 con N cartas (según la mesa)
    if(m)found.push({n:c.length>=8?'21 con 8 cartas o más':`21 con ${c.length} cartas`,m});
    if(c.length===3){
      const rs=c.map(x=>x.r).sort().join(','),suited=c.every(x=>x.s===c[0].s);
      if(hasPrize('b678')&&rs==='6,7,8')found.push(suited?{n:'6-7-8 del mismo palo',m:B678[1]}:{n:'6-7-8',m:B678[0]});
      if(hasPrize('b777')&&rs==='7,7,7')found.push(suited?{n:'7-7-7 del mismo palo',m:B777[1]}:{n:'7-7-7',m:B777[0]});
    }
    if(hasPrize('picas21')&&c.length>=3&&c.every(x=>x.s==='♠'))found.push({n:'21 de Picas',m:PICAS21});
  }
  if(hasPrize('lluvia')&&c.length===5&&t<=21&&c.every(isRedCard))found.push({n:'Lluvia de Oros (5 cartas rojas)',m:LLUVIA});
  return found.length?found.reduce((a,b)=>b.m>a.m?b:a):null;               // si coinciden varios, paga el mayor
}

/* ---------- UI ---------- */

/* Rueda de la fortuna (Las Vegas): cada blackjack natural gana un giro gratis; el premio es un múltiplo de la apuesta de esa mano.
   Valor esperado ≈ 0.26 x apuesta por giro (≈ +1.2% por mano, con blackjacks ~4.75% de las manos). */
const WHEEL=[0,.5,0,1,0,2,0,5,0,10,.5,25],WHEEL_W=[[0,830],[.5,100],[1,40],[2,20],[5,12],[10,5],[25,1]];
const wheelQ=[];let wheelRot=0;
function wheelPick(){const tot=WHEEL_W.reduce((a,w)=>a+w[1],0);let r=rand(tot);for(const [v,w] of WHEEL_W){if(r<w)return v;r-=w}return 0}
function buildWheel(){
  const pt=(a,r)=>[(r*Math.sin(a*Math.PI/180)).toFixed(2),(-r*Math.cos(a*Math.PI/180)).toFixed(2)];
  const col=v=>v===0?'#1b2a24':v<1?'#5a4a1c':v<5?'#9a7b24':v<25?'#c9a43a':'#e8453c';
  $('wSvg').innerHTML='<g id="wRot">'+WHEEL.map((v,i)=>{
    const a0=i*30-15,a1=i*30+15,p0=pt(a0,96),p1=pt(a1,96);
    return `<path d="M0,0 L${p0} A96,96 0 0 1 ${p1} Z" fill="${col(v)}" stroke="#0b1410" stroke-width="1.5"/>`+
      `<text transform="rotate(${i*30}) translate(0,-68)" text-anchor="middle" dominant-baseline="middle" font-size="${v>=10?15:13}" font-weight="700" fill="${v===0?'#6d7a73':'#0b1410'}">${v===0?'—':'x'+v}</text>`;
  }).join('')+'<circle r="10" fill="#0b1410" stroke="#d4af37" stroke-width="2"/></g>';
}
async function runWheel(){
  if(S.busy||S.phase!=='done'||!wheelQ.length)return;
  const ov=$('wheel');S.busy=true;buildWheel();ov.hidden=false;
  const g=$('wRot'),go=$('wGo'),tx=$('wTxt');
  while(wheelQ.length){
    const bet=wheelQ.shift();
    tx.textContent=`¡Blackjack! Giro gratis sobre tu apuesta de ${fmt(bet)}.`;go.textContent='Girar';go.disabled=false;
    await new Promise(res=>{go.onclick=res});
    go.disabled=true;
    const v=wheelPick(),idx=WHEEL.map((x,i)=>x===v?i:-1).filter(i=>i>=0),i=idx[rand(idx.length)];
    const target=-(i*30+(rand(21)-10)),cur=wheelRot%360;
    wheelRot+=360*5+(((target-cur)%360)+360)%360;
    g.style.transition='transform 4s cubic-bezier(.12,.6,.1,1)';g.style.transform=`rotate(${wheelRot}deg)`;
    sfx('tick');const tk=setInterval(()=>sfx('tick'),260);await sleep(4100);clearInterval(tk);
    const win=bet*v;
    if(win>0){S.balance+=win;addLog(`Rueda de la fortuna · x${v}`,win,v>=10?'jackpot':'sidewin');tx.textContent=`¡x${v}! Ganas ${fmt(win)}`;
      if(v>=10)celebrate('big',`Rueda de la fortuna x${v}`,win)}
    else{S.log.unshift({text:'Rueda de la fortuna · sin premio',amt:0});tx.textContent='Esta vez no hubo premio.'}
    S.msg=win>0?`Rueda de la fortuna: x${v} (+${fmt(win)}).`:S.msg;render();
    go.textContent=wheelQ.length?'Siguiente giro':'Continuar';go.disabled=false;
    await new Promise(res=>{go.onclick=res});
  }
  ov.hidden=true;S.busy=false;render();
}
