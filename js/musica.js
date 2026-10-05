/* Música generativa: motor con fundido cruzado, instrumentos, los estilos de cada mesa, etapas de intensidad y controles de audio.
   (Script clásico: comparte las variables globales con los demás archivos de js/; el orden de carga está en index.html.) */
const CHORDS=[{b:[38,41,45,48],v:[53,57,60,64]},{b:[43,47,50,53],v:[53,59,62,67]},{b:[48,52,55,47],v:[52,59,62,67]},{b:[45,49,52,55],v:[55,61,64,69]}];
const MEL=[74,76,79,81,84],BEAT=60/84,mtof=m=>440*Math.pow(2,(m-69)/12);
/* ---- Motor de música: cada estilo que suena es una "voz" con su bus de volumen, su planificador y su eco.
   Para cambiar de estilo se hace un fundido cruzado: la voz vieja baja mientras la nueva sube. ---- */
const FADE_SEC=2.4, ROTATE_SEC=150; // en modo automático se rota a otro estilo de la misma etapa cada ~2.5 min
function makeVoice(styleKey,fadeIn){
  const c=AUDIO.ctx,st=STYLES[styleKey]||STYLES.jazz,t=c.currentTime;
  const bus=c.createGain();bus.connect(AUDIO.master);
  bus.gain.setValueAtTime(.0001,t);bus.gain.linearRampToValueAtTime(st.trim||1,t+fadeIn); // trim = ajuste de volumen para que todos los estilos suenen igual de fuertes
  const v={style:styleKey,st,bus,echo:makeEcho(c,bus,.36,.3,.4),step:0,next:t+.15,t0:t,timer:null};
  v.timer=setInterval(()=>voiceTick(v),90);return v;
}
function voiceTick(v){
  const c=AUDIO.ctx,keepM=AUDIO.mus,keepE=AUDIO.echo;
  AUDIO.mus=v.bus;AUDIO.echo=v.echo; // las funciones de los estilos escriben en AUDIO.mus / AUDIO.echo
  try{
    while(v.next<c.currentTime+.4){
      v.st.step(v.step,v.next-c.currentTime);
      v.next+=60/v.st.bpm/2*(v.step%2===0?1+v.st.swing:1-v.st.swing);v.step=(v.step+1)%v.st.len;
      if(v.step===0&&v===AUDIO.voices[0])onCycle(v);
    }
  }finally{AUDIO.mus=keepM;AUDIO.echo=keepE}
}
function onCycle(v){ // al terminar una vuelta del patrón: en automático, tras un rato rota a otro estilo para no cansar
  if(AUDIO.style==='auto'&&AUDIO.ctx.currentTime-v.t0>ROTATE_SEC){AUDIO.rot++;switchMusic()}
}
function fadeOutVoice(v,sec){
  const c=AUDIO.ctx,t=c.currentTime;
  v.bus.gain.cancelScheduledValues(t);v.bus.gain.setValueAtTime(Math.max(v.bus.gain.value,.0001),t);v.bus.gain.linearRampToValueAtTime(.0001,t+sec);
  setTimeout(()=>{clearInterval(v.timer);try{v.bus.disconnect()}catch(e){}},sec*1000+900); // sigue planificando durante el fundido
}
function startMusic(){
  if(!AUDIO.ctx||AUDIO.voices.length)return;
  AUDIO.playing=curStyle();const v=makeVoice(AUDIO.playing,.9);AUDIO.voices=[v];AUDIO.timer=v.timer;
}
function stopMusic(){AUDIO.voices.forEach(v=>fadeOutVoice(v,.5));AUDIO.voices=[];AUDIO.timer=null}
function switchMusic(){ // fundido cruzado hacia el estilo que toca ahora
  if(!AUDIO.ctx||!AUDIO.on.mus)return;
  if(!AUDIO.voices.length){startMusic();return}
  const want=curStyle();if(want===AUDIO.playing)return;
  AUDIO.voices.forEach(v=>fadeOutVoice(v,FADE_SEC));
  AUDIO.playing=want;const nv=makeVoice(want,FADE_SEC);AUDIO.voices=[nv];AUDIO.timer=nv.timer;
  // subida de ruido que desemboca en un golpe grave cuando termina el fundido (transición tipo DJ)
  noise(FADE_SEC,{f:500,to:6500,type:'highpass',q:1,vol:.05,dest:AUDIO.master});
  tone(95,1.1,{type:'sine',vol:.22,to:48,when:FADE_SEC,dest:AUDIO.master});
  applyVibe();
}
/* ---- instrumentos y batería compartidos por los estilos ---- */
function ftone(f,dur,o={}){ // oscilador con filtro pasa-bajos (pads, sintes, bajos)
  const c=AUDIO.ctx,t=c.currentTime+(o.when||0),osc=c.createOscillator(),fl=c.createBiquadFilter(),g=c.createGain();
  const v=o.vol??.1,at=o.attack??.3,hold=Math.max(dur-(o.release??.4),at);
  osc.type=o.type||'sawtooth';osc.frequency.setValueAtTime(f,t);if(o.detune)osc.detune.value=o.detune;
  fl.type='lowpass';fl.frequency.setValueAtTime(o.cut||900,t);fl.Q.value=o.q||1;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+at);g.gain.setValueAtTime(v,t+hold);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(fl);fl.connect(g);g.connect(AUDIO.mus);if(o.send&&AUDIO.echo)g.connect(AUDIO.echo);osc.start(t);osc.stop(t+dur+.05);
}
const rhodes=(f,d,w,v)=>{tone(f,d,{vol:v,when:w,attack:.012,dest:AUDIO.mus,send:true,type:'triangle'});tone(f*2,d*.35,{vol:v*.35,when:w,dest:AUDIO.mus})};
const pluck=(f,d,w,v)=>{tone(f,d,{type:'triangle',vol:v,when:w,attack:.004,dest:AUDIO.mus});tone(f*2,d*.5,{vol:v*.3,when:w,dest:AUDIO.mus})};
const kick=(w,v=.5)=>tone(120,.22,{vol:v,to:45,when:w,attack:.003,dest:AUDIO.mus});
const snare=(w,v=.2)=>{noise(.16,{f:2200,q:.8,vol:v,when:w,dest:AUDIO.mus});tone(190,.09,{type:'triangle',vol:v*.5,when:w,dest:AUDIO.mus})};
const hat=(w,v=.03,len=.04)=>noise(len,{f:8500,type:'highpass',vol:v,when:w,dest:AUDIO.mus});
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* ---- Lo-fi chill: Cmaj9 · Am9 · Dm9 · G13, 74 bpm, piano eléctrico, bombo suave y crujido de vinilo ---- */
const LOFI=[{b:48,v:[52,55,59,62]},{b:45,v:[55,59,60,64]},{b:50,v:[53,57,60,64]},{b:43,v:[53,59,62,64]}],LMEL=[69,72,74,76,79,81];
function lofiStep(s,w){
  const B=60/74,M=AUDIO.mus,e=s&7,ch=LOFI[s>>3];
  if(e===0||e===3)ch.v.forEach(n=>rhodes(mtof(n),B*(e===0?2.2:1.2),w,.08));
  if(e===0)tone(mtof(ch.b),B*1.9,{vol:.55,when:w,attack:.02,dest:M});
  if(e===4)tone(mtof(ch.b),B*1.3,{vol:.4,when:w,attack:.02,dest:M});
  if(e===0||e===5)kick(w,.42);
  if(e===2||e===6)snare(w,.12);
  if(Math.random()<.8)hat(w,e%2?.016:.028);
  if(Math.random()<.5)noise(.02,{f:6000,type:'highpass',vol:.014,when:w+Math.random()*.1,dest:M}); // crujido
  if(e%2===0&&Math.random()<.24)tone(mtof(pick(LMEL)),B*1.7,{vol:.07,when:w,attack:.012,dest:M,send:true});
}
/* ---- Bossa nova: Dm7 · G7 · Cmaj7 · A7, 116 bpm, guitarra sincopada, shaker y flauta ---- */
const BCH=[{b:50,v:[53,57,60,64]},{b:43,v:[53,59,62,65]},{b:48,v:[52,59,62,67]},{b:45,v:[55,61,64,67]}],BMEL=[74,76,77,81,84];
function bossaStep(s,w){
  const B=60/116,M=AUDIO.mus,e=s&7,ch=BCH[s>>3];
  if(e===0)tone(mtof(ch.b),B*1.2,{vol:.5,when:w,attack:.012,dest:M});
  if(e===3)tone(mtof(ch.b+7),B*.9,{vol:.4,when:w,attack:.012,dest:M});
  if([0,3,4,7].includes(e))ch.v.forEach((n,i)=>pluck(mtof(n),B*.55,w+i*.012,.065));
  hat(w,e%2?.018:.032,.03);
  if([0,3,6].includes(e))tone(1900,.04,{vol:.05,when:w,dest:M});
  if(e%2===0&&Math.random()<.22)tone(mtof(pick(BMEL)),B*1.5,{vol:.07,when:w,attack:.05,dest:M,send:true});
}
/* ---- Casino noir: Am · Fmaj7 · Dm · E7, 64 bpm, cuerdas graves, contrabajo y vibráfono ---- */
const NOIR=[{b:45,v:[57,60,64]},{b:41,v:[53,57,60,64]},{b:38,v:[50,57,62,65]},{b:40,v:[52,56,59,62]}],NMEL=[69,72,76,77,80,81,83],NWALK=[0,7,5,7];
function noirStep(s,w){
  const B=60/64,M=AUDIO.mus,e=s&7,ch=NOIR[s>>3];
  if(e===0)ch.v.forEach(n=>{ftone(mtof(n),B*4,{vol:.035,cut:650,attack:.9,release:1.2,send:true,detune:-6});ftone(mtof(n),B*4,{vol:.035,cut:650,attack:.9,release:1.2,detune:6})});
  if(e%2===0)tone(mtof(ch.b+NWALK[e/2]),B*.85,{type:'triangle',vol:.48,when:w,attack:.01,dest:M});
  if(e===2||e===6)noise(.2,{f:5000,type:'highpass',vol:.05,when:w,dest:M});
  if(e%2===1)hat(w,.012,.05);
  if(e%2===0&&Math.random()<.2){const f=mtof(pick(NMEL));tone(f,B*2.2,{vol:.09,when:w,attack:.006,dest:M,send:true});tone(f*3,B*.8,{vol:.025,when:w,dest:M,send:true})}
}
/* ---- Synthwave: Am · F · C · G, 102 bpm, arpegiador, bajo pulsante y bombo a negras ---- */
const SYN=[{b:45,v:[57,60,64]},{b:41,v:[53,57,60]},{b:48,v:[55,60,64]},{b:43,v:[55,59,62]}],ARP=[0,1,2,1,2,1,2,0];
function synthStep(s,w){
  const B=60/102,e=s&7,ch=SYN[s>>3];
  if(e===0)ch.v.forEach(n=>ftone(mtof(n),B*4,{vol:.03,cut:1300,attack:.5,release:.6,send:true}));
  ftone(mtof(ch.b),B*.45,{vol:.15,cut:420,attack:.005,release:.1,q:3,when:w});
  ftone(mtof(ch.v[ARP[e]%3]+12),B*.5,{vol:.05,cut:2600,attack:.005,release:.25,send:true,when:w});
  if(e%2===0)kick(w,.4);
  if(e===2||e===6)snare(w,.11);
  if(e%2===1)hat(w,.04,.09);
}
/* ---- Piano clásico: vals lento en sol y re mayor (3/4, 60 bpm) ---- */
const PCH=[{b:43,v:[59,62,66]},{b:38,v:[57,61,64]},{b:43,v:[59,62,66]},{b:38,v:[57,61,64]},{b:40,v:[55,59,62]},{b:45,v:[55,61,64]},{b:38,v:[57,61,64]},{b:38,v:[57,61,66]}],PMEL=[74,76,78,81,83,86];
function pianoStep(s,w){
  const B=1,M=AUDIO.mus,e=s%6,ch=PCH[Math.floor(s/6)];
  if(e===0){const n=mtof(ch.b);tone(n,B*3,{type:'triangle',vol:.5,when:w,attack:.01,dest:M});tone(n*2,B*1.5,{vol:.12,when:w,dest:M})}
  if(e===2||e===4)ch.v.forEach((n,i)=>pluck(mtof(n),B*2.2,w+i*.03,.06));
  if((e===0&&Math.random()<.5)||(e===3&&Math.random()<.3))tone(mtof(pick(PMEL)),B*2.6,{vol:.08,when:w+.02,attack:.012,dest:M,send:true});
}
/* ===== Estilos con identidad de mesa =====
   Caracas: salsa suave · Madrid: guitarra y flamenco · Monaco: cinematográfico · Las Vegas: swing de big band y funk ===== */
/* ---- Salsa (Caracas): Am · Dm · E7 · Am, 96 bpm, clave 3-2, tumbao de bajo, congas, campana y montuno de piano ---- */
const SAL=[{b:45,v:[57,60,64]},{b:50,v:[57,62,65]},{b:40,v:[56,59,64]},{b:45,v:[57,60,64]}],SALM=[69,72,76,77,79,81];
function salsaStep(s,w){
  const B=60/96,M=AUDIO.mus,bar=s>>3,e=s&7,ch=SAL[bar];
  if(e===3||e===6||(e===0&&bar%2===0))tone(mtof(e===6?ch.b+7:ch.b),B*.9,{vol:.5,when:w,attack:.01,dest:M});                 // tumbao
  if((bar%2===0?[0,3,6]:[2,4]).includes(e))tone(1900,.04,{vol:.05,when:w,dest:M});                                          // clave 3-2
  if(e%2===0)tone(560,.05,{type:'square',vol:.018,when:w,dest:M});                                                          // campana
  if(e===3||e===7)tone(230,.12,{type:'triangle',vol:.1,when:w,to:170,dest:M});                                              // conga abierta
  if(e===5||e===1)noise(.05,{f:1800,q:2,vol:.07,when:w,dest:M});                                                            // conga slap
  if([1,3,4,6].includes(e))ch.v.forEach((n,i)=>pluck(mtof(n+(i===2?12:0)),B*.5,w+i*.008,.06));                              // montuno
  hat(w,.02,.03);
  if(e===0&&bar===3)noise(B*2,{f:3000,to:7000,type:'highpass',vol:.05,when:w,dest:M});                                      // barrido hacia la repetición
  if(e%2===0&&Math.random()<.2)tone(mtof(pick(SALM)),B*.9,{type:'triangle',vol:.07,when:w,attack:.01,dest:M,send:true});
}
/* ---- Guitarra (Madrid, tranquila): arpegios de guitarra española sobre Am · G · F · E (cadencia andaluza), 72 bpm ---- */
const GUI=[[45,52,57,60,64],[43,50,55,59,62],[41,48,53,57,60],[40,47,52,56,59]],GPAT=[0,2,3,4,3,2,3,1];
function guitarraStep(s,w){
  const B=60/72,M=AUDIO.mus,bar=s>>3,e=s&7,ch=GUI[bar];
  tone(mtof(ch[GPAT[e]]),B*1.1,{type:'triangle',vol:.1,when:w,attack:.004,dest:M,send:true});tone(mtof(ch[GPAT[e]])*2,B*.4,{vol:.03,when:w,dest:M});
  if(e===0)tone(mtof(ch[0]-12),B*2,{vol:.35,when:w,attack:.02,dest:M});                                                     // bajo
  if(e===4)noise(.05,{f:900,q:3,vol:.05,when:w,dest:M});                                                                    // golpe en la tapa
  if(e===0&&bar===3)noise(B*2,{f:2500,to:6000,type:'highpass',vol:.03,when:w,dest:M});
  if(e%4===2&&Math.random()<.3)tone(mtof(pick([64,65,67,69,71,72])),B*1.6,{type:'triangle',vol:.07,when:w,attack:.01,dest:M,send:true}); // frase frigia
}
/* ---- Flamenco (Madrid, intenso): rumba flamenca en Am · G · F · E, 104 bpm, rasgueos, palmas y cajón ---- */
function flamencoStep(s,w){
  const B=60/104,M=AUDIO.mus,bar=s>>3,e=s&7,ch=GUI[bar];
  if([0,3,4,6].includes(e))ch.forEach((n,i)=>pluck(mtof(n),B*.5,w+i*.011,e===0||e===4?.09:.06));                              // rasgueado
  if(e===0||e===4)tone(mtof(ch[0]-12),B*.9,{vol:.45,when:w,attack:.01,dest:M});                                              // bajo
  if(e===2||e===6)noise(.08,{f:1900,q:1.2,vol:.14,when:w,dest:M});                                                          // palmas
  if(e===1||e===5)noise(.04,{f:1500,q:1.5,vol:.05,when:w,dest:M});                                                          // palmas sordas
  if(e===0)tone(105,.2,{vol:.35,to:60,when:w,dest:M});                                                                      // cajón grave
  if(e===4||e===7)noise(.06,{f:2600,q:1.5,vol:.09,when:w,dest:M});                                                          // cajón agudo
  if(e%2===0&&Math.random()<.4)pluck(mtof(pick([64,65,67,69,71,72,76])),B*.8,w,.08);                                         // falseta
  if(bar===3&&e>=4)noise(B/2,{f:1500+e*400,type:'highpass',vol:.03+e*.006,when:w,dest:M});
}
/* ---- Cinematográfico (Monaco): Am · F · Dm · E, 84 bpm, cuerdas en ostinato, timbales y subidas de tensión ---- */
const CIN=[{b:33,v:[57,60,64]},{b:29,v:[57,60,65]},{b:38,v:[57,62,65]},{b:40,v:[56,59,64]}];
function cinematicStep(s,w){
  const B=60/84,M=AUDIO.mus,bar=s>>3,e=s&7,ch=CIN[bar];
  ftone(mtof(ch.v[[0,1,2,1,2,1,0,1][e]]+12),B*.55,{vol:.04,cut:1500,attack:.01,release:.2,send:true,when:w});               // ostinato de cuerdas
  if(e===0){ch.v.forEach(n=>ftone(mtof(n),B*4,{vol:.03,cut:900,attack:.6,release:.8,send:true}));ftone(mtof(ch.b+24),B*4,{vol:.12,cut:300,attack:.3,release:.8})} // pad y cello
  if(e===0||(e===4&&bar%2===1))tone(75,.5,{vol:.55,to:42,when:w,dest:M});                                                   // timbal
  if(e===6&&bar===3){for(let k=0;k<2;k++)snare(w+k*B/4,.08+k*.04)}                                                           // redoble
  if(bar===3)noise(B/2,{f:500+e*600,type:'highpass',q:1.2,vol:.025+e*.008,when:w,dest:M});                                   // tensión
  if(e===0&&bar===0)noise(1.2,{f:5000,type:'highpass',vol:.04,when:w,dest:M});
}
/* ---- Swing de big band (Las Vegas): Dm7 · G7 · Cmaj7 · A7, 138 bpm, bajo caminante, ride, metales y piano ---- */
function swingStep(s,w){
  const B=60/138,M=AUDIO.mus,bar=s>>3,e=s&7,ch=CHORDS[bar];
  if(e%2===0){const n=mtof(ch.b[e/2]);tone(n,B*.9,{type:'triangle',vol:.55,when:w,attack:.01,dest:M});kick(w,.16)}        // bajo caminante y bombo ligero
  hat(w,e%2===0?.04:.025,.05);                                                                                              // ride
  if(e===3||e===7)noise(.05,{f:7500,type:'highpass',vol:.03,when:w,dest:M});
  if(e===2||e===6)snare(w,.05);
  if(e===3||e===7||(e===0&&bar===3))ch.v.forEach((n,i)=>ftone(mtof(n+12),B*.3,{type:'sawtooth',vol:.05,cut:2000,attack:.006,release:.08,send:true,when:w+i*.004})); // metales
  if(e===1||e===5)ch.v.forEach(n=>pluck(mtof(n),B*.4,w,.04));                                                               // piano
  if(e%2===1&&Math.random()<.25)tone(mtof(pick([74,76,79,81,84])),B*.7,{vol:.07,when:w,attack:.01,dest:M,send:true});
}
/* ---- Funk (Las Vegas): vamp de Em7 y A7, 108 bpm, bajo de slap, guitarra con sordina y batería apretada en semicorcheas ---- */
const FUNK=[{b:40,v:[55,59,62,64]},{b:40,v:[55,59,62,64]},{b:45,v:[55,61,64,67]},{b:40,v:[55,59,62,64]}];
const FK_KICK=[0,6,10],FK_SNARE=[4,12],FK_BASS=[0,3,6,7,10,12,14],FK_GTR=[2,5,9,13];
function funkStep(s,w){
  const B=60/108,Q=B/4,M=AUDIO.mus,bar=s>>3,e=s&7,ch=FUNK[bar];
  for(let k=0;k<2;k++){
    const i=e*2+k,t=w+k*Q;
    if(FK_KICK.includes(i))kick(t,.6);
    if(FK_SNARE.includes(i))snare(t,.17);
    hat(t,i%4===0?.035:.018,.03);
    if(FK_BASS.includes(i))ftone(mtof(ch.b+(i===7||i===14?12:0)),Q*1.6,{vol:.22,cut:700,attack:.003,release:.05,q:4,when:k*Q+w-0});
    if(FK_GTR.includes(i)){noise(.04,{f:2800,q:3,vol:.09,when:t,dest:M});ch.v.slice(0,3).forEach(n=>pluck(mtof(n),Q*.8,t,.04))}
  }
  if(e===0&&bar===0)noise(.9,{f:6000,type:'highpass',vol:.05,when:w,dest:M});
  if(e%2===0&&Math.random()<.2)ftone(mtof(pick([67,71,74,76,79])),B*.5,{type:'square',vol:.035,cut:2200,attack:.004,release:.2,send:true,when:w});
}
/* ---- House trancado (tech/deep house), 126 bpm, 8 compases: Am7 · Fmaj7 · Am7 · G7.
   Bombo a negras, bajo rodante en semicorcheas, hi-hats con ghost notes, palmas, stabs, percusión, y estructura:
   compases 1-6 groove · 7 breakdown (sin bombo ni bajo, arpegio y subida) · 8 build con redoble de caja → vuelve el golpe ---- */
/* El house cambia en cada vuelta de 16 compases (~30 s): progresión de acordes, patrón de bajo, ritmo de los stabs, motivo de melodía y
   hats se sortean de nuevo, y la estructura es: 1-4 intro (sin stabs) · 5-8 groove · 9-12 groove completo con motivo · 13 breakdown ·
   14-15 build con redoble y subida · 16 relleno y vuelta con platillo. Así no se repite igual mientras juegas. */
const HPROGS=[ // 8 acordes de 2 compases cada uno
  [[45,[57,60,64,67]],[45,[57,60,64,67]],[41,[57,60,64,65]],[41,[57,60,64,65]],[45,[57,60,64,67]],[45,[59,62,64,67]],[43,[55,59,62,65]],[43,[55,59,62,65]]],
  [[45,[57,60,64,67]],[38,[57,60,62,65]],[41,[57,60,64,65]],[40,[56,59,62,64]],[45,[57,60,64,67]],[38,[57,60,62,65]],[41,[57,60,64,65]],[40,[56,59,62,64]]],
  [[41,[57,60,64,65]],[43,[55,59,62,65]],[45,[57,60,64,67]],[45,[57,60,64,67]],[41,[57,60,64,65]],[43,[55,59,62,65]],[45,[57,60,64,67]],[40,[56,59,62,64]]],
  [[38,[57,60,62,65]],[43,[55,59,62,65]],[48,[55,59,64,67]],[45,[57,60,64,67]],[38,[57,60,62,65]],[43,[55,59,62,65]],[48,[55,59,64,67]],[45,[57,60,64,67]]]];
const HBASS=[ // patrones de bajo en semicorcheas (16 por compás) y su transposición
  {g:[0,0,1,1, 0,0,1,0, 0,0,1,1, 0,1,1,0],p:[0,0,0,12, 0,0,0,0, 0,0,0,12, 0,0,7,0]},
  {g:[0,1,0,1, 0,0,1,0, 0,1,0,1, 0,0,1,1],p:[0,12,0,12, 0,0,7,0, 0,12,0,12, 0,0,7,5]},
  {g:[0,0,1,0, 0,1,0,1, 0,0,1,0, 1,0,1,0],p:[0,0,0,0, 0,12,0,7, 0,0,0,0, 12,0,7,0]},
  {g:[0,1,1,0, 0,0,1,1, 0,1,1,0, 0,1,0,1],p:[0,12,0,0, 0,0,7,12, 0,12,0,0, 0,5,0,7]}];
const HSTAB=[[0,3,6],[0,3,5],[1,4,7],[0,2,5]];
const HMEL=[69,72,74,76,79,81,84];
let HS={cycle:-1};
function houseNewCycle(){
  const motif=Array.from({length:4},()=>pick(HMEL));
  HS={cycle:(HS.cycle||0)+1,prog:Math.floor(Math.random()*HPROGS.length),bassA:Math.floor(Math.random()*HBASS.length),bassB:Math.floor(Math.random()*HBASS.length),
      stab:Math.floor(Math.random()*HSTAB.length),stabB:Math.floor(Math.random()*HSTAB.length),motif,hatOpen:Math.random()<.6,perc:.25+Math.random()*.3};
}
function houseStep(s,w){
  if(s===0||HS.prog===undefined)houseNewCycle();
  const B=60/126,Q=B/4,M=AUDIO.mus,bar=s>>3,e=s&7,sec=bar<4?0:bar<8?1:bar<12?2:bar===12?3:bar<15?4:5; // sección
  const ch=HPROGS[HS.prog][bar>>1],bs=ch[0],vs=ch[1];
  const groove=sec<=2||sec===5,breakdown=sec===3,build=sec===4;
  const bass=HBASS[bar<8?HS.bassA:HS.bassB],stabPat=HSTAB[bar<8?HS.stab:HS.stabB];
  if(bar===0&&e===0)noise(1.3,{f:6000,type:'highpass',vol:.07,when:w,dest:M});           // platillo al volver
  const kickOn=(sec>=1&&groove&&!(bar===15&&e>=6))||(sec===0&&bar>=1&&groove)||(sec===0&&bar===0&&e>=4); // la intro entra poco a poco
  if(e%2===0&&kickOn)kick(w,.72);                                                       // bombo a negras
  hat(w,.02,.03);hat(w+Q,.011,.025);                                                    // hats en semicorcheas
  if(e%2===1&&(HS.hatOpen||sec>=2))noise(.12,{f:9500,type:'highpass',vol:groove?.06:.03,when:w,dest:M}); // hat abierto
  if((e===2||e===6)&&groove&&sec>=1){snare(w,.17);noise(.09,{f:1400,q:.6,vol:.1,when:w,dest:M})} // palmas
  if(e===5&&groove&&bar%2===1)snare(w+Q,.05);                                           // ghost de caja
  if(groove&&sec>=1){
    for(let k=0;k<2;k++){const i=e*2+k;if(bass.g[i])ftone(mtof(bs+bass.p[i]),Q*1.7,{vol:.2,cut:520+(bar%4)*60,attack:.003,release:.06,q:3,when:w+k*Q})} // bajo rodante
    if(e%2===1)tone(mtof(bs-12),B*.45,{vol:.35,when:w,attack:.005,dest:M});             // sub
  }
  if(sec>=1&&groove&&stabPat.includes(e))vs.forEach((n,i)=>ftone(mtof(n),B*.38,{vol:.045,cut:1700,attack:.004,release:.15,send:true,when:w+i*.004})); // stabs
  if(e===0&&!build)vs.forEach(n=>ftone(mtof(n),B*(breakdown?4:3.8),{vol:breakdown?.04:.02,cut:breakdown?1800:1100,attack:.4,release:.5,send:true})); // colchón
  if(groove&&sec>=1&&Math.random()<HS.perc)tone(pick([420,520,640,780]),.07,{type:'triangle',vol:.05,when:w+(Math.random()<.5?0:Q),dest:M});          // percusión
  if(breakdown||build)noise(B/2,{f:400+(build?300:0)+e*500,type:'highpass',q:1.2,vol:.03+e*.008+(build?.03:0),when:w,dest:M});                   // subida
  if(build&&bar===14){snare(w,.05+e*.03);snare(w+Q,.05+e*.03)}                          // redoble de caja
  if(breakdown&&e%2===0)ftone(mtof(vs[(e/2)%4]+12),B*1.8,{type:'square',vol:.04,cut:2400,attack:.01,release:.5,send:true,when:w});                // arpegio del breakdown
  if(sec===2&&e%2===0&&(bar%4)<2){const n=HS.motif[((bar%4)*4+e/2)%4];ftone(mtof(n),B*.9,{type:'square',vol:.035,cut:2300,attack:.004,release:.3,send:true,when:w})} // motivo de la vuelta
  else if(groove&&sec>=1&&e%2===0&&Math.random()<.15)ftone(mtof(pick(HMEL)),B*.8,{type:'square',vol:.03,cut:2200,attack:.004,release:.3,send:true,when:w});
  if(bar===15&&e>=4)snare(w,.06+(e-4)*.025);                                            // relleno final
}
function jazzStep(s,w){
  const ch=CHORDS[s>>3],e=s&7,M=AUDIO.mus;
  if(e%2===0){const n=mtof(ch.b[e/2]);tone(n,BEAT*.95,{vol:.5,when:w,attack:.02,dest:M});tone(n*2,BEAT*.4,{type:'triangle',vol:.08,when:w,dest:M})}
  if(e===0||e===5)ch.v.forEach(n=>tone(mtof(n),e===0?BEAT*1.7:BEAT*.7,{type:'triangle',vol:e===0?.1:.08,when:w,attack:.012,dest:M,send:true}));
  if(e===2||e===6)noise(.14,{f:5500,type:'highpass',vol:.06,when:w,dest:M});
  noise(.04,{f:8000,type:'highpass',vol:.022,when:w,dest:M});
  if(e!==0&&Math.random()<.2)tone(mtof(MEL[Math.floor(Math.random()*MEL.length)]),BEAT*1.3,{vol:.08,when:w,attack:.01,dest:M,send:true});
}
const STYLES={
  // trim: ajuste de volumen medido offline (RMS con ponderación tipo K) para que todos los estilos suenen igual de fuertes (diferencia 4.2 dB → 1.0 dB)
  jazz:{name:'Jazz lounge',bpm:84,swing:.16,len:32,step:jazzStep,trim:.80},
  lofi:{name:'Lo-fi chill',bpm:74,swing:.12,len:32,step:lofiStep,trim:.88},
  bossa:{name:'Bossa nova',bpm:116,swing:0,len:32,step:bossaStep,trim:1.09},
  noir:{name:'Casino noir',bpm:64,swing:0,len:32,step:noirStep,trim:1.18},
  synth:{name:'Synthwave',bpm:102,swing:0,len:32,step:synthStep,trim:.94},
  piano:{name:'Piano clásico',bpm:60,swing:0,len:48,step:pianoStep,trim:1.31},
  salsa:{name:'Salsa suave (Caracas)',bpm:96,swing:0,len:32,step:salsaStep,trim:1.15},
  guitarra:{name:'Guitarra española (Madrid)',bpm:72,swing:0,len:32,step:guitarraStep,trim:2.13},
  flamenco:{name:'Rumba flamenca (Madrid)',bpm:104,swing:0,len:32,step:flamencoStep,trim:2.57},
  cinematic:{name:'Cinematográfico (Monaco)',bpm:84,swing:0,len:32,step:cinematicStep,trim:2.5},
  swing:{name:'Big band swing (Las Vegas)',bpm:138,swing:.2,len:32,step:swingStep,trim:.96},
  funk:{name:'Funk (Las Vegas)',bpm:108,swing:0,len:32,step:funkStep,trim:.8},
  house:{name:'House trancado · modo fiesta',bpm:126,swing:0,len:128,step:houseStep,trim:1,hot:true} // el "sube el ambiente": va aparte en el menú
};
const applyVibe=()=>document.body.classList.toggle('party',AUDIO.playing==='house'&&AUDIO.on.mus&&!!AUDIO.ctx);
/* música que sube de intensidad: 4 etapas por mesa según las rondas jugadas (0-7, 8-19, 20-39, 40+); un premio grande sube una etapa durante 5 rondas */
const STAGE_AT=[0,8,20,40];
function musicStage(){
  const r=S.stats?S.stats.rounds:0;let i=0;STAGE_AT.forEach((n,k)=>{if(r>=n)i=k});
  if(S.stats&&r<(S.boostUntil||0))i++;
  return Math.min(i,3);
}
function curStyle(){ // en automático: la etapa de la mesa elige un grupo de estilos y se va rotando entre ellos
  if(AUDIO.style!=='auto'&&STYLES[AUDIO.style])return AUDIO.style;
  const pool=T().playlist[musicStage()];return pool[AUDIO.rot%pool.length];
}
function updateMusic(){ // cuando la mesa pasa a otra etapa, fundido cruzado al nuevo grupo
  if(!AUDIO.ctx||!AUDIO.on.mus)return;
  switchMusic();
}
/* menú plegable del encabezado (celular y tableta en vertical) */
document.addEventListener('click',e=>{
  const h=document.querySelector('header'),mb=e.target.closest('#menuBtn');
  if(mb){const o=h.classList.toggle('open');mb.setAttribute('aria-expanded',o);return}
  if(h.classList.contains('open')&&(!e.target.closest('header')||e.target.closest('.hbtns .btn:not(#audioBtn)')))h.classList.remove('open');
});
document.addEventListener('pointerdown',initAudio);
document.addEventListener('keydown',initAudio);
document.addEventListener('touchend',initAudio,{passive:true}); // iOS solo libera el audio con touchend/click
document.addEventListener('click',initAudio);
document.addEventListener('visibilitychange',()=>{const c=AUDIO.ctx;if(!c)return;document.hidden?c.suspend():c.resume()});
document.addEventListener('click',e=>{
  if(e.target.closest('#audioBtn'))$('audioPanel').hidden=!$('audioPanel').hidden;
  else if(!e.target.closest('.audiowrap'))$('audioPanel').hidden=true;
  if(e.target.closest('button')&&!e.target.closest('.chip'))sfx('tick');
});
document.addEventListener('input',e=>{
  if(e.target.id==='musVol'){AUDIO.vol.mus=+e.target.value;applyAudio();saveAudio()}
  else if(e.target.id==='sfxVol'){AUDIO.vol.sfx=+e.target.value;applyAudio();saveAudio();sfx('chip')}
});
document.addEventListener('change',e=>{
  if(e.target.id==='musStyle'){
    AUDIO.style=STYLES[e.target.value]||e.target.value==='auto'?e.target.value:'auto';AUDIO.styleSet=true;saveAudio();
    e.target.classList.toggle('hot',!!(STYLES[AUDIO.style]&&STYLES[AUDIO.style].hot));
    if(AUDIO.ctx&&AUDIO.on.mus)switchMusic(); // fundido cruzado hacia el estilo elegido
    applyVibe();
  }
  else if(e.target.id==='musOn'){AUDIO.on.mus=e.target.checked;applyAudio();AUDIO.on.mus?startMusic():stopMusic();saveAudio();applyVibe()}
  else if(e.target.id==='sfxOn'){AUDIO.on.sfx=e.target.checked;applyAudio();saveAudio();sfx('chip')}
});
function syncAudioUI(){
  if(AUDIO.style!=='auto'&&!STYLES[AUDIO.style])AUDIO.style='auto';
  const opt=([k,v])=>`<option value="${k}"${v.hot?' class="hot"':''}>${v.name}</option>`,all=Object.entries(STYLES);
  $('musStyle').innerHTML=`<option value="auto">Automática de la mesa (sube con las rondas)</option>`+all.filter(x=>!x[1].hot).map(opt).join('')+`<optgroup label="★ Para subir el ambiente">${all.filter(x=>x[1].hot).map(opt).join('')}</optgroup>`;
  $('musStyle').value=AUDIO.style;$('musStyle').classList.toggle('hot',!!(STYLES[AUDIO.style]&&STYLES[AUDIO.style].hot));applyVibe();
  $('musOn').checked=AUDIO.on.mus;$('sfxOn').checked=AUDIO.on.sfx;$('musVol').value=AUDIO.vol.mus;$('sfxVol').value=AUDIO.vol.sfx}

/* ---------- salón de la fama del MEGA JACKPOT (se guarda en el navegador) ---------- */
