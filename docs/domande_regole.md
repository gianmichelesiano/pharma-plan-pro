# Domande aperte — Gestione Regole di Copertura

## Contesto

La tabella `coverage_rules` definisce quante persone per ruolo devono essere presenti
in un dato giorno/fascia oraria. Sono i vincoli che il solver userà per generare il piano.



---

## 1. Schema slot: AM/PM vs FULL_DAY?

**Situazione attuale:**
- Migration DB: `slot in ('MORNING', 'AFTERNOON', 'FULL_DAY')`
- UI (RulesPage): usa `'AM'`, `'PM'`, `'FULL'` → **non combaciano**, inserimento via UI viola il constraint

**Domanda:** Come vogliamo modellare le fasce?

- **Opzione A** — Due fasce AM/PM per ogni giorno feriale + FULL per sabato  
  → più granulare, permette regole diverse mattina/pomeriggio  
  → bisogna allineare DB enum e UI (ora disallineati)

- **Opzione B** — Solo FULL_DAY per tutti i giorni  
  → più semplice, sufficiente se i requisiti non cambiano tra mattina e pomeriggio  
  → la UI attuale è overengineered per questo caso

**Decisione necessaria prima di sistemare RulesPage.**

---

## 2. Vincolo serale (dopo 17:45) — come gestirlo?

**Dal doc info_extract.md:** esiste un requisito separato di PhA in fascia serale
(dopo 17:45), più stringente il mercoledì (target 5 PhA).

**Domanda:** Vogliamo una riga separata in `coverage_rules` con `time_window='evening'`?

- **Sì** → aggiungere `evening` come valore gestito dalla UI (attualmente non esiste)
- **No** → il vincolo serale si gestisce solo nei turni (shifts), non nelle regole

---

## 3. HARD vs SOFT — un solo livello o due?

**Dal doc:** due livelli distinti:
- **HARD** (minimo assoluto — da non violare mai)
- **SOFT** (target tipico — penalità nel solver se non raggiunto)

**Domanda:** La tabella `coverage_rules` ha solo `min_required`. Aggiungiamo `target_required`?

- **Sì** → aggiungere colonna `target_required smallint` in una nuova migration
- **No per ora** → il solver usa solo il minimo, il target si aggiunge dopo

---

## 4. Ruoli coperti nelle regole

**Attualmente la UI gestisce solo:**
- `pharmacist` (farmacisti)
- `pha` (operatori — raggruppa PhA, apprendiste, ausiliarie)

**Domanda:** Vogliamo regole separate per `apprentice_pha` e `auxiliary`?

- Esempio sabato: serve 1 `auxiliary` (LO/LM) — attualmente non modellabile via UI
- Oppure: le regole coprono solo farmacisti + PhA, il resto è implicito nei turni?

---

## 5. Chi può modificare le regole?

**Domanda:** Le `coverage_rules` sono configurazione admin (solo Katja le tocca)
o ogni utente può editarle?

- Impatta RLS su Supabase e visibilità del menu nella UI

---

## 6. I minimi osservati nel doc sono HARD reali o includono giorni di emergenza?

**Dal doc (info_extract.md):**
> "Importante da verificare con Katja: i minimi osservati (es. 2 farmacisti il mercoledì)
> erano giorni di emergenza (malattia, festivo) o sono stati tollerati?"

**Da chiedere a Katja prima di congelare i valori.**

Valori attuali MIN_COVERAGE dedotti:

| Giorno | Farm min | PhA min | Serale PhA min | Totale min |
|--------|----------|---------|----------------|------------|
| Lun    | 2        | 1       | 2              | 6          |
| Mar    | 2        | 1       | 3              | 6          |
| Mer    | 2        | 2       | 2              | 6          |
| Gio    | 2        | 1       | 3              | 5          |
| Ven    | 2        | 2       | 3              | 6          |
| Sab    | 1        | 0       | n/a            | 5          |
