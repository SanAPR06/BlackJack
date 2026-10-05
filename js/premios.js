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
