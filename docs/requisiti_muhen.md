# Briefing per il team di sviluppo — Migrazione del piano del personale della farmacia

**Fonte**: due file Excel in tedesco della farmacia TPZ (Top Pharm Zentrum) per l'anno 2026
- `01 02 05 ERF-01 Arbeitsplan TPZ 2026.xlsx` — piano mensile turni (12 fogli, uno per mese)
- `Übersicht Kurse Team 2026.xlsx` — calendario formazione annuale

**Obiettivo**: sostituire la pianificazione Excel con un software più strutturato. Qui sotto tutte le informazioni estratte, già mappate su un modello dati utilizzabile per l'implementazione.

---

## 1. Modello dati da implementare

Il file Excel usa di fatto 4 entità mescolate in una griglia. Vanno separate:

| Entità | Descrizione | Granularità |
|---|---|---|
| **Employee** | anagrafica + ruolo + contratto | 1 record per persona |
| **WeeklyPattern** | giorni tipici di lavoro (turno base) | 1 record per persona × giorno settimana |
| **Shift / Planned Day** | turno effettivo pianificato | 1 record per persona × data |
| **Absence** | assenza (ferie, malattia, scuola, corso) | 1 record per persona × data (o intervallo) |
| **TrainingCourse** | corso di formazione | 1 record per corso; N partecipanti |
| **DailyNote / Event** | nota libera, riunione, appuntamento | 1 record per data (+ partecipanti) |
| **CoverageRule** | requisiti minimi di copertura per turno | configurazione |

---

## 2. Anagrafica personale (Employees)

Le colonne del piano Excel usano abbreviazioni a 2 lettere. Mapping completo con email fornite:

| Short | Nome | Cognome | Email | Ruolo (stimato dai dati) | Stato 2026 |
|---|---|---|---|---|---|
| KR | Katja | Renette | katjarenette@gmx.ch | Farmacista responsabile/titolare | Attivo tutto l'anno |
| UE | Ursula | Egloff | zentrum-apo.muhen@bluewin.ch, egloff.ursula@gmail.com | Farmacista | Attivo tutto l'anno |
| CR | Carla | Russo | russocarla78@gmail.com | Farmacista / PhA | Attivo tutto l'anno |
| IA | Isabelle | Ackermann | isi12@gmx.ch | Farmacista | Attivo tutto l'anno |
| ML | Maria Lucia | Masala | marialucia.masala@gmail.com | Farmacista (FPH?) | Attivo tutto l'anno |
| FF | Franziska | Feuerlein | fraenzi80@hotmail.com | Farmacista / Skipper | Pianificata fino a Giu 2026 |
| ID | Isabelle | Di Domenico | isabelle.didomenico@outlook.com | Pharma-Assistentin (PhA) | Pianificata fino a Giu 2026 |
| LO | Lorena | Bucher | lorbu2004@gmail.com | Apprendista/ausiliaria sabato | Pianificata fino a Lug 2026 |
| MW | Myriam | Wyss | myriam.wyss95@bluewin.ch | Farmacista / PhA | In uscita: pianificata solo Gen–Mar 2026 |
| RS | Regula | Stiefel | regi.stiefels@gmail.com | Farmacista / Skipper | Pianificata fino a Giu 2026 (+ alcune assenze nel 2° semestre) |
| SB | Sonja | Baumann | Baumann_s@gmx.ch | Autista consegne + supporto | Pianificata fino a Giu 2026 |
| SI | *sconosciuta* | *non in lista* | — | PhA? | In uscita: solo Gen–Feb 2026 |
| TG | Tanja | Gautschy | tanja.gautschy@quickline.ch | PhA | Pianificata fino a Giu 2026 |
| JH | Jenny | Hofstetter | jennyhofstetter@yahoo.de | PhA | Pianificata fino a Ott 2026 |
| MH | Murielle | Hunziker | murielle.hunziker@quickline.ch | Apprendista PhA — ultimo anno (QV Giu 2026) | Pianificata fino a Giu 2026 (diploma) |
| LT | Linda | Thoma | linda.thoma2010@gmail.com | Apprendista PhA — 1° anno | Pianificata fino a Giu 2026 |
| LM | Lauren | Michel | lauren.michel@gmx.ch | Ausiliaria sabato | Entrata in pianificazione da Mar 2026 |
| LH | Lenia | Hochuli | leniahochuli@icloud.com | Farmacista / PhA | Giornata di prova 7.1.2026, assunta da Apr 2026 |
| JF | Janine | Fähnrich | *non in lista fornita* | Nuova assunzione | Colloquio 31.3.2026, operativa da Mag 2026 |

**Note per il team**:
- 2 sigle (SI, JF) non corrispondono a nomi forniti dall'utente → verificare con KR (Katja) per completare l'anagrafica.
- Le email di UE sono due: la seconda sembra personale, la prima è la casella della farmacia — attenzione nella migrazione.
- Gli apprendisti (MH, LT) hanno regime speciale: vanno modellati come tipo `APPRENDISTA` con calendario scolastico.

---

## 3. Pattern settimanale osservato (giorni tipici di lavoro)

Calcolato dai giorni effettivamente pianificati come `1` nel 2026. Identifica i "giorni tipici" e quindi il contratto implicito.

| Short | Lun | Mar | Mer | Gio | Ven | Sab | Giorni tipici | % impegno stimato |
|---|---|---|---|---|---|---|---|---|
| KR | ✓ | ✓ |   | ✓ | ✓ | ✓(rot.) | Lu-Ma-Gio-Ve + sabato rotante | ~100% (5–6 gg/sett) |
| UE |   | ✓ | ✓ |   |   | occ. | Ma-Me (+ qualche sabato) | ~40% |
| CR |   | ✓ | ✓ |   | ✓ |   | Ma-Me-Ve | ~60% |
| IA | ✓ |   |   |   |   | ✓(rot.) | Lunedì + sabato rotante | ~40% |
| ML | ✓ |   | ✓ | ✓ | ✓ |   | Lu-Me-Gio-Ve | ~80% |
| FF |   | ✓ |   | ✓ |   | occ. | Ma-Gio (+mattine libere) | ~50% (fino a Giu) |
| ID | ✓ |   |   | ✓ | ✓ |   | Lu-Gio-Ve | ~60% |
| LO |   |   |   |   |   | ✓ | Solo sabato (scolara) | ~10–20% |
| MW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | quasi full-time (ma solo Gen-Mar) | ~100% fino a Mar |
| RS |   | ✓ | ✓ |   | ✓ | ✓ | Ma-Me-Ve-Sab | ~70% |
| SB |   | ✓ | ✓ |   | ✓ |   | Ma-Me-Ve (soprattutto **½ giornate**) | ~40% equivalente |
| SI |   |   |   | ✓ | ✓ | occ. | Gio-Ve (+sabato) — solo Gen/Feb | — |
| TG |   |   | ✓ |   |   | ✓ | **Mercoledì + Sabato** | ~40% |
| JH | ✓ | ✓ | ✓ | ✓ | ✓ |   | Full settimana Lu-Ve | ~90% (Gen-Giu) |
| MH | ✓ | ✓ |   | ✓ |   | ✓(rot.) | Lu-Ma-Gio + sabato (+ scuola Mer/Ven) | Apprendista |
| LT | ✓ |   |   | ✓ |   | ✓(rot.) | Lu-Gio + sabato rotante (+ scuola) | Apprendista |
| LM |   |   |   |   |   | ✓ | **Solo sabato** | molto ridotto |
| LH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Full settimana da Apr | ~90% |
| JF | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Full settimana da Mag | ~90% |

Il file **non contiene ore contrattuali esplicite**: andranno chieste a HR. Le percentuali sopra sono stime basate sulla frequenza di presenza.

---

## 4. Giorni lavorativi totali per persona (2026)

| Short | Nome completo | gg. piene | ½ giornate | Totale equivalente | gg in scuola | Ferie/n.d. (`.`) | Malattia |
|---|---|---:|---:|---:|---:|---:|---:|
| KR | Katja Renette | 209 | 6 | 212 | 0 | 1 | 0 |
| UE | Ursula Egloff | 87 | 0 | 87 | 2 | 38 | 1 |
| CR | Carla Russo | 105 | 0 | 105 | 0 | 1 | 0 |
| IA | Isabelle Ackermann | 63 | 1 | 63,5 | 0 | 10 | 0 |
| ML | Maria Lucia Masala | 172 | 1 | 172,5 | 0 | 0 | 0 |
| FF | Franziska Feuerlein | 55 | 6 | 58 | 3 | 2 | 0 |
| ID | Isabelle Di Domenico | 69 | 0 | 69 | 0 | 3 | 0 |
| LO | Lorena Bucher | 22 | 0 | 22 | 0 | 17 | 0 |
| MW | Myriam Wyss (Gen-Mar) | 49 | 0 | 49 | 0 | 1 | 4 |
| RS | Regula Stiefel | 75 | 2 | 76 | 1 | 15 | 0 |
| SB | Sonja Baumann | 23 | 48 | 47 | 0 | 0 | 0 |
| SI | *sconosciuta* (Gen-Feb) | 15 | 0 | 15 | 0 | 0 | 0 |
| TG | Tanja Gautschy | 42 | 0 | 42 | 0 | 0 | 2 |
| JH | Jenny Hofstetter | 95 | 0 | 95 | 0 | 11 | 0 |
| MH | Murielle Hunziker (apprend.) | 91 | 0 | 91 | **18** | 5 | 0 |
| LT | Linda Thoma (apprend.) | 69 | 0 | 69 | **43** | 0 | 0 |
| LM | Lauren Michel (Mar-Giu) | 15 | 0 | 15 | 0 | 2 | 0 |
| LH | Lenia Hochuli (Apr-Giu) | 47 | 0 | 47 | 0 | 1 | 0 |
| JF | Janine Fähnrich (Mag-Giu) | 41 | 0 | 41 | 1 | 0 | 0 |

Numeri ridotti nel 2° semestre per molte persone = **piano non ancora completato dopo giugno**, non uscite effettive (eccetto MW, SI, MH che sono casi reali).

---

## 5. Codifica delle celle (legenda)

Tradurre 1:1 in enum nel nuovo software:

| Simbolo Excel | Significato DE | Significato IT | Valore per export |
|---|---|---|---|
| `1` | ganzer Arbeitstag | Giornata intera | `shift=FULL_DAY` |
| `1*` | Arbeitstag mit Termin/Meeting | Giornata + appuntamento | `shift=FULL_DAY` + link a evento |
| `1mo` / `1mo*` | nur Vormittag | Solo mattina | `shift=MORNING` (~0.5) |
| `1nm` / `1nm*` | nur Nachmittag | Solo pomeriggio | `shift=AFTERNOON` (~0.5) |
| (vuoto) | nicht eingeplant | Non pianificato | nessun record |
| `.` | Ferien / nicht verfügbar | Ferie / non disponibile | `absence=VACATION_OR_UNAVAILABLE` |
| `krank` | krank | Malattia | `absence=SICK` |
| `S` | Schule / Berufsschule | Scuola (apprendista) | `absence=SCHOOL` (ricorrente) |
| `TP` | TopPharm-Kurs | Corso TopPharm | `absence=TRAINING` |
| `G` | Gespräch / Mitarbeitergespräch | Colloquio con collaboratore | `absence=HR_MEETING` |
| `*` | flag nota | Vedi "Bemerkung" / "Anmerkung" | flag → join con DailyNote |
| `Bediener` | Personen am HV | N° persone al banco (calcolato) | KPI copertura |
| `PhA's` | Anzahl Pharma-Assistentinnen | N° PhA presenti (calcolato) | KPI copertura |
| `Spezialzeiten` | abweichende Arbeitszeiten | Orari speciali del giorno | testo libero |
| `PhA's ab 17:45 Uhr` | Abenddeckung | N° PhA dopo le 17:45 (calcolato) | KPI copertura serale |

---

## 6. Regole di pianificazione osservate

1. **Granularità**: singolo giorno, con 2 slot possibili (mattina / pomeriggio) per alcune persone (es. SB lavora quasi sempre mezza giornata).
2. **Orario di default non scritto**: la giornata piena corrisponde all'apertura della farmacia. Gli scostamenti sono **note testuali**, non strutturate:
   - "KR geht um 17.30 Uhr"
   - "JH kommt um 8:45"
   - "UE kommt erst um 09.30h (Physio)"
   - "ID geht um 18:00 Uhr"
   - "TG geht um 11:00 Uhr"
   → vanno convertite in campi `start_time` / `end_time` per turno.
3. **Copertura minima**: per ogni giorno ci sono formule che contano:
   - `Bediener` = totale persone al banco
   - `PhA's` = totale pharma-assistenti
   - `PhA's ab 17:45` = copertura serale
   Indica che le **regole di staffing** dipendono dal ruolo e dalla fascia oraria.
4. **Sabato**: turno a parte, coperto da personale dedicato (LM solo sabato; LO sabato+occasionale; IA lunedì+sabato rotante; RS, MH, LT rotazione sabato).
5. **Fascia serale**: tracciata esplicitamente → richiesta copertura dedicata dopo le 17:45.
6. **Apprendisti (MH, LT)**: giorni di scuola ricorrenti (`S`) + corsi esterni (ÜK, Booster, QV-Vorbereitung). 43 gg di scuola per LT. Esami finali e feste di diploma a giugno (MH).
7. **Formazione continua**: presa dal file separato "Übersicht Kurse" — cfr. sezione 9.
8. **Riunioni ricorrenti**:
   - AH-Sitzung (direzione): ~1x/mese ore 09:00 o 10:00 — partecipanti fissi (KR, UE, MW/JH)
   - Teamsitzung: serale 18:30
   - AH-Pharmis: meeting PhA mattina
   - MH+SB / MH+MW "Allergiecheck üben" (training interno ricorrente)
   → modellare come **eventi ricorrenti con partecipanti**.
9. **Eventi HR**: Schnuppertag (giornata di prova candidati), Vorstellungsgespräch (colloqui), esami finali, visite esterne (Swisscom, Landanzeiger) — attualmente sono note testuali, dovrebbero essere una tabella `Events` con tipo.
10. **Ferie non strutturate**: le "`."` nel piano sono al tempo stesso ferie E non-disponibilità. Nel nuovo sistema vanno distinte (Vacation vs. Unavailable) e gestite con richieste/approvazioni.
11. **Schulferien (vacanze scolastiche)**: per LO "7.2.–22.2.2026 LO Schulferien = kann nicht zum Arbeiten eingetragen werden" → vincolo "non disponibile" derivato dal calendario scolastico.

---

## 7. Eventi e note significative estratti

Esempi reali (dal file — da usare come test cases nel nuovo sistema):

| Data | Tipo | Descrizione |
|---|---|---|
| 07.01.2026 | Candidatura | Probearbeitstag Lenia Hochuli 8:00–12:15 (KR presente la mattina) |
| 10.01.2026 | Formazione | LT TopPharm Kurs Booster 1. Lehrjahr (giovedì libero) |
| 13.01.2026 | Candidatura | FF Schnuppi Elina Racaj 8.15 |
| 15.01.2026 | Riunione | Teamsitzung 18.30 |
| 20.01.2026 | Riunione direzione | 09:00 KR+UE+MW AH-Sitzung |
| 21.01.2026 | Pianificazione | Katja & Tanja 7:30 Besprechung Planung |
| 22.01.2026 | Training interno | MH/LT Riboflavin herstellen |
| 23.2.–13.3.2026 | Praticantato | Schul-Praktikum Magdalena Egloff (nipote di Ursula) |
| 07.2.–22.2.2026 | Vincolo | LO Schulferien — non può essere pianificata |
| 17.03.2026 | Corso | MH QV Vorbereitungskurs TopPharm |
| 31.03.2026 | Colloquio | 14:30 Janine Fähnrich (Vorstellungsgespräch) |
| 15.04.2026 | Esame | LH Abschlussprüfungen (rientra ~16:00) |
| 01.06.2026 | Esame | MH schriftliche Abschlussprüfung Aarau |
| 24.06.2026 | Evento | MH QV-Feier 19:15 Bärematte Suhr |
| 26.06.2026 | Evento | MH Abschlussball HKV |

---

## 8. Assenze / tipologie da modellare

| Tipo | Codice Excel | Approvazione richiesta? | Ricorrente? |
|---|---|---|---|
| Ferie | `.` | Sì | No |
| Non disponibile | `.` | No (self-service) | Anche ricorrente (es. Schulferien) |
| Malattia | `krank` | No (certificato medico a posteriori) | No |
| Scuola | `S` | No (calendario annuale) | Sì (pattern settimanale) |
| Corso esterno | `TP` | Sì (approvazione manager) | Su date specifiche |
| Colloquio HR | `G` | Sì | No |
| Riunione aziendale | nota + `*` | No | Sì (mensile) |
| Arrivo ritardato / uscita anticipata | nota testuale | No | Spesso ricorrente (es. UE martedì Physio) |

---

## 9. Formazione (file "Übersicht Kurse Team 2026")

Una tabella dedicata con righe = corsi e colonne = partecipanti (short name). I valori sono **date di partecipazione** al corso. Dal file emergono:

**TopKompetenz Schulung (4 cicli/anno)** — tutto il giorno 9:00–17:00, sede Baden/Olten:
- Schulung 1 (Migräne + Ohrengesundheit) — 10.3.2026 IA+JH; 24.3.2026 ML+RS
- Schulung 2 (Reisegesundheit + Frauenthemen) — 11.6.2026 IA+FF
- Schulung 3 (Herz-Kreislauf + Mundgesundheit) — 8.9.2026 IA+JH, 9.9.2026 MH, 15.9.2026 ML
- Schulung 4 (Allergie bei Kindern + Männergesundheit) — 12.11.2026 ID+TG

**TP Skipper** (solo per FF e RS — funzione "Skipper" regionale):
- Kompetenz Forum Aarau 6.5.2026 (FF)
- Regiositzungen: 19.3 / 27.5 / 2.9 / 5.11.2026 (FF o RS alternati)

**TP Neue Kompetenzen**:
- netcare 20.5.2026 (JH)
- Impfen Zürich 16.6.2026 (LH, se non in ferie)

**Medinform Fortbildung** (Zürich / Webinar):
- 5.5.2026 IA, RS, FF, ID pomeriggio 13:30–17:00
- 7.5.2026 ID+RS pomeriggio
- 12.5.2026 IA mattina
- 28.5.2026 TG mattina

**Lernendentraining Booster** (apprendisti) — Olten:
- 1° / 2° / 3° anno (date non ancora assegnate nel file per MH/LT)

→ Il nuovo software deve poter **importare** un calendario formazione annuale e generare automaticamente le assenze del partecipante nel piano.

---

## 10. Raccomandazioni implementative

1. **Separare i 7 concetti** oggi sovrapposti nella griglia Excel (Employee, Shift, Absence, Event, Training, Note, Coverage).
2. **Mantenere le short-name come alias** (campo `display_code`) per agevolare la continuità visiva di chi è abituato al piano attuale.
3. **Vista calendario principale**: mantenere la logica "una colonna per persona, una riga per giorno" come UI di default (è già familiare al team), ma con click-to-edit strutturato.
4. **Vincoli duri**:
   - Apprendisti non schedulabili nei giorni di scuola
   - LO non schedulabile durante Schulferien
   - UE non prima delle 09:30 il martedì (da confermare: ricorrente?)
5. **Vincoli morbidi / regole di copertura**:
   - Almeno 1 Farmacista (Apotheker) sempre in servizio
   - Almeno N PhA al banco (`Bediener`) per fascia oraria
   - Copertura serale dopo 17:45 con almeno 1 PhA
6. **Roles / Permessi**:
   - `OWNER` (KR): full edit, gestione anagrafica, approvazione ferie
   - `MANAGER` (FF, RS Skipper): edit piano, approvazione ferie team
   - `STAFF`: visualizza piano, richiede ferie, segnala malattia
   - `APPRENTICE` (MH, LT): view-only + request absence
7. **Import iniziale**:
   - Anagrafica: sezione 2 di questo documento
   - Pattern settimanale: sezione 3
   - Formazione 2026: file separato (dettagli sezione 9)
   - Assenze pianificate: estratte dai 12 fogli mensili (principalmente codici `.` e `krank`)
8. **Dati mancanti da richiedere a Katja (KR)**:
   - Ore contrattuali ufficiali per ogni dipendente (oggi non nel file)
   - Identità di SI e JF (non coincidono con le email fornite)
   - Conferma se MW lascia davvero o solo non pianificata nel 2° semestre
   - Se RS/FF lasciano da luglio o il piano è semplicemente incompleto
   - Orari di apertura ufficiali della farmacia (lun-ven, sabato)
   - Orario fascia serale (start/stop del "PhA's ab 17:45 Uhr")

---

## 11. Suggerimento sulla migrazione

Consigliato un approccio in 3 fasi:
1. **Fase 1 — Anagrafica + contratto**: import Employees + WeeklyPattern, senza storico.
2. **Fase 2 — Calendario 2026**: import assenze e corsi del 1° semestre 2026 (già definiti); il 2° semestre si pianifica dentro il nuovo sistema.
3. **Fase 3 — Regole di copertura e approvazioni**: abilitare vincoli duri/morbidi e workflow di richiesta ferie una volta che il team è a regime.

La dismissione definitiva del file Excel può avvenire a fine 2026, dopo un trimestre di parallel-run.
