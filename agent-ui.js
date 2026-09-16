(() => {
 'use strict';
 if(location.pathname!=='/')return;
 const form=document.getElementById('chat-form'),input=document.getElementById('chat-input'),box=document.getElementById('chat-box');
 if(!form||!input||!box)return;
 document.body.classList.add('agent-home');
 let history=[],busy=false,available=false,abort=null;
 const controls=document.createElement('div');controls.className='agent-controls';
 const label=document.createElement('label');label.textContent='Formato ';label.htmlFor='agent-mode';
 const select=document.createElement('select');select.id='agent-mode';select.setAttribute('aria-label','Tipo de material');
 // "Respuesta" salió del listado: era una etiqueta genérica que no distinguía
 // ningún comportamiento real. "Automático" es el mismo modo por defecto
 // (consulta) pero explica lo que realmente hace.
 for(const [value,text]of Object.entries({consulta:'Automático',analisis:'Análisis detallado',resumen:'Resumen',mapa:'Mapa conceptual',cuadro:'Cuadro sinóptico',cronologia:'Cronología',comparativo:'Comparativo',guia:'Guía para enseñar'}))select.add(new Option(text,value));
 const status=document.createElement('span');status.className='agent-status';status.setAttribute('role','status');status.textContent='Comprobando disponibilidad…';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Detener';stop.hidden=true;stop.addEventListener('click',()=>abort?.abort());
 controls.append(label,select,status,stop);form.before(controls);
 fetch('/api/agent/status').then(r=>r.json()).then(s=>{available=s.available;status.textContent=available?'Investiga y crea con fuentes':'Consulta habitual disponible';select.disabled=!available;}).catch(()=>{status.textContent='Consulta habitual disponible';select.disabled=true;});
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
 // Indicador vivo de "buscando" para la fase silenciosa de investigación en
 // Magisterium (antes de que OpenAI empiece a redactar). Rota frases breves
 // para que el usuario perciba avance real, no una pantalla congelada.
 const THINKING_PHRASES=['Consultando fuentes de Magisterium…','Verificando citas y referencias…','Redactando con las fuentes recuperadas…'];
 function startThinking(bubble){
  bubble.innerHTML='';
  const wrap=document.createElement('span');wrap.className='agent-thinking';
  const dot=document.createElement('span');dot.className='agent-thinking-dot';wrap.append(dot);
  const text=textEl('span',THINKING_PHRASES[0]);wrap.append(text);
  bubble.append(wrap);
  let i=0;const timer=setInterval(()=>{i=(i+1)%THINKING_PHRASES.length;text.textContent=THINKING_PHRASES[i];},2600);
  return ()=>clearInterval(timer);
 }
 form.addEventListener('submit',async e=>{
  if(!available)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
  const query=input.value.trim();if(!query)return;busy=true;abort=new AbortController();stop.hidden=false;select.disabled=true;const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
  document.getElementById('welcome-screen')?.classList.add('hidden');const user=textEl('div',query);user.className='chat-bubble user';box.append(user);input.value='';
  const bubble=document.createElement('div');bubble.className='chat-bubble bot bot-content agent-answer';box.append(bubble);bubble.scrollIntoView({block:'nearest'});status.textContent='Investigación en curso';
  const stopThinking=startThinking(bubble);
  let streamedText='';let sawDelta=false;
  try{
   const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({query,history,mode:select.value,stream:true}),signal:abort.signal});
   if(!r.ok||!r.body){let msg='No se pudo completar la consulta.';try{msg=(await r.json()).error||msg;}catch{}throw Error(msg);}
   const reader=r.body.getReader();const decoder=new TextDecoder();let buffer='';let final=null;let errorMsg=null;
   const handleBlock=block=>{
    const raw=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    if(!raw)return;let event;try{event=JSON.parse(raw);}catch{return;}
    if(event.type==='delta'){
     if(!sawDelta){sawDelta=true;stopThinking();bubble.textContent='';}
     streamedText+=event.delta;bubble.textContent=streamedText;bubble.scrollIntoView({block:'nearest'});
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
   bubble.textContent='';render(final.text,bubble);if(final.sources?.length)bubble.append(sourcesPanel(final.sources));downloads({text:final.text,sources:final.sources||[],mode:final.mode},bubble);
   history.push({role:'user',content:query},{role:'assistant',content:final.text});history=history.slice(-6);status.textContent='Material listo';
  }
  catch(err){stopThinking();bubble.textContent=err.name==='AbortError'?'Investigación detenida.':err.message;status.textContent='Puedes volver a consultar';}
  finally{busy=false;stop.hidden=true;select.disabled=false;if(submit)submit.disabled=false;input.focus();}
 },true);
})();
