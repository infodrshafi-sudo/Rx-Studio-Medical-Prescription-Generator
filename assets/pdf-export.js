/* Rx Studio: local, browser-only PDF export. No patient data or signature is uploaded.
   Creates a multi-page A4 PDF by wrapping a high-resolution document canvas as
   JPEG XObjects. WhatsApp file sharing uses the Web Share API when available. */
'use strict';
(() => {
  const $=s=>document.querySelector(s);
  const W=1240,H=1754,LEFT=86,RIGHT=1154,TOP=68,BOTTOM=1485;
  const C={ink:'#193248',blue:'#21556e',teal:'#078b80',mute:'#60788b',hair:'#dbe6ec',light:'#edf8f5',paper:'#ffffff'};
  let canvas,ctx,y,pages=[],pageNumber=0;
  const toText=x=>String(x??'').trim();
  const prettyDate=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?`${m[3]}/${m[2]}/${m[1]}`:s||'—';};
  const prettyTime=s=>{const [h,m]=(s||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`:'—';};
  function beginPage(){canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);ctx.fillStyle=C.teal;ctx.fillRect(LEFT,TOP,RIGHT-LEFT,7);pageNumber++;y=112;}
  function font(size=20,bold=false,serif=false){ctx.font=`${bold?'700':'400'} ${size}px ${serif?'Georgia, serif':'Arial, sans-serif'}`;}
  function text(t,x,yy,size=20,color=C.ink,bold=false){font(size,bold);ctx.fillStyle=color;ctx.fillText(toText(t),x,yy);}
  function rule(yy){ctx.strokeStyle=C.hair;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT,yy);ctx.lineTo(RIGHT,yy);ctx.stroke();}
  function wrap(t,maxWidth,size=20,bold=false){font(size,bold);const lines=[];for(const block of toText(t).split('\n')){if(!block){lines.push('');continue;}let current='';for(const word of block.split(/\s+/)){const proposal=current?current+' '+word:word;if(ctx.measureText(proposal).width<=maxWidth){current=proposal;continue;}if(current)lines.push(current);if(ctx.measureText(word).width<=maxWidth){current=word;continue;}let part='';for(const ch of word){if(part&&ctx.measureText(part+ch).width>maxWidth){lines.push(part);part='';}part+=ch;}current=part;}lines.push(current);}return lines;}
  function block(t,x,width,size=19,lineH=29,color=C.ink,bold=false){const lines=wrap(t,width,size,bold);font(size,bold);ctx.fillStyle=color;for(const line of lines){ctx.fillText(line,x,y);y+=lineH;}return lines.length*lineH;}
  function ensure(height,signature){if(y+height>BOTTOM){finishPage(signature);pages.push(canvas.toDataURL('image/jpeg',.89));beginPage();text('PRESCRIPTION — CONTINUED',LEFT,y,24,C.teal,true);text(`Page ${pageNumber}`,RIGHT-100,y,17,C.mute);y+=46;rule(y);y+=35;}}
  function heading(t,signature){ensure(75,signature);text(t,LEFT,y,20,C.teal,true);y+=28;rule(y);y+=28;}
  function normalizeVitals(v){return [['BP',v.bp,'mmHg'],['PR',v.pulse,'/min'],['RR',v.rr,'/min'],['SpO₂',v.spo2,'%'],['Temp',v.temp,'°C']].filter(([,val])=>toText(val)).map(([k,val,unit])=>{const str=toText(val);return `${k}: ${str.toLowerCase().endsWith(unit.toLowerCase())?str:str+' '+unit}`;});}
  async function loadSignature(src){if(!src||src==='none'||(!src.startsWith('data:image/png;base64,')&&src!=='./assets/default-signature.png'))return null;return new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;});}
  function finishPage(signature){const base=H-205;if(signature){const scale=Math.min(300/signature.width,100/signature.height);const w=signature.width*scale,h=signature.height*scale;ctx.drawImage(signature,RIGHT-w,base-45,w,h);}text(currentState.doctor.name||'Doctor',RIGHT-350,base+65,20,C.ink,true);text(currentState.doctor.registration||'',RIGHT-350,base+91,15,C.mute);rule(H-87);text((currentState.doctor.name||'Doctor')+' — Digital Medical Prescription',LEFT,H-58,14,C.mute);font(14,true);ctx.fillStyle='#755f65';ctx.textAlign='right';ctx.fillText('Not valid for MLC / medico-legal purposes.',RIGHT,H-58);ctx.textAlign='left';}
  let currentState;
  async function render(s){currentState=s;pages=[];pageNumber=0;beginPage();const signature=await loadSignature(s.doctor?.signature);
    text(s.doctor?.name||'Doctor',LEFT,y,38,C.blue,true);y+=42;
    const credentials=wrap(s.doctor?.credentials||'',730,17);for(const line of credentials){text(line,LEFT,y,17,C.teal,true);y+=24;}
    text(s.doctor?.registration||'',LEFT,y+8,17,C.teal,true);y+=42;
    if(s.doctor?.clinic||s.doctor?.contact){block([s.doctor.clinic,s.doctor.contact].filter(Boolean).join(' · '),LEFT,700,16,23,C.mute);y+=8;}
    text(s.visit?.mode==='Online'?'ONLINE CONSULTATION':'OP CONSULTATION',RIGHT-280,115,17,C.blue,true);text('Date: '+prettyDate(s.visit?.date),RIGHT-280,145,17,C.mute);text('Time: '+prettyTime(s.visit?.time),RIGHT-280,172,17,C.mute);
    y=Math.max(y,213);rule(y);y+=40;
    const patient=[['PATIENT NAME',s.patient?.name||'—'],['AGE / GENDER',[s.patient?.age?`${s.patient.age} yrs`:'',s.patient?.gender].filter(Boolean).join(' / ')||'—'],['WEIGHT / HEIGHT',[s.patient?.weight?`${s.patient.weight} kg`:'',s.patient?.height?`${s.patient.height} cm`:''].filter(Boolean).join(' / ')||'—']];
    ctx.fillStyle=C.light;ctx.fillRect(LEFT,y-25,RIGHT-LEFT,90);
    for(let i=0;i<3;i++){const x=LEFT+22+i*350;text(patient[i][0],x,y,14,C.mute,true);const val=wrap(patient[i][1],330,21,true);text(val[0]||'—',x,y+35,21,C.ink,true);}
    y+=115;
    const vitals=normalizeVitals(s.vitals||{});if(vitals.length){let x=LEFT;for(const v of vitals){font(18,true);const width=ctx.measureText(v).width+40;if(x+width>RIGHT){x=LEFT;y+=32;}text(v,x,y,18,C.blue,true);x+=width;}y+=37;}
    rule(y);y+=31;
    const assessment=[['CLINICAL HISTORY',s.history||'—'],['DIAGNOSIS',s.diagnosis||'—']];for(const [label,value] of assessment){const ht=wrap(value,RIGHT-LEFT,19).length*29+34;ensure(ht+15,signature);text(label,LEFT,y,15,C.mute,true);y+=28;block(value,LEFT,RIGHT-LEFT,19,29);y+=18;}
    heading('Rx  PRESCRIBED MEDICATIONS',signature);
    const meds=s.medicines||[];
    if(!meds.length){text('No medicines added.',LEFT,y,19,C.mute);y+=42;}
    for(let i=0;i<meds.length;i++){const med=meds[i];const name=med.brand||'Unnamed medicine';const d=med.dose||'';const generic=med.generic||'';const instructions=med.instructions||'';const nameLines=wrap(name,760,23,true),genericLines=generic?wrap(generic,800,17):[],instructionLines=instructions?wrap(instructions.replace(/;\s*$/,'').replace(/; /g,' · '),800,16):[];
      const rowH=30*nameLines.length+24*genericLines.length+23*instructionLines.length+42;
      ensure(rowH+10,signature);
      text(`${i+1}.`,LEFT,y,22,C.teal,true);
      const startX=LEFT+45;for(const line of nameLines){text(line,startX,y,23,C.ink,true);y+=30;}
      let rightY=y-30; if(d){const lines=wrap(d,190,18,true);for(const l of lines){text(l,RIGHT-175,rightY,18,C.teal,true);rightY+=25;}}
      if(med.duration){text(med.duration,RIGHT-175,rightY+5,16,C.mute);}
      for(const line of genericLines){text(line,startX,y,17,C.mute);y+=24;}
      for(const line of instructionLines){text(line,startX,y,16,C.mute);y+=23;}
      y=Math.max(y,rightY+25);y+=20;rule(y);y+=24;
    }
    const plan=[['Advice',s.plan?.advice],['Investigations',s.plan?.investigations],['Review date',s.plan?.reviewDate?prettyDate(s.plan.reviewDate):''],['Follow up',s.plan?.followup]].filter(([,val])=>toText(val));
    if(plan.length){heading('TREATMENT PLAN & ADVICE',signature);for(const [label,value] of plan){const lines=wrap(`${label}: ${value}`,RIGHT-LEFT,18);ensure(26*lines.length+16,signature);block(`${label}: ${value}`,LEFT,RIGHT-LEFT,18,26);y+=13;}}
    finishPage(signature);pages.push(canvas.toDataURL('image/jpeg',.89));return buildPdf(pages);
  }
  function buildPdf(images){const enc=new TextEncoder();let chunks=[],offsets=[0],size=0;function addBytes(bytes){chunks.push(bytes);size+=bytes.length;}function add(s){addBytes(enc.encode(s));}function obj(i,body){offsets[i]=size;add(`${i} 0 obj\n${body}\nendobj\n`);}function bytesOf(base64){const bin=atob(base64);const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return b;}
    add('%PDF-1.4\n%RxStudio\n');const n=images.length;const pageIds=images.map((_,i)=>3+i*3);obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,`<< /Type /Pages /Kids [${pageIds.map(i=>`${i} 0 R`).join(' ')}] /Count ${n} >>`);
    for(let j=0;j<n;j++){const pageId=pageIds[j],imageId=pageId+1,contentId=pageId+2,img=bytesOf(images[j].split(',')[1]);obj(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      offsets[imageId]=size;add(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);addBytes(img);add('\nendstream\nendobj\n');
      const commands='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';obj(contentId,`<< /Length ${enc.encode(commands).length} >>\nstream\n${commands}endstream`);
    }
    const xref=size;add(`xref\n0 ${3+3*n}\n0000000000 65535 f \n`);for(let i=1;i<3+3*n;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${3+3*n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  const fileName=s=>`Prescription_${(s.patient?.name||'patient').replace(/[^a-z0-9_-]+/gi,'_').slice(0,35)}_${s.visit?.date||'visit'}.pdf`;
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function alertError(error){console.error('PDF operation failed',error);window.alert('Could not create the PDF. Try again, or use the Print option to save as PDF.');}
  async function action(kind){const s=window.RxStudioGetSnapshot?.();if(!s)return;const button=$('#btn-'+(kind==='download'?'download-pdf':'whatsapp-pdf'));if(button)button.disabled=true;try{const pdf=await render(s),name=fileName(s);if(kind==='download'){download(pdf,name);return;}
      const file=new File([pdf],name,{type:'application/pdf'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file],title:'Medical Prescription',text:'Prescription PDF'});}catch(e){if(e.name!=='AbortError')throw e;}
      }else{download(pdf,name);window.alert('PDF downloaded. WhatsApp PDF attachment sharing is not supported by this browser. Open WhatsApp, select the chat, attach the downloaded PDF as a document, and send it.');}
    }catch(error){alertError(error);}finally{if(button)button.disabled=false;}}
  $('#btn-download-pdf')?.addEventListener('click',()=>action('download'));
  $('#btn-whatsapp-pdf')?.addEventListener('click',()=>action('share'));
})();
