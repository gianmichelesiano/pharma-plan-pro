# Tutorial Utente — Pharma Plan Pro

Guida completa alla pianificazione dei turni della Farmacia TPZ (Muhen).

---

## 1. Turni Settimanali

### Accedere alla vista settimanale

Dal menu laterale, clicca su **"Turni"** (icona calendario). Vedrai la griglia dei turni della settimana corrente.

### Struttura della griglia

- **Colonne**: i 7 giorni della settimana (Lunedì → Domenica)
- **Righe**: fasce orarie (Mattina, Pomeriggio, Notte)
- **Colore dei turni**:
  - 🟨 Giallo = Mattina (es. 08:00–16:00)
  - 🟦 Blu = Pomeriggio (es. 14:00–22:00)
  - 🟪 Viola = Notte (es. 22:00–08:00)

### Assegnare un turno (drag & drop)

1. **Apri il pannello "Dipendenti"**: cliccando sul lato destro della pagina, vedi la lista di tutti i dipendenti con il loro ruolo (Farmacista, PHA, Ausiliario).
2. **Trascina un dipendente**: clicca e tieni premuto su un nome, poi trascinalo sulla casella della fascia oraria desiderata.
3. **Rimuovere un turno**: trascina il nome dal turno e rilascialo nell'area "Non assegnato" in basso.

> **Nota**: Solo gli utenti con ruolo **Admin** possono modificare i turni tramite drag & drop. Gli altri utenti possono solo visualizzarli.

### Navigare tra le settimane

- Usa le frecce `◀` e `▶` in alto per spostarti alla settimana precedente o successiva.
- Clicca su **"Oggi"** per tornare alla settimana corrente.

---

## 2. Pianificazione Mensile

### Accedere alla vista mensile

Dal menu laterale, clicca su **"Pianificazione"**. Vedrai una griglia mese corrente con tutti i dipendenti elencati sulle righe.

### Struttura della vista mensile

- **Colonne**: i giorni del mese (1–31)
- **Righe**: i dipendenti
- **Cella**: mostra i turni assegnati per quel dipendente in quel giorno

### Navigare tra i mesi

- Usa le frecce `◀` e `▶` in alto per cambiare mese.
- Clicca su **"Oggi"** per tornare al mese corrente.
- Usa il **menu a tendina dell'anno** per saltare a un anno diverso.

### Filtrare i dipendenti

Usa i filtri in alto per:
- **Ruolo**: filtra per Farmacista, PHA, Ausiliario, o tutti.
- **Reparto**: filtra per reparto/sezione.
- **Ricerca**: digita un nome per trovare un dipendente specifico.

### Generare turni automaticamente

> **Solo per Admin**

1. Clicca sul pulsante **"Genera turni"** in alto a destra.
2. Seleziona il mese di riferimento.
3. Clicca su **"Conferma"**.

Il sistema genererà automaticamente i turni rispettando:
- Le regole di copertura (minimo di farmacisti e PHA per giorno)
- I turni settimanali predefiniti di ogni dipendente
- Le assenze già registrate

> **Consiglio**: genera i turni dopo aver registrato tutte le assenze del mese.

---

## 3. Gestione Assenze

### Accedere alla gestione assenze

Dal menu laterale, clicca su **"Assenze"**. Vedrai la lista di tutte le assenze registrate.

### Richiedere un'assenza

1. Clicca sul pulsante **"+ Nuova assenza"** in alto a destra.
2. Compila il form:
   - **Dipendente**: seleziona il nome dal menu a tendina.
   - **Tipo di assenza**: scegli tra:
     - 🏖️ **Vacanza** (VACATION) — ferie annuali
     - 🚫 **Non disponibile** (UNAVAILABLE) — periodo in cui non si può lavorare
     - 🤒 **Malattia** (SICK) — giorno di malattia
     - 🏫 **Scuola** (SCHOOL) — corso/formazione obbligatoria
     - 📚 **Formazione** (TRAINING) — corso di formazione
     - 🤝 **Riunione HR** (HR_MEETING) — incontro con risorse umane
   - **Data inizio**: seleziona il primo giorno di assenza.
   - **Data fine**: seleziona l'ultimo giorno (lascia vuoto se è un solo giorno).
   - **Note**: aggiungi eventuali informazioni aggiuntive (opzionale).
3. Clicca su **"Invia richiesta"**.

### Stato di una richiesta

Ogni assenza ha uno stato visibile con un badge colorato:

| Stato | Colore | Significato |
|-------|--------|-------------|
| `requested` | 🟡 Giallo | Richiesta in attesa di approvazione |
| `approved` | 🟢 Verde | Richiesta approvata — l'assenza è confermata |
| `rejected` | 🔴 Rosso | Richiesta rifiutata — il dipendente deve lavorare |

### Approvare o rifiutare un'assenza (Admin)

1. Trova l'assenza nella lista o nella vista mensile.
2. Clicca sul pulsante **"Approva"** o **"Rifiuta"** accanto alla richiesta.
3. Conferma l'azione.

> **Nota**: solo gli Admin possono approvare o rifiutare le assenze.

### Visualizzare le assenze nella pianificazione

Le assenze approvate vengono automaticamente:
- Rilevate nella griglia dei turni (la cella viene segnata come "assente")
- Ignorate dal generatore automatico di turni

---

## 4. Dipendenti

### Accedere alla lista dipendenti

Dal menu laterale, clicca su **"Dipendenti"**. Vedrai la tabella con tutti i dipendenti registrati.

### Struttura della tabella

| Colonna | Descrizione |
|---------|-------------|
| Nome | Nome e cognome del dipendente |
| Ruolo | Farmacista, PHA, Ausiliario |
| Orario | Tipo di contratto (es. Full-time, Part-time) |
| Stato | Attivo / Non attivo |

### Aggiungere un nuovo dipendente

1. Clicca su **"+ Nuovo dipendente"** in alto a destra.
2. Compila il form:
   - **Nome completo**
   - **Ruolo** (Farmacista, PHA, Ausiliario)
   - **Tipo di orario** (Full-time, Part-time, ecc.)
   - **Stato** (Attivo/Non attivo)
3. Clicca su **"Salva"**.

> **Nota**: il dipendente dovrà anche essere creato in Auth (email + password) separatamente per accedere al sistema.

### Modificare i dati di un dipendente

1. Nella tabella, trova il dipendente desiderato.
2. Clicca sull'icona **"Modifica"** (matita) sulla destra della riga.
3. Aggiorna i campi desiderati.
4. Clicca su **"Salva"**.

### Attivare/Disattivare un dipendente

1. Clicca sull'icona **"Modifica"**.
2. Cambia lo stato da "Attivo" a "Non attivo" (o viceversa).
3. Clicca su **"Salva"**.

> I dipendenti non attivi non appaiono nella generazione automatica dei turni.

---

## 5. Regole di Copertura

### Accedere alle regole

Dal menu laterale, clicca su **"Regole di copertura"**. Vedrai la tabella con i minimi di personale richiesti per ogni combinazione di giorno e ruolo.

### Cosa sono le regole di copertura

Le regole definiscono il **numero minimo** di ogni ruolo richiesto per ciascun giorno della settimana. Il generatore automatico di turni usa queste regole per creare pianificazioni valide.

### Struttura delle regole

| Giorno | Farmacisti (min) | PHA (min) | Ausiliari (min) |
|--------|------------------|-----------|-----------------|
| Lunedì | 2 | 1 | 0 |
| Martedì | 2 | 1 | 0 |
| Mercoledì | 2 | 2 | 0 |
| Giovedì | 2 | 1 | 0 |
| Venerdì | 2 | 2 | 0 |
| Sabato | 1 | 1 | 0 |
| Domenica | 1 | 0 | 0 |

*(I valori sopra sono indicativi — consulta sempre la configurazione attuale nel sistema.)*

### Modificare una regola

1. Trova la riga del giorno desiderato nella tabella.
2. Clicca sull'icona **"Modifica"** (matita).
3. Aggiorna i valori minimi.
4. Clicca su **"Salva"**.

> **Consiglio**: modifica le regole solo se cambiano le esigenze operative della farmacia. Dopo una modifica, rigenera i turni per applicare i nuovi minimi.

---

## 6. Formazione

### Accedere alla gestione formazione

Dal menu laterale, clicca su **"Formazione"**. Vedrai la lista di tutti i corsi di formazione.

### Cos'è la sezione formazione

Questa sezione serve a organizzare i corsi di formazione obbligatori o opzionali per i dipendenti (corsi per farmacisti, PHA, ecc.).

### Creare un corso di formazione

1. Clicca su **"+ Nuovo corso"** in alto a destra.
2. Compila il form:
   - **Nome del corso**: es. "Aggiornamento normativa farmaci 2026"
   - **Descrizione**: dettagli sul contenuto del corso
   - **Data inizio**: quando inizia il corso
   - **Data fine**: quando termina (se il corso dura più giorni)
   - **Luogo**: dove si svolge (opzionale)
   - **Istruttore**: nome di chi tiene il corso (opzionale)
3. Clicca su **"Salva"**.

### Iscrivere un dipendente a un corso

1. Apri il corso cliccando sul suo nome nella lista.
2. Nella pagina del dettaglio corso, clicca su **"+ Aggiungi partecipante"**.
3. Seleziona il dipendente dal menu a tendina.
4. Clicca su **"Conferma"**.

> I dipendenti iscritti a un corso vedranno automaticamente il corso come "Formazione" nelle assenze.

### Visualizzare i partecipanti

Nella pagina di dettaglio di un corso, vedi la lista completa dei partecipanti iscritti. Puoi:
- Rimuovere un partecipante cliccando sull'icona **"Rimuovi"** (cestino).

---

## Glossario

| Termine | Descrizione |
|---------|-------------|
| **Admin** | Utente con permessi completi (crea/modifica turni, approva assenze, ecc.) |
| **Farmacista** | Ruolo principale — responsabile della dispensazione farmaci |
| **PHA** | Peritos pharmaceutus ad honorem — tecnico farmaceutico |
| **Ausiliario** | Personale ausiliario senza ruolo farmaceutico |
| **Turno Mattina** | Fascia mattutina (tipicamente 08:00–16:00) |
| **Turno Pomeriggio** | Fascia pomeridiana (tipicamente 14:00–22:00) |
| **Turno Notte** | Fascia notturna (tipicamente 22:00–08:00) |
| **Regole di copertura** | Minimi di personale richiesti per giorno e ruolo |
| **Generazione automatica** | Algoritmo che crea i turni rispettando regole e vincoli |

---

## Supporto

Per problemi tecnici o richieste di accesso, contatta l'amministratore di sistema o il team IT.
