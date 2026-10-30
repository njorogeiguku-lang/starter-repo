const templates = [
  { id: 'proposal', name: 'Client proposal', desc: 'Present a clear scope, approach, and next step.', icon: '✧', cls: 'ic-purple', type: 'New business' },
  { id: 'brief', name: 'Project brief', desc: 'Align your team around the client’s goals.', icon: '▤', cls: 'ic-blue', type: 'Project setup' },
  { id: 'kickoff', name: 'Kickoff checklist', desc: 'Make the handoff to delivery feel effortless.', icon: '✓', cls: 'ic-green', type: 'Client onboarding' }
];
const key = 'flowforge-ai-state-v1', cloudUiKey = 'flowforge-ai-cloud-ui-v1';
const steps = ['Intake captured', 'Proposal reviewed', 'Project brief shared', 'Kickoff ready'];
let legacyState = loadState(), state = { ...legacyState, docs: [], workflows: [] }, editingId = null, toastTimer;
let aiAvailable = false, cloudEnabled = false, saveQueue = Promise.resolve(true), signedInUser = null;
state.workflows = (state.workflows || []).map(w => ({
  ...w, id: w.id || crypto.randomUUID(), client: w.client || 'Existing client',
  project: w.project || w.title || 'Agency project', service: w.service || 'Client onboarding',
  step: Math.max(0, Math.min(steps.length, Number(w.step) || 0)), created: w.created || Date.now(), updated: w.updated || Date.now()
}));

function loadState() {
  try { return { docs: [], workflows: [], theme: 'dark', ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return { docs: [], workflows: [], theme: 'dark' }; }
}
function saveState() {
  if (cloudEnabled) {
    try { localStorage.setItem(cloudUiKey, JSON.stringify({ theme: state.theme })); } catch {}
    const payload = JSON.stringify({ documents: state.docs, workflows: state.workflows });
    saveQueue = saveQueue.catch(() => false).then(async () => {
      const indicator = document.querySelector('.save-indicator'); if (indicator) indicator.innerHTML = '<i></i> Saving workspace…';
      const response = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: payload });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Cloud save failed.'); }
      if (indicator) indicator.innerHTML = '<i></i> Saved to workspace';
      return true;
    }).catch(error => { const indicator = document.querySelector('.save-indicator'); if (indicator) indicator.textContent = 'Cloud save needs attention'; notify(error.message || 'Cloud save failed.'); return false; });
    return saveQueue;
  }
  try { localStorage.setItem(key, JSON.stringify(state)); return Promise.resolve(true); }
  catch { toast('Browser storage is unavailable. Download your documents to keep a copy.'); return Promise.resolve(false); }
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function cleanDocument(html = '') {
  const source = document.createElement('template'); source.innerHTML = html;
  const allowed = new Set(['P','H1','H2','H3','UL','OL','LI','BR','B','STRONG','I','EM','HR','A']);
  const walk = node => [...node.childNodes].forEach(child => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH'].includes(child.tagName)) { child.remove(); return; }
    walk(child);
    if (!allowed.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
    [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
  });
  walk(source.content); return source.innerHTML;
}
function dateLabel(value) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function notify(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400); }
async function refreshAiStatus() {
  const label=document.getElementById('ai-label'), dot=document.getElementById('ai-status');
  try { const response=await fetch('/api/health'), health=await response.json(); aiAvailable=Boolean(response.ok&&health.aiAvailable); document.getElementById('sign-out').classList.toggle('hidden',!health.authRequired); label.textContent=aiAvailable?'AI DRAFTING CONFIGURED':'TEMPLATE DEMO · AI NOT CONFIGURED'; dot.style.background=aiAvailable?'#6bc39d':'#d8aa70'; }
  catch { aiAvailable=false; label.textContent='TEMPLATE DEMO · START SERVER FOR AI'; dot.style.background='#d8aa70'; }
}
function showModal(content) { document.getElementById('modal-content').innerHTML = content; document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function renderTemplates() {
  document.getElementById('template-grid').innerHTML = templates.map(t => `<article class="template-card" data-template="${t.id}"><div class="template-icon ${t.cls}">${t.icon}</div><h3>${t.name}</h3><p>${t.desc}</p><div class="card-bottom"><span class="template-type">${t.type}</span><span class="card-arrow">↗</span></div></article>`).join('');
  document.querySelectorAll('[data-template]').forEach(el => el.onclick = () => openIntake(el.dataset.template));
}
function renderDocuments() {
  const query = (document.getElementById('document-search')?.value || '').toLowerCase();
  const filter = document.getElementById('document-filter')?.value || 'all';
  const docs = [...state.docs].sort((a,b) => b.updated-a.updated).filter(d => (filter === 'all' || d.template === filter) && `${d.title} ${d.client}`.toLowerCase().includes(query));
  const markup = docs.length ? docs.map(d => `<div class="doc-row" data-edit="${escapeHtml(d.id)}"><div class="doc-name"><span class="recent-icon">${templates.find(t => t.id === d.template)?.icon || '▤'}</span><span>${escapeHtml(d.title)}</span></div><div class="doc-sub">${escapeHtml(d.client)}</div><div class="doc-date">Edited ${dateLabel(d.updated)}</div><span class="status">Draft</span></div>`).join('') : '<div class="empty-state"><span>▤</span><strong>No documents found.</strong><br>Create a client pack to get started.</div>';
  for (const id of ['all-documents-list','recent-list']) { const node = document.getElementById(id); if (!node) continue;
    if (id === 'recent-list') node.innerHTML = docs.slice(0,4).map(d => `<div class="recent-item" data-edit="${escapeHtml(d.id)}"><span class="recent-icon">${templates.find(t => t.id === d.template)?.icon || '▤'}</span><span class="recent-meta"><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(d.client)} · ${dateLabel(d.updated)}</small></span><span class="status">Draft</span></div>`).join('') || '<div class="empty-state"><span>▤</span><strong>Your next client pack starts here.</strong><br>Build a proposal, project brief, and kickoff checklist together.</div>';
    else node.innerHTML = markup;
    node.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => openEditor(el.dataset.edit));
  }
  document.getElementById('doc-count').textContent = state.docs.length;
}
function renderWorkflows() {
  const workflows = [...state.workflows].sort((a,b) => b.updated-a.updated);
  const short = document.getElementById('workflow-list'), full = document.getElementById('workflow-full');
  if (!workflows.length) {
    short.innerHTML = '<div class="empty-state"><span>⟳</span><strong>No client work in motion yet.</strong><br>Start a client pack to create its onboarding workflow.</div>';
    full.innerHTML = '<div class="empty-state panel"><span>⟳</span><strong>Your client workflows will appear here.</strong><br>Build a client pack to begin.</div>'; return;
  }
  short.innerHTML = workflows.slice(0,3).map(w => `<div class="workflow-item"><div class="workflow-title"><span>${escapeHtml(w.client)} · ${escapeHtml(w.project)}</span><small>${w.step}/${steps.length} complete</small></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(w.step/steps.length*100)}%"></div></div><button class="workflow-cta" data-advance="${escapeHtml(w.id)}">${w.step < steps.length ? `Complete: ${steps[w.step]}` : '✓ Onboarding complete'}</button></div>`).join('');
  full.innerHTML = workflows.map(w => `<div class="panel"><div class="panel-heading"><div><h2>${escapeHtml(w.client)} · ${escapeHtml(w.project)}</h2><p>${escapeHtml(w.service)} · Started ${dateLabel(w.created)}</p></div><span class="pulse-badge"><i></i> ${w.step === steps.length ? 'Complete' : 'In progress'}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(w.step/steps.length*100)}%"></div></div><div class="workflow-steps">${steps.map((label,i) => `<span class="step ${i<w.step?'done':i===w.step?'active':''}"><i class="step-num">${i<w.step?'✓':i+1}</i>${label}</span>${i<steps.length-1?'<i class="step-line"></i>':''}`).join('')}</div><button class="workflow-cta" data-advance="${escapeHtml(w.id)}">${w.step < steps.length ? `Mark “${steps[w.step]}” complete →` : '✓ Client onboarding complete'}</button></div>`).join('');
  document.querySelectorAll('[data-advance]').forEach(el => el.onclick = () => advanceWorkflow(el.dataset.advance));
}
function advanceWorkflow(id) { const workflow = state.workflows.find(w => w.id === id); if (!workflow || workflow.step >= steps.length) return; workflow.step++; workflow.updated = Date.now(); saveState(); renderWorkflows(); notify(workflow.step === steps.length ? 'Client onboarding complete.' : `${steps[workflow.step-1]} — marked complete.`); }

function openIntake(templateId = 'pack') {
  showModal(`<div class="eyebrow">AGENCY CLIENT ONBOARDING</div><h2>${templateId === 'pack' ? 'Create a client pack' : `Draft a ${templates.find(t=>t.id===templateId)?.name.toLowerCase()}`}</h2><p class="modal-lead">One intake creates a proposal, delivery brief, kickoff checklist, and a trackable workflow.</p><div class="wizard-progress"><span class="wizard-current" id="wizard-current">01 / 03 · CLIENT</span><div class="progress-track"><div class="progress-fill" id="wizard-bar" style="width:33%"></div></div><div class="wizard-labels"><span>Client</span><span>Scope</span><span>Review</span></div></div><form id="intake-form"><div class="intake-step" data-step="0"><div class="form-row"><div class="field"><label for="client">Client or brand</label><input id="client" name="client" placeholder="e.g. Acme Studio" required></div><div class="field"><label for="project">Project name</label><input id="project" name="project" placeholder="e.g. Brand refresh" required></div></div><div class="field"><label for="service">Agency service</label><input id="service" name="service" placeholder="e.g. Brand strategy and identity" required></div></div><div class="intake-step" data-step="1" hidden><div class="form-row"><div class="field"><label for="timeline">Target timeline</label><input id="timeline" name="timeline" placeholder="e.g. 6 weeks"></div><div class="field"><label for="budget">Proposed budget (optional)</label><input id="budget" name="budget" placeholder="e.g. $8,000"></div></div><div class="field"><label for="goal">Client’s goal</label><textarea id="goal" name="goal" placeholder="What outcome does the client want?" required></textarea></div><div class="field"><label for="notes">Scope or context</label><textarea id="notes" name="notes" placeholder="Deliverables, constraints, stakeholders, or notes"></textarea></div></div><div class="intake-step" data-step="2" hidden><div class="panel"><h2 id="review-title">Your client pack</h2><p class="subhead" id="review-client"></p><div class="review-summary" id="review-summary"></div><p class="template-type">You’ll get three editable drafts and a four-step onboarding tracker. Confirm commercial details with your client before sharing.</p></div></div><div class="modal-actions"><button type="button" class="secondary-button" id="intake-cancel">Cancel</button><button type="button" class="secondary-button hidden" id="intake-back">Back</button><button type="button" class="primary-button" id="intake-next">Continue →</button><button class="primary-button hidden" id="intake-submit">✦ ${templateId === 'pack' ? 'Create client pack' : 'Create draft'}</button></div></form><p class="template-type" style="margin-top:13px"><span id="generation-mode">Checking generation mode…</span> · Drafts are saved to your private workspace.</p>`);
  document.getElementById('intake-cancel').onclick = closeModal;
  const form=document.getElementById('intake-form'), panels=[...form.querySelectorAll('.intake-step')]; let current=0;
  const update=()=>{panels.forEach((panel,index)=>panel.hidden=index!==current);document.getElementById('wizard-current').textContent=[`01 / 03 · CLIENT`,`02 / 03 · SCOPE`,`03 / 03 · REVIEW`][current];document.getElementById('wizard-bar').style.width=`${(current+1)*100/3}%`;document.getElementById('intake-back').classList.toggle('hidden',current===0);document.getElementById('intake-next').classList.toggle('hidden',current===2);document.getElementById('intake-submit').classList.toggle('hidden',current!==2);document.getElementById('intake-cancel').classList.toggle('hidden',current!==0);if(current===2){const v=Object.fromEntries(new FormData(form));document.getElementById('review-title').textContent=`${v.project} · client pack`;document.getElementById('review-client').textContent=`Prepared for ${v.client} · ${v.service}`;document.getElementById('review-summary').innerHTML=`<p><b>Goal:</b> ${escapeHtml(v.goal)}</p><p><b>Timeline:</b> ${escapeHtml(v.timeline||'To be agreed')} · <b>Budget:</b> ${escapeHtml(v.budget||'To be agreed')}</p><p><b>Scope notes:</b> ${escapeHtml(v.notes||'None added')}</p><p><b>Included:</b> proposal · project brief · kickoff checklist</p>${aiAvailable?'<label class="ai-consent"><input type="checkbox" id="ai-consent" required> Send this intake to OpenAI to generate drafts. API usage may incur charges to the connected account.</label>':'<p><b>Generation:</b> Local template demo (no API call).</p>'}`;}};
  document.getElementById('intake-next').onclick=()=>{if(current<2){const required=panels[current].querySelectorAll('[required]');if([...required].some(input=>!input.reportValidity()))return;current++;update();}};
  document.getElementById('intake-back').onclick=()=>{current=Math.max(0,current-1);update();};
  form.onsubmit=event=>{event.preventDefault();if(current!==2)return;createClientWork(Object.fromEntries(new FormData(form)),templateId);};
  document.getElementById('generation-mode').textContent=aiAvailable?'AI draft generation is configured on the server.':'Template demo mode: configure the server-side AI provider to enable live drafts.';
}
function contentFor(type, v) {
  const client=escapeHtml(v.client), project=escapeHtml(v.project), service=escapeHtml(v.service), goal=escapeHtml(v.goal), notes=escapeHtml(v.notes || 'To be confirmed with the client.'), timeline=escapeHtml(v.timeline || 'To be agreed'), budget=escapeHtml(v.budget || 'To be agreed');
  if (type === 'proposal') return `<h1>Proposal · ${project}</h1><p>Prepared for <b>${client}</b></p><h2>Understanding your goals</h2><p>${goal}</p><h2>Our proposed approach</h2><p>${service}</p><p>${notes}</p><h2>Deliverables & timing</h2><p>We’ll confirm deliverables and review milestones together. Target timeline: ${timeline}.</p><h2>Investment</h2><p>Proposed budget: ${budget}. Final scope and payment schedule to be agreed in writing.</p><h2>Next step</h2><p>Review the scope, share feedback, and confirm a kickoff date.</p>`;
  if (type === 'brief') return `<h1>Project brief · ${project}</h1><p><b>Client:</b> ${client} · <b>Service:</b> ${service}</p><h2>Desired outcome</h2><p>${goal}</p><h2>Scope & context</h2><p>${notes}</p><h2>Timeline</h2><p>${timeline}</p><h2>Open questions</h2><ul><li>Confirm approvers and decision owner.</li><li>Agree on review dates and feedback windows.</li><li>Confirm final deliverables and success measures.</li></ul>`;
  return `<h1>Kickoff checklist · ${project}</h1><p><b>Client:</b> ${client} · <b>Service:</b> ${service}</p><h2>Before kickoff</h2><ul><li>Confirm signed scope, budget, and timeline.</li><li>Collect brand assets, access, and source materials.</li><li>Confirm client stakeholders and decision maker.</li><li>Schedule kickoff and first review.</li></ul><h2>Kickoff agenda</h2><ul><li>Revisit the client’s goal: ${goal}</li><li>Confirm deliverables and responsibilities.</li><li>Agree on communication channel and response times.</li><li>Set the first milestone for ${timeline}.</li></ul><h2>Project notes</h2><p>${notes}</p>`;
}
async function createClientWork(values, requested) {
  const selected = requested === 'pack' ? templates.map(t=>t.id) : [requested];
  let aiDocs = null;
  if (aiAvailable) {
    notify('Preparing your drafts with AI…');
    try {
      const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      const result=await response.json(); if(!response.ok) throw new Error(result.error||'Generation failed'); aiDocs=result.documents;
    } catch(error) { notify(error.message||'AI generation failed. Your intake is still here.'); return; }
  }
  const workflow = { id: crypto.randomUUID(), client: values.client, project: values.project, service: values.service, step: 1, total: steps.length, created: Date.now(), updated: Date.now() };
  const aiByType={proposal:aiDocs?.proposal,brief:aiDocs?.brief,kickoff:aiDocs?.kickoff};
  const docs = selected.map(type => ({ id: crypto.randomUUID(), template:type, title:`${values.project} — ${templates.find(t=>t.id===type).name}`, client:values.client, project:values.project, service:values.service, content:cleanDocument(aiByType[type]||contentFor(type,values)), created:Date.now(), updated:Date.now(), workflowId:workflow.id, generatedBy:aiDocs?'openai':'template' }));
  state.docs.unshift(...docs); state.workflows.unshift(workflow); await saveState(); renderDocuments(); renderWorkflows(); closeModal();
  notify(aiDocs?'AI client pack and onboarding workflow created.':requested === 'pack' ? 'Template client pack and onboarding workflow created.' : 'Template draft and onboarding workflow created.');
  openEditor(docs[0].id);
}

function openEditor(id) {
  const doc=state.docs.find(d=>d.id===id); if(!doc) return; editingId=id;
  showModal(`<div class="eyebrow">${escapeHtml(templates.find(t=>t.id===doc.template)?.name || 'Document')} · PRIVATE DRAFT</div><input class="editor-title" id="editor-title" value="${escapeHtml(doc.title)}" aria-label="Document title"><div class="editor-toolbar"><button data-cmd="bold"><b>B</b></button><button data-cmd="italic"><i>I</i></button><button data-cmd="insertUnorderedList">• List</button><button data-cmd="formatBlock" data-val="h2">Heading</button></div><div class="editor-area" id="editor-area" contenteditable="true" spellcheck="true">${cleanDocument(doc.content)}</div><div class="editor-footer"><span>${cloudEnabled?'Saved to your private workspace':'Saved in this browser'}</span><div class="modal-actions" style="margin:0"><button class="secondary-button" id="export-doc">Download .html</button><button class="primary-button" id="save-doc">Save changes</button></div></div>`);
  document.querySelectorAll('[data-cmd]').forEach(button=>button.onclick=()=>{document.execCommand(button.dataset.cmd,false,button.dataset.val||null);document.getElementById('editor-area').focus();});
  document.getElementById('save-doc').onclick=saveEditor; document.getElementById('export-doc').onclick=exportDoc;
}
async function saveEditor() { const doc=state.docs.find(d=>d.id===editingId); if(!doc)return; doc.title=document.getElementById('editor-title').value.trim()||'Untitled document'; doc.content=cleanDocument(document.getElementById('editor-area').innerHTML); doc.updated=Date.now(); const saved=await saveState(); renderDocuments(); closeModal(); notify(saved&&cloudEnabled?'Document saved to your private workspace.':saved?'Document saved on this device.':'Document could not be synced. Please retry.'); }
function exportDoc() { const doc=state.docs.find(d=>d.id===editingId), title=document.getElementById('editor-title').value||doc.title; const body=cleanDocument(document.getElementById('editor-area').innerHTML); const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{max-width:760px;margin:60px auto;font:16px/1.8 Georgia,serif;color:#252536;padding:0 24px}h1,h2{font-family:Arial,sans-serif}</style></head><body>${body}</body></html>`; const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([html],{type:'text/html'})); link.download=`${title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'document'}.html`; link.click(); URL.revokeObjectURL(link.href); notify('Your draft downloaded as an HTML file.'); }
function navigate(view) { document.querySelectorAll('.page-content').forEach(el=>el.classList.add('hidden')); document.getElementById(`${view}-view`).classList.remove('hidden'); document.getElementById('crumb').textContent={overview:'Overview',documents:'Documents',workflows:'Workflows'}[view]; document.querySelectorAll('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view)); if(view==='documents')renderDocuments(); if(view==='workflows')renderWorkflows(); window.scrollTo(0,0); }
function roadmap() { showModal(`<div class="eyebrow">THE ROADMAP</div><h2>Built for agency work.</h2><p class="modal-lead">What works in this local MVP, and what still needs a production integration.</p><div class="integration-list"><div class="integration-row"><span class="integration-icon">✦</span><div><strong>Proposal, brief, and kickoff pack</strong><small>Working now · generated from one client intake</small></div><span class="coming">READY</span></div><div class="integration-row"><span class="integration-icon">◎</span><div><strong>OpenAI-assisted writing</strong><small>Available when this app runs with its local server and API access</small></div><span class="coming">CLOUD WORKSPACE</span></div><div class="integration-row"><span class="integration-icon">↗</span><div><strong>Calendar, project tools, and team invitations</strong><small>OAuth connections and shared team roles are planned next.</small></div><span class="coming">NEXT</span></div><div class="integration-row"><span class="integration-icon">◇</span><div><strong>Billing, enterprise SSO, and compliance validation</strong><small>Require provider setup, operational controls, and independent review.</small></div><span class="coming">SETUP</span></div></div><div class="modal-actions"><button class="primary-button" id="roadmap-close">Got it</button></div>`); document.getElementById('roadmap-close').onclick=closeModal; }

document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.view));
document.getElementById('new-document').onclick=()=>openIntake(); document.getElementById('new-document-list').onclick=()=>openIntake();
document.getElementById('start-workflow').onclick=()=>openIntake();
document.getElementById('explore-templates').onclick=()=>document.getElementById('template-grid').scrollIntoView({behavior:'smooth'});
document.getElementById('all-templates').onclick=()=>openIntake(); document.getElementById('view-documents').onclick=()=>navigate('documents'); document.getElementById('view-workflows').onclick=()=>navigate('workflows');
['integrations-link','integrations-link-top','integrations-link-foot','integrations-link-work'].forEach(id=>document.getElementById(id).onclick=roadmap);
document.getElementById('modal-close').onclick=closeModal; document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal();}; document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
document.getElementById('billing-link').onclick=()=>location.assign('/billing');
document.getElementById('theme-toggle').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;document.getElementById('theme-toggle').textContent=state.theme==='dark'?'☀':'☾';saveState();};
document.getElementById('share-app').onclick=()=>{
  const link=location.origin;
  showModal(`<div class="eyebrow">SHARE FLOWFORGE</div><h2>Invite someone to FlowForge</h2><p class="modal-lead">Share this secure sign-in link. Each person creates their own account and private workspace.</p><div class="phone-url-list"><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a></div><button class="secondary-button copy-invite" id="copy-app-link">Copy sign-in link</button><p class="phone-footnote">This link opens the hosted app. It does not grant access to your workspace documents.</p><div class="modal-actions"><button class="primary-button" id="share-close">Done</button></div>`);
  document.getElementById('copy-app-link').onclick=async()=>{try{await navigator.clipboard.writeText(link);notify('FlowForge sign-in link copied.');}catch{notify('Select and copy the sign-in link above.');}};
  document.getElementById('share-close').onclick=closeModal;
};document.getElementById('sign-out').onclick=async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});window.location.assign('/login');};
document.getElementById('document-search').addEventListener('input',renderDocuments); document.getElementById('document-filter').addEventListener('change',renderDocuments);
document.getElementById('date-line').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
function offerLocalImport(localState){
  if(!cloudEnabled||state.docs.length||state.workflows.length||(!localState.docs?.length&&!localState.workflows?.length))return;
  showModal(`<div class="eyebrow">LOCAL DRAFTS FOUND</div><h2>Import this device’s drafts?</h2><p class="modal-lead">${localState.docs.length} document(s) and ${localState.workflows.length} workflow(s) are saved in this browser. Importing uploads them to your private FlowForge workspace.</p><p class="phone-footnote">Only import if your organization approves storing this information in the hosted workspace. Your original browser copy remains available on this device.</p><div class="modal-actions"><button class="secondary-button" id="skip-local-import">Not now</button><button class="primary-button" id="import-local-drafts">Import drafts</button></div>`);
  document.getElementById('skip-local-import').onclick=closeModal;
  document.getElementById('import-local-drafts').onclick=async()=>{state.docs=[...localState.docs];state.workflows=[...localState.workflows];const ok=await saveState();if(ok){renderDocuments();renderWorkflows();closeModal();notify('Drafts imported to your private workspace.');}else notify('Import did not finish. Please retry.');};
}
async function initializeApp(){
  const shell=document.querySelector('.app-shell');
  const response=await fetch('/api/session',{credentials:'same-origin'});
  if(!response.ok)throw new Error('Could not check your sign-in. Refresh the page to try again.');
  const session=await response.json();cloudEnabled=Boolean(session.authRequired);
  document.getElementById('share-app').classList.toggle('hidden',!cloudEnabled);
  document.getElementById('billing-link').classList.toggle('hidden',!cloudEnabled);
  if(cloudEnabled){
    if(!session.authenticated){location.replace('/login');return;}
    const billingResponse=await fetch('/api/billing/status',{credentials:'same-origin'});
    const billing=await billingResponse.json().catch(()=>({}));
    if(billing.required&&!billing.entitled){location.replace('/billing');return;}
    signedInUser=session.user;
    const workspaceName=session.user.workspaceName||`${session.user.email?.split('@')[0]||'My'} workspace`;
    document.getElementById('workspace-name').textContent=workspaceName;
    document.getElementById('account-label').textContent=session.user.email||'Private workspace';
    document.getElementById('account-name').textContent=session.user.email||'Your account';
    document.getElementById('account-avatar').textContent=(session.user.email||'FF').slice(0,2).toUpperCase();
    let cloudTheme='dark';try{cloudTheme=JSON.parse(localStorage.getItem(cloudUiKey)||'{}').theme||'dark';}catch{}
    const dataResponse=await fetch('/api/data',{credentials:'same-origin'});
    if(!dataResponse.ok)throw new Error('Could not load your private workspace. Check the database setup and refresh.');
    const data=await dataResponse.json();state={docs:data.documents||[],workflows:data.workflows||[],theme:['dark','light'].includes(cloudTheme)?cloudTheme:'dark'};
  }else{
    document.getElementById('account-label').textContent='Local demo';
    document.getElementById('account-role').textContent='Local demo';
  }
  document.documentElement.dataset.theme=state.theme;
  document.getElementById('theme-toggle').textContent=state.theme==='dark'?'☀':'☾';
  renderTemplates();renderDocuments();renderWorkflows();await refreshAiStatus();shell.classList.add('ready');
  if(cloudEnabled)offerLocalImport(legacyState);
}
initializeApp().catch(error=>{document.querySelector('.app-shell').classList.add('ready');notify(error.message||'Could not start FlowForge.');});
