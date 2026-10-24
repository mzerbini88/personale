import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const key = Buffer.from(process.env.ENCRYPTION_KEY_HEX || '', 'hex');
const adminToken = process.env.ADMIN_TOKEN || '';
if (key.length !== 32 || adminToken.length < 24) {
  console.error('Configura ENCRYPTION_KEY_HEX (64 caratteri hex) e ADMIN_TOKEN (minimo 24 caratteri) in .env');
  process.exit(1);
}
await fs.mkdir(dataDir,{recursive:true,mode:0o700});
const app = express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'blob:','data:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
app.use(express.static(path.join(root,'public')));
app.use('/api', rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false}));
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:5,fields:10,parts:17},fileFilter(_req,file,cb){if(!['image/jpeg','image/png','image/webp'].includes(file.mimetype))return cb(new Error('Sono ammesse solo immagini JPG, PNG o WebP.'));cb(null,true)}});
function encrypted(buffer){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const content=Buffer.concat([cipher.update(buffer),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),content]);}
function decrypted(buffer){const iv=buffer.subarray(0,12);const tag=buffer.subarray(12,28);const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]);}
function safeName(s){return String(s||'').trim().replace(/\s+/g,' ').slice(0,90)}
async function notify(id,name){if(!process.env.NOTIFY_EMAIL||!process.env.SMTP_HOST)return;const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:process.env.NOTIFY_EMAIL,subject:'Nuova acquisizione documenti',text:`Nuova acquisizione: ${name}\nCodice: ${id}\nAccedi al pannello riservato via HTTPS per visualizzarla.\nNessun documento è allegato.`});}
app.post('/api/submit',upload.fields([{name:'front',maxCount:1},{name:'back',maxCount:1},{name:'selfieFrontDoc',maxCount:1},{name:'selfieBackDoc',maxCount:1},{name:'selfieNoDoc',maxCount:1}]),async(req,res)=>{
  const name=safeName(req.body.name),surname=safeName(req.body.surname);
  const email=String(req.body.email||'').trim().toLowerCase();
  const phone=safeName(req.body.phone),address=String(req.body.address||'').trim().slice(0,240);
  const iban=String(req.body.iban||'').toUpperCase().replace(/\s/g,'');
  const accountHolder=safeName(req.body.accountHolder).slice(0,120);
  if(!name||!surname||name.length<2||surname.length<2||!req.body.consent||req.body.consent!=='yes')return res.status(400).json({error:'Inserisci nome, cognome e consenso.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({error:'Inserisci una email valida.'});
  if(!/^[+0-9() .-]{6,25}$/.test(phone)||address.length<8||!accountHolder||accountHolder.length<3||!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban))return res.status(400).json({error:'Verifica telefono, indirizzo, IBAN e intestatario.'});
  if(!['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc'].every(k=>req.files?.[k]?.length===1))return res.status(400).json({error:'Carica tutte e cinque le immagini.'});
  const id=crypto.randomUUID();const dir=path.join(dataDir,id);
  try{
    await fs.mkdir(dir,{mode:0o700});
    await fs.writeFile(path.join(dir,'details.enc'),encrypted(Buffer.from(JSON.stringify({id,name,surname,email,phone,address,iban,accountHolder,createdAt:new Date().toISOString(),consent:true,status:"pending",reviewReason:"",reviewedAt:null,notificationStatus:"not_sent"}))),{mode:0o600});
    for(const k of ['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc']){
      const f=req.files[k][0];
      // Controlli di firma dei file: non affidarsi soltanto al tipo dichiarato dal browser.
      const b=f.buffer;const jpg=b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;const png=b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));const webp=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
      if(!jpg&&!png&&!webp)throw new Error('Uno dei file non è un’immagine valida.');
      await fs.writeFile(path.join(dir,k+'.enc'),encrypted(b),{mode:0o600});
      await fs.writeFile(path.join(dir,k+'.type'),jpg?'image/jpeg':png?'image/png':'image/webp',{mode:0o600});
    }
    notify(id,name+' '+surname).catch(e=>console.error('Notifica non inviata:',e.message));
    res.status(201).json({ok:true,id});
  }catch(e){await fs.rm(dir,{recursive:true,force:true});res.status(400).json({error:e.message||'Errore di salvataggio'});}
});
function admin(req,res,next){const presented=req.get('x-admin-token')||'';if(!presented||Buffer.byteLength(presented)!==Buffer.byteLength(adminToken)||!crypto.timingSafeEqual(Buffer.from(presented),Buffer.from(adminToken)))return res.status(401).json({error:'Accesso non autorizzato'});next();}
app.get('/admin',(_req,res)=>res.sendFile(path.join(root,'private-admin.html')));
app.get('/api/admin/list',admin,async(_req,res)=>{const ids=(await fs.readdir(dataDir,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name);const rows=[];for(const id of ids){try{const raw=await fs.readFile(path.join(dataDir,id,'details.enc'));rows.push(JSON.parse(decrypted(raw).toString()))}catch{}}res.json(rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));});
app.get('/api/admin/file/:id/:kind',admin,async(req,res)=>{if(!/^[a-f0-9-]{36}$/.test(req.params.id)||!['front','back','selfieFrontDoc','selfieBackDoc','selfieNoDoc'].includes(req.params.kind))return res.sendStatus(400);try{const dir=path.join(dataDir,req.params.id);const b=await fs.readFile(path.join(dir,req.params.kind+'.enc'));const type=await fs.readFile(path.join(dir,req.params.kind+'.type'),'utf8');res.set('Content-Type',type);res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.send(decrypted(b));}catch{res.sendStatus(404)}});

// La notifica contiene esclusivamente esito, eventuale motivo e codice pratica.
const smtpReady=()=>Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD);
async function sendDecisionEmail(details,status,reason){
  if(!smtpReady())throw new Error('Email non configurata: imposta SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD e SMTP_FROM su Render.');
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});
  const accepted=status==='validated';
  const body=accepted
    ? `La tua richiesta con codice ${details.id} è stata convalidata.\n\nQuesta comunicazione non contiene documenti personali.`
    : `La tua richiesta con codice ${details.id} è stata respinta.\nMotivo: ${reason}\n\nPer correggere la richiesta, contatta il soggetto che ti ha fornito il link.`;
  await transporter.sendMail({from:process.env.SMTP_FROM,to:details.email,subject:accepted?'Richiesta convalidata':'Richiesta da correggere',text:body});
}
app.post('/api/admin/review/:id',admin,express.json({limit:'12kb'}),async(req,res)=>{
  const id=req.params.id;
  if(!/^[a-f0-9-]{36}$/.test(id))return res.status(400).json({error:'ID non valido'});
  const status=req.body?.status,reason=String(req.body?.reason||'').trim().slice(0,1000);
  if(!['validated','rejected'].includes(status))return res.status(400).json({error:'Esito non valido'});
  if(status==='rejected'&&reason.length<5)return res.status(400).json({error:'Indica il motivo del rifiuto (almeno 5 caratteri).'});
  const detailsPath=path.join(dataDir,id,'details.enc');
  let details;
  try{details=JSON.parse(decrypted(await fs.readFile(detailsPath)).toString());}
  catch{return res.status(404).json({error:'Pratica non trovata'});}
  if(!details.email)return res.status(400).json({error:'Questa pratica non contiene una email: impossibile inviare comunicazioni automatiche.'});
  if(details.status==='validated'||details.status==='rejected')return res.status(409).json({error:'Questa pratica è già stata esaminata.'});
  // La pratica cambia stato solo quando la mail è stata accettata dal server SMTP.
  try{await sendDecisionEmail(details,status,reason);}catch(e){console.error('Invio esito fallito:',e.message);return res.status(502).json({error:'Email non inviata: '+e.message});}
  details.status=status;
  details.reviewReason=status==='rejected'?reason:'';
  details.reviewedAt=new Date().toISOString();
  details.notificationStatus='sent';
  try{await fs.writeFile(detailsPath,encrypted(Buffer.from(JSON.stringify(details))),{mode:0o600});}
  catch(e){console.error('Esito inviato ma salvataggio fallito',id,e);return res.status(500).json({error:'Email inviata ma impossibile salvare lo stato: verifica prima di riprovare.'});}
  res.json({ok:true,status,notificationStatus:'sent'});
});
app.delete('/api/admin/record/:id',admin,async(req,res)=>{if(!/^[a-f0-9-]{36}$/.test(req.params.id))return res.sendStatus(400);await fs.rm(path.join(dataDir,req.params.id),{recursive:true,force:true});res.json({ok:true})});
app.use((err,_req,res,_next)=>res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Ogni foto deve essere inferiore a 8 MB.':err.message||'Richiesta non valida'}));
const retentionDays=Math.max(1,Number(process.env.RETENTION_DAYS)||7);
async function purge(){for(const e of await fs.readdir(dataDir,{withFileTypes:true})){if(!e.isDirectory())continue;try{const p=path.join(dataDir,e.name);const s=await fs.stat(p);if(Date.now()-s.birthtimeMs>retentionDays*86400000)await fs.rm(p,{recursive:true,force:true})}catch{}}}
await purge();setInterval(()=>purge().catch(console.error),6*3600*1000).unref();
app.listen(Number(process.env.PORT)||3000,()=>console.log('Web app disponibile su http://localhost:'+(process.env.PORT||3000)));
