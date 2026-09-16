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
 function buckets(s,day,month){s.months[month]||={usd:0,input:0,output:0,calls:0};s.days[day]||={usd:0,research:0,requests:0};return[s.months[month],s.days[day]];}
 // `unlimited` es la cuenta Premium: se salta el tope diario por cliente, pero
 // NUNCA los topes de gasto. Ilimitado para el usuario no puede significar
 // ilimitado para la factura.
 function admit(client,{unlimited=false,limit}={}){const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);return transaction(s=>{
  const [m,d]=buckets(s,day,month);const key=crypto.createHmac('sha256',process.env.AGENT_QUOTA_SECRET||process.env.MAGISTERIUM_API_KEY||'local-development').update(day+':'+client).digest('hex');
  if(m.usd>=number('OPENAI_AGENT_MONTHLY_BUDGET_USD',30)||d.usd>=number('OPENAI_AGENT_DAILY_BUDGET_USD',2))throw Error('budget_exhausted');
  // `limit` lo decide quien llama según el tipo de visitante (anónimo o
  // registrado); si no lo pasa, se usa el tope general.
  const cap=Number.isFinite(limit)&&limit>0?limit:number('AGENT_FREE_DAILY_REQUESTS',number('AGENT_DAILY_CLIENT_REQUESTS',10));
  if(!unlimited && (s.clients[key]?.count||0)>=cap)throw Error('daily_quota');
  if(d.research+3>number('MAGISTERIUM_AGENT_DAILY_CALLS',1500))throw Error('magisterium_budget_exhausted');
  s.clients[key]={day,count:(s.clients[key]?.count||0)+1};d.requests++;d.research+=3;
  for(const [k,v]of Object.entries(s.clients))if(v.day!==day)delete s.clients[k];
  for(const k of Object.keys(s.days))if(k.slice(0,7)!==month)delete s.days[k];
  return {day,month};
 });}
 function reserve(body){const day=new Date().toISOString().slice(0,10),month=day.slice(0,7),rate=prices(body.model);
  // UTF-8 bytes plus protocol allowance are a conservative text token reservation.
  const input=Buffer.byteLength(JSON.stringify(body),'utf8')+4096,output=body.max_output_tokens||4000;
  const usd=(input*rate.input+output*rate.output)/1e6;
  transaction(s=>{const[m,d]=buckets(s,day,month);if(m.usd+usd>number('OPENAI_AGENT_MONTHLY_BUDGET_USD',30)||d.usd+usd>number('OPENAI_AGENT_DAILY_BUDGET_USD',2))throw Error('budget_exhausted');m.usd+=usd;d.usd+=usd;m.calls++;});
  let settled=false;return{settle(usage){if(settled||!Number.isFinite(usage?.input_tokens)||!Number.isFinite(usage?.output_tokens))return;settled=true;const actual=(usage.input_tokens*rate.input+usage.output_tokens*rate.output)/1e6;transaction(s=>{const[m,d]=buckets(s,day,month);m.usd=Math.max(0,m.usd-usd+actual);d.usd=Math.max(0,d.usd-usd+actual);m.input+=usage.input_tokens;m.output+=usage.output_tokens;});}};
 }
 return{admit,reserve};
}
module.exports={createBudget,prices};
