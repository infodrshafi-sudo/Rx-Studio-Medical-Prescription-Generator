/* Rx Studio V4: privacy-preserving, multi-page A4 prescription generator.
   Layout based on clinician-provided redesigned prescription reference.
   All output is rendered on device; no patient data is transmitted. */
'use strict';
(() => {
  const $=s=>document.querySelector(s);
  const W=1240,H=1754,L=87,R=1153,TOP=84,FOOT=1643,CONTENT_END=1595;
  const C={navy:'#193B63',navy2:'#294F79',ink:'#243746',muted:'#667781',rule:'#DFE7E7',panel:'#F1F5FA',white:'#FFFFFF'};
  const disclaimer='This prescription is issued for routine clinical consultation and treatment only. It is not intended for use as a medico-legal certificate or medico-legal case (MLC) document.';
  let canvas,ctx,y,pages=[],pageNo=0,state,sign;
  const str=x=>String(x??'').trim();
  const date=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?`${m[3]}/${m[2]}/${m[1]}`:str(s)||'—';};
  const clock=s=>{const [h,m]=String(s||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`:'—';};
  function font(sz=19,b=false){ctx.font=`${b?'700':'400'} ${sz}px Arial, 'Segoe UI', sans-serif`;}
  function txt(v,x,yy,sz=19,color=C.ink,b=false,align='left'){font(sz,b);ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str(v),x,yy);ctx.textAlign='left';}
  function rule(yy,heavy=false){ctx.strokeStyle=heavy?C.navy:C.rule;ctx.lineWidth=heavy?3:1.5;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(R,yy);ctx.stroke();}
  function wrap(value,width,size=19,bold=false){font(size,bold);const lines=[];for(const paragraph of str(value).split(/\n/)){if(!paragraph){lines.push('');continue;}let current='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const trial=current?current+' '+word:word;if(ctx.measureText(trial).width<=width){current=trial;continue;}if(current)lines.push(current);if(ctx.measureText(word).width<=width){current=word;continue;}let segment='';for(const ch of word){if(segment&&ctx.measureText(segment+ch).width>width){lines.push(segment);segment='';}segment+=ch;}current=segment;}lines.push(current);}return lines;}
  function multi(value,x,yy,width,sz=19,lineH=28,color=C.ink,bold=false){for(const line of wrap(value,width,sz,bold)){txt(line,x,yy,sz,color,bold);yy+=lineH;}return yy;}
  function startPage(continued=false){canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle=C.white;ctx.fillRect(0,0,W,H);pageNo++;y=TOP;
    if(continued){txt('PRESCRIPTION — CONTINUED',L,y,20,C.navy,true);txt(`Page ${pageNo}`,R,y,16,C.muted,false,'right');y+=32;txt(`Patient: ${state.patient?.name||'—'}`,L,y,17,C.ink,true);txt(`Date: ${date(state.visit?.date)}`,R,y,16,C.muted,false,'right');y+=26;rule(y,true);y+=35;}}
  function footer(){rule(FOOT);txt(`${state.doctor?.name||'Doctor'} | Outpatient Prescription`,L,FOOT+26,16,C.muted);const lines=wrap(disclaimer,R-L,16);let yy=FOOT+54;for(const line of lines){txt(line,L,yy,16,C.muted);yy+=21;}}
  function closePage(){footer();pages.push(canvas.toDataURL('image/jpeg',0.92));}
  function ensure(height){if(y+height>CONTENT_END){closePage();startPage(true);}}
  function heading(title){ensure(74);txt(title,L,y,20,C.navy,true);y+=17;rule(y);y+=33;}
  function row(label,val){const size=19,lh=28,content=wrap(val,R-(L+205),size);let first=true;for(const line of content){ensure(lh+12);if(first){txt(label,L,y,17,C.muted);first=false;}txt(line,L+200,y,size,C.ink);y+=lh;}y+=6;}
  async function signatureImage(source){if(!source||source==='none'||(!source.startsWith('data:image/png;base64,')&&source!=='./assets/default-signature.png'))return null;return await new Promise(res=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>res(null);img.src=source;});}
  function drawHeader(){const d=state.doctor||{},visit=state.visit||{};const cred=wrap(d.credentials||'',755,18);txt(d.name||'Doctor',L,y,40,C.navy,true);y+=41;
    for(const line of cred){txt(line,L,y,18,C.ink);y+=26;}
    if(d.registration){txt(d.registration,L,y+4,17,C.muted);y+=26;}
    const add=[d.clinic,d.contact].filter(Boolean);for(const a of add){y=multi(a,L,y+2,710,16,23,C.muted);}
    txt(visit.mode==='Online'?'ONLINE CONSULTATION':'OP CONSULTATION',R,TOP+5,17,C.navy,true,'right');txt(date(visit.date),R,TOP+35,17,C.muted,false,'right');txt(clock(visit.time),R,TOP+61,17,C.muted,false,'right');
    y=Math.max(y,235);rule(y,true);y+=46;
  }
  function drawPatient(){const p=state.patient||{};const fields=[['PATIENT',p.name||'—'],['AGE / SEX',[p.age||'',p.gender?({'Male':'M','Female':'F'}[p.gender]||p.gender):''].filter(Boolean).join(' / ')||'—'],['WT',p.weight?`${p.weight} kg`:'—'],['HT',p.height?`${p.height} cm`:'—']];
    const starts=[L+19,L+498,L+780,L+930], widths=[467,272,140,123];const vals=fields.map((f,i)=>wrap(f[1],widths[i]-12,i===0?21:19,true));const h=Math.max(92,66+28*Math.max(0,...vals.map(a=>a.length-1)));ensure(h+64);
    ctx.fillStyle=C.panel;ctx.fillRect(L,y-22,R-L,h);for(let i=0;i<4;i++){txt(fields[i][0],starts[i],y,15,C.muted,true);let a=y+36;for(const line of vals[i]){txt(line,starts[i],a,i===0?21:19,C.ink,true);a+=28;}}
    y+=h+9;const v=state.vitals||{};const items=[['BP',v.bp,'mmHg'],['PR',v.pulse,'/min'],['RR',v.rr,'/min'],['SpO₂',v.spo2,'%'],['Temp',v.temp,'°C']];let x=L+5;let had=false;
    for(const [label,val,unit] of items){if(!str(val))continue;had=true;const raw=str(val),valtxt=raw.toLowerCase().endsWith(unit.toLowerCase())?raw:raw+' '+unit;const whole=`${label}  ${valtxt}`;font(17);const width=ctx.measureText(whole).width+32;if(x+width>R){x=L+5;y+=29;}txt(whole,x,y,17,C.ink);x+=width;}
    if(had)y+=38;else y+=18;
  }
  function drawHistory(){heading('CLINICAL SUMMARY');row('History',state.history||'—');row('Diagnosis',state.diagnosis||'—');y+=28;}
  function drawMeds(){heading('Rx | PRESCRIBED MEDICATIONS');const meds=state.medicines||[];if(!meds.length){txt('No medicines added.',L+4,y,18,C.muted);y+=35;return;}
    for(let i=0;i<meds.length;i++){const m=meds[i],name=wrap(m.brand||'Unnamed medicine',730,23,true),generic=m.generic?wrap(m.generic,750,17):[],instructions=m.instructions?wrap(m.instructions.replace(/[;\s]+$/g,'').replace(/;\s*/g,' · '),750,17):[],dose=m.dose?wrap(m.dose,180,20,true):[],duration=m.duration?wrap(m.duration,190,17):[];
      const leftHeight=name.length*29+generic.length*24+instructions.length*25;
      const rightHeight=dose.length*25+duration.length*23;
      const h=Math.max(leftHeight,rightHeight,36)+34;
      ensure(h+4);
      const base=y;txt(String(i+1).padStart(2,'0'),L+2,base,22,C.navy,true);const col=L+62;let ny=base;
      for(const line of name){txt(line,col,ny,23,C.ink,true);ny+=29;}
      for(const line of generic){txt(line,col,ny,17,C.muted);ny+=24;}
      for(const line of instructions){txt(line,col,ny,17,C.ink);ny+=25;}
      let dy=base;for(const line of dose){txt(line,R-5,dy,20,C.navy,true,'right');dy+=25;}
      for(const line of duration){txt(line,R-5,dy+2,17,C.muted,false,'right');dy+=23;}
      y=Math.max(ny,dy)+18;rule(y);y+=21;
    }
  }
  function drawPlan(){const pl=state.plan||{},entries=[['Advice',pl.advice],['Investigations',pl.investigations],['Review date',pl.reviewDate?date(pl.reviewDate):''],['Follow-up',pl.followup]].filter(([,v])=>str(v));if(!entries.length)return;heading('TREATMENT PLAN & FOLLOW-UP');for(const [k,v] of entries)row(k,v);y+=18;}
  function drawSign(){const availableWidth=350, maxH=102;let signHeight=0;if(sign){const scale=Math.min(availableWidth/sign.width,maxH/sign.height);signHeight=Math.round(sign.height*scale);}const needed=76+signHeight+65;ensure(needed);y+=58;
    if(sign){const scale=Math.min(availableWidth/sign.width,maxH/sign.height);const w=sign.width*scale,h=sign.height*scale;ctx.drawImage(sign,R-w,y,w,h);y+=h+12;}
    txt(state.doctor?.name||'Doctor',R,y+5,20,C.ink,true,'right');y+=29;txt(state.doctor?.registration||'',R,y,16,C.muted,false,'right');y+=18;
  }
  async function render(s){state=s;pages=[];pageNo=0;sign=await signatureImage(s.doctor?.signature);startPage();drawHeader();drawPatient();drawHistory();drawMeds();drawPlan();drawSign();closePage();return buildPdf(pages);}
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
