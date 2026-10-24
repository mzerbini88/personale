const form=document.querySelector('#wizard');
const screens=[...document.querySelectorAll('.screen')];
const error=document.querySelector('#error');
const next=document.querySelector('#next');
const backButton=document.querySelector('#back');
const selected={front:null,back:null,selfieFrontDoc:null,selfieBackDoc:null,selfieNoDoc:null};
let step=0;
const field=k=>form.querySelector('[name="'+k+'"]');
const kinds=['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc'];
function show(){
  screens.forEach((s,i)=>s.classList.toggle('active',i===step));
  document.querySelector('#bar').style.width=Math.min(100,((step+1)/8)*100)+'%';
  document.querySelector('#stepText').textContent=step===7?'Operazione conclusa':`Passaggio ${Math.min(step+1,7)} di 7`;
  backButton.classList.toggle('hidden',step===0||step===7);
  next.style.display=step===7?'none':'block';
  next.textContent=step===6?'Invia in modo sicuro':'Continua →';
  error.textContent='';
  window.scrollTo(0,0);
}
for(const kind of kinds){
  for(const input of document.querySelectorAll('input[data-kind="'+kind+'"]')){
    input.addEventListener('change',()=>{
      const file=input.files&&input.files[0];if(!file)return;
      if(selected[kind]?.url)URL.revokeObjectURL(selected[kind].url);
      selected[kind]={file,url:URL.createObjectURL(file)};
      const img=input.closest('.screen').querySelector('.preview');
      img.src=selected[kind].url;img.classList.add('visible');
      document.querySelector('#'+kind+'Selected').textContent='Foto selezionata: '+file.name;
      error.textContent='';
    });
  }
}
backButton.addEventListener('click',()=>{step=Math.max(0,step-1);show()});
next.addEventListener('click',async()=>{
  error.textContent='';
  if(step===0){
    for(const k of ['name','surname','phone','address','iban','accountHolder'])if(!field(k).reportValidity())return;
    const iban=field('iban').value.toUpperCase().replace(/\s/g,'');
    if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)){error.textContent='Controlla il formato IBAN.';return}
    field('iban').value=iban;
  }else if(step>=1&&step<=5){
    const kind=kinds[step-1],file=selected[kind]?.file;
    if(!file){error.textContent='Scatta una foto o selezionala dalla galleria.';return}
    if(file.size>8*1024*1024){error.textContent='La foto supera 8 MB: scegline una più piccola.';return}
  }else if(step===6){
    if(!field('consent').checked){error.textContent='Conferma di aver letto l’informativa privacy.';return}
    next.disabled=true;next.textContent='Invio in corso…';
    try{
      const data=new FormData();
      for(const k of ['name','surname','phone','address','iban','accountHolder'])data.append(k,field(k).value.trim());
      for(const kind of kinds)data.append(kind,selected[kind].file,selected[kind].file.name);
      data.append('consent','yes');
      const r=await fetch('/api/submit',{method:'POST',body:data});
      const result=await r.json();if(!r.ok)throw Error(result.error||'Errore durante il caricamento');
      document.querySelector('#reference').textContent='Codice ricevuta: '+result.id;
      step=7;show();
    }catch(e){error.textContent=e.message||'Invio non riuscito'}
    finally{next.disabled=false;next.textContent='Invia in modo sicuro'}
    return;
  }
  step++;
  if(step===6){
    const summary=document.querySelector('#summary');summary.replaceChildren();
    const section=(title)=>{const box=document.createElement('div');box.className='summary-card';const h=document.createElement('h3');h.textContent=title;box.append(h);summary.append(box);return box};
    const personal=section('👤 Dati personali');
    for(const [label,k] of [['Nome','name'],['Cognome','surname'],['Telefono','phone'],['Residenza','address'],['IBAN','iban'],['Intestatario IBAN','accountHolder']]){
      const line=document.createElement('div');line.className='summary-row';
      const a=document.createElement('span');a.textContent=label;
      const b=document.createElement('strong');b.textContent=field(k).value;
      line.append(a,b);personal.append(line);
    }
    const images=section('📸 Foto selezionate');
    const labels={front:'Documento fronte',back:'Documento retro',selfieFrontDoc:'Selfie con documento fronte',selfieBackDoc:'Selfie con documento retro',selfieNoDoc:'Selfie senza documento'};
    const thumbs=document.createElement('div');thumbs.className='summary-photos';
    for(const kind of kinds){const item=document.createElement('div');item.className='summary-photo';const img=document.createElement('img');img.src=selected[kind].url;img.alt=labels[kind];const label=document.createElement('span');label.textContent=labels[kind];item.append(img,label);thumbs.append(item)}images.append(thumbs);
  }
  show();
});
show();
