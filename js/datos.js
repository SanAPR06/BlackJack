/* Datos y estado: constantes, mesas (límites, fichas, premios, música), estado del juego, zapato, cartas, reglas de dividir y rendirse.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const chipLabel=n=>n>=1000?n/1000+'K':n, SHOE_SIZE=416, CUT=SHOE_SIZE*0.25;
/* ---- Mesas: cada una con sus límites, saldo de entrada, fichas, bote propio y una lista de música que sube de intensidad ---- */
const TABLES={
  caracas:{id:'caracas',name:'Caracas',min:5,max:250,buyMin:100,buyMax:5000,presets:[100,500,1000,2500,5000],chips:[5,10,25,50,100],seed:1000,jokers:2,cutCard:'yellow',prizes:['b678'],cnt:{},energy:1,tag:'Caribe y bossa · relajado',playlist:[['piano','lofi'],['lofi','bossa'],['bossa','salsa'],['salsa','bossa']]},
  madrid:{id:'madrid',name:'Madrid',min:20,max:1000,buyMin:500,buyMax:20000,presets:[500,2000,5000,10000,20000],chips:[5,25,100,500,1000],seed:5000,cutCard:'purple',prizes:['reyreina','lluvia','b777','siesta'],cnt:{},energy:2,tag:'Guitarra y flamenco',playlist:[['guitarra','lofi'],['guitarra','jazz'],['flamenco','jazz'],['flamenco','guitarra']]},
  monaco:{id:'monaco',name:'Monaco',min:100,max:5000,buyMin:2500,buyMax:100000,presets:[2500,10000,25000,50000,100000],chips:[25,100,500,1000,5000],seed:25000,cutCard:'red',prizes:['palo21','bKA','doble007'],cnt:{6:12},energy:3,tag:'Elegancia y suspenso',playlist:[['piano','noir'],['noir','cinematic'],['cinematic','jazz'],['cinematic','synth']]},
  vegas:{id:'vegas',name:'Las Vegas',min:500,max:25000,buyMin:10000,buyMax:1000000,presets:[10000,50000,100000,250000,1000000],chips:[100,500,1000,5000,25000],seed:100000,cutCard:'yellow',prizes:['picas21','doble'],cnt:{5:3,7:25,8:100},energy:4,tag:'Swing, funk y house · a todo volumen',playlist:[['swing','jazz'],['swing','funk'],['funk','synth'],['house','funk','synth']]}
};
const TABLE_ORDER=['caracas','madrid','monaco','vegas'];
const T=()=>TABLES[S.table]||TABLES.caracas;
const sideMax=()=>T().max/10,sideMin=()=>T().chips[0]; // sidebets: de la ficha más chica hasta una décima del máximo de la mesa
// bonos de la mano (multiplicador N:1). Más raros = pagan más. Probabilidades por mano (estrategia básica, 8 mazos):
// 6-7-8 ≈ 1 en 600 (suited ≈ 1 en 9,600) · 7-7-7 ≈ 1 en 4,300 (suited ≈ 1 en 95,000) · K-A de picas ≈ 1 en 1,350
// 21 con 7+ cartas ≈ 1 en 38,000 · 21 con 8+ cartas ≈ 1 en 242,000
const BONUS_KA=7,B678=[3,20],B777=[6,30],SIESTA=1,DOBLE007=50; // [normal, mismo palo]
const BIG_PRIZE=12; // los premios de mano que pagan 12:1 o más son "premios gordos" (fanfarria, luces y celebración)
const PICAS21=12,LLUVIA=20,REYREINA=2,PALO21=2; // premios exclusivos: 21 de picas, 5 cartas rojas, Rey y Reina (extra), blackjack de palo
const POT_RATE=.03; // bote progresivo de cada mesa: arranca en su base y recibe el 3% de cada apuesta 21+3
const isRed=s=>s==='♥'||s==='♦';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=n=>'$'+n.toLocaleString('en-US',Number.isInteger(n)?{}:{minimumFractionDigits:2,maximumFractionDigits:2});

const S={table:'caracas',pick:'caracas',balance:1000,bank:1000,initial:1000,pot:1000,ratings:[],dec:[],rate:null,nHands:2,chip:25,phase:'bet',shoe:[],spots:[],dealer:[],hole:true,cur:null,
  log:[],sbProfit:0,last:null,msg:'Elige el número de manos y coloca tus apuestas.',busy:false};

function rand(n){const a=new Uint32Array(1);const lim=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=lim);return a[0]%n}
function newShoe(){
  const s=[];for(let d=0;d<8;d++)for(const su of SUITS)for(const r of RANKS)s.push({r,s:su});
  for(let k=0;k<(T().jokers||0);k++)s.push({r:'JK',s:'★'}); // Caracas: jokers dentro del zapato
  for(let i=s.length-1;i>0;i--){const j=rand(i+1);[s[i],s[j]]=[s[j],s[i]]}
  S.shoe=s;S.needCut=true;S.cutReached=false;S.count=0;S.seen={low:0,mid:0,high:0};S.seenRank={};
}
let uid=0;
function draw(){
  if(!S.shoe.length)newShoe();
  const c=S.shoe.pop();c.id=++uid;
  if(!S.cutReached&&T().cutCard&&S.shoe.length<=CUT){ // Caracas: sale la carta de corte
    S.cutReached=true;toast('Salió la carta de corte: esta es la última ronda antes de barajar');sfx('cut');
  }
  return c;
}
function drawDealer(){ // el Joker no le sirve al dealer: se descarta y toma otra carta
  let c=draw();
  while(c.r==='JK'){toast('El dealer recibió un Joker: no cuenta, toma otra carta');c=draw()}
  return c;
}
function cv(c){return c.r==='JK'?0:c.r==='A'?11:('JQK'.includes(c.r)||c.r==='10')?10:+c.r}
function total(cards){ // el Joker es comodín: la mano del jugador que lo tiene vale 21
  if(cards.some(c=>c.r==='JK'))return 21;
  let t=0,a=0;for(const c of cards){t+=cv(c);if(c.r==='A')a++}while(t>21&&a){t-=10;a--}return t}
function isBJ(cards){return cards.length===2&&total(cards)===21}

function mkSpots(){S.spots=Array.from({length:S.nHands},()=>({main:0,pp:0,p3:0,hands:[],split:false}))}
mkSpots();

/* Dividir: no-ases hasta 4 manos por posición; ases solo una vez (sin re-dividir ases) */
const MAX_HANDS=4;
function splittable(s,h){
  const c=h.cards;
  if(c.length!==2||cv(c[0])!==cv(c[1])||s.hands.length>=MAX_HANDS)return false;
  return !(c[0].r==='A'&&s.hands.length>1);
}
const canSplit=(s,h)=>splittable(s,h)&&S.balance>=h.bet;
/* Rendición tardía: solo como primera decisión (2 cartas, sin dividir ni doblar) y únicamente si la apuesta de la mano es de $10 o más; devuelve la mitad */
const SURR_MIN=10;
const canSurrender=(s,h)=>h.cards.length===2&&!s.split&&!h.doubled&&!h.bj&&h.bet>=SURR_MIN;
function tableBet(){return S.spots.reduce((a,s)=>a+s.pp+s.p3+(s.hands.length?s.hands.reduce((x,h)=>x+h.bet,0):s.main),0)}

/* ---------- audio: efectos y música generados con Web Audio (sin archivos externos) ---------- */
