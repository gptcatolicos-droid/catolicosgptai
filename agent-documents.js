'use strict';
const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel}=require('docx');
const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
function plain(s){return String(s||'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/<[^>]*>/g,'');}
function blocks(text){
 const lines=String(text).split('\n');const out=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line)continue;
  if(line.startsWith('|')){const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|')){const row=lines[i].trim().replace(/^\||\|$/g,'').split('|').slice(0,8).map(x=>plain(x.trim()));if(!row.every(x=>/^:?-+:?$/.test(x)))rows.push(row);i++;}i--;if(rows.length)out.push({type:'table',rows});}
  else out.push({type:/^#{1,3} /.test(line)?'heading':'text',text:plain(line.replace(/^#{1,6} /,''))});
 }
 return out;
}
function material(input){
 const text=typeof input.text==='string'?input.text:'';
 if(!text.trim()||text.length>40000)throw new Error('invalid_document');
 const sources=(Array.isArray(input.sources)?input.sources:[]).slice(0,60);
 return blocks(text).concat(sources.length?[{type:'heading',text:'Fuentes consultadas'},...sources.map(s=>({type:'text',text:plain(`[${String(s.id||'').slice(0,10)}] ${String(s.title||'Documento').slice(0,300)}. ${String(s.author||'').slice(0,200)}. ${String(s.reference||'').slice(0,160)} ${String(s.url||'').slice(0,1000)}`)}))]:[]);
}
async function word(input){
 const children=[new Paragraph({text:'CatólicosGPT · Formación católica',heading:HeadingLevel.TITLE})];
 for(const b of material(input)){
  if(b.type==='table'){
   const cols=Math.max(...b.rows.map(r=>r.length));
   children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:b.rows.map((r,i)=>new TableRow({tableHeader:i===0,children:Array.from({length:cols},(_,j)=>new TableCell({shading:i===0?{fill:'173C78'}:undefined,children:[new Paragraph({children:[new TextRun({text:r[j]||'',bold:i===0,color:i===0?'FFFFFF':'222222',size:20})]})]}))}))}));
  }else children.push(new Paragraph({text:b.text,heading:b.type==='heading'?HeadingLevel.HEADING_1:undefined,spacing:{after:160}}));
 }
 return Packer.toBuffer(new Document({creator:'CatólicosGPT',styles:{default:{document:{run:{font:'Calibri',size:22}}}},sections:[{children}]}));
}
async function pdf(input){
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page,y;const width=499;const blue=rgb(.043,.169,.404);const gray=rgb(.15,.18,.22);
 const newPage=()=>{page=doc.addPage([595,842]);y=790;};newPage();
 const encode=s=>Array.from(s).map(c=>{try{font.encodeText(c);return c;}catch{return c==='→'?' > ':' ';}}).join('');
 function wrap(text,size,maxWidth,f=font){const lines=[];let line='';for(const word of encode(text).split(/\s+/)){if(f.widthOfTextAtSize((line+' '+word).trim(),size)>maxWidth&&line){lines.push(line);line='';}if(f.widthOfTextAtSize(word,size)>maxWidth){for(const ch of word){if(f.widthOfTextAtSize(line+ch,size)>maxWidth){lines.push(line);line='';}line+=ch;}}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines.length?lines:[''];}
 function textLine(text,size=11,f=font,color=gray){for(const line of wrap(text,size,width,f)){if(y<60)newPage();page.drawText(line,{x:48,y,size,font:f,color});y-=size*1.5;}y-=7;}
 textLine('CatólicosGPT',22,bold,blue);textLine('Formación católica · Material de estudio',10);y-=12;
 for(const b of material(input)){
  if(b.type==='table'){
   const cols=Math.max(...b.rows.map(r=>r.length));const cw=width/cols;
   for(let i=0;i<b.rows.length;i++){
    const f=i===0?bold:font;const lines=Array.from({length:cols},(_,j)=>wrap(b.rows[i][j]||'',9,cw-14,f));const count=Math.max(...lines.map(a=>a.length));
    for(let offset=0;offset<count;){
     if(y<95)newPage();const take=Math.min(count-offset,Math.floor((y-60)/14)-1);const h=take*14+14;
     for(let j=0;j<cols;j++){const x=48+j*cw;page.drawRectangle({x,y:y-h,width:cw,height:h,color:i===0?rgb(.92,.95,.98):rgb(1,1,1),borderColor:rgb(.82,.86,.9),borderWidth:.5});for(let k=0;k<take;k++){if(lines[j][offset+k])page.drawText(lines[j][offset+k],{x:x+7,y:y-14-k*14,font:f,size:9,color:gray});}}
     y-=h;offset+=take;
    }
   }y-=18;
  }else{if(b.type==='heading'&&y<100)newPage();textLine(b.text,b.type==='heading'?14:11,b.type==='heading'?bold:font,b.type==='heading'?blue:gray);}
 }
 doc.setTitle('Material de formación · CatólicosGPT');doc.setAuthor('CatólicosGPT');return Buffer.from(await doc.save());
}
module.exports={word,pdf,blocks,material};
