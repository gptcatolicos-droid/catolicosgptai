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

// ── Lecturas de la Misa desde Magisterium ──
test('las lecturas se sacan por los rotulos del leccionario, no por la maquetacion', () => {
  const m = require('../magisterium-lecturas');
  // Dos maquetaciones distintas del mismo contenido: el análisis no puede
  // depender de las etiquetas, porque un rediseño las cambia.
  const conH3 = `<html><body><main>
    <h2>Jueves de la XXIV semana del Tiempo Ordinario</h2>
    <h3>Primera lectura</h3>
    <p>Lectura de la primera carta del apóstol san Pablo a Timoteo 4, 12-16</p>
    <p>Querido hermano: Que nadie te desprecie por ser joven; al contrario, procura ser modelo de los creyentes en la palabra, en la conducta, en el amor, en la fe, en la pureza.</p>
    <h3>Salmo responsorial</h3>
    <p>Sal 110, 7-8. 9. 10</p>
    <p>R. Grandes son las obras del Señor. Las obras de sus manos son justicia y derecho, sus decretos son fidedignos.</p>
    <h3>Evangelio</h3>
    <p>Lectura del santo evangelio según san Lucas 7, 36-50</p>
    <p>En aquel tiempo, un fariseo rogó a Jesús que comiera con él; Jesús entró en casa del fariseo y se recostó a la mesa.</p>
  </main></body></html>`;
  const conDivs = conH3.replace(/<h3>/g, '<div class="x9">').replace(/<\/h3>/g, '</div>')
                       .replace(/<p>/g, '<div>').replace(/<\/p>/g, '</div>');

  for (const [nombre, html] of [['con h3', conH3], ['con divs', conDivs]]) {
    const lecturas = m.partirEnLecturas(m.htmlATexto(html));
    const claves = lecturas.map(l => l.clave);
    assert.ok(claves.includes('primera'), `${nombre}: falta la primera lectura`);
    assert.ok(claves.includes('salmo'), `${nombre}: falta el salmo`);
    assert.ok(claves.includes('evangelio'), `${nombre}: falta el evangelio`);
    const evangelio = lecturas.find(l => l.clave === 'evangelio');
    assert.ok(/fariseo rogó a Jesús/.test(evangelio.texto), `${nombre}: el evangelio no trae su texto`);
    const primera = lecturas.find(l => l.clave === 'primera');
    assert.ok(/Que nadie te desprecie/.test(primera.texto), `${nombre}: la primera lectura no trae su texto`);
    // Y cada sección se corta donde empieza la siguiente.
    assert.ok(!/fariseo/.test(primera.texto), `${nombre}: la primera lectura se comió el evangelio`);
  }
});

test('las lecturas se leen del JSON incrustado cuando lo hay', () => {
  const m = require('../magisterium-lecturas');
  const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { dailyMass: { readings: [
      { title: 'Primera lectura', text: 'Querido hermano: Que nadie te desprecie por ser joven, procura ser modelo de los creyentes.' },
      { title: 'Evangelio', text: 'En aquel tiempo, un fariseo rogó a Jesús que comiera con él y Jesús entró en su casa.' }
    ] } } }
  })}</script></body></html>`;
  const lecturas = m.lecturasDesdeJsonIncrustado(html);
  assert.equal(lecturas.length, 2);
  assert.equal(lecturas[0].titulo, 'Primera lectura');
  assert.ok(/fariseo/.test(lecturas[1].texto));
});

test('si Magisterium no devuelve lecturas no se sirve la de otro dia', async () => {
  const m = require('../magisterium-lecturas');
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-lecturas-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../magisterium-lecturas')];
  try {
    const mod = require('../magisterium-lecturas');
    // Caché de ayer en el disco.
    fs.writeFileSync(pathMod.join(dir, 'lecturas-magisterium.json'), JSON.stringify({
      fecha: '2001-01-01', lecturas: [{ titulo: 'Evangelio', texto: 'lectura de otro día' }]
    }));
    const caido = async () => { throw new Error('sin red'); };
    const resultado = await mod.lecturasDeHoy({ fetcher: caido });
    assert.equal(resultado, null, 'devolvió la lectura de otro día como si fuera la de hoy');
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../magisterium-lecturas')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('si la respuesta no es 200 pero el cuerpo trae las lecturas, se usan', async () => {
  const m = require('../magisterium-lecturas');
  const cuerpo = `<html><body>
    <h3>Primera lectura</h3><p>Querido hermano: que nadie te desprecie por ser joven, procura ser modelo de los creyentes.</p>
    <h3>Evangelio</h3><p>En aquel tiempo, un fariseo rogó a Jesús que comiera con él y Jesús entró en su casa.</p>
  </body></html>`;
  const fetcherLimitado = async () => ({
    ok: false, status: 429,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => cuerpo
  });
  const previo = process.env.MAGISTERIUM_REINTENTO_MS;
  process.env.MAGISTERIUM_REINTENTO_MS = '1';
  try {
    const r = await m.descargar('2026-09-17', fetcherLimitado);
    assert.ok(r, 'se descartó una respuesta que sí traía las lecturas');
    assert.equal(r.lecturas.length, 2);
    assert.ok(/fariseo/.test(r.lecturas[1].texto));
    assert.ok(/429/.test(r.via), 'la vía debe dejar constancia de que vino de un 429');
  } finally {
    previo === undefined ? delete process.env.MAGISTERIUM_REINTENTO_MS : process.env.MAGISTERIUM_REINTENTO_MS = previo;
  }
});

test('si no es 200 y el cuerpo no trae lecturas, no se inventa nada', async () => {
  const m = require('../magisterium-lecturas');
  const fetcherBloqueado = async () => ({
    ok: false, status: 429,
    headers: { get: () => 'text/html' },
    text: async () => '<html><body><h1>Demasiadas peticiones</h1><p>Intenta más tarde.</p></body></html>'
  });
  const previo = process.env.MAGISTERIUM_REINTENTO_MS;
  process.env.MAGISTERIUM_REINTENTO_MS = '1';
  try {
    assert.equal(await m.descargar('2026-09-17', fetcherBloqueado), null);
  } finally {
    previo === undefined ? delete process.env.MAGISTERIUM_REINTENTO_MS : process.env.MAGISTERIUM_REINTENTO_MS = previo;
  }
});

// ── Lecturas de la Misa del día ──
// Los textos de estas pruebas son los que devolvieron de verdad las fuentes el
// 17/09/2026, copiados de los registros de producción. No son inventados.
const TEXTO_EVANGELIZO = `Jueves de la 24a semana del Tiempo Ordinario
Carta I de San Pablo a los Corintios 15,1-11.
Hermanos, les recuerdo la Buena Noticia que yo les he predicado, que ustedes han recibido y a la cual permanecen fieles.
Por ella son salvados, si la conservan tal como yo se la anuncié; de lo contrario, habrán creído en vano.
Les he trasmitido en primer lugar, lo que yo mismo recibí: Cristo murió por nuestros pecados, conforme a la Escritura.
Salmo 118(117),1-2.16ab-17.28.
¡Den gracias al Señor, porque es bueno,
porque es eterno su amor!
Que lo diga el pueblo de Israel:
¡es eterno su amor!
Evangelio según San Lucas 7,36-50.
Un fariseo invitó a Jesús a comer con él. Jesús entró en la casa y se sentó a la mesa.
Entonces una mujer pecadora que vivía en la ciudad se enteró de que Jesús estaba comiendo allí.`;

const TEXTO_USCCB = `Jueves de la XXIV semana del Tiempo ordinario | USCCB
Skip to main content
Menu: Top Buttons
Readings
Primera lectura
1 Corintios 15, 1-11
Hermanos: Les recuerdo el Evangelio que yo les prediqué y que ustedes aceptaron y en el cual están firmes.
Salmo 117, 1-2. 16ab-17. 28
R. Demos gracias al Señor, porque es eterna su misericordia.
Aclamación antes del Evangelio
Aleluya, aleluya. Mis ovejas escuchan mi voz, dice el Señor.
Evangelio
Lucas 7, 36-50
En aquel tiempo, un fariseo le rogó a Jesús que fuera a comer con él.`;

test('evangelizo: las lecturas se separan por la referencia biblica', () => {
  const l = require('../lecturas-diarias');
  const lecturas = l.analizarEvangelizo(TEXTO_EVANGELIZO);
  const papeles = lecturas.map(x => x.papel);
  assert.deepEqual(papeles, ['primera', 'salmo', 'evangelio']);

  const primera = lecturas[0];
  assert.match(primera.titulo, /Corintios 15,1-11/);
  assert.match(primera.texto, /les recuerdo la Buena Noticia/);
  // Cada lectura se corta donde empieza la siguiente.
  assert.ok(!/Den gracias al Señor/.test(primera.texto), 'la primera se comió el salmo');

  assert.match(lecturas[1].titulo, /^Salmo 118/);
  assert.match(lecturas[2].titulo, /Lucas 7,36-50/);
  assert.match(lecturas[2].texto, /fariseo invitó a Jesús/);

  // El encabezado del día no es una lectura.
  assert.ok(!lecturas.some(x => /semana del Tiempo/.test(x.titulo)), 'el título del día se coló como lectura');
});

test('USCCB: las lecturas se separan por los rotulos del leccionario', () => {
  const l = require('../lecturas-diarias');
  const lecturas = l.analizarUSCCB(TEXTO_USCCB);
  const papeles = lecturas.map(x => x.papel);
  assert.deepEqual(papeles, ['primera', 'salmo', 'aleluya', 'evangelio']);
  assert.match(lecturas[0].texto, /1 Corintios 15, 1-11/);
  assert.match(lecturas[0].texto, /Les recuerdo el Evangelio/);
  assert.match(lecturas[3].texto, /fariseo le rogó a Jesús/);
  // Los menús de la página quedan fuera.
  assert.ok(!lecturas.some(x => /Skip to main content/.test(x.texto)), 'se coló el menú de la página');
});

test('si la primera fuente falla se usa la segunda', async () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-lect-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../lecturas-diarias')];
  try {
    const l = require('../lecturas-diarias');
    const fetcher = async (url) => {
      if (url.includes('evangelizo')) return { ok: false, status: 503, text: async () => '' };
      return { ok: true, status: 200, text: async () => TEXTO_USCCB };
    };
    const r = await l.lecturasDeHoy({ fetcher });
    assert.ok(r, 'no se usó la segunda fuente');
    assert.match(r.fuente, /USCCB/);
    assert.equal(r.lecturas.length, 4);
    // Y queda en caché para no volver a pedirlo hoy.
    assert.ok(fs.existsSync(pathMod.join(dir, 'lecturas-del-dia.json')));
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../lecturas-diarias')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('un muro antibots descarta la fuente, no se rodea', async () => {
  const l = require('../lecturas-diarias');
  const fetcher = async () => ({
    ok: true, status: 200,
    text: async () => '<html><body><h1>Vercel Security Checkpoint</h1><p>We are verifying your browser</p></body></html>'
  });
  await assert.rejects(() => l.desdeEvangelizo({ compacta: '20260917' }, fetcher), /muro antibots/);
});

test('si ninguna fuente sirve no se devuelve la lectura de ayer', async () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-lect-ayer-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../lecturas-diarias')];
  try {
    const l = require('../lecturas-diarias');
    fs.writeFileSync(pathMod.join(dir, 'lecturas-del-dia.json'), JSON.stringify({
      fecha: '2001-01-01', lecturas: [{ papel: 'evangelio', titulo: 'x', texto: 'lectura de otro día' }]
    }));
    const caido = async () => { throw new Error('sin red'); };
    assert.equal(await l.lecturasDeHoy({ fetcher: caido }), null);
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../lecturas-diarias')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── La bajada desde la nube no se repite sin motivo ──
test('una coleccion no se vuelve a bajar si la nube no ha cambiado', async () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-conteos-'));
  const previo = { DATA_DIR: process.env.DATA_DIR, SIN_NUBE: process.env.CATOLICOSGPT_SIN_NUBE };
  process.env.DATA_DIR = dir;
  process.env.CATOLICOSGPT_SIN_NUBE = '1';
  fs.writeFileSync(pathMod.join(dir, 'users.json'), JSON.stringify({ users: [] }));
  delete require.cache[require.resolve('../auth-module')];
  try {
    const auth = require('../auth-module');
    // La nube dice 2627 y el disco tiene 4: hay que bajar.
    let consultas = 0;
    const firebase = require('../firebase-module');
    const original = firebase.contarEnLaNube;
    firebase.contarEnLaNube = async () => { consultas++; return 2627; };
    try {
      assert.equal(await auth.debeDescargar('posts', 4), true, 'la primera vez hay que bajar');
      // Tras bajar, en el disco quedan menos porque se descartan los de
      // plantilla. Si solo se comparan los dos números, se bajaría otra vez.
      assert.equal(await auth.debeDescargar('posts', 1627), false, 'no debe repetirse si la nube no cambió');
      // Y si la nube crece, sí se vuelve a bajar.
      firebase.contarEnLaNube = async () => 2700;
      assert.equal(await auth.debeDescargar('posts', 1627), true, 'si la nube cambia hay que bajar');
      assert.ok(consultas >= 2);
    } finally {
      firebase.contarEnLaNube = original;
    }
  } finally {
    for (const [k, v] of Object.entries({ DATA_DIR: previo.DATA_DIR, CATOLICOSGPT_SIN_NUBE: previo.SIN_NUBE })) {
      v === undefined ? delete process.env[k] : process.env[k] = v;
    }
    delete require.cache[require.resolve('../auth-module')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Qué pregunta la gente al chat ──
test('las preguntas se agrupan aunque cambien tildes, signos y mayusculas', () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-consultas-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../consultas-chat')];
  try {
    const c = require('../consultas-chat');
    c.registrar('¿Qué es la Eucaristía para niños?');
    c.registrar('que es la eucaristia para ninos');
    c.registrar('QUE ES LA EUCARISTIA PARA NINOS!!');
    c.registrar('cómo se reza el santo rosario');

    const top = c.top(10);
    assert.equal(top.length, 2, 'deberían quedar dos preguntas distintas');
    assert.equal(top[0].veces, 3, 'las tres formas de la misma pregunta cuentan juntas');
    // Se conserva el texto tal como se escribió la primera vez, que se lee mejor.
    assert.equal(top[0].texto, '¿Qué es la Eucaristía para niños?');
    assert.equal(c.resumen().total, 4);
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../consultas-chat')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no se guardan correos, telefonos ni cifras largas', () => {
  const c = require('../consultas-chat');
  const limpio = c.limpiar('escribeme a juan.perez@gmail.com o al +57 300 123 4567, mi cedula es 1020304050');
  assert.ok(!/gmail\.com|juan\.perez/.test(limpio), `se coló un correo: ${limpio}`);
  assert.ok(!/300 123 4567|3001234567/.test(limpio), `se coló un teléfono: ${limpio}`);
  assert.ok(!/1020304050/.test(limpio), `se coló una cédula: ${limpio}`);
  // Una cita bíblica sí sobrevive: son pocas cifras seguidas.
  assert.match(c.limpiar('que significa Juan 3,16'), /Juan 3,16/);
});

test('los saludos y los dedazos no ensucian el informe', () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-consultas2-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  delete require.cache[require.resolve('../consultas-chat')];
  try {
    const c = require('../consultas-chat');
    assert.equal(c.registrar('hola'), null);
    assert.equal(c.registrar('  '), null);
    assert.equal(c.registrar('asdf'), null);
    assert.ok(c.registrar('que es el purgatorio segun la Iglesia'));
    assert.equal(c.top(10).length, 1);
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../consultas-chat')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Aviso de presupuesto ──
test('avisa al cruzar el 70% y el 90% del mes, y solo una vez cada uno', () => {
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const { createBudget } = require('../agent-budget');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-presupuesto-'));
  const previo = {
    mes: process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD,
    dia: process.env.OPENAI_AGENT_DAILY_BUDGET_USD,
    entrada: process.env.OPENAI_AGENT_INPUT_USD_PER_MILLION,
    salida: process.env.OPENAI_AGENT_OUTPUT_USD_PER_MILLION
  };
  process.env.OPENAI_AGENT_MONTHLY_BUDGET_USD = '1';
  process.env.OPENAI_AGENT_DAILY_BUDGET_USD = '1';

  const avisos = [];
  const warnOriginal = console.warn;
  console.warn = (...a) => { avisos.push(a.join(' ')); };
  try {
    const budget = createBudget(dir);
    // Un cuerpo que reserva algo menos de 0,25 USD por llamada.
    const cuerpo = { model: 'gpt-4.1-mini', max_output_tokens: 150000, texto: 'x' };
    budget.reserve(cuerpo);               // ~24%
    assert.equal(avisos.length, 0, 'no debe avisar tan pronto');
    budget.reserve(cuerpo);               // ~48%
    assert.equal(avisos.length, 0);
    budget.reserve(cuerpo);               // ~72% -> primer aviso
    assert.equal(avisos.length, 1, 'debe avisar al pasar del 70%');
    assert.match(avisos[0], /Presupuesto/);
    assert.match(avisos[0], /tambi[ée]n a quien paga/i);
    budget.reserve(cuerpo);               // ~96% -> segundo aviso
    assert.equal(avisos.length, 2, 'debe avisar al pasar del 90%');
    // Y el resumen cuadra con lo gastado.
    const r = budget.resumenGasto();
    assert.equal(r.topeMes, 1);
    assert.ok(r.gastadoMes > 0.9 && r.gastadoMes <= 1, `gastado raro: ${r.gastadoMes}`);
    assert.equal(r.llamadasMes, 4);
  } finally {
    console.warn = warnOriginal;
    for (const [k, v] of Object.entries({
      OPENAI_AGENT_MONTHLY_BUDGET_USD: previo.mes,
      OPENAI_AGENT_DAILY_BUDGET_USD: previo.dia,
      OPENAI_AGENT_INPUT_USD_PER_MILLION: previo.entrada,
      OPENAI_AGENT_OUTPUT_USD_PER_MILLION: previo.salida
    })) { v === undefined ? delete process.env[k] : process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Consolidación SEO ──
test('el titulo se acorta sin perder la busqueda por la que compite', () => {
  const { acortarTitulo } = require('../seo-consolidacion');

  // Lo que ya cabe no se toca.
  assert.equal(acortarTitulo('La Eucaristía para Niños: Guía Práctica'), 'La Eucaristía para Niños: Guía Práctica');

  // Lo largo se corta por palabra, nunca a mitad.
  const largo = acortarTitulo('¿Qué es la Biblia? Guía Práctica para Niños sobre la Palabra de Dios');
  assert.ok(largo.length <= 60, `se pasa de 60: ${largo.length}`);
  assert.ok(!/\s$/.test(largo));
  assert.match(largo, /para Niños/i, 'perdió la audiencia, que es la búsqueda');

  // Aunque la audiencia esté al final del título original, sobrevive.
  const conAudienciaAlFinal = acortarTitulo('Mi Primer Encuentro con Jesús: Guía de Catequesis sobre el Bautismo para Niños');
  assert.ok(conAudienciaAlFinal.length <= 60);
  assert.match(conAudienciaAlFinal, /para Niños/i);

  // Y no termina en una palabra que deja la frase colgando.
  for (const t of [
    'Los Sacramentos Explicados para Niños: Una Aventura con Jesús y su Iglesia',
    '¿Qué es el Magisterio de la Iglesia y por qué es fundamental para los católicos?',
    'Dogmas Católicos: Qué Son, Cuántos Hay y Por Qué Son Importantes'
  ]) {
    const r = acortarTitulo(t);
    assert.ok(r.length <= 60, `${r} (${r.length})`);
    assert.ok(!/\s+(y|o|de|del|la|el|los|las|en|con|por|para|sobre|que)$/i.test(r), `queda colgando: "${r}"`);
  }
});

test('ninguna redireccion encadena con otra ni apunta a si misma', () => {
  const { redirecciones } = require('../seo-consolidacion');
  const mapa = redirecciones();
  assert.ok(Object.keys(mapa).length > 100, 'el mapa de redirecciones no se cargó');
  for (const [origen, destino] of Object.entries(mapa)) {
    assert.notEqual(origen, destino, `se redirige a sí misma: ${origen}`);
    assert.ok(!mapa[destino], `cadena: ${origen} -> ${destino} -> ${mapa[destino]}`);
  }
});

test('las cadenas se aplanan aunque el fichero las traiga', () => {
  // Se comprueba sobre el comportamiento, no sobre el fichero: si mañana
  // alguien edita el JSON a mano y encadena dos, el código lo resuelve igual.
  const fs = require('fs'), os = require('os'), pathMod = require('path');
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'cgpt-redir-'));
  const previo = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  fs.writeFileSync(pathMod.join(dir, 'seo-redirecciones.json'), JSON.stringify({
    '/a': '/b', '/b': '/c', '/c': '/destino-final', '/solo': '/destino-final'
  }));
  delete require.cache[require.resolve('../seo-consolidacion')];
  try {
    const { redirecciones } = require('../seo-consolidacion');
    const m = redirecciones();
    assert.equal(m['/a'], '/destino-final', 'la cadena de tres saltos no se aplanó');
    assert.equal(m['/b'], '/destino-final');
    assert.equal(m['/solo'], '/destino-final');
  } finally {
    previo === undefined ? delete process.env.DATA_DIR : process.env.DATA_DIR = previo;
    delete require.cache[require.resolve('../seo-consolidacion')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Quién consume la cuota ──
test('cada visitante sin cuenta tiene su propia cuota, no la comparte por IP', () => {
  const express = require('express');
  const rutas = require('../agent-routes');
  // Se captura la clave que el módulo calcula, montándolo sobre un app de
  // mentira que solo guarda los manejadores.
  const manejadores = {};
  const appFalso = {
    get: (ruta, ...fns) => { manejadores[`GET ${ruta}`] = fns[fns.length - 1]; },
    post: () => {}, use: () => {}
  };
  const previo = process.env.CATHOLIC_AGENT_ENABLED;
  delete process.env.CATHOLIC_AGENT_ENABLED;
  try {
    rutas.register(appFalso, { getUser: () => null, isSuperAdmin: () => false });
    const cuota = manejadores['GET /api/agent/cuota'];
    assert.ok(cuota, 'no se registró la ruta de cuota');

    const llamar = (cookie) => {
      let cuerpo = null, cabeceras = {};
      const req = { headers: cookie ? { cookie } : {}, ip: '1.2.3.4', query: {} };
      const res = {
        headersSent: false,
        setHeader: (k, v) => { cabeceras[k] = v; },
        set: () => res,
        json: (x) => { cuerpo = x; return res; }
      };
      cuota(req, res);
      return { cuerpo, cabeceras };
    };

    // Dos visitantes distintos desde la MISMA IP: el segundo no hereda el gasto
    // del primero, que es lo que pasaba con miles de móviles tras el CGNAT del
    // operador.
    const primero = llamar(null);
    assert.match(primero.cabeceras['Set-Cookie'] || '', /^cgpt_visitante=[a-f0-9]{32};/,
      'no se entrega identificador propio al visitante');
    assert.match(primero.cabeceras['Set-Cookie'], /HttpOnly/);
    const segundo = llamar(null);
    assert.notEqual(primero.cabeceras['Set-Cookie'], segundo.cabeceras['Set-Cookie'],
      'dos visitantes distintos recibieron el mismo identificador');

    // Y quien vuelve con su cookie conserva la suya: no se le da una nueva.
    const id = primero.cabeceras['Set-Cookie'].slice('cgpt_visitante='.length, 'cgpt_visitante='.length + 32);
    const vuelve = llamar(`cgpt_visitante=${id}`);
    assert.equal(vuelve.cabeceras['Set-Cookie'], undefined, 'se le cambió el identificador al volver');

    // El límite que se anuncia es el de visitante.
    assert.equal(primero.cuerpo.limite, 5);
  } finally {
    previo === undefined ? delete process.env.CATHOLIC_AGENT_ENABLED : process.env.CATHOLIC_AGENT_ENABLED = previo;
  }
});

// Los 300 artículos sembrados dentro del blog no traían el campo `fuente`, así
// que la retirada -que miraba ese campo- no los veía. Comparten un único cuerpo
// palabra por palabra: eso es lo que hay que reconocer, porque una etiqueta se
// puede olvidar y el texto no.
test('el contenido de plantilla se reconoce por su texto aunque no venga etiquetado', () => {
  const { detectarPlantilla } = require('../blog-contenido-plantilla');
  const cuerpoComun = [
    'Este profundo y fecundo estudio doctrinal nos adentra en la verdad sagrada de nuestra fe. El Catecismo de la Iglesia Catolica y la herencia milenaria del Magisterio nos ofrecen la guia segura para comprender el designio del Creador.',
    'Como indica la rica tradicion apostolica, la Iglesia custodia y proclama con fidelidad el deposito divino. El rezo constante y el estudio guiado de los dogmas de fe configuran nuestra razon para marchar en santidad cristiana.'
  ].join('\n\n');
  // Ocho artículos con el mismo cuerpo y sólo el título distinto: es justo la
  // forma del lote que se coló.
  const plantillas = ['trinidad','eucaristia','bautismo','rosario','penitencia','maria','angeles','purgatorio']
    .map(t => ({ slug: 'tema-' + t, titulo: 'La verdad sobre ' + t, contenidoMd: '# La verdad sobre ' + t + '\n\n' + cuerpoComun }));

  const real = {
    slug: 'que-es-la-eucaristia-para-ninos',
    titulo: 'Qué es la Eucaristía para niños',
    contenidoMd: '# Qué es la Eucaristía para niños\n\nCuando un niño pregunta qué es la Eucaristía, la respuesta más honesta es también la más sencilla: es Jesús mismo, que se queda con nosotros bajo la apariencia del pan y del vino, y no un recuerdo de algo que ocurrió hace mucho tiempo.\n\nA los cinco o seis años funciona la comparación del regalo, porque un regalo se entrega y no se explica. Más adelante ya se puede hablar de la diferencia entre lo que los ojos ven y lo que la fe sabe, sin adelantarse a preguntas que el niño todavía no ha hecho.'
  };

  const marcados = detectarPlantilla([...plantillas, real]);
  assert.equal(marcados.size, plantillas.length, 'los ocho de plantilla se reconocen sin campo fuente');
  assert.ok(!marcados.has(real.slug), 'un artículo escrito de verdad no se toca');
});

// El error caro es el falso positivo: dos artículos del mismo tema se parecen,
// pero no comparten párrafos enteros carácter a carácter.
test('dos articulos del mismo tema no se confunden con contenido de plantilla', () => {
  const { detectarPlantilla } = require('../blog-contenido-plantilla');
  const posts = [
    { slug:'rosario-como-rezarlo', titulo:'Cómo rezar el rosario', contenidoMd:'# Cómo rezar el rosario\n\nSe empieza por la señal de la cruz y el Credo, se rezan tres avemarías por las virtudes teologales y se entra en el primer misterio. Cada decena lleva un padrenuestro, diez avemarías y un gloria, y conviene anunciar el misterio en voz alta antes de empezarla.' },
    { slug:'rosario-misterios-luminosos', titulo:'Los misterios luminosos', contenidoMd:'# Los misterios luminosos\n\nJuan Pablo II los propuso en 2002 para cubrir la vida pública de Jesús, que hasta entonces quedaba fuera del rezo. Son el bautismo en el Jordán, las bodas de Caná, el anuncio del Reino, la transfiguración y la institución de la Eucaristía.' },
    { slug:'rosario-en-familia', titulo:'Rezar el rosario en familia', contenidoMd:'# Rezar el rosario en familia\n\nCon niños pequeños una decena entera ya es mucho, y forzarla suele conseguir lo contrario de lo que se busca. Vale más un misterio corto, comentado en dos frases, a la misma hora cada día, que un rosario completo que nadie quiere repetir mañana.' }
  ];
  assert.equal(detectarPlantilla(posts).size, 0);
});

// El catálogo se rellenaba solo cuando bajaba de mil artículos, que es siempre:
// por eso cada arranque deshacía la limpieza. Un catálogo corto se queda corto.
test('un catalogo con pocos articulos no se rellena con contenido de plantilla', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-blog-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  fs.writeFileSync(pathMod.join(dir,'blog-catalog.json'), JSON.stringify({ version:'5.0', total:1, posts:[
    { slug:'unico', titulo:'El único artículo de verdad', contenidoMd:'# El único artículo de verdad\n\nTexto escrito por una persona.', publicado:true }
  ]}));
  delete require.cache[require.resolve('../blog-module')];
  try {
    const blog=require('../blog-module');
    const posts=blog.loadBlog().posts;
    assert.equal(posts.length, 1, 'sigue habiendo un solo artículo, no mil');
    assert.equal(posts[0].slug, 'unico');
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../blog-module')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

// Lo que más caro sale es equivocarse al revés: retirar un artículo bueno. Un
// artículo con fuentes citadas pasó por Magisterium, y eso el contenido de
// plantilla no lo puede fingir.
test('un articulo con fuentes citadas nunca se retira como plantilla', () => {
  const { detectarPlantilla } = require('../blog-contenido-plantilla');
  const cuerpo = 'Un párrafo largo que se repite en todos ellos porque sale del mismo molde y no lo escribió nadie pensando en el tema concreto de cada página.\n\nY un segundo párrafo igual de repetido, con la misma extensión y el mismo tono general de relleno doctrinal para todos los casos.';
  const posts = ['a','b','c','d','e','f'].map(x => ({ slug:'clon-'+x, titulo:'Tema '+x, contenidoMd:'# Tema '+x+'\n\n'+cuerpo }));
  // El séptimo tiene el mismo cuerpo, pero trae fuentes: no se toca.
  posts.push({ slug:'con-fuentes', titulo:'Tema con fuentes', contenidoMd:'# Tema con fuentes\n\n'+cuerpo,
    fuentes:[{ titulo:'Catecismo de la Iglesia Católica', referencia:'1324' }] });

  const marcados = detectarPlantilla(posts);
  assert.equal(marcados.size, 6);
  assert.ok(!marcados.has('con-fuentes'));
});

// Las redirecciones corren por delante de todas las rutas. Si a una URL retirada
// le sale dueño -el generador diario saca sus slugs de lo que la gente busca, y
// ahí las coincidencias pasan-, la redirección la escondería para siempre sin
// avisar de nada.
test('una redireccion cede el paso si ese slug vuelve a tener articulo', async () => {
  const express=require('express');
  const seo=require('../seo-consolidacion');
  const http=require('http');

  const pedir=(servidor,ruta)=>new Promise(resolve=>{
    const {port}=servidor.address();
    http.get({port,path:ruta},r=>{r.resume();resolve({codigo:r.statusCode,destino:r.headers.location});});
  });

  // Se le pasa un catálogo de mentira: aquí sólo se comprueba quién manda.
  const vivos=new Set();
  const app=express();
  seo.register(app,(ruta)=>vivos.has(ruta));
  app.get('/blog/:slug',(req,res)=>res.send('artículo'));
  app.get('/blog/:categoria/:slug',(req,res)=>res.send('artículo'));
  const servidor=http.createServer(app);
  await new Promise(r=>servidor.listen(0,r));

  try {
    const retirada=Object.keys(seo.redirecciones())[0];
    assert.ok(retirada,'hace falta al menos una redirección para la prueba');

    const sinDueno=await pedir(servidor,retirada);
    assert.equal(sinDueno.codigo,301,'sin artículo, redirige como siempre');

    vivos.add(retirada);
    const conDueno=await pedir(servidor,retirada);
    assert.equal(conDueno.codigo,200,'con artículo publicado, gana el artículo');
  } finally {
    await new Promise(r=>servidor.close(r));
  }
});

// Firestore hacía de segunda copia. Al apagarlo, el disco se queda solo, así que
// el respaldo deja de ser una comodidad y pasa a ser lo único que hay.
test('el respaldo recoge las cuentas y dice lo que no incluye', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-respaldo-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  fs.writeFileSync(pathMod.join(dir,'users.json'), JSON.stringify({ users:[{id:'1',email:'a@b.c',plan:'premium'}] }));
  fs.writeFileSync(pathMod.join(dir,'blog-catalog.json'), JSON.stringify({ posts:[{slug:'x'},{slug:'y'}] }));
  fs.mkdirSync(pathMod.join(dir,'subidas'));
  fs.writeFileSync(pathMod.join(dir,'subidas','foto.png'),'binario');
  delete require.cache[require.resolve('../respaldo-module')];
  try {
    const respaldo=require('../respaldo-module');
    const copia=respaldo.construir();
    assert.equal(copia.resumen['users.json'], 1, 'las cuentas entran, que es lo irreemplazable');
    assert.equal(copia.resumen['blog-catalog.json'], 2);
    assert.equal(copia.secciones['users.json'].users[0].email, 'a@b.c');
    // Las imágenes no caben en la descarga; lo que no se puede omitir es decirlo.
    assert.equal(copia.noIncluido.imagenesSubidas, 1);
    assert.ok(!copia.secciones['subidas']);
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../respaldo-module')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

// Una copia vacía que pisa a la de ayer es peor que no tener copia: parece buena
// hasta el día que hace falta.
test('una copia vacia no sobrescribe a la del dia anterior', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-respaldo2-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  delete require.cache[require.resolve('../respaldo-module')];
  try {
    const respaldo=require('../respaldo-module');
    const vacio=respaldo.guardarEnDisco();
    assert.equal(vacio.hecho, false, 'sin datos no se escribe nada');
    assert.equal(respaldo.listar().length, 0);

    fs.writeFileSync(pathMod.join(dir,'users.json'), JSON.stringify({ users:[{id:'1'}] }));
    const lleno=respaldo.guardarEnDisco();
    assert.equal(lleno.hecho, true);
    assert.equal(lleno.registros, 1);
    assert.equal(respaldo.listar().length, 1);
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../respaldo-module')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

// Antes de arreglar el SEO del catálogo hay que poder verlo: vive en el disco
// del servidor y desde fuera no se sabe en qué estado está.
test('la salud SEO distingue un articulo bueno de uno de relleno', () => {
  const seo = require('../seo-salud');
  const cuerpoLargo = 'palabra '.repeat(400);
  const posts = [
    {
      slug: 'bueno', titulo: 'Qué es la Eucaristía para niños', publicado: true,
      descripcion: 'Explicación sencilla de la Eucaristía para niños de catequesis, con ejemplos por edades y qué responder a las preguntas que hacen.',
      contenidoMd: '# Qué es la Eucaristía\n\n' + cuerpoLargo + '\n\nVer también [los sacramentos](/blog/los-sacramentos).',
      faqs: [{ q: '¿A qué edad?', a: 'Hacia los nueve años.' }]
    },
    {
      slug: 'relleno', titulo: 'La Trinidad', publicado: true,
      descripcion: 'Corta.',
      contenidoMd: '# La Trinidad\n\nDos frases y ya está.'
    }
  ];

  const a = seo.analizar(posts);
  assert.equal(a.total, 2);

  const bueno = a.fichas.find(f => f.slug === 'bueno');
  assert.deepEqual(bueno.problemas, [], 'un artículo completo no tiene nada que reprochar');
  assert.ok(bueno.palabras > 300);
  assert.equal(bueno.enlaces, 1);

  const relleno = a.fichas.find(f => f.slug === 'relleno');
  assert.ok(relleno.problemas.includes('descripcion-corta'));
  assert.ok(relleno.problemas.includes('contenido-fino'));
  assert.ok(relleno.problemas.includes('cuerpo-sin-enlaces'));
  assert.ok(relleno.problemas.includes('sin-preguntas'));
});

// Una descripción de molde es "única" solo porque le cambia el título dentro.
// Si no se quita el título, 300 descripciones idénticas parecen 300 distintas.
test('una descripcion de molde se reconoce aunque lleve el titulo dentro', () => {
  const seo = require('../seo-salud');
  const temas = ['la Trinidad','la Eucaristía','el Bautismo','el Rosario','la Penitencia','María'];
  const posts = temas.map((t, i) => ({
    slug: 'tema-' + i, titulo: t, publicado: true,
    descripcion: `Explicación completa, doctrinal y teológica exhaustiva sobre: ${t}. Analizado rigurosamente según el magisterio apostólico y las sagradas escrituras.`,
    contenidoMd: '# ' + t + '\n\n' + 'palabra '.repeat(400)
  }));
  // Uno escrito a mano, con la misma longitud pero contenido propio.
  posts.push({
    slug: 'a-mano', titulo: 'El Adviento', publicado: true,
    descripcion: 'Las cuatro semanas antes de Navidad tienen su propio color, sus propias lecturas y una forma concreta de vivirse en casa con niños pequeños.',
    contenidoMd: '# El Adviento\n\n' + 'palabra '.repeat(400)
  });

  const a = seo.analizar(posts);
  const genericas = a.fichas.filter(f => f.problemas.includes('descripcion-generica')).map(f => f.slug);
  assert.equal(genericas.length, temas.length, 'las seis de molde se reconocen');
  assert.ok(!genericas.includes('a-mano'), 'la escrita a mano no se toca');
});

// 1364 de 1372 artículos no enlazaban a ninguna otra página del sitio. El
// bloque se calcula al servir, así que arregla los que ya están y los que se
// publiquen mañana, sin editar ninguno.
test('el bloque de sigue leyendo nunca enlaza el articulo consigo mismo', () => {
  const sigue = require('../seo-sigue-leyendo');
  assert.equal(sigue.esElMismo('/blog/la-eucaristia', 'la-eucaristia'), true);
  assert.equal(sigue.esElMismo('/blog/catequesis/la-eucaristia', 'la-eucaristia'), true);
  assert.equal(sigue.esElMismo('/blog/el-bautismo', 'la-eucaristia'), false);
  assert.equal(sigue.esElMismo('', 'la-eucaristia'), false);
});

// El tema sale de más sitios que el título: hay artículos con título genérico
// cuyo asunto solo se adivina por sus palabras clave.
test('la consulta de parecido usa titulo, keywords y categoria', () => {
  const sigue = require('../seo-sigue-leyendo');
  const q = sigue.consultaDe({
    titulo: 'Guía completa', keywords: 'eucaristía, comunión',
    categoria: 'sacramentos', consultaObjetivo: 'qué es la eucaristía'
  });
  assert.ok(/eucarist/i.test(q));
  assert.ok(/sacramentos/i.test(q));
});

// Un bloque de enlaces no puede tumbar un artículo: si el índice falla, la
// página se sirve igual y solo se pierden los enlaces.
test('si el indice de parecidos falla, el articulo se sirve sin bloque', () => {
  const sigue = require('../seo-sigue-leyendo');
  // Un post sin slug no puede buscar parecidos; devuelve vacío en vez de romper.
  assert.equal(sigue.render({ titulo: 'Sin slug' }), '');
  assert.deepEqual(sigue.enlaces(null), { articulos: [], infografias: [] });
});

// Medir el título guardado daba 949 problemas que Google no ve, porque la
// página ya lo recorta antes de emitirlo.
test('la salud SEO mide el titulo que se emite, no el que se guarda', () => {
  const seo = require('../seo-salud');
  const largo = 'La Santísima Trinidad explicada con detalle para catequistas y familias que preparan la confirmación';
  const a = seo.analizar([{
    slug: 'x', titulo: largo, publicado: true,
    descripcion: 'Una descripción suficientemente larga y concreta para no disparar ninguno de los otros avisos del diagnóstico.',
    contenidoMd: '# ' + largo + '\n\n' + 'palabra '.repeat(400) + '\n\n[Ver más](/blog/otro)',
    faqs: [{ q: 'a', a: 'b' }]
  }]);
  assert.ok(!a.fichas[0].problemas.includes('titulo-largo'),
    'el título se recorta al servir, así que no es un problema que arreglar a mano');
  assert.ok(a.fichas[0].largoTitulo <= 60);
});

// El índice de parecidos descarta lo que no supera su umbral -y hace bien-, pero
// eso dejaba artículos con un enlace o con ninguno, que es el problema que se
// estaba arreglando. La categoría los completa.
test('la categoria completa los enlaces cuando el parecido no da para mas', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-enlaces-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  const posts=[];
  for (let i=0;i<8;i++) posts.push({
    slug:'vecino-'+i, titulo:'Vecino '+i, categoria:'liturgia', publicado:true,
    descripcion:'Uno de la misma sección.', fechaCreacion:new Date(2026,0,i+1).toISOString()
  });
  posts.push({ slug:'de-otra', titulo:'De otra sección', categoria:'moral', publicado:true, fechaCreacion:new Date().toISOString() });
  fs.writeFileSync(pathMod.join(dir,'blog-catalog.json'), JSON.stringify({ posts }));
  delete require.cache[require.resolve('../seo-sigue-leyendo')];
  try {
    const sigue=require('../seo-sigue-leyendo');
    const post={ slug:'vecino-0', titulo:'Vecino 0', categoria:'liturgia' };
    const v=sigue.vecinosDeCategoria(post, [], 3);
    assert.equal(v.length, 3, 'rellena hasta lo que se le pide');
    assert.ok(!v.some(x=>x.slug==='vecino-0'), 'nunca se enlaza a sí mismo');
    assert.ok(!v.some(x=>x.slug==='de-otra'), 'no se cuela nadie de otra sección');

    // Lo que ya puso el índice de parecidos no se repite.
    const conPuestos=sigue.vecinosDeCategoria(post, [{url:'/blog/vecino-1'}], 3);
    assert.ok(!conPuestos.some(x=>x.slug==='vecino-1'), 'no duplica un enlace ya puesto');

    // Si no se pide nada, no se lee nada.
    assert.deepEqual(sigue.vecinosDeCategoria(post, [], 0), []);
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../seo-sigue-leyendo')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

// Medio dia de 404 por un fallo silencioso: esto leia el PRIMER fichero de
// redirecciones que encontrara y paraba. El del disco persistente se siembra una
// vez y no se vuelve a tocar, asi que 600 redirecciones nuevas en el repositorio
// no existian -y el registro decia "211 activas", que parecia correcto.
test('las redirecciones del disco y las del repositorio se suman, no se pisan', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-redir-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  // El disco trae una vieja que el repositorio ya no tiene.
  fs.writeFileSync(pathMod.join(dir,'seo-redirecciones.json'), JSON.stringify({
    '/blog/solo-en-el-disco': '/blog'
  }));
  delete require.cache[require.resolve('../seo-consolidacion')];
  try {
    const seo=require('../seo-consolidacion');
    const m=seo.redirecciones();
    assert.ok(m['/blog/solo-en-el-disco'], 'no se pierde lo que solo esta en el disco');
    // Y siguen estando las del repositorio, que son la mayoria.
    assert.ok(Object.keys(m).length > 500, `se esperaban las del repositorio, hay ${Object.keys(m).length}`);
    // Sin cadenas ni bucles despues de juntarlas.
    const claves=Object.keys(m);
    assert.equal(claves.filter(k=>m[k] in m).length, 0, 'sin cadenas');
    assert.equal(claves.filter(k=>m[k]===k).length, 0, 'sin bucles');
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../seo-consolidacion')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

// Cada artículo se servía en dos URLs -/blog/slug y /blog/categoria/slug- y cada
// una se declaraba canónica de sí misma. Para Google eran dos páginas iguales
// compitiendo, en los 1372.
test('las dos rutas de un articulo apuntan a la misma URL canonica', () => {
  const art = require('../seo-articulo');
  const post = { slug: 'la-eucaristia', titulo: 'La Eucaristía', categoria: 'sacramentos' };
  assert.equal(art.urlCanonicaDeArticulo(post), '/blog/sacramentos/la-eucaristia');
  // Un artículo sin categoría no puede quedarse sin canónica.
  assert.equal(art.urlCanonicaDeArticulo({ slug: 'suelto', titulo: 'Suelto' }), '/blog/doctrina/suelto');
});

// El marcado vivía dentro de una sola de las dos rutas, así que según por qué
// URL se entrara el artículo salía sin fecha, sin autor y sin migas de pan.
test('el marcado del articulo es el mismo se entre por donde se entre', () => {
  const art = require('../seo-articulo');
  const post = {
    slug: 'la-eucaristia', titulo: 'La Eucaristía', categoria: 'sacramentos',
    descripcion: 'Qué es la Eucaristía.', fechaCreacion: '2026-01-01T00:00:00Z',
    faqs: [{ q: '¿Qué es?', a: 'El cuerpo de Cristo.' }]
  };
  const tipos = art.esquemasDeArticulo(post).map(e => e['@type']);
  assert.deepEqual(tipos, ['Article', 'BreadcrumbList', 'FAQPage']);

  // Sin preguntas no se inventa un FAQPage vacío.
  const sinFaqs = art.esquemasDeArticulo({ ...post, faqs: [] }).map(e => e['@type']);
  assert.deepEqual(sinFaqs, ['Article', 'BreadcrumbList']);
});

// El marcado decía ai.catolicosgpt.com mientras la etiqueta canónica decía
// www.catolicosgpt.com: dos hosts distintos para la misma página.
test('el marcado y la canonica hablan del mismo host', () => {
  const art = require('../seo-articulo');
  const previo = process.env.PUBLIC_SITE_URL;
  process.env.PUBLIC_SITE_URL = 'https://www.catolicosgpt.com';
  try {
    const post = { slug: 'x', titulo: 'X', categoria: 'doctrina', fechaCreacion: '2026-01-01T00:00:00Z' };
    const [articulo, migas] = art.esquemasDeArticulo(post);
    const esperada = 'https://www.catolicosgpt.com/blog/doctrina/x';
    assert.equal(articulo.mainEntityOfPage['@id'], esperada);
    assert.equal(migas.itemListElement[3].item, esperada);
    // Nada puede quedar apuntando al host viejo escrito a mano.
    assert.ok(!JSON.stringify(art.esquemasDeArticulo(post)).includes('ai.catolicosgpt.com'));
  } finally {
    previo === undefined ? delete process.env.PUBLIC_SITE_URL : process.env.PUBLIC_SITE_URL = previo;
  }
});

// La consolidacion anterior se hizo sin datos de trafico y eligio ganadores a
// ojo: habia redirecciones mandando una pagina de 104 sesiones a otra de 60.
// Estas son las reglas que no se pueden romper, se elija como se elija.
test('ninguna pagina que recibe redirecciones esta ella misma redirigida', () => {
  const { redirecciones } = require('../seo-consolidacion');
  const mapa = redirecciones();
  const destinos = new Set(Object.values(mapa));
  const rotos = [...destinos].filter(d => mapa[d]);
  assert.deepEqual(rotos, [], 'un destino redirigido manda el trafico a una pagina retirada');
});

test('las redirecciones no forman cadenas ni bucles', () => {
  const { redirecciones } = require('../seo-consolidacion');
  const mapa = redirecciones();
  const claves = Object.keys(mapa);
  assert.equal(claves.filter(k => mapa[k] === k).length, 0, 'sin bucles');
  assert.equal(claves.filter(k => mapa[k] in mapa).length, 0, 'sin cadenas: cada salto pierde fuerza');
  // Y ningún destino puede quedar vacío o relativo a otra cosa.
  assert.ok(Object.values(mapa).every(d => typeof d === 'string' && d.startsWith('/')));
});

// La copia del disco se siembra una vez y conserva decisiones viejas. Si ahí
// dice X->Y y en el repositorio se ha corregido a Y->X, la unión tiene las dos,
// forman un bucle y aplanar las descarta ENTERAS: la corrección no se aplica y
// encima se pierde la redirección. Pasó con tres páginas reales.
test('una correccion en el repositorio gana a la direccion vieja del disco', () => {
  const fs=require('fs'),os=require('os'),pathMod=require('path');
  const dir=fs.mkdtempSync(pathMod.join(os.tmpdir(),'cgpt-dir-'));
  const previo=process.env.DATA_DIR;
  process.env.DATA_DIR=dir;
  // El disco cree que la débil se queda y la fuerte se retira.
  fs.writeFileSync(pathMod.join(dir,'seo-redirecciones.json'), JSON.stringify({
    '/blog/catequesis-ninos/conociendo-a-la-virgen-maria-guia-para-ninos-catolicos':
      '/blog/catequesis-ninos/la-virgen-maria-guia-practica-para-ninos-catolicos'
  }));
  delete require.cache[require.resolve('../seo-consolidacion')];
  try {
    const seo=require('../seo-consolidacion');
    const m=seo.redirecciones();
    const fuerte='/blog/catequesis-ninos/conociendo-a-la-virgen-maria-guia-para-ninos-catolicos';
    const debil='/blog/catequesis-ninos/la-virgen-maria-guia-practica-para-ninos-catolicos';
    assert.ok(!m[fuerte], 'la que el repositorio eligió como destino no puede redirigirse');
    assert.equal(m[debil], fuerte, 'y la otra apunta a ella, no al revés');
  } finally {
    previo===undefined?delete process.env.DATA_DIR:process.env.DATA_DIR=previo;
    delete require.cache[require.resolve('../seo-consolidacion')];
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
