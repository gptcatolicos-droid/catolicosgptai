'use strict';
const path=require('path');
const agent=require('./catholic-agent');
const docs=require('./agent-documents');
const library=require('./agent-related-content');
// Per-process ceilings bound anonymous research cost and concurrent exports.
function register(app,options={}){
 // La cuota deja de medirse solo por IP: con sesión iniciada se mide por
 // cuenta, que es lo que permite vender un plan y no un rango de IPs.
 const getUser=typeof options.getUser==='function'?options.getUser:()=>null;
 // El súper administrador queda fuera de TODOS los topes: consultas por
 // minuto, cuota diaria y tope de gasto. Es la cuenta del dueño del servicio.
 const isSuperAdmin=typeof options.isSuperAdmin==='function'?options.isSuperAdmin:()=>false;
 // Una sola definición de "puede descargar", que consultan tanto la interfaz
 // como el propio endpoint: si vivieran en dos sitios acabarían discrepando y
 // el usuario vería un botón que luego le rechaza.
 const esPremium=account=>Boolean(account && ['premium','admin'].includes(account.plan));
 // ── A quién se le cuenta la cuota ──────────────────────────────────────────
 // Con sesión iniciada es fácil: la cuenta. Sin sesión se medía por IP, y en
 // móvil eso no identifica a una persona: los operadores meten miles de
 // teléfonos detrás de unas pocas IPs públicas (CGNAT). El primero que
 // consultaba dejaba sin cuota a todos los demás clientes de ese operador, que
 // ni siquiera habían entrado.
 //
 // Así que a cada visitante se le da un identificador propio en una cookie. Se
 // puede borrar para tener cuota nueva, y no pasa nada: la cuota de los
 // anónimos es un empujón para que se registren, no una cerradura. La cerradura
 // es la cuenta.
 const crypto=require('crypto');
 function claveVisitante(req,res){
  const account=getUser(req);
  if(account)return `user:${account.id}`;
  let id='';
  const crudo=req.headers&&req.headers.cookie;
  if(crudo){
   const par=crudo.split('; ').find(c=>c.startsWith('cgpt_visitante='));
   if(par)id=par.slice('cgpt_visitante='.length);
  }
  if(!/^[a-f0-9]{32}$/.test(id)){
   id=crypto.randomBytes(16).toString('hex');
   // HttpOnly: este identificador no lo necesita ningún script de la página.
   if(res&&!res.headersSent)res.setHeader('Set-Cookie',`cgpt_visitante=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
  }
  return `anon:${id}`;
 }
 // Solo presencia, nunca valores: permite ver en los logs por qué el agente
 // aparece desactivado sin tener que adivinar cuál variable falta.
 console.log(`[Agente] configurado=${agent.configured()} | CATHOLIC_AGENT_ENABLED=${process.env.CATHOLIC_AGENT_ENABLED||'(sin definir)'} | MAGISTERIUM_API_KEY=${process.env.MAGISTERIUM_API_KEY?'presente':'FALTA'} | OPENAI_API_KEY=${process.env.OPENAI_API_KEY?'presente':'FALTA'}`);
 app.get('/favicon.png',(req,res)=>res.set('Cache-Control','public, max-age=86400').type('png').sendFile(path.join(__dirname,'favicon.png')));
 const budget=require('./agent-budget').createBudget();
 const envInt=(name,fallback)=>{const n=Number(process.env[name]);return Number.isFinite(n)&&n>0?n:fallback;};
 // Los limites que de verdad rigen, no los que dice el codigo: una variable de
 // entorno puesta en el servidor gana al valor por defecto, y sin esto la unica
 // forma de saber cual esta activo es agotar la cuota uno mismo.
 console.log(`[Agente] Cuota diaria: ${envInt('AGENT_ANON_DAILY_REQUESTS',5)} sin cuenta, ${envInt('AGENT_FREE_DAILY_REQUESTS',12)} con cuenta gratis, sin tope con Premium.`);
 const requests=new Map();let active=0;let exportsActive=0;
 function limited(req,res,next){
  if(isSuperAdmin(getUser(req)))return next();
  const now=Date.now();for(const [k,v]of requests)if(v.until<now)requests.delete(k);
  const key=req.ip;const item=requests.get(key)||{count:0,until:now+60000};
  if(item.count>=8 || requests.size>10000){res.set('Retry-After','60');return res.status(429).json({error:'Espera un minuto antes de volver a consultar.'});}
  item.count++;requests.set(key,item);next();
 }
 // Sin cabecera de caché, el navegador podía quedarse con una versión vieja de
 // la interfaz indefinidamente: una pestaña abierta antes de un cambio seguía
 // ejecutando el código anterior (y mostrando un estado del agente ya
 // obsoleto). 'no-cache' no impide almacenar, obliga a revalidar.
 const freshAsset=file=>(req,res)=>res.set('Cache-Control','no-cache').sendFile(path.join(__dirname,file));
 app.get('/agent-ui.js',freshAsset('agent-ui.js'));
 app.get('/agent-ui.css',freshAsset('agent-ui.css'));
 app.get('/api/agent/status',(req,res)=>res.json({available:agent.configured()}));
 // Cuántas consultas le quedan a quien está preguntando. Hasta ahora el límite
 // solo se descubría al chocar con él: la interfaz no tenía forma de avisar
 // antes, ni de ofrecer el plan Premium en el momento en que importa.
 app.get('/api/agent/cuota',(req,res)=>{
  const account=getUser(req);
  const superAdmin=isSuperAdmin(account);
  const unlimited=superAdmin||Boolean(account && ['premium','admin'].includes(account.plan));
  const limit=account?envInt('AGENT_FREE_DAILY_REQUESTS',12):envInt('AGENT_ANON_DAILY_REQUESTS',5);
  const quotaKey=claveVisitante(req,res);
  const used=unlimited?0:budget.usage(quotaKey).used;
  res.set('Cache-Control','no-store').json({
   registrado:Boolean(account),
   plan:account?account.plan:'visitante',
   ilimitado:unlimited,
   limite:unlimited?null:limit,
   usadas:used,
   restantes:unlimited?null:Math.max(0,limit-used),
   puedeDescargar:superAdmin||esPremium(account)
  });
 });
 function sseWrite(res,payload){res.write(`data: ${JSON.stringify(payload)}\n\n`);}
 // El chat no puede ser un callejón sin salida: al final de cada consulta se
 // enlaza el material ya publicado en el sitio sobre ese mismo tema. Se resuelve
 // con un índice local (sin llamar a ningún modelo), así que no añade espera ni
 // coste; si algo falla, la respuesta sale igual y solo se pierden los enlaces.
 function relatedLibrary(query){
  try{return library.related(query);}
  catch(e){console.warn('[Agente] contenido relacionado no disponible:',e.message);return {infografias:[],articulos:[]};}
 }
 const handleResearch=async(req,res)=>{
  const {query,history,mode}=req.body||{};
  const wantsStream=req.body?.stream===true;
  if(typeof query!=='string'||!query.trim()||query.length>6000|| (history!==undefined&&(!Array.isArray(history)||history.length>10)))return res.status(400).json({error:'Escribe una consulta de hasta 6000 caracteres.'});
  if(!agent.configured())return res.status(503).json({error:'La investigación con fuentes no está disponible en este momento. Puedes utilizar la consulta habitual.'});
  if(active>=6)return res.status(429).json({error:'Hay varias investigaciones en curso. Inténtalo en un momento.'});
  const account=getUser(req);
  const superAdmin=isSuperAdmin(account);
  const unlimited=Boolean(account && ['premium','admin'].includes(account.plan));
  const quotaKey=claveVisitante(req,res);
  // El gasto del súper administrador se sigue contabilizando, pero no lo frena.
  const spending=superAdmin?budget.unmetered():budget;
  // Escalera de acceso: quien no se registra prueba el chat, quien se registra
  // tiene más margen y quien paga no tiene tope diario.
  const limit=account?envInt('AGENT_FREE_DAILY_REQUESTS',12):envInt('AGENT_ANON_DAILY_REQUESTS',5);
  try{spending.admit(quotaKey,{unlimited,limit});}catch(e){
  // A quien paga no se le puede decir lo mismo que a un visitante que agotó su
  // cupo: su plan no tiene tope diario, y si el chat no responde es un problema
  // nuestro. Decirle "alcanzaste tu límite" sería mentirle sobre lo que compró.
  const mensaje = e.message==='daily_quota'
   ? (account?'Alcanzaste tu límite diario del plan gratuito. Con Premium el chat no tiene límite diario.':'Alcanzaste el límite de consultas para visitantes. Crea una cuenta gratis para tener más, o suscríbete a Premium para no tener límite diario.')
   : unlimited
   ? 'El servicio alcanzó su tope de uso de hoy. No es tu plan: tu suscripción sigue activa y sin límite de consultas. Vuelve a intentarlo en un rato; ya estamos avisados.'
   : 'La investigación ha alcanzado su límite temporal de uso. Puedes seguir consultando los recursos publicados.';
  return res.status(429).json({error:mensaje});}
  active++;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100000);const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnect);
  // El streaming SSE retransmite el texto del modelo apenas se genera (no espera
  // a que termine el turno completo) para que la primera palabra llegue en
  // segundos y no tras toda la investigación. El contrato JSON histórico se
  // mantiene intacto para /api/chat y para quien no pida stream:true.
  if(wantsStream){
   res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});
   if(typeof res.flushHeaders==='function')res.flushHeaders();
   // Comentario SSE cada 15s: mantiene viva la conexión mientras se investiga,
   // que es cuando puede pasar más tiempo sin enviar nada. El cliente ignora
   // las líneas que empiezan por ':' según la propia especificación SSE.
   const heartbeat=setInterval(()=>{ if(!res.writableEnded) res.write(': keep-alive\n\n'); },15000);
   try{
    const result=await agent.run({query:query.trim(),history,mode,signal:controller.signal,budget:spending,
     onDelta:delta=>sseWrite(res,{type:'delta',delta}),
     onStep:label=>sseWrite(res,{type:'step',label}),
     onStepDelta:delta=>sseWrite(res,{type:'step-delta',delta})
    });
    if(!res.destroyed){sseWrite(res,{type:'meta',text:result.text,sources:result.sources,mode:result.mode,relatedQuestions:result.relatedQuestions||[],library:relatedLibrary(query)});sseWrite(res,{type:'done'});}
   }catch(e){
    console.warn('[CatholicAgent]',e.name,e.message.replace(/[^a-zA-Z0-9_ ]/g,'').slice(0,60));
    if(!res.destroyed)sseWrite(res,{type:'error',error:'No se pudo completar la investigación con fuentes. Inténtalo de nuevo; no se ha sustituido por una respuesta sin verificar.'});
   }finally{clearInterval(heartbeat);clearTimeout(timer);res.off('close',disconnect);active--;if(!res.writableEnded)res.end();}
   return;
  }
  try{const result=await agent.run({query:query.trim(),history,mode,signal:controller.signal,budget:spending});if(!res.destroyed){res.set('Cache-Control','no-store');if(req.path==='/api/chat')res.type('text/plain').send(result.text+'\n\nFuentes: \n'+result.sources.map(s=>'['+s.id+'] '+s.title+' '+s.reference+' '+s.url).join('\n'));else res.json({...result,library:relatedLibrary(query)});}}
  catch(e){console.warn('[CatholicAgent]',e.name,e.message.replace(/[^a-zA-Z0-9_ ]/g,'').slice(0,60));if(!res.destroyed)res.status(502).json({error:'No se pudo completar la investigación con fuentes. Inténtalo de nuevo; no se ha sustituido por una respuesta sin verificar.'});}
  finally{clearTimeout(timer);res.off('close',disconnect);active--;}
 };
 app.post('/api/agent',limited,handleResearch);
 // Preserve the legacy URL while enforcing the same evidence and spending boundary.
 app.post('/api/chat',(req,res,next)=>process.env.CATHOLIC_AGENT_ENABLED==='1'?limited(req,res,()=>handleResearch(req,res)):next());
 app.post('/api/agent/export/:format',limited,async(req,res)=>{
  const format=req.params.format;if(!['docx','pdf'].includes(format))return res.sendStatus(404);
  // Exportar a Word y PDF es de Premium. Se comprueba en el servidor, no solo
  // en la interfaz: ocultar un botón no protege nada, cualquiera puede llamar
  // al endpoint a mano.
  const account=getUser(req);
  if(!isSuperAdmin(account) && !esPremium(account)){
   return res.status(402).json({
    error:'Descargar en Word y PDF es parte del plan Premium.',
    premium:true,
    url:'/planes'
   });
  }
  if(exportsActive>=3)return res.sendStatus(429);exportsActive++;
  try{const buffer=await docs[format==='docx'?'word':'pdf'](req.body||{});res.set({'Cache-Control':'no-store','Content-Disposition':`attachment; filename="catolicosgpt-material.${format}"`}).type(format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);}
  catch{res.status(400).json({error:'No fue posible exportar el material.'});}finally{exportsActive--;}
 });
}
module.exports={register};
