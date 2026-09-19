'use strict';
// Single host, durable-volume ledger. Reservations survive restarts and uncertain failures.
// Do not share this file across multiple Render instances; use a transactional store first.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function number(name,fallback){const x=Number(process.env[name]);return Number.isFinite(x)&&x>=0?x:fallback;}
function prices(model){
 if(/^gpt-4\.1-mini(?:-2025-04-14)?$/.test(model))return{input:.4,output:1.6};
 const input=Number(process.env.OPENAI_AGENT_INPUT_USD_PER_MILLION),output=Number(process.env.OPENAI_AGENT_OUTPUT_USD_PER_MILLION);
 if(!(input>0&&output>0))throw Error('unpriced_model');return{input,output};
}
function createBudget(directory=process.env.AGENT_BUDGET_DIR||process.env.DATA_DIR||path.join(__dirname,'data')){
 const file=path.join(directory,'agent-budget.json');
 function transaction(fn){
  fs.mkdirSync(directory,{recursive:true});let fd;try{fd=fs.openSync(file+'.lock','wx');}catch{throw Error('budget_store_busy');}
  try{let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('budget_store_invalid');state={months:{},days:{},clients:{}};}
   const result=fn(state);fs.writeFileSync(file+'.tmp',JSON.stringify(state),{mode:0o600});fs.renameSync(file+'.tmp',file);return result;
  }finally{fs.closeSync(fd);fs.unlinkSync(file+'.lock');}
 }
 // ── Aviso antes de chocar ──────────────────────────────────────────────────
 // El tope de gasto no es un presupuesto que se gaste: es el punto donde el
 // sitio deja de responder. Hasta ahora solo se notaba al llegar, y llegar
 // significa que a quien pagó le salta un mensaje de límite. Ahora avisa al
 // cruzar el 70% y el 90% del mes, con margen para subirlo.
 //
 // Cada umbral se anuncia UNA vez al mes: queda anotado en el propio estado,
 // que vive en el disco persistente, así que un reinicio no repite el aviso ni
 // lo pierde.
 const UMBRALES=[0.7,0.9];
 function avisar(s,month,gastado,tope){
  if(!(tope>0))return;
  s.avisos||={};
  const yaAvisado=s.avisos[month]||0;
  for(const u of UMBRALES){
   if(gastado>=tope*u && yaAvisado<u){
    s.avisos[month]=u;
    console.warn(`[Presupuesto] Llevas ${gastado.toFixed(2)} USD de ${tope.toFixed(2)} este mes (${Math.round(gastado/tope*100)}%). Al llegar al tope, el chat deja de responder TAMBIÉN a quien paga. Súbelo en OPENAI_AGENT_MONTHLY_BUDGET_USD antes de que ocurra.`);
   }
  }
  // Limpieza: los avisos de meses pasados no hacen falta.
  for(const k of Object.keys(s.avisos))if(k!==month)delete s.avisos[k];
 }
 function buckets(s,day,month){s.months[month]||={usd:0,input:0,output:0,calls:0};s.days[day]||={usd:0,research:0,requests:0};return[s.months[month],s.days[day]];}
 // `unlimited` es la cuenta Premium: se salta el tope diario por cliente, pero
 // NUNCA los topes de gasto. Ilimitado para el usuario no puede significar
 // ilimitado para la factura.
 function admit(client,{unlimited=false,limit,unmetered=false}={}){const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);return transaction(s=>{
  const [m,d]=buckets(s,day,month);const key=crypto.createHmac('sha256',process.env.AGENT_QUOTA_SECRET||process.env.MAGISTERIUM_API_KEY||'local-development').update(day+':'+client).digest('hex');
  if(!unmetered && (m.usd>=number('OPENAI_AGENT_MONTHLY_BUDGET_USD',80)||d.usd>=number('OPENAI_AGENT_DAILY_BUDGET_USD',6)))throw Error('budget_exhausted');
  // `limit` lo decide quien llama según el tipo de visitante (anónimo o
  // registrado); si no lo pasa, se usa el tope general.
  const cap=Number.isFinite(limit)&&limit>0?limit:number('AGENT_FREE_DAILY_REQUESTS',number('AGENT_DAILY_CLIENT_REQUESTS',12));
  if(!unlimited && (s.clients[key]?.count||0)>=cap)throw Error('daily_quota');
  if(!unmetered && d.research+3>number('MAGISTERIUM_AGENT_DAILY_CALLS',1500))throw Error('magisterium_budget_exhausted');
  s.clients[key]={day,count:(s.clients[key]?.count||0)+1};d.requests++;d.research+=3;
  for(const [k,v]of Object.entries(s.clients))if(v.day!==day)delete s.clients[k];
  for(const k of Object.keys(s.days))if(k.slice(0,7)!==month)delete s.days[k];
  return {day,month};
 });}
 function reserve(body,{unmetered=false}={}){const day=new Date().toISOString().slice(0,10),month=day.slice(0,7),rate=prices(body.model);
  // UTF-8 bytes plus protocol allowance are a conservative text token reservation.
  const input=Buffer.byteLength(JSON.stringify(body),'utf8')+4096,output=body.max_output_tokens||4000;
  const usd=(input*rate.input+output*rate.output)/1e6;
  transaction(s=>{const[m,d]=buckets(s,day,month);if(!unmetered && (m.usd+usd>number('OPENAI_AGENT_MONTHLY_BUDGET_USD',80)||d.usd+usd>number('OPENAI_AGENT_DAILY_BUDGET_USD',6)))throw Error('budget_exhausted');m.usd+=usd;d.usd+=usd;m.calls++;avisar(s,month,m.usd,number('OPENAI_AGENT_MONTHLY_BUDGET_USD',80));});
  let settled=false;return{settle(usage){if(settled||!Number.isFinite(usage?.input_tokens)||!Number.isFinite(usage?.output_tokens))return;settled=true;const actual=(usage.input_tokens*rate.input+usage.output_tokens*rate.output)/1e6;transaction(s=>{const[m,d]=buckets(s,day,month);m.usd=Math.max(0,m.usd-usd+actual);d.usd=Math.max(0,d.usd-usd+actual);m.input+=usage.input_tokens;m.output+=usage.output_tokens;});}};
 }
 // Cuántas consultas lleva hoy un cliente. La interfaz necesita poder decirle
 // al usuario cuántas le quedan: un límite que solo se descubre al chocar con
 // él no es un límite, es una sorpresa.
 function usage(client){
  const day=new Date().toISOString().slice(0,10);
  const key=crypto.createHmac('sha256',process.env.AGENT_QUOTA_SECRET||process.env.MAGISTERIUM_API_KEY||'local-development').update(day+':'+client).digest('hex');
  try{
   const state=JSON.parse(fs.readFileSync(file,'utf8'));
   const entry=state.clients&&state.clients[key];
   return {used:entry&&entry.day===day?entry.count:0};
  }catch{return {used:0};}
 }
 // Lo que lleva gastado el mes y el día, para poder enseñarlo en el panel sin
 // tener que abrir un fichero a mano.
 function resumenGasto(){
  const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);
  const topeMes=number('OPENAI_AGENT_MONTHLY_BUDGET_USD',80),topeDia=number('OPENAI_AGENT_DAILY_BUDGET_USD',6);
  try{
   const s=JSON.parse(fs.readFileSync(file,'utf8'));
   const m=(s.months&&s.months[month])||{usd:0,calls:0},d=(s.days&&s.days[day])||{usd:0,requests:0};
   return {mes:month,dia:day,gastadoMes:m.usd||0,topeMes,llamadasMes:m.calls||0,gastadoDia:d.usd||0,topeDia,consultasDia:d.requests||0};
  }catch{return {mes:month,dia:day,gastadoMes:0,topeMes,llamadasMes:0,gastadoDia:0,topeDia,consultasDia:0};}
 }
 // El súper administrador no tiene tope: ni de consultas ni de gasto. El gasto
 // se SIGUE contabilizando —solo deja de frenar— para que las cifras del panel
 // sigan siendo ciertas y se vea lo que consume.
 function unmeteredView(){
  return {
   admit:(client,options={})=>admit(client,{...options,unlimited:true,unmetered:true}),
   reserve:(body,options={})=>reserve(body,{...options,unmetered:true})
  };
 }
 return{admit,reserve,usage,resumenGasto,unmetered:unmeteredView};
}
module.exports={createBudget,prices};
