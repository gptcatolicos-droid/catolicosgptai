(() => {
 'use strict';
 if(location.pathname!=='/')return;
 const form=document.getElementById('chat-form'),input=document.getElementById('chat-input'),box=document.getElementById('chat-box');
 if(!form||!input||!box)return;
 document.body.classList.add('agent-home');
 let history=[],busy=false,available=false,abort=null;
 const FORMATS={consulta:'Automático',analisis:'Análisis detallado',resumen:'Resumen',mapa:'Mapa conceptual',cuadro:'Cuadro sinóptico',cronologia:'Cronología',comparativo:'Comparativo',guia:'Guía para enseñar'};
 // El selector clásico (etiqueta + <select>) sigue siendo la fuente de
 // verdad del modo elegido y se conserva visible en desktop. En mobile se
 // oculta por CSS y su lugar lo toma un botón "+" junto al campo de texto
 // (como el compositor de Claude en mobile) que abre una hoja de opciones:
 // así el formato deja de ocupar una fila fija todo el tiempo.
 const controls=document.createElement('div');controls.className='agent-controls';
 const label=document.createElement('label');label.textContent='Formato ';label.htmlFor='agent-mode';
 const select=document.createElement('select');select.id='agent-mode';select.setAttribute('aria-label','Tipo de material');
 // "Respuesta" salió del listado: era una etiqueta genérica que no distinguía
 // ningún comportamiento real. "Automático" es el mismo modo por defecto
 // (consulta) pero explica lo que realmente hace.
 for(const [value,text]of Object.entries(FORMATS))select.add(new Option(text,value));
 const status=document.createElement('span');status.className='agent-status';status.setAttribute('role','status');status.textContent='Comprobando disponibilidad…';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Detener';stop.hidden=true;stop.addEventListener('click',()=>abort?.abort());
 controls.append(label,select,status,stop);form.before(controls);
 const plusBtn=document.createElement('button');plusBtn.type='button';plusBtn.className='agent-plus';plusBtn.setAttribute('aria-label','Elegir formato');plusBtn.textContent='+';
 const chip=document.createElement('span');chip.className='agent-format-chip';chip.hidden=true;
 const chipLabel=document.createElement('span');const chipClear=document.createElement('button');chipClear.type='button';chipClear.textContent='✕';chipClear.setAttribute('aria-label','Quitar formato');
 chip.append(chipLabel,chipClear);
 chipClear.addEventListener('click',()=>{select.value='consulta';syncChip();});
 function syncChip(){const isDefault=select.value==='consulta';chip.hidden=isDefault;if(!isDefault)chipLabel.textContent=FORMATS[select.value]||select.value;}
 const sheet=document.createElement('div');sheet.className='agent-format-sheet';sheet.hidden=true;
 const backdrop=document.createElement('div');backdrop.className='agent-format-sheet-backdrop';
 const panel=document.createElement('div');panel.className='agent-format-sheet-panel';
 panel.append(textEl('div','Elige un formato'));panel.lastChild.className='agent-format-sheet-title';
 for(const [value,text]of Object.entries(FORMATS)){
  const opt=textEl('button',text);opt.type='button';opt.dataset.mode=value;
  opt.addEventListener('click',()=>{select.value=value;syncChip();closeSheet();});
  panel.append(opt);
 }
 sheet.append(backdrop,panel);document.body.append(sheet);
 function openSheet(){sheet.hidden=false;}
 function closeSheet(){sheet.hidden=true;}
 backdrop.addEventListener('click',closeSheet);
 plusBtn.addEventListener('click',openSheet);
 form.prepend(plusBtn);input.before(chip);
 fetch('/api/agent/status').then(r=>r.json()).then(s=>{available=s.available;status.textContent=available?'Investiga y crea con fuentes':'Consulta habitual disponible';select.disabled=!available;plusBtn.disabled=!available;}).catch(()=>{status.textContent='Consulta habitual disponible';select.disabled=true;plusBtn.disabled=true;});
 const welcome=document.getElementById('welcome-screen');
 if(welcome){const about=document.createElement('a');about.href='/como-funciona';about.textContent='Cómo investiga y crea CatólicosGPT';about.className='agent-about';welcome.append(about);const h=welcome.querySelector('h1');if(h)h.textContent='Comprende tu fe. Profundiza. Comparte.';const p=welcome.querySelector('p');if(p)p.textContent='Tu agente de IA católica para estudiar la Biblia, explorar el Magisterio y crear materiales de formación.';}
 input.placeholder='Pregunta o pide un resumen, mapa conceptual, cronología…';input.maxLength=6000;input.setAttribute('aria-label','Tu pregunta o material de formación');
 const oldClear=window.clearChat;window.clearChat=function(){abort?.abort();history=[];if(oldClear)oldClear();};
 function textEl(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
 function render(text,target){
  const lines=text.split('\n');
  for(let i=0;i<lines.length;i++){
   let line=lines[i].trim();if(!line)continue;
   if(line.startsWith('|')){const wrap=document.createElement('div');wrap.className='agent-table';const table=document.createElement('table');let rowIndex=0;
    while(i<lines.length&&lines[i].trim().startsWith('|')){const cols=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());if(!cols.every(c=>/^:?-+:?$/.test(c))){const row=document.createElement('tr');cols.forEach(c=>row.append(textEl(rowIndex?'td':'th',c.replace(/\*\*/g,''))));table.append(row);rowIndex++;}i++;}i--;wrap.append(table);target.append(wrap);
   }else target.append(textEl(/^#{1,3} /.test(line)?'h3':'p',line.replace(/^#{1,6} /,'').replace(/\*\*/g,'')));
  }
 }
 function sourcesPanel(sources){const details=document.createElement('details');details.className='agent-sources';details.append(textEl('summary',`Fuentes consultadas (${sources.length})`));for(const s of sources){const item=document.createElement('p');item.append(textEl('strong',`[${s.id}] ${s.title||'Documento'} `),document.createTextNode(`${s.author||''} · ${s.reference||''}`));if(s.url){try{const u=new URL(s.url);if(['http:','https:'].includes(u.protocol)){const a=textEl('a','Consultar fuente');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';item.append(' ',a);}}catch{}}if(s.quote)item.append(textEl('blockquote',s.quote));details.append(item);}return details;}
 function downloads(result,bubble){const bar=document.createElement('div');bar.className='agent-downloads';
  for(const [format,label]of [['docx','Descargar Word'],['pdf','Descargar PDF']]){const btn=textEl('button',label);btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{const r=await fetch(`/api/agent/export/${format}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});if(!r.ok)throw Error();const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=`catolicosgpt-material.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{status.textContent='No se pudo descargar. Inténtalo de nuevo.';}finally{btn.disabled=false;}};bar.append(btn);}bubble.append(bar);
 }
 // Panel de "pasos de investigación" al estilo Magisterium: cada evento step
 // del servidor añade una fila; la anterior queda marcada como hecha y la
 // nueva como activa. step-delta muestra un adelanto en vivo de lo que
 // Magisterium está redactando mientras investiga, así la espera nunca se ve
 // congelada, tenga o no tenga texto final que mostrar todavía.
 function createStepsPanel(bubble){
  bubble.innerHTML='';
  const wrap=document.createElement('div');wrap.className='agent-steps';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='agent-steps-toggle';
  toggle.append(textEl('span','Pasos de investigación'),textEl('span','⌄'));
  const list=document.createElement('div');list.className='agent-steps-list';
  toggle.addEventListener('click',()=>wrap.classList.toggle('is-collapsed'));
  wrap.append(toggle,list);bubble.append(wrap);
  let activeRow=null,preview=null;
  return {
   wrap,
   addStep(label){
    if(activeRow){activeRow.classList.remove('active');activeRow.classList.add('done');activeRow.querySelector('.agent-step-icon').textContent='✓';}
    const row=document.createElement('div');row.className='agent-step active';
    row.append(textEl('span','⟳'),textEl('span',label));
    row.firstChild.className='agent-step-icon';
    list.append(row);row.scrollIntoView({block:'nearest'});
    activeRow=row;preview=null;
   },
   addPreview(delta){
    if(!activeRow)return;
    if(!preview){preview=document.createElement('p');preview.className='agent-step-preview';activeRow.append(preview);}
    preview.textContent=(preview.textContent+delta).slice(-220);
   },
   finish(){if(activeRow){activeRow.classList.remove('active');activeRow.classList.add('done');activeRow.querySelector('.agent-step-icon').textContent='✓';}wrap.classList.add('is-collapsed');}
  };
 }
 // Botones de siguiente paso bajo cada respuesta: "Profundizar" siempre
 // disponible, y accesos directos a los formatos que pide el usuario según
 // el tema (cuadro sinóptico, cronología, resumen, citas bíblicas, de santos).
 function quickActions(originalQuery,bubble){
  const bar=document.createElement('div');bar.className='agent-quick-actions';
  const items=[['analisis','Profundizar más'],['cuadro','Cuadro sinóptico'],['cronologia','Cronología'],['resumen','Resumen'],['citas_biblicas','Citas bíblicas'],['citas_santos','Citas de santos']];
  for(const [mode,label]of items){
   const btn=textEl('button',label);btn.type='button';btn.className='agent-quick-action';
   btn.addEventListener('click',()=>{if(!busy)runQuery(originalQuery,mode);});
   bar.append(btn);
  }
  bubble.append(bar);
 }
 async function runQuery(query,mode){
  if(!available||busy||!query)return;
  busy=true;abort=new AbortController();stop.hidden=false;select.disabled=true;const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
  document.getElementById('welcome-screen')?.classList.add('hidden');
  const user=textEl('div',query);user.className='chat-bubble user';box.append(user);
  const bubble=document.createElement('div');bubble.className='chat-bubble bot bot-content agent-answer';box.append(bubble);bubble.scrollIntoView({block:'nearest'});status.textContent='Investigación en curso';
  const steps=createStepsPanel(bubble);
  let streamedText='';let sawDelta=false;
  try{
   const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({query,history,mode,stream:true}),signal:abort.signal});
   if(!r.ok||!r.body){let msg='No se pudo completar la consulta.';try{msg=(await r.json()).error||msg;}catch{}throw Error(msg);}
   const reader=r.body.getReader();const decoder=new TextDecoder();let buffer='';let final=null;let errorMsg=null;let answerEl=null;
   const handleBlock=block=>{
    const raw=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    if(!raw)return;let event;try{event=JSON.parse(raw);}catch{return;}
    if(event.type==='step'){steps.addStep(event.label);status.textContent=event.label;}
    else if(event.type==='step-delta'){steps.addPreview(event.delta);}
    else if(event.type==='delta'){
     if(!sawDelta){sawDelta=true;steps.finish();status.textContent='Redactando…';answerEl=document.createElement('div');answerEl.className='agent-answer-text';bubble.append(answerEl);}
     streamedText+=event.delta;answerEl.textContent=streamedText;bubble.scrollIntoView({block:'nearest'});
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
   if(answerEl)answerEl.remove();
   render(final.text,bubble);if(final.sources?.length)bubble.append(sourcesPanel(final.sources));downloads({text:final.text,sources:final.sources||[],mode:final.mode},bubble);quickActions(query,bubble);
   history.push({role:'user',content:query},{role:'assistant',content:final.text});history=history.slice(-6);status.textContent='Material listo';
  }
  catch(err){steps.finish();bubble.textContent=err.name==='AbortError'?'Investigación detenida.':err.message;status.textContent='Puedes volver a consultar';}
  finally{busy=false;stop.hidden=true;select.disabled=false;if(submit)submit.disabled=false;input.focus();}
 }
 form.addEventListener('submit',e=>{
  if(!available)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
  const query=input.value.trim();if(!query)return;input.value='';runQuery(query,select.value);
 },true);
})();
