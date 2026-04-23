```{=latex}
\begin{titlepage}
\thispagestyle{empty}
\vspace*{0.24\textheight}
\begin{center}
{\setlength{\fboxsep}{16pt}\colorbox[HTML]{184F3D}{\textcolor{white}{\fontsize{20}{20}\selectfont\bfseries PP}}}

\vspace{1.2cm}
{\fontsize{30}{34}\selectfont\bfseries Pharma\par}
\vspace{0.15cm}
{\fontsize{30}{34}\selectfont\bfseries Plan\par}
\vspace{0.45cm}
{\Large TPZ Muhen\par}

\vfill
{\large Built by Speats\par}
\end{center}
\end{titlepage}
\newpage
```

Versione documento: 1.1  
Stato: bozza completa pronta per revisione finale  
Prodotto: Pharma Plan Pro  
Destinatari: utenti operativi e amministratori

---

## 1. Introduzione

Pharma Plan Pro e una piattaforma per la gestione del personale e della pianificazione operativa.  
Il sistema supporta le principali attivita quotidiane legate all'organizzazione dei turni, alla gestione delle assenze, alle richieste di copertura e al mantenimento dell'anagrafica del personale.

Le funzionalita principali comprendono:

- consultazione della dashboard operativa
- visualizzazione e gestione del calendario turni
- generazione della pianificazione mensile
- gestione dell'anagrafica dipendenti
- configurazione delle disponibilita ricorrenti
- registrazione delle assenze
- gestione delle richieste di copertura
- amministrazione dei corsi di formazione
- configurazione delle regole di copertura
- approvazione e gestione degli utenti

![Panoramica iniziale dell'applicazione](./screenshots/04-menu-dashboard.png){ width=95% }

### 1.1 Ruoli E Permessi

Le funzionalita disponibili dipendono dal profilo dell'utente.

- Gli utenti standard accedono alle sezioni consentite dal proprio account.
- Gli amministratori dispongono anche delle funzioni di configurazione, inserimento dati e gestione utenti.

Nel manuale, le funzioni riservate agli amministratori sono indicate esplicitamente nel testo.

---

## 2. Accesso Al Sistema

### 2.1 Login

Per accedere alla piattaforma:

1. aprire la pagina di accesso
2. inserire email e password
3. fare clic sul pulsante di login

![Pagina di login](./screenshots/01-login.png){ width=95% }

Nella schermata di accesso sono generalmente disponibili:

- campo email
- campo password
- pulsante di login
- collegamento alla registrazione
- selettore lingua

### 2.2 Registrazione

Se la registrazione e abilitata, un nuovo utente puo creare il proprio account compilando i campi richiesti.

Procedura tipica:

1. aprire la pagina di registrazione
2. inserire nome completo, email e password
3. confermare la creazione dell'account

![Pagina di registrazione](./screenshots/02-registrazione.png){ width=95% }

---

## 3. Panoramica Dell'Interfaccia

Dopo l'accesso, l'utente entra nell'interfaccia principale dell'applicazione.

![Applicazione con menu laterale visibile](./screenshots/04-menu-dashboard.png){ width=95% }

### 3.1 Struttura Della Schermata

L'interfaccia e composta da:

- un menu laterale con le sezioni disponibili
- un'area centrale che visualizza il contenuto della pagina attiva
- una sezione inferiore con informazioni sull'utente connesso
- il pulsante di logout
- il comando per il cambio lingua

### 3.2 Menu Di Navigazione

In base ai permessi del profilo, possono essere visibili le seguenti sezioni:

- Dashboard
- Turni
- Pianificazione
- Regole di copertura
- Dipendenti
- Disponibilita
- Assenze
- Richieste di copertura
- Formazione
- Gestione utenti

---

## 4. Dashboard

La dashboard rappresenta il punto di partenza operativo dell'applicazione.  
Permette di avere un quadro sintetico della situazione corrente senza entrare subito nel dettaglio delle singole sezioni.

![Dashboard completa](./screenshots/05-dashboard.png){ width=95% }

### 4.1 Informazioni Disponibili

La dashboard puo mostrare:

- il numero di dipendenti attivi
- il riepilogo delle assenze nel periodo
- il numero di turni registrati nella settimana corrente
- eventuali note pianificate del giorno
- indicatori di criticita o problemi di copertura

### 4.2 Utilizzo Consigliato

La dashboard e particolarmente utile per:

- controllare rapidamente la situazione del giorno o della settimana
- individuare anomalie prima di modificare il piano
- verificare la presenza di note operative da tenere in considerazione

---

## 5. Turni

La sezione **Turni** consente di visualizzare il calendario operativo del mese e, per gli amministratori, di intervenire manualmente sulle assegnazioni.

![Vista turni del mese](./screenshots/06-turni-mese.png){ width=95% }

### 5.1 Selezione Del Periodo

Nella parte superiore della schermata sono disponibili i controlli per:

- selezionare il mese
- selezionare l'anno
- generare il piano del mese, se non ancora presente
- cancellare il piano del mese, se necessario

### 5.2 Lettura Del Calendario

Ogni cella del calendario rappresenta una giornata.  
All'interno della giornata possono comparire:

- dipendenti assegnati
- badge relativi alla copertura
- indicatori di assenza
- note operative

Le giornate con criticita vengono evidenziate per facilitare l'individuazione dei problemi.

![Giornata con badge di copertura o criticita](./screenshots/07-turni-criticita.png){ width=95% }

### 5.3 Filtro Per Settimana

La schermata mette a disposizione un elenco di settimane `KW` per limitare la visualizzazione a una sola settimana del mese.

![Vista turni con filtro settimana attivo](./screenshots/08-turni-settimana.png){ width=95% }

Questa funzione e utile quando si desidera:

- concentrarsi su un intervallo ridotto
- verificare una settimana specifica
- semplificare il controllo delle assegnazioni

### 5.4 Assegnazione Manuale Dei Turni

Gli amministratori possono assegnare manualmente un dipendente trascinandolo dal pannello laterale verso una giornata del calendario.

![Pannello dipendenti con esempio di drag and drop](./screenshots/09-turni-drag-drop.png){ width=95% }

Procedura consigliata:

1. individuare il dipendente nel pannello laterale
2. trascinarlo sulla giornata desiderata
3. rilasciarlo all'interno della cella del giorno

Per rimuovere un turno, e possibile:

- usare il comando di eliminazione presente sulla singola assegnazione
- oppure trascinare l'assegnazione nell'area di rimozione prevista dalla schermata

### 5.5 Note E Indicatori Visivi

Nel calendario possono comparire differenti stati operativi, tra cui:

- turno generato automaticamente
- turno inserito manualmente
- turno coperto da sostituzione
- conflitto
- assenza del dipendente assegnato
- presenza di note pianificate o giornaliere

La corretta lettura di questi indicatori consente di capire immediatamente la qualita del piano e la natura di eventuali anomalie.

---

## 6. Pianificazione Mensile

La sezione **Pianificazione** fornisce una vista tabellare dettagliata del mese, pensata per il controllo puntuale delle assegnazioni giornaliere.

![Griglia completa della pianificazione mensile](./screenshots/10-pianificazione-griglia.png){ width=95% }

### 6.1 Struttura Della Griglia

Per ogni data, la tabella puo mostrare:

- assegnazione del singolo dipendente
- totale risorse presenti
- totale `Bediener`
- totale `PhA's`
- note pianificate ricorrenti
- note giornaliere specifiche

Questa vista e utile per controlli operativi, verifiche numeriche e confronto rapido tra giorni diversi.

### 6.2 Generazione Del Piano

Quando per il mese selezionato non esiste ancora una pianificazione generata, l'amministratore puo utilizzare il pulsante `Genera`.

![Pulsante genera nella pagina pianificazione](./screenshots/11-pianificazione-genera.png){ width=95% }

La generazione automatica tiene conto della configurazione disponibile nel sistema, inclusi dati di base, disponibilita, assenze e regole di copertura.

### 6.3 Cancellazione Del Piano

Se il piano deve essere ricreato, l'amministratore puo usare il comando `Cancella piano`.

![Finestra di conferma per cancellazione piano](./screenshots/12-pianificazione-cancella.png){ width=95% }

Questa operazione elimina le assegnazioni del mese selezionato e deve quindi essere eseguita solo quando necessario.

### 6.4 Gestione Delle Note Giornaliere

Per ogni giorno e possibile aprire il pannello di modifica della nota giornaliera.

![Finestra di modifica della nota giornaliera](./screenshots/13-pianificazione-nota.png){ width=95% }

Le note giornaliere possono essere usate per registrare:

- indicazioni organizzative
- promemoria interni
- eccezioni operative valide per una sola data

---

## 7. Gestione Dipendenti

La sezione **Dipendenti** e dedicata all'anagrafica del personale.

![Pagina dipendenti con form e tabella](./screenshots/14-dipendenti.png){ width=95% }

### 7.1 Inserimento Di Un Nuovo Dipendente

Nel form di inserimento sono disponibili i principali campi operativi:

- nome
- cognome
- codice visualizzato
- email
- telefono
- ruolo
- percentuale ore settimanali
- stato attivo o non attivo
- indicatore `Bediener`

Procedura:

1. compilare i campi richiesti
2. verificare i dati inseriti
3. confermare il salvataggio

### 7.2 Modifica Di Un Dipendente

Dalla tabella laterale e possibile aprire la modifica di un dipendente gia registrato.

Le modifiche piu frequenti riguardano:

- aggiornamento dati anagrafici
- aggiornamento contatti
- variazione del ruolo
- variazione della percentuale oraria
- attivazione o disattivazione del dipendente

### 7.3 Filtro Della Lista

La lista puo essere filtrata per visualizzare:

- solo dipendenti attivi
- tutti i dipendenti

Questa distinzione aiuta a mantenere lo storico senza compromettere la leggibilita operativa della schermata.

---

## 8. Disponibilita

La sezione **Disponibilita** consente di definire la disponibilita ricorrente del personale per ciascun giorno della settimana.

![Disponibilita standard](./screenshots/15-disponibilita-standard.png){ width=95% }

### 8.1 Disponibilita Standard

La scheda **standard** rappresenta il modello di disponibilita abituale del dipendente.

Per ogni dipendente e per ogni giorno della settimana e possibile:

- attivare la disponibilita
- disattivare la disponibilita

Questa impostazione costituisce la base di partenza della pianificazione.

### 8.2 Disponibilita Accessoria

La scheda **accessoria** permette di gestire disponibilita aggiuntive rispetto a quelle standard.

![Disponibilita accessoria](./screenshots/16-disponibilita-accessoria.png){ width=95% }

Questa sezione e utile quando:

- un dipendente puo coprire giorni extra
- si vogliono gestire eccezioni ricorrenti
- si desidera modellare scenari di supporto o rinforzo

### 8.3 Note Speciali Sulla Disponibilita

Per una disponibilita attiva e possibile aggiungere una nota specifica.

![Disponibilita con nota aperta o gia salvata](./screenshots/17-disponibilita-nota.png){ width=95% }

Le note possono essere utilizzate per descrivere:

- limitazioni
- preferenze
- condizioni particolari associate a quel giorno

---

## 9. Assenze

La sezione **Assenze** permette di registrare e monitorare tutte le indisponibilita del personale.

![Pagina assenze con form di inserimento e tabella riepilogativa](./screenshots/18-assenze-form-tabella.png){ width=95% }

### 9.1 Inserimento Di Una Nuova Assenza

Per registrare un'assenza occorre:

1. selezionare il dipendente
2. inserire data di inizio e data di fine
3. scegliere il motivo
4. impostare lo stato
5. salvare la registrazione

### 9.2 Tipologie Gestite

Tra le tipologie piu comuni rientrano:

- vacanza
- non disponibile
- malattia
- scuola
- formazione
- riunione HR

### 9.3 Consultazione Delle Assenze

La tabella delle assenze consente di verificare:

- nominativo del dipendente
- periodo di assenza
- motivo
- stato
- eventuale stato della copertura

La schermata include filtri per mese e anno, utili per una consultazione mirata.

### 9.4 Eliminazione Di Un'Assenza

Se un'assenza e stata registrata per errore oppure non e piu valida, puo essere eliminata.

Quando all'assenza sono collegate richieste di copertura o sostituzioni, il sistema aggiorna di conseguenza gli elementi associati.

### 9.5 Avvio Della Richiesta Di Copertura

Se l'assenza riguarda una giornata gia coperta da un turno, l'amministratore puo avviare una richiesta di copertura.

![Riga assenza con pulsante di avvio copertura o stato copertura](./screenshots/20-assenze-copertura.png){ width=95% }

Da questa schermata e possibile:

- avviare la ricerca di candidati
- verificare una richiesta gia aperta
- controllare se un sostituto e gia stato assegnato

---

## 10. Richieste Di Copertura

La sezione **Richieste di copertura** raccoglie tutte le richieste di sostituzione generate a seguito di assenze o scoperture.

![Pagina richieste di copertura](./screenshots/21-richieste-copertura.png){ width=95% }

### 10.1 Informazioni Mostrate

Per ogni richiesta vengono generalmente visualizzati:

- data del turno
- dipendente assente
- stato della richiesta
- candidato attuale
- tempo residuo o scadenza
- azioni disponibili

### 10.2 Stati Operativi

In base al flusso della richiesta, possono comparire stati come:

- in attesa
- proposta inviata
- accettata
- esaurita
- annullata

### 10.3 Azioni Disponibili

A seconda dello stato, l'amministratore puo:

- reinviare la richiesta
- annullare la richiesta
- intervenire manualmente sul processo

### 10.4 Gestione Manuale

Se il flusso automatico non produce una soluzione adeguata, e possibile procedere con un intervento manuale.

![Modal o schermata di gestione manuale della copertura](./screenshots/22-copertura-manuale.png){ width=95% }

Questa funzione e utile soprattutto nei casi eccezionali o quando serve una decisione organizzativa immediata.

---

## 11. Formazione

La sezione **Formazione** consente di gestire corsi, sessioni formative e partecipanti.

![Pagina formazione con elenco corsi e dettaglio](./screenshots/23-formazione.png){ width=95% }

### 11.1 Creazione Di Un Corso

Per ogni corso possono essere definiti:

- codice
- titolo
- data di inizio
- data di fine
- orario
- luogo
- note

### 11.2 Consultazione E Modifica Del Corso

L'elenco dei corsi si trova normalmente nella parte sinistra della schermata, mentre il dettaglio del corso selezionato compare nella parte destra.

Le operazioni disponibili includono:

- modifica dei dati del corso
- eliminazione del corso
- consultazione del calendario e dei partecipanti

### 11.3 Gestione Dei Partecipanti

Per ogni corso e possibile:

- aggiungere un partecipante
- rimuovere un partecipante
- visualizzare l'elenco completo degli iscritti

![Dettaglio corso con partecipanti](./screenshots/24-formazione-partecipanti.png){ width=95% }

L'inserimento di un partecipante puo generare automaticamente la relativa assenza di tipo formazione.

---

## 12. Regole Di Copertura

La sezione **Regole di copertura** permette di definire i requisiti minimi di personale necessari per ciascun giorno della settimana.

![Tabella regole di copertura](./screenshots/25-regole-copertura.png){ width=95% }

### 12.1 Finalita Della Schermata

Le regole di copertura servono a stabilire il numero minimo di risorse richieste, ad esempio:

- farmacisti
- operatori

### 12.2 Aggiornamento Dei Valori

Per modificare le regole:

1. aggiornare i campi numerici della tabella
2. salvare le modifiche

Le regole configurate influenzano il controllo delle criticita e la generazione automatica del piano.

---

## 13. Gestione Utenti

La sezione **Gestione utenti** e riservata agli amministratori.

![Pagina gestione utenti](./screenshots/26-utenti-admin.png){ width=95% }

### 13.1 Funzioni Disponibili

Da questa schermata e possibile:

- visualizzare gli utenti registrati
- approvare gli account in attesa
- revocare un'approvazione
- assegnare o rimuovere privilegi amministrativi

### 13.2 Utilizzo Operativo

La pagina va utilizzata in particolare quando:

- un nuovo utente ha completato la registrazione
- si devono modificare i permessi di accesso
- e necessario abilitare o limitare un account

---

## 14. Problemi Comuni

### 14.1 Non Riesco Ad Accedere

Verificare:

- correttezza di email e password
- stato di approvazione dell'account
- eventuali errori di digitazione

### 14.2 Il Mio Account Risulta In Attesa

Significa che un amministratore non ha ancora approvato l'utente dalla sezione gestione utenti.

### 14.3 Non Vedo Un Dipendente Nelle Schermate Operative

Controllare:

- che il dipendente sia presente in anagrafica
- che sia impostato come attivo
- che la disponibilita sia stata configurata correttamente

### 14.4 Non Riesco A Generare Il Piano

Verificare:

- mese e anno selezionati
- coerenza dei dati di disponibilita
- presenza di assenze gia registrate
- correttezza delle regole di copertura

### 14.5 Una Richiesta Di Copertura E Scaduta

Aprire la sezione richieste di copertura e controllare se e disponibile un nuovo invio o un intervento manuale.

### 14.6 Un Corso O Un Partecipante Non Compare Correttamente

Verificare:

- che il corso sia stato salvato
- che il partecipante sia stato associato correttamente
- che la relativa assenza di tipo formazione sia stata registrata

---

## 15. Glossario

### Turno

Assegnazione di un dipendente a una determinata giornata operativa.

### Pianificazione

Vista strutturata del mese con assegnazioni, conteggi e note operative.

### Disponibilita Standard

Disponibilita ricorrente abituale del dipendente.

### Disponibilita Accessoria

Disponibilita aggiuntiva o complementare rispetto a quella standard.

### Assenza

Periodo in cui un dipendente non e disponibile al lavoro.

### Copertura

Processo di ricerca e gestione di un sostituto per un turno scoperto.

### Sostituto

Dipendente incaricato di coprire il turno di un collega assente.

### Nota Giornaliera

Messaggio operativo associato a una data specifica.

---

## 16. Indicazioni Per La Versione Finale

Prima dell'esportazione in PDF e consigliato:

- sostituire tutti i placeholder con gli screenshot reali
- verificare che i nomi dei pulsanti coincidano con quelli presenti nell'app
- uniformare eventuali termini interni usati dall'organizzazione
- aggiungere data di aggiornamento del documento
- inserire eventuale logo o intestazione aziendale

---

## 17. Checklist Di Verifica Finale

- tutti gli screenshot sono stati inseriti
- i titoli delle sezioni sono corretti e uniformi
- la terminologia e coerente in tutto il documento
- i percorsi operativi descritti corrispondono all'applicazione reale
- il PDF finale e stato controllato visivamente prima della consegna
