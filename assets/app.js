/* Rx Studio — fully client-side prescription composer.
   Medical data is not sent to a server. Search indexes contain only the supplied
   public-style medicine catalogue; all patient data remains in memory unless the
   user explicitly exports an encrypted file. */
'use strict';
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const PROFILE_KEY = 'rx-studio-doctor-profile-v1';
  const defaultDoctor = {
    name: 'Dr. Muhammad Shafi K',
    credentials: 'MBBS (Govt MC Thrissur) · DNB Anesthesia & Critical Care Medicine (NBEMS)',
    registration: 'KSMC Reg No: 82692', clinic:'', contact:''
  };
  const makeInitial = () => {
    const now = new Date(), stamp = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    return {doctor:loadDoctor(),visit:{date:stamp,time:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),mode:'Offline'},
      patient:{name:'',age:'',gender:'',weight:'',height:''},vitals:{bp:'',pulse:'',spo2:'',temp:''},history:'',diagnosis:'',medicines:[],
      plan:{advice:'',investigations:'',followup:'',reviewDate:''}};
  };
  function loadDoctor(){try{const val=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');return val&&typeof val==='object'?{...defaultDoctor,...val}:{...defaultDoctor};}catch{return {...defaultDoctor};}}
  let state=makeInitial();
  const cachedBuckets = new Map();
  let lastResults=[], searchTimer=0, searchToken=0, toastTimer=0;
  const esc = s => String(s??'').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const norm = s => String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const words = s => norm(s).split(' ').filter(Boolean);
  function setPath(path,value) {const keys=path.split('.');let target=state;for(const k of keys.slice(0,-1))target=target[k];target[keys.at(-1)]=value;}
  function getPath(path) {return path.split('.').reduce((v,k)=>v?.[k],state)??'';}
  function findMed(id){return state.medicines.find(x=>x.id===id);}
  function prettyDate(s){if(!/^\d{4}-\d\d-\d\d$/.test(s||''))return '—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;}
  function prettyTime(t){if(!/^\d\d:\d\d$/.test(t||''))return '—';let [h,m]=t.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  function notify(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4200);}
  function switchStage(stage){$$('.stage').forEach(b=>{const active=b.dataset.stage===stage;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});$$('.stage-panel').forEach(p=>p.hidden=p.id!==`panel-${stage}`);if(stage==='medicines')$('#medicine-search').focus({preventScroll:true});if(window.innerWidth<1060){$('#preview-column').classList.remove('mobile-visible');$('.editor').classList.remove('mobile-hide');$('#btn-mobile-preview').textContent='↗ Preview prescription';}window.scrollTo({top:0,behavior:'smooth'});}
  const formulation = name => {const n=name.toLowerCase();if(/inhaler|rotacap|respule|nebul/i.test(n))return 'Inhaler';if(/eye drop|ear drop|nasal drop|drops/i.test(n))return 'Drops';if(/injection|infusion|vial|ampoule|prefilled syringe/i.test(n))return 'Injection';if(/syrup|suspension|oral solution|dry syrup|elixir|oral liquid|drops oral|liquid/i.test(n))return 'Liquid';if(/cream|ointment|gel|lotion|topical|paint/i.test(n))return 'Topical';if(/tablet|capsule|softgel|pill|chewable|lozenge|sachet/i.test(n))return 'Tablet';return 'Other';};
  function renderPreview(){const s=state;$('#rx-doctor-name').textContent=s.doctor.name||'Doctor';$('#rx-quals').textContent=s.doctor.credentials||'';$('#rx-reg').textContent=s.doctor.registration||'';$('#rx-reg').hidden=!s.doctor.registration;$('#rx-clinic').hidden=!(s.doctor.clinic||s.doctor.contact);$('#rx-clinic').textContent=[s.doctor.clinic,s.doctor.contact].filter(Boolean).join('\n');$('#rx-mode').textContent=s.visit.mode==='Online'?'Online Consultation':'OP Consultation';$('#rx-date').textContent='Date: '+prettyDate(s.visit.date);$('#rx-time').textContent='Time: '+prettyTime(s.visit.time);$('#context-date').textContent=prettyDate(s.visit.date);$('#rx-patient-name').textContent=s.patient.name||'—';$('#rx-age-gender').textContent=[s.patient.age?`${s.patient.age} yrs`:'',s.patient.gender].filter(Boolean).join(' / ')||'—';$('#rx-weight-height').textContent=[s.patient.weight?`${s.patient.weight} kg`:'',s.patient.height?`${s.patient.height} cm`:''].filter(Boolean).join(' / ')||'—';$('#rx-history').textContent=s.history||'—';$('#rx-diagnosis').textContent=s.diagnosis||'—';
    const vitals=[['BP',s.vitals.bp],['Pulse',s.vitals.pulse],['SpO₂',s.vitals.spo2],['Temp',s.vitals.temp]];
    $('#rx-vitals').innerHTML=vitals.filter(([k,v])=>v.trim()).map(([k,v])=>`<span class="rx-vital">${esc(k)}: <strong>${esc(v)}</strong></span>`).join('');
    $('#rx-medicines').innerHTML=s.medicines.length?s.medicines.map(m=>`<div class="rx-med-card"><div><div class="rx-med-title">${esc(m.brand||'Unnamed medicine')}</div>${m.generic?`<div class="rx-med-generic">${esc(m.generic)}</div>`:''}${m.instructions?`<div class="rx-med-instruction">${esc(m.instructions.replace(/[;\s]+$/g,''))}</div>`:''}</div><div class="rx-med-regimen">${m.dose?`<span class="rx-med-dose">${esc(m.dose)}</span>`:''}${m.duration?`<div class="rx-med-duration">${esc(m.duration)}</div>`:''}</div></div>`).join(''):'<p class="rx-muted">Medicines will appear here as you add them.</p>';
    const plan=[['Advice',s.plan.advice],['Investigations',s.plan.investigations],['Date',s.plan.reviewDate?prettyDate(s.plan.reviewDate):''],['Follow up',s.plan.followup]].filter(([,val])=>String(val).trim());
    $('#rx-plan').hidden=plan.length===0;$('#rx-advice').innerHTML=plan.map(([label,val])=>`<p><strong>${esc(label)}:</strong> ${esc(val)}</p>`).join('');
    $('#rx-sign-name').textContent=s.doctor.name||'';$('#rx-sign-reg').textContent=s.doctor.registration||'';$('#rx-footer-doctor').textContent=(s.doctor.name||'Doctor')+' — Digital Medical Prescription';
    const count=s.medicines.length;$('#nav-med-count').textContent=count;$('#selected-count').textContent=count;
  }
  function syncFields(){ $$('[data-field]').forEach(e=>{const val=getPath(e.dataset.field);e.value=val;});$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.visit.mode));renderMedicines();renderPreview(); }
  const inputHandler=e=>{const f=e.target.closest('[data-field]');if(f){setPath(f.dataset.field,f.value);renderPreview();}};
  document.addEventListener('input',inputHandler);
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.visit.mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));renderPreview()}));
  $$('[data-stage]').forEach(b=>b.addEventListener('click',()=>switchStage(b.dataset.stage)));
  $$('[data-next]').forEach(b=>b.addEventListener('click',()=>switchStage(b.dataset.next)));

  // The catalogue is partitioned by two-character token prefixes. Only the
  // single needed index is requested, then browser-cached for later searches.
  async function catalogueSearch(){const query=$('#medicine-search').value.trim();const seq=++searchToken;const target=$('#search-results');const tokens=words(query);const first=tokens.find(t=>t.length>=2);lastResults=[];
    if(!first){$('#search-hint').textContent='Type at least two characters to start searching.';target.innerHTML='';return;}
    const prefix=first.slice(0,2);$('#search-hint').textContent='Searching catalogue…';
    try{
      let rows=cachedBuckets.get(prefix);
      if(!rows){const r=await fetch(`./data/${encodeURIComponent(prefix)}.json`);if(r.status===404){rows=[];}else if(!r.ok)throw new Error('HTTP '+r.status);else rows=await r.json();cachedBuckets.set(prefix,rows);}
      if(seq!==searchToken)return;
      const showDisc=$('#include-discontinued').checked;
      const scored=[];let matchCount=0;
      for(const row of rows){if(!showDisc&&row[4])continue;
        const brand=norm(row[0]),full=brand+' '+norm(row[1])+' '+norm(row[2]);
        const matches=tokens.every(token=>full.split(' ').some(w=>w.startsWith(token)));
        if(!matches)continue;
        matchCount++;
        // Strongly prefer exact brand, then brand-prefix, then other brand, then generic.
        const score=(brand===norm(query)?1000:0)+(brand.startsWith(norm(query))?400:0)+
          (brand.split(' ').some(w=>w.startsWith(first))?100:0)+(row[4]?-300:0);
        if(scored.length<110)scored.push({row,score});else{let worst=0;for(let i=1;i<scored.length;i++)if(scored[i].score<scored[worst].score)worst=i;if(score>scored[worst].score)scored[worst]={row,score};}
      }
      scored.sort((a,b)=>b.score-a.score||a.row[0].localeCompare(b.row[0]));lastResults=scored.slice(0,35).map(x=>x.row);
      $('#search-hint').textContent=matchCount?`${matchCount.toLocaleString('en-IN')} match${matchCount===1?'':'es'} · showing ${lastResults.length}`:'No matches — try a different spelling or add manually.';
      target.innerHTML=lastResults.map((row,index)=>`<div class="result-item"><div><div class="result-title">${esc(row[0])} ${row[4]?'<span class="result-discontinued"> • Discontinued</span>':''}</div><div class="result-generic">${esc([row[1],row[2]].filter(Boolean).join(' + ')||'Composition not provided')}</div><div class="result-pack">${esc([row[3],row[5]].filter(Boolean).join(' · '))}</div></div><button type="button" class="result-add" data-add-index="${index}" aria-label="Add ${esc(row[0])}">+ Add</button></div>`).join('');
    }catch(error){if(seq!==searchToken)return;console.error('Catalogue search unavailable:',error);$('#search-hint').textContent='Catalogue not available. Serve the complete project, including its /data folder.';target.innerHTML='';}
  }
  $('#medicine-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(catalogueSearch,160)});
  $('#include-discontinued').addEventListener('change',catalogueSearch);
  $('#search-results').addEventListener('click',e=>{const btn=e.target.closest('[data-add-index]');if(!btn)return;const row=lastResults[Number(btn.dataset.addIndex)];if(!row)return;const med={id:uuid(),brand:row[0],generic:[row[1],row[2]].filter(Boolean).join(' + '),form:formulation(row[0]),dose:'',duration:'',instructions:'',pack:row[3]};state.medicines.push(med);renderMedicines();renderPreview();notify(med.brand+' added');$('#medicine-search').value='';$('#search-results').innerHTML='';$('#search-hint').textContent='Added. Search again to add another medicine.';});
  function uuid(){return globalThis.crypto?.randomUUID?.() || String(Date.now())+'-'+String(Math.random()).slice(2);}
  $('#btn-manual').addEventListener('click',()=>{const med={id:uuid(),brand:'',generic:'',form:'Tablet',dose:'',duration:'',instructions:'',pack:''};state.medicines.push(med);renderMedicines();renderPreview();const target=$(`[data-med-id="${med.id}"] [data-med-field="brand"]`);if(target)target.focus();notify('Custom medicine added. Please enter its details.');});
  function renderMedicines(){const container=$('#selected-medicines');if(state.medicines.length===0){container.innerHTML='<div class="empty-state"><div class="empty-glyph">✚</div><strong>No medicines added yet</strong><p>Select a medicine from the catalogue or add one manually.</p></div>';return;}
    container.innerHTML=state.medicines.map((m,i)=>`<div class="med-editor" data-med-id="${esc(m.id)}"><div class="med-editor-top"><span class="med-num">${i+1}</span><div class="med-editor-title">${esc(m.brand||'Custom medicine')}<div class="med-editor-desc">${esc(m.generic||'Add brand and composition below')}</div></div><div class="med-editor-buttons"><button type="button" class="mini-icon-button" data-med-action="duplicate" title="Duplicate medicine">Copy</button><button type="button" class="mini-icon-button danger" data-med-action="remove" title="Remove medicine">Remove</button></div></div><div class="med-fields"><div class="med-field full"><label>Brand name</label><input data-med-field="brand" value="${esc(m.brand)}" placeholder="Medicine name" autocomplete="off"></div><div class="med-field full"><label>Generic composition</label><input data-med-field="generic" value="${esc(m.generic)}" placeholder="Ingredients and strengths" autocomplete="off"></div><div class="med-field"><label>Formulation</label><select data-med-field="form">${['Tablet','Liquid','Drops','Inhaler','Injection','Topical','Other'].map(f=>`<option ${f===m.form?'selected':''}>${f}</option>`).join('')}</select></div><div class="med-field"><label>Duration</label><input data-med-field="duration" value="${esc(m.duration)}" placeholder="Type 3 → 3 days, 3 weeks" autocomplete="off"><div class="suggestions" data-suggest="duration"></div></div><div class="med-field full"><label>Dosage / volume &amp; frequency</label><input data-med-field="dose" value="${esc(m.dose)}" placeholder="Type 1 → 1-0-1, or 5 → 5 mL TDS" autocomplete="off"><div class="suggestions" data-suggest="dose"></div></div><div class="med-field full"><label>Special instructions (multiple allowed)</label><textarea data-med-field="instructions" rows="2" placeholder="Type 'after', 'before', 'shake'…">${esc(m.instructions)}</textarea><div class="suggestions" data-suggest="instructions"></div></div></div></div>`).join('');}
  const standardInstructions=[
    'After food','Before food','With food','On an empty stomach','At bedtime','In the morning','With plenty of water','As needed (SOS)','Shake well before use','Rinse mouth after use','Avoid alcohol','May cause drowsiness','Do not drive if drowsy','Swallow whole; do not crush','Dissolve in water before use','Apply to the affected area','Apply a thin layer','Wash hands after application','Use as directed by clinician','Complete the prescribed course','Keep away from eyes','Refrigerate if required by product label','Take with meals','Do not exceed prescribed dose','Report rash or breathing difficulty promptly'
  ];
  function dosageSuggestions(m){let n=(m.dose.match(/\d+(?:\.\d+)?/)||[])[0]||(['Liquid'].includes(m.form)?'5':'1');
    if(m.form==='Liquid')return [`${n} mL OD`,`${n} mL BD`,`${n} mL TDS`,`${n} mL QID`,`${n} mL HS`,`${n} mL SOS`,`${n} mL every 6 hours`,`${n} mL every 8 hours`];
    if(m.form==='Drops')return [`${n} drop OD`,`${n} drop BD`,`${n} drop TDS`,`${n} drop QID`,`${n} drops in each eye BD`,`${n} drops in each ear BD`];
    if(m.form==='Inhaler')return [`${n} puff OD`,`${n} puffs BD`,`${n} puffs TDS`,`${n} puffs QID`,`${n} puffs SOS`,`Nebulisation BD`,`Nebulisation TDS`];
    if(m.form==='Injection')return [`${n} mg IV OD`,`${n} mg IV BD`,`${n} mg IM STAT`,`${n} mL IV STAT`,`${n} mL IM OD`,`${n} units SC OD`,`${n} mcg/kg/min IV infusion`,`As prescribed (specify route)`];
    if(m.form==='Topical')return ['Apply once daily','Apply BD','Apply TDS','Apply thin layer BD','Apply at bedtime','Apply locally SOS'];
    if(m.form==='Tablet')return [`${n}-0-0`,`${n}-0-${n}`,`${n}-${n}-${n}`,`0-0-${n}`,`${n}-${n}-0`,`0-${n}-0`,`${n} tablet OD`,`${n} tablet SOS`,`${n} tablet HS`,`${n} tablet QID`,`${n} tablet every 6 hours`];
    return [`${n} OD`,`${n} BD`,`${n} TDS`,`${n} QID`,`${n} SOS`,`${n} STAT`,`${n} every 8 hours`];
  }
  function durationSuggestions(m){let n=(m.duration.match(/\d+(?:\.\d+)?/)||[])[0]||'3';return [`${n} days`,`${n} weeks`,`${n} months`,`${n} doses`,`${n} hours`,'Single dose','Until review','As directed'];}
  function instructionSuggestions(m){const fragments=m.instructions.split(';');const last=fragments.at(-1).trim().toLowerCase();let candidates=standardInstructions.filter(v=>v.toLowerCase().includes(last));if(m.form==='Liquid')candidates.sort((a,b)=>Number(b.startsWith('Shake'))-Number(a.startsWith('Shake')));if(m.form==='Inhaler')candidates.sort((a,b)=>Number(b.startsWith('Rinse'))-Number(a.startsWith('Rinse')));if(!last)candidates=candidates.slice(0,10);return candidates.slice(0,13);}
  function showSuggestions(editor,med,kind){$$('.suggestions',editor).forEach(el=>{if(el.dataset.suggest!==kind)el.innerHTML='';});const panel=$(`[data-suggest="${kind}"]`,editor);let choices=kind==='dose'?dosageSuggestions(med):kind==='duration'?durationSuggestions(med):instructionSuggestions(med);panel.innerHTML='<span class="suggestion-title">CLICK TO INSERT A SUGGESTION</span>'+choices.map(s=>`<button type="button" class="suggestion" data-pick="${esc(kind)}" data-pick-value="${esc(s)}">${esc(s)}</button>`).join('');}
  $('#selected-medicines').addEventListener('focusin',e=>{const input=e.target.closest('[data-med-field]');if(!input)return;const kind=input.dataset.medField;if(!['dose','duration','instructions'].includes(kind))return;const editor=input.closest('[data-med-id]'),med=findMed(editor.dataset.medId);if(med)showSuggestions(editor,med,kind)});
  $('#selected-medicines').addEventListener('input',e=>{const input=e.target.closest('[data-med-field]');if(!input)return;const editor=input.closest('[data-med-id]'),med=findMed(editor.dataset.medId);if(!med)return;med[input.dataset.medField]=input.value;const kind=input.dataset.medField;if(['dose','duration','instructions'].includes(kind))showSuggestions(editor,med,kind);if(['brand','generic'].includes(kind)){$('.med-editor-title',editor).firstChild.textContent=med.brand||'Custom medicine';$('.med-editor-desc',editor).textContent=med.generic||'Add brand and composition below';}renderPreview();});
  $('#selected-medicines').addEventListener('change',e=>{const input=e.target.closest('[data-med-field]');if(!input)return;const med=findMed(input.closest('[data-med-id]').dataset.medId);if(med){med[input.dataset.medField]=input.value;renderPreview();}});
  $('#selected-medicines').addEventListener('click',e=>{const editor=e.target.closest('[data-med-id]');if(!editor)return;const id=editor.dataset.medId,med=findMed(id);if(!med)return;const action=e.target.closest('[data-med-action]');if(action){if(action.dataset.medAction==='remove'){state.medicines=state.medicines.filter(x=>x.id!==id);notify('Medicine removed');}else{const index=state.medicines.findIndex(x=>x.id===id);state.medicines.splice(index+1,0,{...med,id:uuid()});notify('Medicine duplicated');}renderMedicines();renderPreview();return;}
    const pick=e.target.closest('[data-pick]');if(!pick)return;const kind=pick.dataset.pick,value=pick.dataset.pickValue;
    if(kind==='instructions'){
      const prior=med.instructions.split(';');prior[prior.length-1]=value;med.instructions=prior.map(x=>x.trim()).filter(Boolean).join('; ')+'; ';
    }else med[kind]=value;
    const field=$(`[data-med-field="${kind}"]`,editor);field.value=med[kind];renderPreview();field.focus();showSuggestions(editor,med,kind);
  });

  function printRx(){if(!state.patient.name.trim()){if(!window.confirm('Patient name is empty. Print the prescription anyway?'))return;}if(!state.medicines.length){if(!window.confirm('No medications have been added. Print anyway?'))return;}window.print();}
  $('#btn-print').addEventListener('click',printRx);$('#btn-print-panel').addEventListener('click',printRx);
  $('#btn-reference').addEventListener('click',()=>{if(state.patient.name||state.medicines.length){if(!window.confirm('Replace current prescription with the sample shown in the reference PDF?'))return;}const now=state.visit;
    state={...makeInitial(),doctor:state.doctor,visit:now,patient:{name:'MAJEED',age:'26',gender:'Male',weight:'80',height:''},vitals:{bp:'',pulse:'',spo2:'',temp:''},history:'Fever × 2 days',diagnosis:'Acute Febrile Illness',medicines:[
      {id:uuid(),brand:'Allegra-M Tablet',generic:'Montelukast (10mg) + Fexofenadine (120mg)',form:'Tablet',dose:'1-0-0',duration:'3 days',instructions:'',pack:''},
      {id:uuid(),brand:'Amoxyclav 625 Tablet',generic:'Amoxycillin (500mg) + Clavulanic Acid (125mg)',form:'Tablet',dose:'1-0-1',duration:'3 days',instructions:'After food',pack:''},
      {id:uuid(),brand:'Ambrodil-S Syrup',generic:'Ambroxol (15mg/5ml) + Salbutamol (1mg/5ml)',form:'Liquid',dose:'5 mL TDS',duration:'3 days',instructions:'',pack:''}],
      plan:{advice:'Drink plenty of water to maintain hydration.',investigations:'CBC, RFT, Serum Electrolytes',followup:'Review in OPD after 3 days with reports.',reviewDate:''}};
    syncFields();notify('Reference sample loaded (illustration only).');});
  $('#btn-new').addEventListener('click',()=>{if(!window.confirm('Start a new prescription? Current unsaved patient details will be cleared.'))return;state=makeInitial();syncFields();$('#medicine-search').value='';$('#search-results').innerHTML='';$('#search-hint').textContent='Type at least two characters to start searching.';switchStage('patient');notify('New blank prescription ready.');});
  $('#btn-mobile-preview').addEventListener('click',()=>{const visible=$('#preview-column').classList.toggle('mobile-visible');$('.editor').classList.toggle('mobile-hide',visible);$('#btn-mobile-preview').textContent=visible?'← Back to editor':'↗ Preview prescription';window.scrollTo({top:0,behavior:'smooth'});});
  $('#btn-preview-stage').addEventListener('click',()=>{if(window.innerWidth<=1060){$('#preview-column').classList.add('mobile-visible');$('.editor').classList.add('mobile-hide');$('#btn-mobile-preview').textContent='← Back to editor';window.scrollTo({top:0,behavior:'smooth'});}else{$('#preview-column').scrollIntoView({behavior:'smooth',block:'start'});}});

  // Doctor profile is the only browser-persisted setting. No patient data in
  // localStorage, indexedDB, cookies, service workers or network POSTs.
  $('#btn-profile').addEventListener('click',()=>{const form=$('#profile-form');Object.entries(state.doctor).forEach(([key,val])=>{if(form.elements.namedItem(key))form.elements.namedItem(key).value=val;});$('#profile-dialog').showModal();});
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
  $('#profile-form').addEventListener('submit',e=>{e.preventDefault();const elements=e.currentTarget.elements;state.doctor={name:elements.namedItem('name').value.trim(),credentials:elements.namedItem('credentials').value.trim(),registration:elements.namedItem('registration').value.trim(),clinic:elements.namedItem('clinic').value.trim(),contact:elements.namedItem('contact').value.trim()};if(!state.doctor.name){notify('Doctor name is required');return;}try{localStorage.setItem(PROFILE_KEY,JSON.stringify(state.doctor))}catch{notify('Profile updated in this session; browser storage is unavailable.');}renderPreview();$('#profile-dialog').close();notify('Doctor profile saved in this browser.');});

  // AES-256-GCM encrypted draft. PBKDF2 key derivation prevents plain-text
  // patient data from being written to the computer by this application.
  const encodeBase64 = bytes => {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
  const decodeBase64 = s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  async function secretKey(pass,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),{name:'PBKDF2'},false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
  $('#btn-export').addEventListener('click',async()=>{
    if(!crypto?.subtle){notify('Encrypted export requires a secure HTTPS or localhost connection.');return;}
    const password=window.prompt('Set a password to encrypt this prescription (at least 8 characters). Keep it safe; the password cannot be recovered.');if(password===null)return;if(password.length<8){notify('Use at least 8 characters for the encryption password.');return;}
    try{const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await secretKey(password,salt);const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));
      const file={format:'rxstudio-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:210000,salt:encodeBase64(salt),iv:encodeBase64(iv),ciphertext:encodeBase64(new Uint8Array(ciphertext))};
      const url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`prescription_${state.visit.date||'draft'}_${(state.patient.name||'patient').replace(/[^a-z0-9-]/gi,'_').slice(0,24)}.rxp`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Encrypted prescription draft downloaded.');
    }catch(error){console.error(error);notify('Could not encrypt draft. Please retry.');}
  });
  $('#btn-import').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>3_000_000)throw new Error('File too large');const obj=JSON.parse(await file.text());if(obj.format!=='rxstudio-encrypted'||obj.version!==1||obj.iterations!==210000)throw new Error('Unsupported encrypted draft');const pass=window.prompt('Enter the password used to encrypt this prescription draft.');if(pass===null)return;const key=await secretKey(pass,decodeBase64(obj.salt));const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decodeBase64(obj.iv)},key,decodeBase64(obj.ciphertext));const restored=JSON.parse(new TextDecoder().decode(clear));if(!restored||!restored.visit||!restored.patient||!Array.isArray(restored.medicines)||!restored.plan||restored.medicines.length>200)throw new Error('Invalid prescription file');if((state.patient.name||state.medicines.length)&&!window.confirm('Replace current unsaved prescription with the imported draft?'))return;
    state={...makeInitial(),...restored,doctor:{...defaultDoctor,...restored.doctor}};state.medicines=state.medicines.map(m=>({...m,id:uuid(),brand:String(m.brand||''),generic:String(m.generic||''),form:formulation(m.brand||''),dose:String(m.dose||''),duration:String(m.duration||''),instructions:String(m.instructions||'')}));syncFields();switchStage('patient');notify('Encrypted prescription opened successfully.');
    }catch(error){console.error('Import failure:',error);notify('Unable to open draft. Check file format and password.');}
  });

  // Visible app metadata is derived from the bundled medicine manifest.
  fetch('./data/manifest.json').then(r=>r.ok?r.json():Promise.reject()).then(meta=>{$('#catalogue-stat').textContent=`${Number(meta.unique_formulations).toLocaleString('en-IN')} distinct medicine records indexed`;}).catch(()=>{$('#catalogue-stat').textContent='Catalogue file is missing';});
  syncFields();
})();
