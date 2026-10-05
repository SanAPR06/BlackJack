/* Estrategia básica, calificación de la ronda, avisos de premios y contador de cartas.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
function recommend(s,h){
  const c=h.cards,up=S.dealer[0],col=up.r==='A'?9:cv(up)===10?8:cv(up)-2;
  const canDbl=c.length===2&&S.balance>=h.bet;
  if(splittable(s,h)&&S.balance>=h.bet){
    const t=c[0].r==='A'?'A,A':cv(c[0])===10?'T,T':c[0].r+','+c[0].r,row=ST_PAIR.find(x=>x[0]===t);
    if(row&&row[1].split(' ')[col]==='Y')return'split';
  }
  const hardSum=c.reduce((a,x)=>a+(x.r==='A'?1:cv(x)),0),soft=c.some(x=>x.r==='A')&&hardSum+10<=21?hardSum+10:0;
  let code;
  if(!soft&&canSurrender(s,h)&&((hardSum===16&&col>=7)||(hardSum===15&&col===8)))return'surrender'; // 16 vs 9/10/A y 15 vs 10
  if(soft){
    if(soft>=21)return'stand';
    const row=ST_SOFT.find(x=>x[0]==='A,'+(soft-11));code=row?row[1].split(' ')[col]:'H'; // soft 12 (A,A sin dividir): pedir
  }else code=hardSum>=17?'S':hardSum<=8?'H':ST_HARD.find(x=>x[0]===String(hardSum))[1].split(' ')[col];
  if(code==='D')return canDbl?'double':'hit';
  if(code==='Ds')return canDbl?'double':'stand';
  return code==='S'?'stand':'hit';
}
const ACT_ES={hit:'pedir',stand:'plantarse',double:'doblar',split:'dividir',surrender:'rendirse'};
function roundRating(){
  const d=S.dec;if(!d.length)return null;
  const ok=d.filter(x=>x.ok).length;
  return{score:Math.max(1,Math.round(ok/d.length*100)),ok,total:d.length,errs:d.filter(x=>!x.ok)};
}
const ratingLabel=n=>n>=90?'Excelente':n>=75?'Muy bien':n>=50?'Regular':'A mejorar';
const ratingColor=n=>n>=75?'#8fc9a0':n>=50?'#d8c898':'#c98a84';
function ratingHTML(){
  const R=S.rate;
  if(!R)return`<div class="rate"><small>Calificación de la ronda</small><p>Sin decisiones que calificar (no hubo jugadas).</p></div>`;
  return`<div class="rate"><small>Calificación de la ronda</small>
    <div class="rscore"><b style="color:${ratingColor(R.score)}">${R.score}</b><span>/ 100 · ${ratingLabel(R.score)}</span></div>
    <div class="rbar"><i style="width:${R.score}%;background:${ratingColor(R.score)}"></i></div>
    <p>${R.ok} de ${R.total} decisiones según la estrategia básica.</p>
    ${R.errs.slice(0,5).map(e=>`<div class="rerr"><b>${e.tag}:</b> ${e.hand} contra ${e.up}. Hiciste ${ACT_ES[e.act]}, lo correcto era <b>${ACT_ES[e.rec]}</b>.</div>`).join('')}</div>`;
}

/* ---------- tabla de estrategia básica (S17, 8 mazos, DAS, sin rendición) ---------- */
const SCOLS=['2','3','4','5','6','7','8','9','10','A'];
const ST_HARD=[['17','S S S S S S S S S S'],['16','S S S S S H H H H H'],['15','S S S S S H H H H H'],['14','S S S S S H H H H H'],
  ['13','S S S S S H H H H H'],['12','H H S S S H H H H H'],['11','D D D D D D D D D D'],['10','D D D D D D D D H H'],
  ['9','H D D D D H H H H H'],['8','H H H H H H H H H H']];
const ST_SOFT=[['A,9','S S S S S S S S S S'],['A,8','S S S S Ds S S S S S'],['A,7','Ds Ds Ds Ds Ds S S H H H'],
  ['A,6','H D D D D H H H H H'],['A,5','H H D D D H H H H H'],['A,4','H H D D D H H H H H'],
  ['A,3','H H H D D H H H H H'],['A,2','H H H D D H H H H H']];
const ST_PAIR=[['A,A','Y Y Y Y Y Y Y Y Y Y'],['T,T','N N N N N N N N N N'],['9,9','Y Y Y Y Y N Y Y N N'],['8,8','Y Y Y Y Y Y Y Y Y Y'],
  ['7,7','Y Y Y Y Y Y N N N N'],['6,6','Y Y Y Y Y N N N N N'],['5,5','N N N N N N N N N N'],['4,4','N N N Y Y N N N N N'],
  ['3,3','Y Y Y Y Y Y N N N N'],['2,2','Y Y Y Y Y Y N N N N']];
const ST_SUR=[['16','- - - - - - - SUR SUR SUR'],['15','- - - - - - - - SUR -'],['14','- - - - - - - - - -']]; // rendición (apuesta de $10+)
function stratHint(){
  if(S.phase!=='play'||!S.cur)return null;
  const h=S.spots[S.cur[0]].hands[S.cur[1]],up=S.dealer[0];if(!up)return null;
  const col=up.r==='A'?9:cv(up)===10?8:cv(up)-2,c=h.cards;
  const hardSum=c.reduce((a,x)=>a+(x.r==='A'?1:cv(x)),0),hasA=c.some(x=>x.r==='A');
  const hint={col,cells:[]};
  if(hasA&&hardSum+10<=21&&hardSum+10<21){hint.cells.push('soft:A,'+(hardSum-1))}
  else hint.cells.push('hard:'+Math.min(17,Math.max(8,hardSum+(hasA&&hardSum+10<=21?10:0))));
  if(splittable(S.spots[S.cur[0]],h)){
    const t=c[0].r==='A'?'A,A':cv(c[0])===10?'T,T':c[0].r+','+c[0].r;hint.cells.push('pair:'+t);
  }
  if(!hasA&&canSurrender(S.spots[S.cur[0]],h)&&hardSum>=14&&hardSum<=16)hint.cells.push('sur:'+hardSum);
  return hint;
}
function stTable(title,kind,rows,hint){
  return`<table class="st"><caption>${title}</caption><tr><th></th>${SCOLS.map(x=>`<th>${x}</th>`).join('')}</tr>`+
    rows.map(([k,s])=>`<tr><th class="r">${k}</th>${s.split(' ').map((v,i)=>
      `<td class="${v==='-'?'N':v}${hint&&hint.col===i&&hint.cells.includes(kind+':'+k)?' hl':''}">${v==='-'?'':v}</td>`).join('')}</tr>`).join('')+'</table>';
}
function setStrat(open,tab){
  if(tab)S.tab=tab;
  $('strat').classList.toggle('open',open);document.body.classList.toggle('strat-open',open);
  $('stratBtn').classList.toggle('on',open&&S.tab==='strat');$('countBtn').classList.toggle('on',open&&S.tab==='count');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===S.tab));
  if(open)renderPanel();
}
function renderPanel(){S.tab==='count'?renderCount():renderStrat()}

/* ---------- avisos de bonos (6-7-8, 7-7-7, 21 con 7 cartas) ---------- */
// probabilidad según lo que el jugador ya ha visto en la mesa (no usa información oculta)
const leftOf=r=>Math.max(0,32-(S.seenRank[r]||0));
const poolSize=()=>Math.max(1,SHOE_SIZE-(S.seen.low+S.seen.mid+S.seen.high));
const pct=n=>(Math.round(n/poolSize()*1000)/10)+'%';
function bonusTips(){
  if(S.phase!=='play'||!S.cur||S.busy)return[];
  const h=S.spots[S.cur[0]].hands[S.cur[1]],c=h.cards,tips=[];
  if(h.done)return tips;
  if(c.length===2&&(hasPrize('b678')||hasPrize('b777'))){
    const [a,b]=c,suited=a.s===b.s;
    let need=null;
    if(hasPrize('b777')&&a.r==='7'&&b.r==='7')need='7';
    else if(hasPrize('b678')&&a.r!==b.r&&'678'.includes(a.r)&&'678'.includes(b.r)&&a.r.length===1&&b.r.length===1)need=['6','7','8'].find(r=>r!==a.r&&r!==b.r);
    if(need){
      const name=need==='7'&&a.r==='7'?'7-7-7':'6-7-8';
      const [bm,bs]=name==='7-7-7'?B777:B678;
      tips.push(`<div><b>Posible ${name}:</b> un <b>${need}</b> te da el premio ${bm}:1${suited?` (${bs}:1 si el ${need} es de ${a.s})`:''}. Probabilidad de que salga ≈ <b>${pct(leftOf(need))}</b>.
        <small>El orden no importa. Compara con la tabla de estrategia: pedir solo por el premio puede costarte en la mano.</small></div>`);
    }
  }
  // 21 con N cartas: premios de la mesa según cuántas cartas llevas (Monaco: 6 cartas, Las Vegas: 5, 7 y 8+)
  const cnt=T().cnt,nx=c.length+1;
  if(total(c)<21&&c.length>=3&&cnt[Math.min(nx,8)]){
    let ways=0;for(const r of RANKS)if(total([...c,{r,s:'♠'}])===21)ways+=leftOf(r);
    if(ways)tips.push(`<div><b>21 con ${nx>=8?'8 o más':nx} cartas:</b> con una carta más puedes llegar a 21 y cobrar <b>${cnt[Math.min(nx,8)]}:1</b>. Probabilidad ≈ <b>${pct(ways)}</b>.</div>`);
  }
  if(hasPrize('lluvia')&&c.length===4&&c.every(isRedCard)&&total(c)<=20){
    const safe=RANKS.filter(r=>total([...c,{r,s:'♥'}])<=21);
    tips.push(`<div><b>Lluvia de Oros:</b> una carta <b>roja</b> más (sin pasarte de 21) paga <b>${LLUVIA}:1</b>. Hoy te sirve cualquiera de ${safe.length} valores.</div>`);
  }
  if(hasPrize('picas21')&&c.length>=2&&c.every(x=>x.s==='♠')&&total(c)<21)
    tips.push(`<div><b>21 de Picas:</b> llegar a 21 con puras picas (3 cartas o más) paga <b>${PICAS21}:1</b>. Llevas ${c.length} picas.</div>`);
  return tips;
}

/* ---------- contador Hi-Lo + mini guía ---------- */
const hilo=c=>c.r==='JK'?0:'23456'.includes(c.r)&&c.r!=='10'?1:('789'.includes(c.r)?0:-1);
const sgn=n=>(n>0?'+':'')+n;
function renderCount(){
  const rc=S.count,decks=Math.max(S.shoe.length/52,0.5),tc=Math.round(rc/decks*10)/10;
  const units=tc>=2?Math.min(8,Math.floor(tc)):1,edge=Math.round((tc*0.5-0.4)*10)/10;
  const hide=S.hideCount,mask=v=>hide?'•••':v;
  const cls=v=>hide?'':v>0?'pos':v<0?'neg':'';
  const seenN=S.seen.low+S.seen.mid+S.seen.high;
  const ill=[['16 vs 10','Plantarse si TC ≥ 0'],['15 vs 10','Plantarse si TC ≥ +4'],['12 vs 2','Plantarse si TC ≥ +3'],['12 vs 3','Plantarse si TC ≥ +2'],
    ['12 vs 4','Pedir si TC < 0'],['13 vs 2','Pedir si TC < −1'],['9 vs 2','Doblar si TC ≥ +1'],['11 vs A','Doblar si TC ≥ +1'],
    ['10 vs 10','Doblar si TC ≥ +4'],['10 vs A','Doblar si TC ≥ +4']];
  $('stratBody').innerHTML=`<div class="ctiles">
      <div class="ctile"><small>Conteo</small><b class="${cls(rc)}">${mask(sgn(rc))}</b></div>
      <div class="ctile"><small>Verdadero</small><b class="${cls(tc)}">${mask(sgn(tc))}</b></div>
      <div class="ctile"><small>Mazos</small><b>${decks.toFixed(1)}</b></div></div>
    <label class="chide"><input type="checkbox" id="hideCnt" ${hide?'checked':''}> Modo práctica: ocultar el conteo (cuenta tú mismo)</label>
    <div class="crow"><span>Apuesta sugerida</span><b>${hide?'•••':units+'× ('+fmt(units*T().min)+')'}</b></div>
    <div class="crow"><span>Ventaja estimada (aprox.)</span><b class="${cls(edge)}">${hide?'•••':sgn(edge)+'%'}</b></div>
    <div class="crow"><span>Cartas vistas (bajas / medias / altas)</span><b>${S.seen.low} / ${S.seen.mid} / ${S.seen.high}</b></div>
    <div class="crow"><span>Cartas vistas en total</span><b>${seenN}</b></div>
    <div class="guide">
      <h4>Hi-Lo en 30 segundos</h4>
      <div class="vals"><span class="p">2-6<br>+1</span><span class="z">7-9<br>0</span><span class="n">10-A<br>−1</span></div>
      <ul>
        <li>Suma o resta cada carta que veas boca arriba: tuyas, de las otras manos y del dealer. La carta oculta cuenta cuando se destapa.</li>
        <li><b>Conteo verdadero (TC)</b> = conteo ÷ mazos que quedan. Es el número que importa en 8 mazos.</li>
        <li>Conteo alto = quedan más cartas altas (10 y As), lo que favorece al jugador. Conteo bajo favorece a la casa.</li>
      </ul>
      <h4>Cómo usarlo</h4>
      <ul>
        <li><b>Apuestas:</b> con TC menor a +2 apuesta lo mínimo. Desde +2 sube una unidad por cada punto de TC (máx. 8).</li>
        <li><b>Jugadas:</b> la tabla de estrategia sigue siendo la base. Con el TC cambia solo en estos casos:</li>
      </ul>
      <table>${ill.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <h4>Para practicar</h4>
      <ul>
        <li>Activa el modo práctica, cuenta mentalmente cada mano y desactívalo para comparar.</li>
        <li>Empieza contando por parejas: un +1 y un −1 que se cancelan.</li>
        <li>El conteo se reinicia a 0 cada vez que se baraja un zapato nuevo.</li>
      </ul>
      <p style="opacity:.7;margin-top:10px">Las cifras de ventaja y las desviaciones son aproximadas. Aquí los sidebets y el seguro (que no existe) no se incluyen en el cálculo.</p>
    </div>`;
}
document.addEventListener('change',e=>{if(e.target.id==='hideCnt'){S.hideCount=e.target.checked;renderPanel()}});
function renderStrat(){
  const hint=stratHint();
  $('stratBody').innerHTML=`<div class="sgrid">${stTable('Totales duros','hard',ST_HARD,hint)}${stTable('Totales suaves','soft',ST_SOFT,hint)}${stTable('Dividir pares','pair',ST_PAIR,hint)}${stTable(T().min<SURR_MIN?`Rendición · solo con apuesta de ${fmt(SURR_MIN)}+`:'Rendición','sur',ST_SUR,hint)}</div>
    <div class="skey"><span><b class="H">H</b>Pedir</span><span><b class="S">S</b>Plantarse</span><span><b class="D">D</b>Doblar (si no, pedir)</span>
    <span><b class="Ds">Ds</b>Doblar (si no, plantarse)</span><span><b class="SUR">SUR</b>Rendirse</span><span><b class="Y">Y</b>Dividir</span><span><b class="N">N</b>No dividir</span></div>
    <div class="snote">Columnas: carta visible del dealer (2 a A). ${hint?'El recuadro blanco marca la jugada para tu mano actual y se actualiza solo. ':'Durante una mano, el recuadro blanco marcará tu jugada. '}Esta mesa permite doblar después de dividir, por eso los pares 2,2 / 3,3 / 4,4 / 6,6 con "Y/N" se muestran como dividir. La rendición (SUR) devuelve la mitad y solo es posible como primera jugada${T().min<SURR_MIN?`, con una apuesta de ${fmt(SURR_MIN)} o más (con menos, juega la tabla normal)`:''}. Sin seguro (nunca lo tomes).</div>`;
}
document.addEventListener('click',e=>{
  const open=$('strat').classList.contains('open'),tb=e.target.closest('[data-tab]');
  if(e.target.closest('#stratBtn'))setStrat(!(open&&S.tab==='strat'),'strat');
  else if(e.target.closest('#countBtn'))setStrat(!(open&&S.tab==='count'),'count');
  else if(tb)setStrat(true,tb.dataset.tab);
  else if(e.target.closest('#stratX'))setStrat(false);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setStrat(false);$('modal').hidden=true}});
/* ---------- sin saldo: recompra o resumen de la sesión ---------- */
