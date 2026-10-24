# Raccolta Documenti V4 — demo

Aggiornamenti: email nel wizard e riepilogo, archivio con acquisizioni in tabella e dettagli espandibili, visualizzazione esplicita delle 5 foto (inclusi errori per foto assenti), convalida/respingi con motivo, email automatica tramite SMTP.

## Installazione / aggiornamento GitHub
Carica i file in radice del repository che Render usa (Root Directory vuota):
- server.js
- private-admin.html
- public/index.html
- public/app.js
- public/admin.js
- public/style.css

package.json non cambia rispetto alla V3. Per test locale: `npm install && npm start` con variabili ENCRYPTION_KEY_HEX e ADMIN_TOKEN.

## Configurazione mail su Render → Environment
Variabili richieste per notificare convalida/rifiuto:
- SMTP_HOST: hostname SMTP del provider
- SMTP_PORT: normalmente 465 o 587
- SMTP_SECURE: true per connessione TLS implicita (generalmente porta 465); false per STARTTLS (generalmente 587)
- SMTP_USER: account SMTP
- SMTP_PASSWORD: credenziale SMTP
- SMTP_FROM: mittente email autorizzato per l'account SMTP

Le mail non allegano documenti o IBAN. Il pulsante non segna la pratica come convalidata/respinta se l'invio SMTP fallisce. L'accettazione SMTP non assicura la consegna in inbox. Configurare SPF/DKIM/DMARC presso il provider. Alcuni hosting bloccano porte SMTP in uscita, nel qual caso occorre passare a provider email API HTTPS.

## Dati già caricati
I record di V3 non hanno il campo email, quindi non possono ricevere un esito automatico. Se un'immagine manca, l'admin lo segnala invece di nasconderla. Non è possibile ricostruire una foto assente da un invio precedente.

## Uso reale
Non caricare dati/documenti reali nella demo. Render gratuito ha filesystem effimero: aggiungere database e storage cifrato persistenti, backup e autorizzazione amministrativa adeguata, protezione contro abuso e gestione privacy prima dell'uso reale. Rigenera le credenziali già condivise pubblicamente; la rotazione della chiave invalida la decifratura dei file vecchi se non migrati prima. Predisporre informativa privacy chiara, base giuridica, retention coerente e contatto del titolare; non usare finalità di riconoscimento biometrico senza valutazione specifica.
