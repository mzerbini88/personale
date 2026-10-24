# Raccolta documenti – web app guidata

Flusso: nome e cognome → fronte documento → retro documento → selfie → consenso → invio.

## Installazione
1. Installa Node.js 20+.
2. Nella cartella del progetto esegui `npm install`.
3. Copia `.env.example` in `.env`.
4. Genera una chiave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e inseriscila in `ENCRYPTION_KEY_HEX`.
5. Imposta `ADMIN_TOKEN` a una password lunga casuale (almeno 24 caratteri).
6. Avvia `npm start`. Apri `http://localhost:3000`.
7. Archivio gestore: `http://localhost:3000/admin`. Per produzione, usare solo HTTPS.

I file sono memorizzati esclusivamente nella cartella `data/`, fuori dal sito pubblico, cifrati con AES-256-GCM. Nessun documento viene allegato a email. Per notifiche via email configura SMTP_* e NOTIFY_EMAIL.

## Prima di pubblicare
- Pubblica sotto HTTPS con hosting persistente e backup protetti; non usare hosting statico o filesystem effimero.
- Imposta informativa privacy reale, titolare, finalità, base giuridica e tempi di conservazione; questa demo include solo testo generico e checkbox, **non** un'informativa GDPR completa.
- Configura accessi limitati, logging senza dati sensibili e credenziali segrete; per uso professionale adotta un provider KYC/privacy specializzato e verifica requisiti normativi.
- Comunica il link solo a persone che devono legittimamente inviare i propri documenti, senza raccoglierne più del necessario.
- La cancellazione automatica dei file avviene dopo `RETENTION_DAYS` giorni, predefinito 7 (alla partenza e ogni sei ore). Conserva al sicuro la chiave: perderla rende illeggibili i file.
- Nessuna verifica dell'autenticità dei documenti o del selfie è eseguita. Non è una verifica d'identità certificata.
