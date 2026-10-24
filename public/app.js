const form=document.querySelector('#wizard');
const screens=[...document.querySelectorAll('.screen')];
const error=document.querySelector('#error');
const next=document.querySelector('#next');
const backButton=document.querySelector('#back');
const selected={front:null,back:null,selfie:null};
let step=0;
const field=k=>form.querySelector('[name="'+k+'"]');
const kinds=['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc'];
function show(){
  screens.forEach((s,i)=>s.classList.toggle('active',i===step));
  document.querySelector('#bar').style.width=Math.min(100,(step+1)*20)+'%';
  document.querySelector('#stepText').textContent=step===5?'Operazione conclusa':`Passaggio ${step+1} di 5`;
  backButton.classList.toggle('hidden',step===0||step===5);
  next.style.display=step===5?'none':'block';
  next.textContent=step===4?'Invia in modo sicuro':'Continua →';
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
  }else if(step>=1&&step<=3){
    const kind=kinds[step-1],file=selected[kind]?.file;
    if(!file){error.textContent='Scatta una foto o selezionala dalla galleria.';return}
    if(file.size>8*1024*1024){error.textContent='La foto supera 8 MB: scegline una più piccola.';return}
  }else if(step===4){
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
      step=5;show();
    }catch(e){error.textContent=e.message||'Invio non riuscito'}
    finally{next.disabled=false;next.textContent='Invia in modo sicuro'}
    return;
  }
  step++;
  if(step===4)document.querySelector('#summary').textContent=`${field('name').value} ${field('surname').value} · ${field('phone').value} · ${field('address').value} · IBAN ${field('iban').value} (${field('accountHolder').value}) · 3 immagini pronte`;
  show();
});
show();
