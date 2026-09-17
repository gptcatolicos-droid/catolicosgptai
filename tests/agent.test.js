const {test}=require('node:test');const assert=require('node:assert/strict');
const agent=require('../catholic-agent');const docs=require('../agent-documents');
const {PDFDocument}=require('pdf-lib');
function fixture({failure=false,noCitations=false,loop=false}={}){let openai=0;const requests=[];return{requests,fetcher:async(url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});if(failure&&url.includes('magisterium'))return{ok:false,status:503};let data;if(url.endsWith('/search'))data={data:{results:[]}};else if(url.includes('magisterium'))data={choices:[{message:{content:'Jesús recibe a los niños.'}}],citations:noCitations?[]:[{document_title:'Evangelio según san Marcos',document_reference:'10, 13-16',cited_text:'Jesús bendice a los niños.',source_url:'https://bible.usccb.org/bible/mark/10'}]};else{openai++;data=(openai===1||loop)&&body.tools?{output:[{type:'function_call',name:'consultar_magisterium',call_id:`call${openai}`,arguments:JSON.stringify({query:'Fundamento en Marcos',category:'magisterial'})}]}:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'# Resumen\nJesús recibe a los niños [F1]. Referencia inválida [F99].'}]}]};}return{ok:true,json:async()=>data};}};}
test('retrieves evidence, executes follow-up, deduplicates citations and removes unknown IDs',async()=>{const f=fixture();const result=await agent.run({query:'Resume el pasaje',mode:'resumen',signal:AbortSignal.timeout(5000),fetcher:f.fetcher});assert.equal(result.researchCalls,2);assert.equal(result.sources.length,1);assert(!result.text.includes('[F99]'));assert.equal(f.requests[0].body.numResults,6);assert.equal(f.requests[1].body.model,'magisterium-1');assert(f.requests.find(r=>r.body.input?.some(x=>x.type==='function_call_output')));});
test('never calls OpenAI if Magisterium fails',async()=>{const f=fixture({failure:true});await assert.rejects(agent.run({query:'Fe',signal:AbortSignal.timeout(5000),fetcher:f.fetcher}));assert(f.requests.every(r=>!r.url.includes('openai')));});
test('research budget remains bounded',async()=>{const f=fixture({loop:true});const r=await agent.run({query:'Fe',mode:'analisis',signal:AbortSignal.timeout(5000),fetcher:f.fetcher});assert.equal(r.researchCalls,3);assert.equal(f.requests.filter(x=>x.url.includes('openai')).length,3);});
test('missing structured sources is disclosed',async()=>{const f=fixture({noCitations:true});const r=await agent.run({query:'Fe',signal:AbortSignal.timeout(5000),fetcher:f.fetcher});assert.match(r.text,/no devolvió referencias/);});
test('untrusted source URLs cannot become executable links',()=>{assert.equal(agent.safeUrl('javascript:alert(1)'),'');assert.equal(agent.safeUrl('data:text/html,test'),'');});
test('Word and PDF exports contain genuine files with tables and references',async()=>{const input={text:'# Guía de estudio\nUna explicación en español.\n| Tema | Idea |\n|---|---|\n| Fe | Confianza |',sources:[{id:'F1',title:'Marcos',reference:'10, 13-16',url:'https://bible.usccb.org/bible/mark/10'}]};const word=await docs.word(input);assert.equal(word.subarray(0,2).toString(),'PK');const pdf=await docs.pdf(input);assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);assert.throws(()=>docs.material({text:'x'.repeat(40001)}));});
test('large tables paginate without an infinite loop',async()=>{const pdf=await docs.pdf({text:'| Tema | Detalle |\n|---|---|\n'+Array.from({length:70},(_,i)=>`| ${i} | ${'Texto de formación '.repeat(20)} |`).join('\n')});assert((await PDFDocument.load(pdf)).getPageCount()>1);});
test('budget persists reservations, reconciles usage, and enforces a ceiling',()=>{
 const fs=require('fs'),os=require('os'),path=require('path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgpt-budget-'));const {createBudget}=require('../agent-budget');const old=process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD;
 try{process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD='.01';const budget=createBudget(dir);const reservation=budget.reserve({model:'gpt-4.1-mini',input:'Hola',max_output_tokens:100});reservation.settle({input_tokens:100,output_tokens:50});let state=JSON.parse(fs.readFileSync(path.join(dir,'agent-budget.json')));assert.equal(Object.values(state.months)[0].input,100);assert.throws(()=>createBudget(dir).reserve({model:'gpt-4.1-mini',input:'x'.repeat(100000),max_output_tokens:2800}),/budget_exhausted/);assert.throws(()=>budget.reserve({model:'unknown-expensive-model',input:'Hola',max_output_tokens:100}),/unpriced_model/);fs.writeFileSync(path.join(dir,'agent-budget.json'),'bad');assert.throws(()=>budget.admit('test'),/budget_store_invalid/);}finally{if(old===undefined)delete process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD;else process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD=old;fs.rmSync(dir,{recursive:true,force:true});}
});
test('sitemap excludes unpublished resources, deduplicates URLs and has no fabricated lastmod',()=>{const xml=require('../seo-module').generateSitemapXML({infografias:[{slug:'hidden',publicado:false},{slug:'test&one',publicado:true}],authorityPages:[{path:'/ninos'},{path:'/ninos'}]});assert(!xml.includes('/hidden'));assert(xml.includes('test&amp;one'));assert.equal(xml.match(/<loc>[^<]*\/ninos<\/loc>/g).length,1);assert(!xml.includes('<lastmod>'));});
test('el modo breve responde desde /search, sin la sintesis intermedia de Magisterium',async()=>{
 const requests=[];
 const enc=new TextEncoder();
 const sse=events=>{const chunks=events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join('');let sent=false;
  return {getReader(){return{async read(){if(sent)return{done:true};sent=true;return{done:false,value:enc.encode(chunks)};}};}};};
 const fetcher=async(url,options)=>{
  requests.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('/search')) return {ok:true,json:async()=>({data:{results:[
   {document_title:'Catecismo',document_reference:'n. 1324',cited_text:'La Eucaristia es fuente y culmen.',source_url:'https://www.vatican.va/ccc'}
  ]}})};
  if(url.includes('magisterium')) throw new Error('no se debe llamar a la sintesis de Magisterium en el modo breve');
  return {ok:true,body:sse([
   {type:'response.output_text.delta',delta:'La Eucaristia es fuente y culmen [F1].'},
   {type:'response.completed',response:{status:'completed',usage:{input_tokens:10,output_tokens:5},
     output:[{type:'message',content:[{type:'output_text',text:'La Eucaristia es fuente y culmen [F1].'}]}]}}
  ])};
 };
 let streamed='';
 const r=await agent.run({query:'Que es la Eucaristia',mode:'consulta',signal:AbortSignal.timeout(5000),fetcher,onDelta:d=>{streamed+=d;}});
 // Una sola llamada a Magisterium (la busqueda) y una sola a OpenAI.
 assert.equal(requests.filter(x=>x.url.endsWith('/search')).length,1);
 assert.equal(requests.filter(x=>x.url.includes('openai')).length,1);
 assert(requests.filter(x=>x.url.includes('openai')).every(x=>!x.body.tools));
 assert.equal(r.researchCalls,1);
 // La fuente recuperada por /search llega al usuario con su enlace.
 assert.equal(r.sources.length,1);
 assert.equal(r.sources[0].url,'https://www.vatican.va/ccc');
 assert.equal(streamed,'La Eucaristia es fuente y culmen [F1].');
});
test('la cuota escalona visitante, registrado y Premium, y el tope de gasto aplica a todos',()=>{
 const fs=require('fs'),os=require('os'),path=require('path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cgpt-quota-'));
 const {createBudget}=require('../agent-budget');
 const prevFree=process.env.AGENT_FREE_DAILY_REQUESTS, prevMonthly=process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD;
 try{
  process.env.AGENT_FREE_DAILY_REQUESTS='2';
  const budget=createBudget(dir);
  // Visitante sin cuenta: el tope lo decide quien llama.
  budget.admit('ip:1.2.3.4',{limit:1});
  assert.throws(()=>budget.admit('ip:1.2.3.4',{limit:1}),/daily_quota/);
  // Registrado gratuito: más margen, pero sigue teniendo tope.
  budget.admit('user:free'); budget.admit('user:free');
  assert.throws(()=>budget.admit('user:free'),/daily_quota/);
  // Premium: sin tope diario por cuenta.
  for(let i=0;i<10;i++) budget.admit('user:premium',{unlimited:true});
  // Pero "ilimitado" nunca significa gasto ilimitado: el tope de dinero manda.
  process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD='0';
  assert.throws(()=>createBudget(dir).admit('user:premium',{unlimited:true}),/budget_exhausted/);
 } finally {
  if(prevFree===undefined)delete process.env.AGENT_FREE_DAILY_REQUESTS;else process.env.AGENT_FREE_DAILY_REQUESTS=prevFree;
  if(prevMonthly===undefined)delete process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD;else process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD=prevMonthly;
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('el material relacionado enlaza el tema consultado y calla cuando no hay nada que enlazar',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 // La prueba trae su propio catálogo. Antes leía el del repositorio, así que
 // cambiar el contenido publicado rompía una prueba que no iba de contenido.
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-related-'));
 const previo=process.env.DATA_DIR;
 process.env.DATA_DIR=dir;
 const articulo=(slug,titulo,descripcion,categoria)=>({slug,titulo,descripcion,categoria,publicado:true});
 // El ranking pesa las palabras por lo raras que sean en el catálogo (IDF) y
 // exige que la consulta traiga alguna de verdad distintiva. Con seis fichas
 // ninguna palabra puede serlo, así que el catálogo de prueba tiene el tamaño
 // que el algoritmo necesita para funcionar como en producción.
 const relleno=[];
 for(let i=0;i<200;i++) relleno.push(articulo('relleno-'+i,'Tema catolico numero '+i,'Ficha de relleno numero '+i+' sobre formacion general.','formacion'));
 fs.writeFileSync(pathMod.join(dir,'blog-catalog.json'),JSON.stringify({posts:[
   articulo('rosario-guia','El Santo Rosario: guía completa para rezarlo','Cómo se reza el rosario paso a paso, con sus misterios.','oraciones'),
   articulo('rosario-misterios','El Santo Rosario: los misterios explicados','Misterios gozosos, luminosos, dolorosos y gloriosos del rosario.','oraciones'),
   articulo('rosario-familia','Rezar el rosario en familia','Cómo rezar el santo rosario en casa con los hijos.','oraciones'),
   articulo('teresa-avila','Santa Teresa de Ávila: vida y obra','Biografía de santa Teresa de Ávila, doctora de la Iglesia.','santos'),
   articulo('catalina-siena','Santa Catalina de Siena','Biografía de santa Catalina de Siena.','santos'),
   articulo('confesion','La confesión sacramental','Qué es el sacramento de la penitencia.','sacramentos'),
   ...relleno
 ],total:206}));
 fs.writeFileSync(pathMod.join(dir,'infografias-catalog.json'),JSON.stringify({infografias:[
   {slug:'rosario-infografia',titulo:'Cómo rezar el Santo Rosario',tema:'rosario',metaDescription:'Los misterios del rosario en una imagen.',categoria:'oraciones',publicado:true,imagenes:[{url:'/x.png'}]},
   {slug:'rosario-para-colorear',titulo:'El Rosario para colorear',tema:'rosario',metaDescription:'Dibujo del rosario para niños.',categoria:'dibujo-para-colorear',esDibujoNinos:true,publicado:true,imagenes:[{url:'/y.png'}]},
   {slug:'sacramentos-infografia',titulo:'Los siete sacramentos',tema:'sacramentos',metaDescription:'Los sacramentos de la Iglesia.',categoria:'doctrina',publicado:true,imagenes:[{url:'/z.png'}]}
 ],total:3}));
 delete require.cache[require.resolve('../agent-related-content')];
 try{
  const {related}=require('../agent-related-content');

  // Un tema con material publicado devuelve artículos reales del catálogo.
  const rosario=related('cómo se reza el santo rosario');
  assert.ok(rosario.articulos.length>0,'el rosario tiene artículos publicados');
  assert.ok(rosario.articulos.every(a=>a.url.startsWith('/blog/')&&a.title));
  assert.ok(rosario.articulos.some(a=>/rosario/i.test(a.title)),'los artículos tratan del tema preguntado');
  assert.ok(rosario.infografias.every(i=>i.url.startsWith('/infografias/')));

  // Los topes son los que pide la interfaz: 2 infografías y 5 artículos.
  assert.ok(rosario.infografias.length<=2);
  assert.ok(rosario.articulos.length<=5);

  // Fuera del ámbito del servicio no se enlaza nada: recomendar cualquier cosa
  // es peor que no recomendar.
  const ajeno=related('cómo cambiar el aceite del motor de un carro');
  assert.deepEqual(ajeno,{infografias:[],articulos:[]});

  // Y un tema católico no se rellena con parecidos: "santa" no basta para
  // ofrecer a otra santa distinta.
  for(const item of related('quién fue santa teresa de ávila').articulos){
   assert.ok(/teresa|avila|ávila/i.test(item.title),`no debería ofrecerse "${item.title}"`);
  }

  // Una consulta vacía no puede reventar ni inventar relaciones.
  assert.deepEqual(related(''),{infografias:[],articulos:[]});
  assert.deepEqual(related(undefined),{infografias:[],articulos:[]});
 } finally {
  previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
  delete require.cache[require.resolve('../agent-related-content')];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('el material relacionado ve los articulos nuevos sin reiniciar el servidor',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-related-vivo-'));
 const previo=process.env.DATA_DIR;
 process.env.DATA_DIR=dir;
 const catalogo=pathMod.join(dir,'blog-catalog.json');
 const relleno=[];
 for(let i=0;i<200;i++) relleno.push({slug:'relleno-'+i,titulo:'Tema catolico numero '+i,descripcion:'Ficha de relleno numero '+i+'.',categoria:'formacion',publicado:true});
 fs.writeFileSync(catalogo,JSON.stringify({posts:relleno,total:relleno.length}));
 fs.writeFileSync(pathMod.join(dir,'infografias-catalog.json'),JSON.stringify({infografias:[],total:0}));
 delete require.cache[require.resolve('../agent-related-content')];
 try{
  const {related}=require('../agent-related-content');
  assert.deepEqual(related('la santa misa explicada'),{infografias:[],articulos:[]});

  // Se publica uno, como hace la generación diaria, sin tocar el proceso.
  fs.writeFileSync(catalogo,JSON.stringify({posts:[
    {slug:'la-santa-misa',titulo:'La Santa Misa explicada paso a paso',descripcion:'Qué ocurre en cada parte de la santa misa.',categoria:'liturgia',publicado:true},
    ...relleno
  ],total:relleno.length+1}));
  const despues=related('la santa misa explicada');
  assert.equal(despues.articulos.length,1,'el artículo recién publicado ya se enlaza');
  assert.equal(despues.articulos[0].url,'/blog/la-santa-misa');
 } finally {
  previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
  delete require.cache[require.resolve('../agent-related-content')];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('las fuentes en otro idioma se identifican, no se transcriben, y el español va primero',async()=>{
 const {citation,searchPassages}=require('../catholic-agent');
 const {detect,name}=require('../agent-language');

 // El idioma se reconoce sobre el texto citado.
 assert.equal(detect('La caridad es la virtud teologal por la cual amamos a Dios sobre todas las cosas.'),'es');
 assert.equal(detect("personne n'allume un flambeau pour le mettre sous le boisseau, mais on le met sur le chandelier."),'fr');
 assert.equal(detect('Vitam segregem agens, tenuem fecit mercaturam, ut sibi et suis victum quaeritaret simulque haberet.'),'la');
 assert.equal(name('la'),'latín');
 // Ante un texto demasiado corto se calla en vez de etiquetar mal.
 assert.equal(detect('Lumen Gentium 8'),'');

 // Las entidades HTML llegaban sin resolver y se leían literalmente en pantalla.
 const francesa=citation({document_title:'Histoire',cited_text:"le fond du c&oelig;ur, personne n&apos;allume un flambeau pour le mettre sous le boisseau afin qu&apos;il éclaire la maison."});
 assert.ok(!francesa.quote.includes('&apos;'),'la entidad &apos; debe quedar resuelta');
 assert.ok(francesa.quote.includes('cœur'));
 assert.equal(francesa.language,'fr');
 assert.equal(francesa.languageName,'francés');

 // Con suficientes fuentes en español, las de otros idiomas no se devuelven.
 const espanolas=n=>Array.from({length:n},(_,i)=>({document_title:`Documento ${i}`,cited_text:'La Iglesia enseña que esta doctrina de la fe se recibe de los apóstoles y se transmite con fidelidad.'}));
 const latinas=n=>Array.from({length:n},(_,i)=>({document_title:`Acta ${i}`,cited_text:'Quae ab ineunte aetate religionis fuerat studiosa ac diligens, tunc pietatem impensius colere coepit atque etiam.'}));
 const responder=(body)=>{
  assert.ok(body.query,'la búsqueda necesita consulta');
  return Promise.resolve({ok:true,json:async()=>({data:[...latinas(3),...espanolas(3)]})});
 };
 const fetcher=(url,init)=>responder(JSON.parse(init.body));
 const soloEspanol=await searchPassages('la fe','auto',new AbortController().signal,fetcher);
 assert.equal(soloEspanol.length,3);
 assert.ok(soloEspanol.every(p=>p.language==='es'),'solo debe quedar evidencia en español');

 // Pero si descartarlas dejaría la respuesta sin ninguna fuente, se conservan
 // detrás de las españolas: responder sin evidencia sería peor.
 const escaso=(url,init)=>Promise.resolve({ok:true,json:async()=>({data:[...latinas(2),...espanolas(1)]})});
 const mezcla=await searchPassages('la fe','auto',new AbortController().signal,escaso);
 assert.equal(mezcla.length,3);
 assert.equal(mezcla[0].language,'es','el español va primero');
 assert.ok(mezcla.slice(1).every(p=>p.language==='la'));
});

test('una pregunta que pide una lista busca también el texto enumerado y exige la lista completa',async()=>{
 const agent=require('../catholic-agent');
 const {MODES,searchPlan,asksForEnumeration}=agent;

 // Se reconoce la forma de la pregunta, no un tema concreto de una lista fija.
 assert.ok(asksForEnumeration('los 10 mandamientos'));
 assert.ok(asksForEnumeration('cuáles son los sacramentos'));
 assert.ok(asksForEnumeration('enumera las bienaventuranzas'));
 assert.ok(!asksForEnumeration('qué es el purgatorio'));
 assert.ok(!asksForEnumeration('por qué sufrimos'));

 // Y esa forma dispara una segunda búsqueda dirigida al texto, porque /search
 // devuelve comentarios sobre la lista y no la lista.
 assert.equal(searchPlan('qué es el purgatorio').length,1);
 const plan=searchPlan('los 10 mandamientos');
 assert.equal(plan.length,2);
 assert.equal(plan[0],'los 10 mandamientos');
 assert.notEqual(plan[1],plan[0]);

 // Contrato de extremo a extremo: dos búsquedas, pasajes repetidos fusionados
 // una sola vez, y la orden de enumerar presente en lo que recibe el modelo.
 const pasaje={document_title:'Catecismo',document_reference:'n. 2052',cited_text:'La Iglesia enseña que el Decálogo se recibe de Dios y la tradición lo transmite con fidelidad a los fieles.'};
 const busquedas=[]; let instrucciones='',formato='',tope=0;
 const fetcher=(url,init)=>{
  const body=JSON.parse(init.body);
  if(url.includes('/search')){
   busquedas.push(body.query);
   return Promise.resolve({ok:true,json:async()=>({data:[pasaje,pasaje]})});
  }
  instrucciones=body.instructions; tope=body.max_output_tokens;
  formato=(body.instructions.split('FORMATO PREFERIDO: ')[1]||'');
  return Promise.resolve({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'1. No tendrás otro Dios [F1]'}]}],usage:{input_tokens:10,output_tokens:10}})});
 };
 const prev={MAGISTERIUM_API_KEY:process.env.MAGISTERIUM_API_KEY,OPENAI_API_KEY:process.env.OPENAI_API_KEY};
 process.env.MAGISTERIUM_API_KEY='prueba';process.env.OPENAI_API_KEY='prueba';
 try{
  const result=await agent.run({query:'los 10 mandamientos',mode:'consulta',signal:new AbortController().signal,fetcher});
  assert.equal(busquedas.length,2,'debe buscar dos veces ante una enumeración');
  assert.equal(result.sources.length,1,'el mismo pasaje no puede ocupar dos fuentes');
  assert.match(instrucciones,/lista|enumeración/i);
  assert.match(formato,/COMPLETA/,'el modo breve debe exigir la lista completa');
  assert.ok(tope>=900,`el tope de salida (${tope}) debe permitir una lista completa`);
 } finally {
  for(const [k,v] of Object.entries(prev)) v===undefined?delete process.env[k]:process.env[k]=v;
 }
});

test('lo que el admin borra no vuelve en el siguiente despliegue, y se puede deshacer',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-borrados-'));
 const prev=process.env.DATA_DIR, prevNube=process.env.CATOLICOSGPT_SIN_NUBE;
 process.env.DATA_DIR=dir;
 process.env.CATOLICOSGPT_SIN_NUBE='1';
 // El módulo cachea la lista y la ruta de datos, así que se carga limpio.
 for(const m of ['../infografias-eliminadas']) delete require.cache[require.resolve(m)];
 try{
  const registro=require('../infografias-eliminadas');
  registro.reset();

  const catalogo=[{id:'a1',slug:'san-jose',titulo:'San José'},{id:'b2',slug:'rosario',titulo:'Rosario'}];
  assert.equal(registro.filter(catalogo).length,2,'sin borrados no se filtra nada');

  // Borrar anota la lápida por id Y por slug: las líneas base identifican los
  // registros por uno u otro, y basta con que una lo cuele para resucitarlo.
  registro.remember(catalogo[0]);
  assert.equal(registro.list().length,1,'un borrado es UNA entrada, no dos claves sueltas');
  assert.equal(registro.list()[0].titulo,'San José','la papelera debe poder nombrar lo que se borró');

  // Un despliegue: la rutina de recuperación intenta reponer su línea base.
  const repuesto=registro.filter([{id:'a1',slug:'san-jose'},{id:'b2',slug:'rosario'},{id:'c3',slug:'nuevo'}]);
  assert.deepEqual(repuesto.map(i=>i.slug),['rosario','nuevo'],'lo borrado no puede volver');

  // Y la reconoce aunque la línea base solo traiga uno de los dos campos.
  assert.ok(registro.isDeleted({slug:'san-jose'}),'debe reconocerla solo por slug');
  assert.ok(registro.isDeleted({id:'a1'}),'debe reconocerla solo por id');

  // Deshacer: un borrado permanente sin marcha atrás sería una trampa.
  assert.ok(registro.forget({slug:'san-jose'}));
  assert.equal(registro.filter([{id:'a1',slug:'san-jose'}]).length,1,'restaurada vuelve al catálogo');

  // Un registro sin id ni slug no puede crear una lápida vacía que bloquee
  // todo lo que tampoco los tenga.
  assert.equal(registro.remember({}),false);
  assert.equal(registro.remember(null),false);
 } finally {
  if(prev===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=prev;
  if(prevNube===undefined)delete process.env.CATOLICOSGPT_SIN_NUBE;else process.env.CATOLICOSGPT_SIN_NUBE=prevNube;
  delete require.cache[require.resolve('../infografias-eliminadas')];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('el súper administrador no tiene tope: ni de consultas ni de gasto, pero su gasto se contabiliza',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const {createBudget}=require('../agent-budget');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-admin-'));
 const prevMensual=process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD, prevDiario=process.env.OPENAI_AGENT_DAILY_BUDGET_USD;
 try{
  // Un tope de gasto ya agotado: para cualquier otra cuenta esto es el final.
  process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD='0';
  process.env.OPENAI_AGENT_DAILY_BUDGET_USD='0';
  const budget=createBudget(dir);
  assert.throws(()=>budget.admit('user:premium',{unlimited:true}),/budget_exhausted/,'el tope frena incluso a Premium');

  // El súper administrador pasa igualmente, y muchas veces seguidas.
  const admin=budget.unmetered();
  for(let i=0;i<25;i++) admin.admit('user:superadmin');

  // Y su gasto sigue quedando registrado: no frena, pero tampoco se esconde.
  const cuerpo={model:'gpt-4.1-mini',max_output_tokens:900,input:'x'};
  admin.reserve(cuerpo);
  const estado=JSON.parse(fs.readFileSync(pathMod.join(dir,'agent-budget.json'),'utf8'));
  const mes=Object.values(estado.months)[0];
  assert.ok(mes.usd>0,'el gasto del administrador debe contabilizarse aunque no le frene');
  assert.ok(mes.calls>0);
 } finally {
  if(prevMensual===undefined)delete process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD;else process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD=prevMensual;
  if(prevDiario===undefined)delete process.env.OPENAI_AGENT_DAILY_BUDGET_USD;else process.env.OPENAI_AGENT_DAILY_BUDGET_USD=prevDiario;
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('la cuota se puede consultar antes de chocar con ella',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const {createBudget}=require('../agent-budget');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-cuota-'));
 try{
  const budget=createBudget(dir);
  assert.equal(budget.usage('ip:9.9.9.9').used,0,'quien no ha preguntado no ha gastado nada');
  budget.admit('ip:9.9.9.9',{limit:3});
  budget.admit('ip:9.9.9.9',{limit:3});
  assert.equal(budget.usage('ip:9.9.9.9').used,2,'debe poder decirse cuántas lleva ANTES de agotarlas');
  // Cada cliente cuenta por separado: el aviso de uno no puede salir del uso
  // de otro.
  assert.equal(budget.usage('ip:8.8.8.8').used,0);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('exportar a Word y PDF es de Premium, y se cierra en el servidor',async()=>{
 const express=require('express');
 const app=express();
 app.use(express.json());
 // El plan lo decide quien llama, como hace server.js con la sesión real.
 let cuenta=null;
 require('../agent-routes').register(app,{getUser:()=>cuenta});

 const servidor=app.listen(0);
 await new Promise(res=>servidor.once('listening',res));
 const puerto=servidor.address().port;
 const pedir=(ruta,opciones)=>fetch(`http://127.0.0.1:${puerto}${ruta}`,opciones);
 const exportar=()=>pedir('/api/agent/export/docx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'hola',sources:[]})});

 try{
  // Visitante sin cuenta: cerrado.
  const anonimo=await exportar();
  assert.equal(anonimo.status,402,'un visitante no puede exportar');
  const cuerpo=await anonimo.json();
  assert.match(cuerpo.error,/Premium/);
  assert.equal(cuerpo.url,'/planes','el mensaje debe llevar a donde se paga');

  // Registrado gratuito: también cerrado. Ocultar el botón no protege nada;
  // esta prueba llama al endpoint directamente, como haría cualquiera.
  cuenta={id:'u1',plan:'free',email:'gratis@ejemplo.com'};
  assert.equal((await exportar()).status,402,'el plan gratuito tampoco exporta');

  // Y la cuota se lo dice a la interfaz, para que no muestre un botón que falla.
  cuenta={id:'u1',plan:'free',email:'gratis@ejemplo.com'};
  const cuotaGratis=await (await pedir('/api/agent/cuota')).json();
  assert.equal(cuotaGratis.puedeDescargar,false);

  // Premium: pasa el control de plan. Ya no responde 402.
  cuenta={id:'u2',plan:'premium',email:'premium@ejemplo.com'};
  assert.notEqual((await exportar()).status,402,'Premium sí puede exportar');
  const cuotaPremium=await (await pedir('/api/agent/cuota')).json();
  assert.equal(cuotaPremium.puedeDescargar,true);
  assert.equal(cuotaPremium.ilimitado,true);
 } finally {
  // Sin esto el proceso de pruebas se queda colgado con el puerto abierto.
  await new Promise(res=>servidor.close(res));
 }
});

test('la cuenta de administrador se restaura tras un reinicio y el correo deja de estar libre',async()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-admin-boot-'));
 const previo={DATA_DIR:process.env.DATA_DIR,ADMIN_EMAIL:process.env.ADMIN_EMAIL,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,CATOLICOSGPT_SIN_NUBE:process.env.CATOLICOSGPT_SIN_NUBE};
 process.env.DATA_DIR=dir;
 process.env.CATOLICOSGPT_SIN_NUBE='1';
 process.env.ADMIN_EMAIL='jefe@ejemplo.com';
 process.env.ADMIN_PASSWORD='contrasena-larga-de-prueba';
 // Un contenedor recien arrancado: el fichero de usuarios llega vacio.
 fs.writeFileSync(pathMod.join(dir,'users.json'),JSON.stringify({users:[]}));
 delete require.cache[require.resolve('../auth-module')];
 try{
  const auth=require('../auth-module');
  assert.equal(auth.getUserByEmail('jefe@ejemplo.com'),null,'parte de cero, como tras un despliegue');

  const r=await auth.bootstrapAdminUser();
  assert.equal(r.creado,true);
  const admin=auth.getUserByEmail('jefe@ejemplo.com');
  assert.ok(admin,'el administrador debe existir tras el arranque');
  assert.equal(admin.plan,'admin');
  // La contrasena se guarda cifrada, nunca en claro.
  assert.ok(admin.passwordHash && admin.passwordHash!=='contrasena-larga-de-prueba');
  assert.ok(await auth.login({email:'jefe@ejemplo.com',password:'contrasena-larga-de-prueba'}),'debe poder entrar');

  // Y esto es lo que cierra el agujero: con la cuenta ocupada, nadie puede
  // reclamar el correo de admin registrandose.
  await assert.rejects(
   auth.register({nombre:'Impostor',email:'jefe@ejemplo.com',password:'otra-contrasena'}),
   /ya est/i,
   'nadie mas puede quedarse con el correo del administrador');

  // Un segundo arranque no pisa la contrasena que el admin pudo cambiar.
  const segundo=await auth.bootstrapAdminUser();
  assert.equal(segundo.creado,false);
  assert.equal(segundo.motivo,'ya existe');

  // Sin ADMIN_PASSWORD no se inventa ninguna cuenta.
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await auth.bootstrapAdminUser()).creado,false);
 } finally {
  for(const [k,v] of Object.entries(previo)) v===undefined?delete process.env[k]:process.env[k]=v;
  delete require.cache[require.resolve('../auth-module')];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('el disco persistente se siembra en el primer arranque y no se pisa despues',()=>{
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const {seedDataDir}=require('../data-dir-seed');
 const disco=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-disco-'));
 try{
  // Primer arranque: el disco esta vacio, como uno recien creado en Render.
  assert.equal(fs.readdirSync(disco).length,0);
  const primero=seedDataDir(disco);
  assert.ok(primero.sembrados.length>5,'debe copiar los catalogos del repositorio');
  assert.ok(primero.sembrados.includes('users.json'));
  assert.ok(primero.sembrados.includes('blog-catalog.json'));

  // El administrador crea algo: aqui lo simulamos editando un fichero.
  const usuarios=pathMod.join(disco,'users.json');
  fs.writeFileSync(usuarios,JSON.stringify({users:[{id:'u1',email:'real@ejemplo.com'}]}));

  // Segundo arranque: NO puede pisar lo que ya hay. Esta es la regla entera.
  const segundo=seedDataDir(disco);
  assert.equal(segundo.sembrados.length,0,'no se siembra nada sobre un disco poblado');
  assert.equal(JSON.parse(fs.readFileSync(usuarios,'utf8')).users[0].email,'real@ejemplo.com',
   'el dato del disco sobrevive al arranque');

  // Si falta un fichero suelto, ese si se repone, sin tocar los demas.
  fs.unlinkSync(pathMod.join(disco,'blog-catalog.json'));
  const tercero=seedDataDir(disco);
  assert.deepEqual(tercero.sembrados,['blog-catalog.json']);
  assert.equal(JSON.parse(fs.readFileSync(usuarios,'utf8')).users[0].email,'real@ejemplo.com');

  // Sin DATA_DIR no se hace nada: el sitio ya usa la carpeta del repositorio.
  assert.equal(seedDataDir('').sembrados.length,0);
  // Y nunca se copia la carpeta del repositorio sobre si misma.
  assert.equal(seedDataDir(pathMod.join(__dirname,'..','data')).sembrados.length,0);
 } finally { fs.rmSync(disco,{recursive:true,force:true}); }
});

// ── Temario diario: el sistema publica todos los días sin repetir tema ──
test('el temario diario no repite ninguna busqueda', () => {
  const daily = require('../daily-content-module');
  const { CONSULTAS } = require('../seo-consultas');
  const estado = {};
  const vistas = new Set();
  const dias = Math.floor(CONSULTAS.length / daily.ARTICULOS_POR_DIA);
  for (let dia = 0; dia < dias; dia++) {
    const { plan, usados } = daily.temarioDelDia(estado);
    assert.equal(plan.length, daily.ARTICULOS_POR_DIA, `el dia ${dia} no llenó el cupo`);
    for (const item of plan) {
      assert.ok(!vistas.has(item.consulta), `búsqueda repetida el día ${dia}: ${item.consulta}`);
      vistas.add(item.consulta);
      usados.add(item.consulta);
    }
    estado.consultasUsadas = Array.from(usados);
  }
  assert.equal(vistas.size, dias * daily.ARTICULOS_POR_DIA);
});

test('un mismo racimo de busquedas no copa el dia', () => {
  const daily = require('../daily-content-module');
  const { plan } = daily.temarioDelDia({});
  const porGrupo = {};
  for (const item of plan) porGrupo[item.grupo] = (porGrupo[item.grupo] || 0) + 1;
  for (const [grupo, cuantos] of Object.entries(porGrupo)) {
    assert.ok(cuantos <= 2, `el racimo ${grupo} copa ${cuantos} artículos del día`);
  }
});

test('el banco de consultas no trae intencion diaria ni consultas de marca', () => {
  const { CONSULTAS } = require('../seo-consultas');
  // "rosario de hoy" o "evangelio de hoy" los sirven las páginas pilar; un
  // artículo de blog competiría contra nuestra propia página.
  for (const c of CONSULTAS) {
    assert.ok(!/\bde hoy\b/i.test(c.consulta), `intención diaria en el banco: ${c.consulta}`);
    assert.ok(!/cat[oó]licos ?gpt|\bia cat[oó]lica\b/i.test(c.consulta), `consulta de marca: ${c.consulta}`);
  }
  const unicas = new Set(CONSULTAS.map(c => c.consulta));
  assert.equal(unicas.size, CONSULTAS.length, 'hay búsquedas duplicadas en el banco');
});

test('lo que se publica respeta los limites de titulo y descripcion de Google', () => {
  const daily = require('../daily-content-module');

  // Un título largo se corta por palabra, no a mitad de una.
  const largo = daily.normalizarSeo({
    seoTitle: 'Qué es la Eucaristía para niños: una explicación completa, sencilla y con ejemplos para catequesis',
    metaDescription: 'x'.repeat(200)
  }, 'qué es la eucaristía para niños');
  assert.ok(largo.seoTitle.length <= 60, 'el seoTitle pasa de 60 caracteres');
  assert.ok(!largo.seoTitle.endsWith(' '), 'el recorte deja un espacio suelto');
  assert.ok(largo.metaDescription.length <= 158);
  assert.ok(largo.avisos.includes('seoTitle recortado'));

  // Un título que no recoge la búsqueda se señala.
  const fuera = daily.normalizarSeo({
    seoTitle: 'Reflexiones sobre el misterio de la fe',
    metaDescription: 'a'.repeat(130)
  }, 'qué es la eucaristía para niños');
  assert.ok(fuera.avisos.some(a => /no recoge la búsqueda/.test(a)));

  // Y uno correcto pasa sin avisos.
  const bien = daily.normalizarSeo({
    seoTitle: 'Qué es la Eucaristía para niños',
    metaDescription: 'Explicamos qué es la Eucaristía para niños con palabras sencillas, ejemplos de catequesis y lo que enseña la Iglesia sobre este sacramento.'
  }, 'qué es la eucaristía para niños');
  assert.deepEqual(bien.avisos, []);
});

test('sin material de Magisterium no se genera ningun articulo', async () => {
  const openaiChat = require('../openai-chat-module');
  await assert.rejects(
    () => openaiChat.generateContentJson({ contentType: 'blog', audience: 'adultos', consulta: 'qué es la eucaristía' }),
    /no se inventa/
  );
});

// ── Retirada del blog generado por plantilla ──
test('la retirada quita solo los articulos de plantilla y se hace una sola vez', () => {
 const fs=require('fs'),os=require('os'),pathMod=require('path');
 const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-purga-'));
 const previo=process.env.DATA_DIR;
 process.env.DATA_DIR=dir;
 fs.writeFileSync(pathMod.join(dir,'blog-catalog.json'), JSON.stringify({ posts: [
   { slug:'plantilla-1', titulo:'Oracion: Guia Completa', fuente:'CatolicosGPT bulk editorial local' },
   { slug:'plantilla-2', titulo:'Oracion: Para Familias', fuente:'CatolicosGPT bulk editorial local' },
   { slug:'escrito-a-mano', titulo:'Artículo del administrador' },
   { slug:'nuevo', titulo:'Los sacramentos', fuenteGeneracion:'magisterium+openai' }
 ], total: 4 }));
 delete require.cache[require.resolve('../blog-purga-bulk')];
 try {
  const purga=require('../blog-purga-bulk');
  assert.equal(purga.purgaHecha(), false);

  const r=purga.purgarBlogBulk();
  assert.equal(r.hecho, true);
  assert.equal(r.retirados, 2);
  assert.equal(r.quedan, 2);

  const catalogo=JSON.parse(fs.readFileSync(pathMod.join(dir,'blog-catalog.json'),'utf-8'));
  const slugs=catalogo.posts.map(p=>p.slug).sort();
  assert.deepEqual(slugs, ['escrito-a-mano','nuevo'], 'lo escrito a mano y lo nuevo se quedan');
  assert.equal(catalogo.total, 2);

  // Una segunda vuelta no vuelve a tocar nada: la marca vive en el disco.
  assert.equal(purga.purgaHecha(), true);
  assert.equal(purga.purgarBlogBulk().hecho, false);
 } finally {
  previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
  delete require.cache[require.resolve('../blog-purga-bulk')];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('la nube no puede devolver los articulos de plantilla', () => {
 const { esContenidoBulk } = require('../blog-purga-bulk');
 assert.equal(esContenidoBulk({ fuente: 'CatolicosGPT bulk editorial local' }), true);
 assert.equal(esContenidoBulk({ fuente: ' CatolicosGPT bulk editorial local ' }), true);
 assert.equal(esContenidoBulk({ fuente: 'otra cosa' }), false);
 assert.equal(esContenidoBulk({}), false);
 assert.equal(esContenidoBulk(null), false);
});

// ── El Rosario de hoy ──
test('los misterios del rosario siguen el orden que fija la Iglesia', () => {
  const rosario = require('../rosario-del-dia');
  // Fechas reales, a mediodía UTC para que Bogotá caiga en el mismo día.
  const esperado = [
    ['2026-09-14', 'lunes',     'Misterios Gozosos'],
    ['2026-09-15', 'martes',    'Misterios Dolorosos'],
    ['2026-09-16', 'miércoles', 'Misterios Gloriosos'],
    ['2026-09-17', 'jueves',    'Misterios Luminosos'],
    ['2026-09-18', 'viernes',   'Misterios Dolorosos'],
    ['2026-09-19', 'sábado',    'Misterios Gozosos'],
    ['2026-09-20', 'domingo',   'Misterios Gloriosos']
  ];
  for (const [fecha, dia, nombre] of esperado) {
    const hoy = rosario.misteriosDeHoy(new Date(`${fecha}T17:00:00Z`));
    assert.equal(hoy.dia.nombre, dia, `${fecha} debería ser ${dia}`);
    assert.equal(hoy.nombre, nombre, `${fecha} (${dia}) debería rezar ${nombre}`);
    assert.equal(hoy.misterios.length, 5, 'un rosario tiene cinco misterios');
  }
});

test('cada misterio trae su cita biblica y su meditacion', () => {
  const { MISTERIOS } = require('../rosario-del-dia');
  const grupos = Object.values(MISTERIOS);
  assert.equal(grupos.length, 4, 'gozosos, luminosos, dolorosos y gloriosos');
  for (const grupo of grupos) {
    assert.equal(grupo.misterios.length, 5);
    for (const m of grupo.misterios) {
      assert.ok(m.titulo && m.titulo.length > 8, `misterio sin título: ${JSON.stringify(m)}`);
      assert.ok(/\d/.test(m.cita), `sin cita bíblica: ${m.titulo}`);
      assert.ok(m.meditacion && m.meditacion.length > 30, `sin meditación: ${m.titulo}`);
    }
  }
});

test('la pagina del rosario trae el rosario entero, no una plantilla', () => {
  const rosario = require('../rosario-del-dia');
  const pagina = rosario.renderHtml(new Date('2026-09-17T17:00:00Z'));

  // Los límites de Google, que es de lo que iba todo esto.
  assert.ok(pagina.seoTitle.length <= 60, 'el seoTitle pasa de 60 caracteres');
  assert.ok(pagina.metaDescription.length <= 158);
  assert.ok(/rosario de hoy/i.test(pagina.seoTitle), 'el título no recoge la búsqueda');
  assert.equal((pagina.html.match(/<h1/g) || []).length, 1, 'debe haber un solo h1');

  // Y el contenido: los cinco misterios del día y las oraciones completas.
  for (const m of rosario.MISTERIOS.luminosos.misterios) {
    assert.ok(pagina.html.includes(m.titulo.replace(/&/g, '&amp;')), `falta el misterio "${m.titulo}"`);
  }
  assert.ok(/Padre nuestro/i.test(pagina.html), 'falta el Padrenuestro');
  assert.ok(/Dios te salve, Mar/i.test(pagina.html), 'falta el Avemaría');
  assert.ok(/HowTo/.test(pagina.html), 'falta el esquema HowTo');
  // Lo que servía antes y no debe volver.
  assert.ok(!/profunda herencia divina/.test(pagina.html), 'sigue saliendo el texto de relleno');
});

// ── Lecturas del día: nunca dar por litúrgico lo que no lo es ──
test('el texto devocional de respaldo va marcado como tal', () => {
  const fs = require('fs');
  const fuente = fs.readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf-8');

  // El respaldo existe y se sirve cuando la descarga falla. Lo que no puede
  // volver a pasar es que se presente como la liturgia del día.
  const i = fuente.indexOf("lecturas: [\n        {\n          titulo: 'Primera Lectura");
  assert.ok(i > 0, 'no se encontró el texto devocional de respaldo');
  const bloque = fuente.slice(Math.max(0, i - 1200), i);
  assert.ok(/esRespaldo:\s*true/.test(bloque), 'el respaldo no se marca con esRespaldo');
  assert.ok(!/fuente:\s*'Subsidio Devocional CatólicosGPT'/.test(bloque),
    'la fuente vuelve a hacerlo pasar por litúrgico');
  assert.ok(/no son las lecturas de hoy/i.test(bloque), 'la fuente no dice la verdad');

  // Y la página que promete las lecturas del día lo descarta.
  assert.ok(/if \(datos && datos\.esRespaldo\) datos = null;/.test(fuente),
    'la página de lecturas ya no descarta el respaldo');
});
