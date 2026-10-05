/* Audio: contexto Web Audio, osciladores, ruido y efectos de sonido.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
const AUDIO={ctx:null,sfx:null,master:null,sfxEcho:null,mus:null,echo:null,noise:null,timer:null,voices:[],rot:0,last:{},vol:{sfx:.7,mus:.5},on:{sfx:true,mus:true},style:'auto',styleSet:false,playing:'jazz'};
// style 'auto' = la lista de la mesa, que sube de intensidad con las rondas; cualquier otro valor fija un estilo
try{const p=JSON.parse(localStorage.getItem('bj-audio')||'null');if(p){Object.assign(AUDIO.vol,p.vol);Object.assign(AUDIO.on,p.on);if(p.styleSet&&typeof p.style==='string'){AUDIO.style=p.style;AUDIO.styleSet=true}}}catch(e){}
const saveAudio=()=>{try{localStorage.setItem('bj-audio',JSON.stringify({vol:AUDIO.vol,on:AUDIO.on,style:AUDIO.style,styleSet:AUDIO.styleSet}))}catch(e){}};
function initAudio(){ // los navegadores exigen un gesto del usuario antes de sonar
  if(AUDIO.ctx){if(AUDIO.ctx.state!=='running')AUDIO.ctx.resume();return} // iOS puede dejarlo "interrupted" tras una llamada o al volver a la app
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const c=AUDIO.ctx=new AC();
  AUDIO.sfx=c.createGain();AUDIO.master=c.createGain(); // master = volumen general de la música; cada "voz" (estilo que suena) tiene su propio bus
  const comp=c.createDynamicsCompressor();AUDIO.sfx.connect(comp);AUDIO.master.connect(comp);comp.connect(c.destination);
  const buf=c.createBuffer(1,c.sampleRate,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AUDIO.noise=buf;
  AUDIO.sfxEcho=makeEcho(c,AUDIO.sfx,.3,.25,.35); // eco de los efectos (campanas)
  applyAudio();if(AUDIO.on.mus)startMusic();
  if(typeof applyVibe==='function')applyVibe();
}
function makeEcho(c,dest,time,fbk,wetAmt){ // retardo con realimentación que vuelve a "dest"
  const dl=c.createDelay(1),fb=c.createGain(),wet=c.createGain();
  dl.delayTime.value=time;fb.gain.value=fbk;wet.gain.value=wetAmt;
  dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(dest);return dl;
}
function applyAudio(){
  if(!AUDIO.ctx)return;const t=AUDIO.ctx.currentTime;
  AUDIO.sfx.gain.setTargetAtTime(AUDIO.on.sfx?AUDIO.vol.sfx:0,t,.05);
  AUDIO.master.gain.setTargetAtTime(AUDIO.on.mus?AUDIO.vol.mus*.45:0,t,.25);
}
function tone(f,dur,o={}){
  const c=AUDIO.ctx,t=c.currentTime+(o.when||0),osc=c.createOscillator(),g=c.createGain();
  osc.type=o.type||'sine';osc.frequency.setValueAtTime(f,t);if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.vol??.2,t+(o.attack??.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(g);g.connect(o.dest||AUDIO.sfx);
  const ec=o.dest&&o.dest!==AUDIO.sfx?AUDIO.echo:AUDIO.sfxEcho; // la música usa el eco de su voz; los efectos, el suyo
  if(o.send&&ec)g.connect(ec);
  osc.start(t);osc.stop(t+dur+.05);
}
function noise(dur,o={}){
  const c=AUDIO.ctx,t=c.currentTime+(o.when||0),src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  src.buffer=AUDIO.noise;src.loop=true;f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f||2000,t);
  if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,t+dur);f.Q.value=o.q||1;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.vol??.2,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(f);f.connect(g);g.connect(o.dest||AUDIO.sfx);src.start(t,Math.random()*.5);src.stop(t+dur+.05);
}
const chipSound=(w=0)=>{tone(2100,.05,{type:'triangle',vol:.14,when:w});tone(1500,.07,{type:'triangle',vol:.12,when:w+.035});noise(.03,{f:4000,q:2,vol:.08,when:w})};
const SFX={
  deal(){noise(.11,{f:1800,to:5200,q:.8,vol:.28});noise(.05,{f:300,type:'lowpass',vol:.18,when:.07})},
  flip(){noise(.09,{f:4500,to:1800,q:.8,vol:.22});tone(180,.06,{type:'triangle',vol:.12,when:.08})},
  chip(){chipSound()},
  tick(){tone(900,.03,{vol:.06})},
  shuffle(){for(let i=0;i<14;i++)noise(.07,{f:2500+Math.random()*2500,q:.7,vol:.17,when:i*.065})},
  cut(){tone(110,.18,{type:'sine',vol:.3,to:60});noise(.1,{f:600,type:'lowpass',vol:.2})},
  win(){[523,659,784,1047].forEach((f,i)=>tone(f,.28,{type:'triangle',vol:.2,when:i*.1}));for(let i=0;i<6;i++)chipSound(.3+i*.06+Math.random()*.03)}, // fichas cayendo al cobrar
  bigwin(){[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.4,{type:'triangle',vol:.2,when:i*.09}));for(let i=0;i<14;i++)chipSound(.35+i*.065+Math.random()*.03)},
  lose(){tone(330,.3,{vol:.22});tone(247,.45,{vol:.22,when:.22})},
  push(){tone(440,.25,{vol:.15});tone(440,.25,{vol:.12,when:.18})},
  bust(){tone(180,.35,{type:'sawtooth',vol:.12,to:70});noise(.2,{f:400,type:'lowpass',vol:.2})},
  bonus(){tone(1319,.6,{vol:.14,send:true});tone(1760,.7,{vol:.1,when:.08,send:true})},
  bills(){noise(.17,{f:3300,to:1300,q:.5,vol:.2});noise(.09,{f:5400,q:.8,vol:.1,when:.05})}, // crujido de billetes
  // sidebet ganado: tres campanas ascendentes y fichas
  sidewin(){[1047,1319,1568].forEach((f,i)=>tone(f,.55,{vol:.17,when:i*.09,send:true}));for(let i=0;i<8;i++)chipSound(.3+i*.06+Math.random()*.03)},
  // MEGA JACKPOT: la fanfarria más larga, con campanas en oleadas y una avalancha de fichas
  mega(){
    [523,659,784,1047,1319,1568,2093].forEach((f,i)=>tone(f,.5,{type:'triangle',vol:.2,when:i*.1}));
    [0,.7,1.4,2.1].forEach(w=>[1047,1319,1568,2093].forEach((f,i)=>tone(f,.9,{vol:.12,when:.8+w+i*.06,send:true})));
    tone(130,1.4,{type:'sawtooth',vol:.05,to:260});
    for(let i=0;i<45;i++)chipSound(.5+i*.06+Math.random()*.03);
  },
  // bono 6-7-8 / 7-7-7 / K-A de picas / 21 con 7 cartas / sidebet grande: fanfarria completa
  jackpot(){
    [523,659,784,1047,784,1047,1319,1568].forEach((f,i)=>tone(f,.35,{type:'triangle',vol:.2,when:i*.08}));
    [1319,1760,2093].forEach((f,i)=>tone(f,.9,{vol:.13,when:.55+i*.1,send:true}));
    for(let i=0;i<18;i++)chipSound(.4+i*.06+Math.random()*.03);
  }
};
function sfx(n){
  if(!AUDIO.ctx||!AUDIO.on.sfx)return;
  const now=performance.now();if(now-(AUDIO.last[n]||0)<40)return;AUDIO.last[n]=now;
  try{SFX[n]()}catch(e){}
}
/* Música: lounge de jazz generativo (ii-V-I-VI7 en Do, 84 bpm con swing): bajo caminante, acordes, escobillas y notas sueltas */
