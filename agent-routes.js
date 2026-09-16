'use strict';
const path=require('path');
const agent=require('./catholic-agent');
const docs=require('./agent-documents');
// Per-process ceilings bound anonymous research cost and concurrent exports.
function register(app){
 app.get('/favicon.png',(req,res)=>res.set('Cache-Control','public, max-age=86400').type('png').sendFile(path.join(__dirname,'favicon.png')));
 const budget=require('./agent-budget').createBudget();
 const requests=new Map();let active=0;let exportsActive=0;
 function limited(req,res,next){
  const now=Date.now();for(const [k,v]of requests)if(v.until<now)requests.delete(k);
  const key=req.ip;const item=requests.get(key)||{count:0,until:now+60000};
  if(item.count>=8 || requests.size>10000){res.set('Retry-After','60');return res.status(429).json({error:'Espera un minuto antes de volver a consultar.'});}
  item.count++;requests.set(key,item);next();
 }
 app.get('/agent-ui.js',(req,res)=>res.sendFile(path.join(__dirname,'agent-ui.js')));
 app.get('/agent-ui.css',(req,res)=>res.sendFile(path.join(__dirname,'agent-ui.css')));
 app.get('/api/agent/status',(req,res)=>res.json({available:agent.configured()}));
 function sseWrite(res,payload){res.write(`data: ${JSON.stringify(payload)}\n\n`);}
 const handleResearch=async(req,res)=>{
  const {query,history,mode}=req.body||{};
  const wantsStream=req.body?.stream===true;
  if(typeof query!=='string'||!query.trim()||query.length>6000|| (history!==undefined&&(!Array.isArray(history)||history.length>10)))return res.status(400).json({error:'Escribe una consulta de hasta 6000 caracteres.'});
  if(!agent.configured())return res.status(503).json({error:'La investigación con fuentes no está disponible en este momento. Puedes utilizar la consulta habitual.'});
  if(active>=6)return res.status(429).json({error:'Hay varias investigaciones en curso. Inténtalo en un momento.'});
  try{budget.admit(req.ip);}catch(e){return res.status(429).json({error:e.message==='daily_quota'?'Has alcanzado la cuota diaria de investigación. Los contenidos y las guías publicadas siguen disponibles.':'La investigación ha alcanzado su límite temporal de uso. Puedes seguir consultando los recursos publicados.'});}
  active++;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100000);const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnect);
  // El streaming SSE retransmite el texto del modelo apenas se genera (no espera
  // a que termine el turno completo) para que la primera palabra llegue en
  // segundos y no tras toda la investigación. El contrato JSON histórico se
  // mantiene intacto para /api/chat y para quien no pida stream:true.
  if(wantsStream){
   res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});
   if(typeof res.flushHeaders==='function')res.flushHeaders();
   try{
    const result=await agent.run({query:query.trim(),history,mode,signal:controller.signal,budget,
     onDelta:delta=>sseWrite(res,{type:'delta',delta}),
     onStep:label=>sseWrite(res,{type:'step',label}),
     onStepDelta:delta=>sseWrite(res,{type:'step-delta',delta})
    });
    if(!res.destroyed){sseWrite(res,{type:'meta',text:result.text,sources:result.sources,mode:result.mode});sseWrite(res,{type:'done'});}
   }catch(e){
    console.warn('[CatholicAgent]',e.name,e.message.replace(/[^a-zA-Z0-9_ ]/g,'').slice(0,60));
    if(!res.destroyed)sseWrite(res,{type:'error',error:'No se pudo completar la investigación con fuentes. Inténtalo de nuevo; no se ha sustituido por una respuesta sin verificar.'});
   }finally{clearTimeout(timer);res.off('close',disconnect);active--;if(!res.writableEnded)res.end();}
   return;
  }
  try{const result=await agent.run({query:query.trim(),history,mode,signal:controller.signal,budget});if(!res.destroyed){res.set('Cache-Control','no-store');if(req.path==='/api/chat')res.type('text/plain').send(result.text+'\n\nFuentes: \n'+result.sources.map(s=>'['+s.id+'] '+s.title+' '+s.reference+' '+s.url).join('\n'));else res.json(result);}}
  catch(e){console.warn('[CatholicAgent]',e.name,e.message.replace(/[^a-zA-Z0-9_ ]/g,'').slice(0,60));if(!res.destroyed)res.status(502).json({error:'No se pudo completar la investigación con fuentes. Inténtalo de nuevo; no se ha sustituido por una respuesta sin verificar.'});}
  finally{clearTimeout(timer);res.off('close',disconnect);active--;}
 };
 app.post('/api/agent',limited,handleResearch);
 // Preserve the legacy URL while enforcing the same evidence and spending boundary.
 app.post('/api/chat',(req,res,next)=>process.env.CATHOLIC_AGENT_ENABLED==='1'?limited(req,res,()=>handleResearch(req,res)):next());
 app.post('/api/agent/export/:format',limited,async(req,res)=>{
  const format=req.params.format;if(!['docx','pdf'].includes(format))return res.sendStatus(404);
  if(exportsActive>=3)return res.sendStatus(429);exportsActive++;
  try{const buffer=await docs[format==='docx'?'word':'pdf'](req.body||{});res.set({'Cache-Control':'no-store','Content-Disposition':`attachment; filename="catolicosgpt-material.${format}"`}).type(format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);}
  catch{res.status(400).json({error:'No fue posible exportar el material.'});}finally{exportsActive--;}
 });
}
module.exports={register};
