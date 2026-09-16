(() => {
 'use strict';
 if(location.pathname!=='/')return;
 const form=document.getElementById('chat-form'),input=document.getElementById('chat-input'),box=document.getElementById('chat-box');
 if(!form||!input||!box)return;
 document.body.classList.add('agent-home');
 let history=[],busy=false,available=false,abort=null,currentMode='consulta';
 function textEl(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
 function withClass(el,className){el.className=className;return el;}

 // ── Compositor ────────────────────────────────────────────────────────────
 // El estado del agente ya se ve en el panel de pasos de cada respuesta: una
 // línea fija encima del campo solo robaba pantalla en el móvil.
 function setStatus(){}

 // El compositor queda limpio: solo el campo y el botón de enviar. Los
 // formatos (cuadro sinóptico, cronología, citas…) siguen a un toque, en los
 // botones que aparecen bajo cada respuesta, donde además ya hay contexto
 // para elegirlos.
 const stopBtn=withClass(textEl('button','■'),'agent-stop');
 stopBtn.type='button';stopBtn.setAttribute('aria-label','Detener la investigación');stopBtn.hidden=true;
 stopBtn.addEventListener('click',()=>abort?.abort());
 const sendBtn=form.querySelector('button[type="submit"]');
 form.append(stopBtn);

 // Anclaje de scroll: seguimos el texto mientras se genera, pero si el usuario
 // sube a releer, dejamos de arrastrarlo hacia abajo en cada fragmento. Vuelve
 // a engancharse solo cuando regresa al final.
 let stick=true;
 function atBottom(){return box.scrollHeight-box.scrollTop-box.clientHeight<120;}
 box.addEventListener('scroll',()=>{stick=atBottom();},{passive:true});
 function follow(){if(stick)box.scrollTop=box.scrollHeight;}

 // ── Entrada multirenglón ──────────────────────────────────────────────────
 // El campo crece con el texto. En escritorio Enter envía y Shift+Enter hace
 // salto de línea; en pantallas táctiles Enter siempre hace salto de línea y
 // se envía con el botón, que es lo esperado al escribir desde el teléfono.
 const MAX_INPUT_HEIGHT=160;
 // Con el campo vacío se fija una sola línea en vez de medir scrollHeight: esa
 // medida dependía del ancho y de las reglas heredadas, y arrancaba el chat con
 // un campo de tres renglones de alto.
 const BASE_INPUT_HEIGHT=48;
 function autoGrow(){
  input.style.height='auto';
  const h=input.value?Math.min(input.scrollHeight,MAX_INPUT_HEIGHT):BASE_INPUT_HEIGHT;
  input.style.height=h+'px';
 }
 const touchDevice=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
 input.addEventListener('input',autoGrow);
 input.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey||touchDevice)return;
  e.preventDefault();
  if(typeof form.requestSubmit==='function')form.requestSubmit();
  else form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
 });
 input.placeholder='Pregunta sobre la fe…';
 input.maxLength=6000;input.setAttribute('aria-label','Tu pregunta o material de formación');
 autoGrow();

 fetch('/api/agent/status').then(r=>r.json()).then(s=>{
  available=s.available;
 }).catch(()=>{available=false;});

 // Pantalla de inicio: una sola frase. El resto (subtítulo, enlace a "cómo
 // investiga") se quita, no se oculta, para que no ocupe alto en el móvil.
 const welcome=document.getElementById('welcome-screen');
 if(welcome){
  const h=welcome.querySelector('h1');
  if(h)h.textContent='¿En qué puedo ayudarte, hermano?';
  welcome.querySelectorAll('p').forEach(el=>el.remove());
 }
 const oldClear=window.clearChat;window.clearChat=function(){abort?.abort();history=[];if(oldClear)oldClear();};

 function render(text,target){
  const lines=text.split('\n');
  for(let i=0;i<lines.length;i++){
   let line=lines[i].trim();if(!line)continue;
   if(line.startsWith('|')){const wrap=withClass(document.createElement('div'),'agent-table');const table=document.createElement('table');let rowIndex=0;
    while(i<lines.length&&lines[i].trim().startsWith('|')){const cols=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());if(!cols.every(c=>/^:?-+:?$/.test(c))){const row=document.createElement('tr');cols.forEach(c=>row.append(textEl(rowIndex?'td':'th',c.replace(/\*\*/g,''))));table.append(row);rowIndex++;}i++;}i--;wrap.append(table);target.append(wrap);
   }else target.append(textEl(/^#{1,3} /.test(line)?'h3':'p',line.replace(/^#{1,6} /,'').replace(/\*\*/g,'')));
  }
 }
 // Las fuentes dejan de estar escondidas tras un desplegable: son el valor
 // diferencial del agente, así que se muestran como tarjetas con su
 // referencia y el enlace real al documento que devuelve Magisterium.
 const VISIBLE_SOURCES=3;
 function sourcesPanel(sources){
  const wrap=withClass(document.createElement('section'),'agent-sources');
  wrap.append(withClass(textEl('h4',`Fuentes consultadas (${sources.length})`),'agent-sources-title'));
  const list=withClass(document.createElement('div'),'agent-source-list');
  sources.forEach((s,i)=>{
   const item=withClass(document.createElement('article'),'agent-source');
   const head=withClass(document.createElement('div'),'agent-source-head');
   head.append(withClass(textEl('span',s.id),'agent-source-id'),textEl('strong',s.title||'Documento'));
   item.append(head);
   const meta=[s.author,s.reference,s.year].filter(Boolean).join(' · ');
   if(meta)item.append(withClass(textEl('p',meta),'agent-source-meta'));
   if(s.quote)item.append(withClass(textEl('blockquote',s.quote),'agent-source-quote'));
   if(s.url){
    try{const u=new URL(s.url);
     if(['http:','https:'].includes(u.protocol)){
      const a=withClass(textEl('a','Abrir documento →'),'agent-source-link');
      a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';item.append(a);
     }
    }catch{}
   }
   // Con respuestas breves, una pila de fuentes entierra lo importante:
   // mostramos las tres primeras y el resto queda tras un botón.
   if(i>=VISIBLE_SOURCES)item.classList.add('is-extra');
   list.append(item);
  });
  wrap.append(list);
  if(sources.length>VISIBLE_SOURCES){
   const more=withClass(textEl('button',`Ver las ${sources.length} fuentes`),'agent-sources-more');
   more.type='button';
   more.addEventListener('click',()=>{
    const open=wrap.classList.toggle('is-open');
    more.textContent=open?'Ver menos fuentes':`Ver las ${sources.length} fuentes`;
   });
   wrap.append(more);
  }
  return wrap;
 }
 // Preguntas relacionadas que devuelve Magisterium (return_related_questions):
 // siguientes pasos alineados con las fuentes, no sugerencias inventadas.
 function relatedPanel(questions){
  const bar=withClass(document.createElement('div'),'agent-related');
  bar.append(withClass(textEl('span','Preguntas relacionadas'),'agent-related-label'));
  for(const q of questions){
   const b=withClass(textEl('button',q),'agent-related-q');b.type='button';
   b.addEventListener('click',()=>{if(!busy)runQuery(q,'consulta');});
   bar.append(b);
  }
  return bar;
 }
 function downloads(result,bubble){const bar=withClass(document.createElement('div'),'agent-downloads');
  for(const [format,label]of [['docx','Descargar Word'],['pdf','Descargar PDF']]){const btn=textEl('button',label);btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{const r=await fetch(`/api/agent/export/${format}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});if(!r.ok)throw Error();const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=`catolicosgpt-material.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setStatus('No se pudo descargar. Inténtalo de nuevo.');}finally{btn.disabled=false;}};bar.append(btn);}bubble.append(bar);
 }
 // Panel de "pasos de investigación" al estilo Magisterium: cada evento step
 // del servidor añade una fila; la anterior queda marcada como hecha y la
 // nueva como activa. step-delta muestra un adelanto en vivo de lo que
 // Magisterium está redactando mientras investiga, así la espera nunca se ve
 // congelada, tenga o no tenga texto final que mostrar todavía.
 function createStepsPanel(bubble){
  bubble.innerHTML='';
  const wrap=withClass(document.createElement('div'),'agent-steps');
  const toggle=withClass(document.createElement('button'),'agent-steps-toggle');toggle.type='button';
  toggle.append(textEl('span','Pasos de investigación'),textEl('span','⌄'));
  const list=withClass(document.createElement('div'),'agent-steps-list');
  toggle.addEventListener('click',()=>wrap.classList.toggle('is-collapsed'));
  wrap.append(toggle,list);bubble.append(wrap);
  let activeRow=null,preview=null;
  const settle=()=>{if(!activeRow)return;activeRow.classList.remove('active');activeRow.classList.add('done');activeRow.querySelector('.agent-step-icon').textContent='✓';};
  return {
   addStep(label){
    settle();
    wrap.classList.remove('is-collapsed');
    const row=withClass(document.createElement('div'),'agent-step active');
    row.append(withClass(textEl('span','⟳'),'agent-step-icon'),textEl('span',label));
    list.append(row);row.scrollIntoView({block:'nearest'});
    activeRow=row;preview=null;
   },
   addPreview(delta){
    if(!activeRow)return;
    if(!preview){preview=withClass(document.createElement('p'),'agent-step-preview');activeRow.append(preview);}
    preview.textContent=(preview.textContent+delta).slice(-220);
   },
   finish(){settle();wrap.classList.add('is-collapsed');}
  };
 }
 // Botones de siguiente paso bajo cada respuesta: profundizar, o el mismo tema
 // en otro formato (cuadro sinóptico, cronología, resumen, citas).
 function quickActions(originalQuery,bubble){
  const bar=withClass(document.createElement('div'),'agent-quick-actions');
  const items=[['analisis','Profundizar más'],['cuadro','Cuadro sinóptico'],['cronologia','Cronología'],['resumen','Resumen'],['citas_biblicas','Citas bíblicas'],['citas_santos','Citas de santos']];
  for(const [mode,label]of items){
   const btn=withClass(textEl('button',label),'agent-quick-action');btn.type='button';
   btn.addEventListener('click',()=>{if(!busy)runQuery(originalQuery,mode);});
   bar.append(btn);
  }
  bubble.append(bar);
 }
 function setBusy(state){
  busy=state;
  stopBtn.hidden=!state;
  if(sendBtn){sendBtn.disabled=state;sendBtn.hidden=state;}
 }
 async function runQuery(query,mode){
  if(!available||busy||!query)return;
  setBusy(true);abort=new AbortController();
  document.getElementById('welcome-screen')?.classList.add('hidden');
  box.append(withClass(textEl('div',query),'chat-bubble user'));
  const bubble=withClass(document.createElement('div'),'chat-bubble bot bot-content agent-answer');
  box.append(bubble);stick=true;follow();
  const steps=createStepsPanel(bubble);
  // Primera fila inmediata: el usuario ve que está pensando desde el instante
  // cero, sin esperar al primer evento del servidor.
  steps.addStep('Conectando con las fuentes de Magisterium…');
  setStatus('Investigando…');
  let streamedText='';let sawDelta=false;
  try{
   const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({query,history,mode,stream:true}),signal:abort.signal});
   if(!r.ok||!r.body){let msg='No se pudo completar la consulta.';try{msg=(await r.json()).error||msg;}catch{}throw Error(msg);}
   const reader=r.body.getReader();const decoder=new TextDecoder();let buffer='';let final=null;let errorMsg=null;let answerEl=null;
   const handleBlock=block=>{
    const raw=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    if(!raw)return;let event;try{event=JSON.parse(raw);}catch{return;}
    if(event.type==='step'){
     steps.addStep(event.label);setStatus(event.label);
     // Un paso nuevo significa que el modelo volvió a investigar: el texto
     // que había escrito antes queda superado. Si no se descarta, el borrador
     // anterior y el definitivo se concatenan y salen pegados en pantalla.
     if(answerEl){answerEl.remove();answerEl=null;}
     streamedText='';sawDelta=false;
    }
    else if(event.type==='step-delta'){steps.addPreview(event.delta);}
    else if(event.type==='delta'){
     if(!sawDelta){sawDelta=true;steps.finish();setStatus('Redactando la respuesta…');answerEl=withClass(document.createElement('div'),'agent-answer-text');bubble.append(answerEl);}
     streamedText+=event.delta;answerEl.textContent=streamedText;follow();
    }else if(event.type==='meta'){final=event;}
    else if(event.type==='error'){errorMsg=event.error;}
   };
   while(true){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';
    for(const block of blocks)handleBlock(block);
   }
   if(buffer.trim())handleBlock(buffer);
   if(errorMsg)throw Error(errorMsg);
   if(!final)throw Error('No se pudo completar la consulta.');
   steps.finish();
   if(answerEl)answerEl.remove();
   render(final.text,bubble);
   if(final.sources?.length)bubble.append(sourcesPanel(final.sources));
   downloads({text:final.text,sources:final.sources||[],mode:final.mode},bubble);
   quickActions(query,bubble);
   if(final.relatedQuestions?.length)bubble.append(relatedPanel(final.relatedQuestions));
   history.push({role:'user',content:query},{role:'assistant',content:final.text});history=history.slice(-6);
   setStatus('');
  }
  catch(err){steps.finish();bubble.append(withClass(textEl('p',err.name==='AbortError'?'Investigación detenida.':err.message),'agent-error'));setStatus('');}
  finally{setBusy(false);input.focus();}
 }
 form.addEventListener('submit',e=>{
  if(!available)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
  const query=input.value.trim();if(!query)return;
  input.value='';autoGrow();runQuery(query,currentMode);
 },true);
})();
