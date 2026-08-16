const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const posLabel = v => ({'-2':'Tar helt avstånd','-1':'Tar delvis avstånd','0':'Neutral / varken eller','1':'Instämmer delvis','2':'Instämmer helt'})[String(v)] ?? 'Okänd';
const impLabel = v => ({0:'Spelar ingen roll',1:'Ganska oviktig',2:'Viktig',3:'Mycket viktig',4:'Mycket viktig+',5:'Avgörande'})[v] ?? v;
const state={answers:{}, index:0, detailParty:null};
const [questions,parties,positions,meta]=await Promise.all(['questions','parties','positions','meta'].map(n=>fetch(`data/${n}.json`).then(r=>r.json())));
const byQ=Object.fromEntries(questions.map(q=>[q.id,q]));
const byP=Object.fromEntries(parties.map(p=>[p.id,p]));
const posMap=new Map(positions.map(p=>[`${p.party}:${p.question}`,p]));
$('#build-meta').textContent=`Dataset ${meta.datasetVersion} · verifierat t.o.m. ${meta.verifiedThrough}`;

function route(){
  const hash=location.hash||'#/';
  if(hash.startsWith('#/compass')) renderCompass();
  else if(hash.startsWith('#/results')) renderResults();
  else if(hash.startsWith('#/party/')) renderParty(hash.split('/')[2]);
  else if(hash.startsWith('#/audit')) renderAudit();
  else if(hash.startsWith('#/method')) renderMethod();
  else renderHome();
  scrollTo(0,0);
}
window.addEventListener('hashchange',route);

function renderHome(){
  $('#app').innerHTML=`<section class="hero"><div class="eyebrow">Svenska riksdagsvalet 13 september 2026</div><h1>En valkompass du kan kontrollera själv.</h1><p class="lead">64 neutralt formulerade sakfrågor. Öppen poängmodell. Källor på varje kodad partiposition. Okänt betyder okänt — aldrig en AI-gissning.</p><div class="actions"><a class="button" href="#/compass">Starta valkompassen</a><a class="button secondary" href="#/audit">Granska datasetet</a></div></section>
  <section class="grid grid-3"><article class="card"><h3>Öppen algoritm</h3><p>Avståndet mellan ditt svar och partiets position räknas på skalan −2 till +2. Ingen dold bonus eller manuell korrigering används.</p></article><article class="card"><h3>Källor, inte antaganden</h3><p>Varje kodat svar kan öppnas och granskas. Saknas tillräckligt underlag markeras positionen som okänd.</p></article><article class="card"><h3>Två resultat</h3><p>Se både total likhet och prioritetsmatchning, där de frågor du själv värderar högst väger mest.</p></article></section>
  <section class="card" style="margin-top:1rem"><strong>Forskningsstatus:</strong> ${esc(meta.note)} Den här versionen innehåller hela webbappen och frågebanken, men källdatabasen är ännu inte komplett nog för skarp publicering.</section>`;
}

function renderCompass(){
  const q=questions[state.index]; const a=state.answers[q.id]||{answer:null,importance:2};
  $('#app').innerHTML=`<section><div class="question-head"><span>${esc(q.area)}</span><span>Fråga ${state.index+1} av ${questions.length}</span></div><div class="progress"><span style="width:${((state.index+1)/questions.length)*100}%"></span></div><article class="card" style="margin-top:1rem"><span class="pill">${esc(q.area)}</span><h2>${esc(q.text)}</h2><div class="answer-grid">${[-2,-1,0,1,2].map(v=>`<button class="choice ${a.answer===v?'active':''}" data-answer="${v}">${posLabel(v)}</button>`).join('')}</div><hr style="border:0;border-top:1px solid var(--line);margin:1.3rem 0"><h3>Hur viktig är frågan för dig?</h3><div class="importance"><input id="importance" type="range" min="0" max="5" step="1" value="${a.importance}"><strong id="importance-label">${a.importance} · ${impLabel(a.importance)}</strong></div></article><div class="sticky-actions actions"><button class="button secondary" id="prev" ${state.index===0?'disabled':''}>Föregående</button><button class="button" id="next">${state.index===questions.length-1?'Visa resultat':'Nästa'}</button></div></section>`;
  document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{state.answers[q.id]={answer:+b.dataset.answer,importance:+$('#importance').value};renderCompass()});
  $('#importance').oninput=e=>{$('#importance-label').textContent=`${e.target.value} · ${impLabel(+e.target.value)}`; if(a.answer!==null) state.answers[q.id]={answer:a.answer,importance:+e.target.value};};
  $('#prev').onclick=()=>{if(state.index>0){state.index--;renderCompass()}};
  $('#next').onclick=()=>{const cur=state.answers[q.id]; if(!cur||cur.answer===null){alert('Välj ett svar innan du går vidare.');return;} cur.importance=+$('#importance').value; if(state.index<questions.length-1){state.index++;renderCompass()}else location.hash='#/results';};
}

function partyScore(pid){
  let totalD=0,totalN=0,prioD=0,prioN=0,prioPossible=0,prioKnown=0,countAnswered=0,countKnown=0;
  const areas={};
  for(const q of questions){const a=state.answers[q.id]; if(!a||a.answer===null) continue; countAnswered++; const p=posMap.get(`${pid}:${q.id}`); const w=a.importance; prioPossible+=w;
    if(!p||p.position===null) continue; countKnown++; const d=Math.abs(a.answer-p.position); totalD+=d; totalN+=4; prioD+=w*d; prioN+=w*4; prioKnown+=w;
    const ar=areas[q.area]??={d:0,n:0}; ar.d+=w*d; ar.n+=w*4;
  }
  const total=totalN?100*(1-totalD/totalN):null;
  const priority=prioN?100*(1-prioD/prioN):total;
  const weightedCoverage=prioPossible?prioKnown/prioPossible:(countAnswered?countKnown/countAnswered:0);
  const countCoverage=countAnswered?countKnown/countAnswered:0;
  const areaScores=Object.fromEntries(Object.entries(areas).map(([k,v])=>[k,v.n?100*(1-v.d/v.n):null]));
  return {total,priority,weightedCoverage,countCoverage,areaScores};
}

function fmt(v){return v==null?'—':`${Math.round(v)} %`}
function renderResults(){
  if(Object.keys(state.answers).length<questions.length){location.hash='#/compass';return}
  const results=parties.map(p=>({party:p,...partyScore(p.id)})).sort((a,b)=>(b.priority??-1)-(a.priority??-1));
  const eligible=results.filter(r=>r.weightedCoverage>=meta.rankingCoverageThreshold);
  $('#app').innerHTML=`<section><div class="eyebrow">Ditt resultat</div><h1>Matchning med full insyn</h1><p class="lead">Total matchning väger alla besvarade frågor lika. Prioritetsmatchning använder dina egna viktningar. Källtäckning visar hur stor del av just dina viktade svar som har en verifierad partiposition.</p>${eligible.length===0?`<div class="callout"><strong>Datasetet är ännu inte publiceringsklart.</strong> Inget parti når ${(meta.rankingCoverageThreshold*100).toFixed(0)} % viktad källtäckning, därför visar vi inga vilseledande vinnare. När positionsdatabasen fylls på börjar samma kod automatiskt rangordna partierna.</div>`:''}<div class="card" style="margin-top:1rem">${results.map((r,i)=>`<div class="result-row"><div><strong>${i+1}. ${esc(r.party.name)}</strong><div class="muted">Källtäckning ${Math.round(r.weightedCoverage*100)} %</div></div><div><div class="muted">Prioritetsmatchning</div><div class="meter"><span style="width:${Math.max(0,r.priority||0)}%"></span></div><small>Total ${fmt(r.total)}</small></div><div><div class="score">${fmt(r.priority)}</div><a class="button small secondary" href="#/party/${r.party.id}">Detaljer</a></div></div>`).join('')}</div></section>`;
}

function renderParty(pid){
  const party=byP[pid]; if(!party){location.hash='#/results';return} const score=partyScore(pid);
  const rows=questions.map(q=>({q,a:state.answers[q.id],p:posMap.get(`${pid}:${q.id}`)})).filter(x=>x.a);
  const known=rows.filter(x=>x.p?.position!==null).sort((a,b)=>Math.abs(a.a.answer-a.p.position)-Math.abs(b.a.answer-b.p.position));
  const equal=known.filter(x=>Math.abs(x.a.answer-x.p.position)<=1); const diff=known.filter(x=>Math.abs(x.a.answer-x.p.position)>=2).reverse();
  $('#app').innerHTML=`<section><a href="#/results">← Till resultat</a><h1>${esc(party.name)}</h1><div class="grid grid-3"><div class="card"><div class="muted">Total matchning</div><div class="score">${fmt(score.total)}</div></div><div class="card"><div class="muted">Prioritetsmatchning</div><div class="score">${fmt(score.priority)}</div></div><div class="card"><div class="muted">Viktad källtäckning</div><div class="score">${Math.round(score.weightedCoverage*100)} %</div></div></div>
  <h2>Per politikområde</h2><div class="card area-bars">${Object.entries(score.areaScores).map(([a,v])=>`<div class="area-row"><span>${esc(a)}</span><div class="meter"><span style="width:${Math.max(0,v||0)}%"></span></div><strong>${fmt(v)}</strong></div>`).join('')||'<p class="muted">Inga verifierade positioner för dina svar ännu.</p>'}</div>
  <div class="grid grid-2" style="margin-top:1rem"><article class="card"><h2>Ni tycker lika</h2>${equal.length?equal.slice(0,12).map(sourceDetail).join(''):'<p class="muted">Ingen verifierad jämförelse ännu.</p>'}</article><article class="card"><h2>Ni tycker olika</h2>${diff.length?diff.slice(0,12).map(sourceDetail).join(''):'<p class="muted">Ingen verifierad tydlig konflikt ännu.</p>'}</article></div></section>`;
}
function sourceDetail(x){const p=x.p;return `<details><summary>${esc(x.q.text)}</summary><p><strong>Du:</strong> ${posLabel(x.a.answer)} · <strong>${esc(byP[p.party].short)}:</strong> ${posLabel(p.position)}</p><p>${esc(p.rationale)}</p>${p.source?`<p class="source"><a href="${esc(p.source)}" target="_blank" rel="noopener">Visa officiell källa ↗</a><br>${esc(p.sourceTitle||'')} · verifierad ${esc(p.verified)} · säkerhet ${esc(p.confidence)}</p>`:''}</details>`}

function renderAudit(){
  const known=positions.filter(p=>p.position!==null).length, total=positions.length;
  $('#app').innerHTML=`<section><div class="eyebrow">Transparens</div><h1>Granska kompassen</h1><p class="lead">Här finns frågorna, varje kodad partiposition, källan, verifieringsdatumet och osäkerhetsgraden. ${known} av ${total} möjliga parti–fråga-positioner är verifierade i denna forskningspreview.</p><div class="actions"><button class="button" id="json">Exportera JSON</button><button class="button secondary" id="csv">Exportera CSV</button></div><div class="table-wrap" style="margin-top:1rem"><table><thead><tr><th>Fråga</th><th>Område</th><th>Parti</th><th>Position</th><th>Säkerhet</th><th>Källa / motivering</th><th>Verifierad</th></tr></thead><tbody>${positions.map(p=>{const q=byQ[p.question],party=byP[p.party];return `<tr><td>${esc(q.text)}</td><td>${esc(q.area)}</td><td>${esc(party.name)}</td><td>${p.position===null?'<span class="unknown">Okänd</span>':`<span class="known">${esc(posLabel(p.position))}</span>`}</td><td>${esc(p.confidence)}</td><td>${p.source?`<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.sourceTitle||'Officiell källa')}</a><br>`:''}<span class="muted">${esc(p.rationale)}</span></td><td>${esc(p.verified)}</td></tr>`}).join('')}</tbody></table></div></section>`;
  $('#json').onclick=()=>download('valkompass-positions.json',JSON.stringify({meta,questions,parties,positions},null,2),'application/json');
  $('#csv').onclick=()=>{const header=['party','question','area','statement','position','confidence','source','sourceTitle','sourceDate','verified','rationale'];const csv=[header,...positions.map(p=>[byP[p.party].name,p.question,byQ[p.question].area,byQ[p.question].text,p.position??'',p.confidence,p.source??'',p.sourceTitle??'',p.sourceDate??'',p.verified,p.rationale])].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');download('valkompass-positions.csv',csv,'text/csv;charset=utf-8')};
}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

function renderMethod(){
  $('#app').innerHTML=`<section><div class="eyebrow">Metod</div><h1>Exakt så räknar kompassen</h1><div class="grid grid-2"><article class="card"><h2>Skalor</h2><p>Användarsvar och partiposition kodas −2, −1, 0, +1, +2. Avståndet för fråga <span class="mono">i</span> är <span class="mono">dᵢ = |uᵢ − pᵢ|</span>. Största möjliga avstånd är 4.</p><p>Vikt anges 0–5. Vikt 0 påverkar inte prioritetsmatchningen.</p></article><article class="card"><h2>Total matchning</h2><p class="mono">100 × (1 − Σ dᵢ / (4 × N))</p><p>Alla besvarade frågor med verifierad partiposition väger lika. <span class="mono">N</span> är antalet jämförbara frågor.</p></article><article class="card"><h2>Prioritetsmatchning</h2><p class="mono">100 × (1 − Σ wᵢdᵢ / (4 × Σ wᵢ))</p><p>Dina egna vikter <span class="mono">wᵢ</span> avgör hur mycket varje fråga betyder.</p></article><article class="card"><h2>Saknade positioner</h2><p>En okänd position tas inte med i täljare eller nämnare. Dessutom visas källtäckning separat. Full ranking kräver minst ${(meta.rankingCoverageThreshold*100).toFixed(0)} % viktad täckning.</p></article></div><h2>Frågebalans</h2><p>Frågebanken innehåller ${questions.length} frågor i ${new Set(questions.map(q=>q.area)).size} politikområden, fyra frågor per område. Partinamn visas inte under testet och inga löpande matchningsresultat visas.</p><h2>Källhierarki</h2><ol><li>Officiellt valmanifest eller partiprogram.</li><li>Partiets officiella webbplats.</li><li>Partiets egna svar i etablerade valkompasser.</li><li>Propositioner, motioner och voteringar.</li><li>Tydliga uttalanden från partiledning eller officiella företrädare.</li></ol><div class="callout"><strong>Ingen AI-positionering.</strong> Kodningen är en redaktionell datapost som måste bära sin egen källa, motivering, datum och osäkerhetsgrad. Om underlaget inte räcker sätts <span class="mono">position: null</span>.</div></section>`;
}
route();
