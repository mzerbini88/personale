const token=document.querySelector('#token');
const list=document.querySelector('#list');
const message=document.querySelector('#message');
let urls=[];
const keys=['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc'];
const captions=['Documento fronte','Documento retro','Selfie con fronte','Selfie con retro','Selfie senza documento'];
const headers=()=>({'x-admin-token':token.value});
function elem(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function clear(){urls.forEach(URL.revokeObjectURL);urls=[];list.replaceChildren();}
function statusLabel(s){return ({pending:'Da verificare',validated:'Convalidato',rejected:'Respinto'})[s]||'Da verificare'}
async function addPhoto(id,k,label,parent){
  const box=elem('div',undefined,'photo');box.append(elem('div',label));parent.append(box);
  try{const r=await fetch(`/api/admin/file/${id}/${k}`,{headers:headers(),cache:'no-store'});if(!r.ok)throw Error('Foto mancante ('+r.status+')');
    const url=URL.createObjectURL(await r.blob());urls.push(url);
    const img=elem('img');img.src=url;img.alt=label;img.title='Apri immagine';img.addEventListener('click',()=>window.open(url,'_blank','noopener'));box.prepend(img);
  }catch(e){box.append(elem('div',e.message,'missing'));}
}
async function review(row,status,reason,detail,badge){
  if(!confirm(status==='validated'?'Convalidare e inviare una email?':'Respingere e inviare il motivo via email?'))return;
  message.textContent='Invio comunicazione in corso…';
  try{const r=await fetch('/api/admin/review/'+row.id,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({status,reason})});
    const out=await r.json();if(!r.ok)throw Error(out.error||'Errore');
    row.status=status;row.reviewReason=reason;row.notificationStatus=out.notificationStatus;
    badge.textContent=statusLabel(status);badge.className='status '+status;
    detail.querySelectorAll('[data-decision]').forEach(b=>b.disabled=true);
    detail.append(elem('p','Esito salvato. Email accettata dal server di posta.','status validated'));
    message.textContent='Esito registrato e comunicazione inviata al servizio email.';
  }catch(e){message.textContent='Operazione non completata: '+e.message;}
}
async function renderRow(row){
  const tr=elem('tr');const details=elem('tr',undefined,'detail');
  tr.append(elem('td',new Date(row.createdAt).toLocaleString('it-IT')),elem('td',row.name+' '+row.surname),elem('td',row.email||'—'));
  const badge=elem('span',statusLabel(row.status),'status '+(row.status||'pending'));const statusTd=elem('td');statusTd.append(badge);tr.append(statusTd);
  const toggle=elem('button','Apri','secondary');toggle.type='button';const last=elem('td');last.append(toggle);tr.append(last);
  const inner=elem('div',undefined,'detail-inner');const cell=elem('td');cell.colSpan=5;cell.append(inner);details.append(cell);
  toggle.addEventListener('click',async()=>{
    const open=details.classList.toggle('open');toggle.textContent=open?'Chiudi':'Apri';
    if(!open||inner.dataset.loaded)return;inner.dataset.loaded='true';
    const fields=elem('div',undefined,'fields');for(const [label,k] of [['Codice','id'],['Nome','name'],['Cognome','surname'],['Email','email'],['Telefono','phone'],['Residenza','address'],['IBAN','iban'],['Intestatario','accountHolder'],['Motivo esito','reviewReason'],['Email esito','notificationStatus']]){
      const box=elem('div',undefined,'field');box.append(elem('small',label),elem('strong',String(row[k]||'—')));fields.append(box);
    }inner.append(fields);
    inner.append(elem('h3','Fotografie (5)'));
    const photos=elem('div',undefined,'photos');inner.append(photos);
    await Promise.all(keys.map((k,i)=>addPhoto(row.id,k,captions[i],photos)));
    if(!row.email){inner.append(elem('p','Questa pratica non ha un indirizzo email: non è possibile inviare automaticamente l’esito.','warn'));return;}
    if(row.status==='validated'||row.status==='rejected')return;
    inner.append(elem('h3','Esito verifica'));
    const reason=elem('textarea',undefined,'reason');reason.placeholder='Motivo del rifiuto: cosa deve correggere l’utente?';reason.maxLength=1000;
    inner.append(reason);
    const decision=elem('div',undefined,'decision');
    const approve=elem('button','✓ Convalida');approve.dataset.decision='true';approve.addEventListener('click',()=>review(row,'validated','',inner,badge));
    const reject=elem('button','✕ Respingi e invia motivo','reject');reject.dataset.decision='true';reject.addEventListener('click',()=>{if(reason.value.trim().length<5){message.textContent='Scrivi il motivo del rifiuto (almeno 5 caratteri).';return;}review(row,'rejected',reason.value.trim(),inner,badge)});
    const del=elem('button','Elimina','secondary');del.addEventListener('click',async()=>{if(!confirm('Eliminare questa pratica definitivamente?'))return;const r=await fetch('/api/admin/record/'+row.id,{method:'DELETE',headers:headers()});if(r.ok){tr.remove();details.remove();}else message.textContent='Eliminazione non riuscita';});
    decision.append(approve,reject,del);inner.append(decision);
  });
  list.append(tr,details);
}
document.querySelector('#load').addEventListener('click',async()=>{
  clear();message.textContent='Caricamento…';
  try{const r=await fetch('/api/admin/list',{headers:headers(),cache:'no-store'});if(!r.ok)throw Error('Token errato o accesso negato');const rows=await r.json();
    for(const row of rows)await renderRow(row);message.textContent=`${rows.length} acquisizioni trovate`;
  }catch(e){message.textContent=e.message;}
});
