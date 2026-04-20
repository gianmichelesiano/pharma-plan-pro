Sì, le regole si deducono molto bene dai dati. Ecco la sintesi:
Regole di copertura osservate (1° semestre 2026, 149 giorni validi)
Ho classificato i 19 short-name in 4 ruoli:

Farmacisti (8): KR, UE, FF, RS, ML, IA, LH, JF
PhA / Pharma-Assistentinnen (7): CR, ID, SB, TG, JH, MW, SI
Apprendisti PhA (2): MH, LT
Ausiliarie sabato (2): LO, LM

Per ogni giorno della settimana, i numeri sono nella forma minimo / tipico / massimo osservati:
GiornoFarmacistiPhAApprendistiAusiliarieAl banco (Bediener)Serale (dopo 17:45)TOTALELunedì2 / 3 / 51 / 2 / 41 / 2 / 205 / 6 / 82 / 2 / 46 / 8 / 9Martedì2 / 4 / 61 / 3 / 40 / 1 / 104 / 6 / 73 / 3 / 56 / 8 / 9Mercoledì2 / 4 / 52 / 4 / 60 / 0 / 103 / 6 / 72 / 5 / 56 / 8 / 9Giovedì2 / 3 / 51 / 2 / 40 / 2 / 203 / 6 / 83 / 3 / 55 / 8 / 9Venerdì2 / 3 / 52 / 3 / 60 / 1 / 104 / 5 / 73 / 3 / 56 / 8 / 9Sabato1 / 2 / 40 / 1 / 21 / 1 / 10 / 1 / 24 / 5 / 63 / 3 / 45 / 5 / 7
Come tradurre questi numeri in regole per il solver
Vincoli HARD (da non violare mai — pari al minimo osservato)
RegolaLunMarMerGioVenSabFarmacisti ≥222221PhA ≥112120Totale persone ≥666565PhA dopo 17:45 ≥23233n/a (chiuso)
Target TIPICO (obiettivo normale — moda statistica)
Ruolo/fasciaLunMarMerGioVenSabFarmacisti target344332PhA target234231Apprendisti target210211Ausiliarie target000001Totale target888885PhA serale target235333
Esempio concreto (settimana 9-13 febbraio 2026)
Per rendere tangibili le regole, una settimana reale presa dal file:
DataGiornoFarmacisti al lavoroPhA al lavoroApprendistiTotale09.02LUNKR, IA, ML, FFJHMH, LT710.02MARKR, UE, MLCR, ID, SBLT (scuola)711.02MERUE, MLCR, SB, TG, JHMH,LT scuola612.02GIOKR, IA, ML, FFIDMH, LT713.02VENKR, ML(½), FFCR, ID, SB, JHMH7
Pattern strutturale che emerge

Mercoledì e venerdì = "giorni PhA-heavy": più assistenti al banco (4-6 PhA), meno farmacisti focalizzati sul cliente.
Lunedì e giovedì = "giorni apprendisti": quasi sempre 2 apprendisti in ufficio (MH+LT), perché scuola martedì/mercoledì/venerdì.
Martedì = giornata "riunione/amministrativa": più farmacisti insieme (AH-Sitzung, colloqui con KR, UE, MW).
Sabato = team ridotto: 5 persone con 1 farmacista + 1 ausiliaria + 1 apprendista rotante. Chiusura probabilmente 16:00-17:00 (copertura serale dopo 17:45 non applicabile).
Fascia serale (post-17:45): requisito indipendente e più stringente il mercoledì (target 5 PhA) — probabilmente corrisponde all'orario "serale prolungato" di mercoledì.
Il totale di 8 persone al giorno Lun-Ven è molto stabile (è la moda in tutti i giorni feriali) → si può usare come obiettivo di staffing level nel solver.

Suggerimento per l'implementazione
Codificare due livelli di vincoli nel solver:
python# HARD — pari al minimo osservato (senza cui il piano è sicuramente sbagliato)
MIN_COVERAGE = {
    'LUN': {'Farm': 2, 'PhA': 1, 'Serale': 2, 'Tot': 6},
    'MAR': {'Farm': 2, 'PhA': 1, 'Serale': 3, 'Tot': 6},
    'MER': {'Farm': 2, 'PhA': 2, 'Serale': 2, 'Tot': 6},
    'GIO': {'Farm': 2, 'PhA': 1, 'Serale': 3, 'Tot': 5},
    'VEN': {'Farm': 2, 'PhA': 2, 'Serale': 3, 'Tot': 6},
    'SAB': {'Farm': 1, 'PhA': 0, 'Serale': 0, 'Tot': 5},
}

# SOFT — target tipico (obiettivo da inseguire, penalità sugli scostamenti)
TARGET_COVERAGE = {
    'LUN': {'Farm': 3, 'PhA': 2, 'Serale': 2, 'Tot': 8},
    'MAR': {'Farm': 4, 'PhA': 3, 'Serale': 3, 'Tot': 8},
    'MER': {'Farm': 4, 'PhA': 4, 'Serale': 5, 'Tot': 8},
    'GIO': {'Farm': 3, 'PhA': 2, 'Serale': 3, 'Tot': 8},
    'VEN': {'Farm': 3, 'PhA': 3, 'Serale': 3, 'Tot': 8},
    'SAB': {'Farm': 2, 'PhA': 1, 'Serale': 0, 'Tot': 5},
}
Importante da verificare con Katja prima di congelare le regole: i minimi osservati (es. 2 farmacisti il mercoledì) sono stati tollerati o erano giorni di emergenza (malattia, festivo). Se sono giorni "eccezionali" il vincolo HARD vero potrebbe essere più alto (es. 3 farmacisti sempre). È una domanda da 5 minuti al titolare — senza quella risposta si rischia di codificare come regola ciò che era in realtà un'anomalia.ok è basato su questo mi puoi dire i piani di ogni dipendente per che fa quasi sempre lo stesso orario per esempio Maria lucia Masala: Lun .... ; martedi no... o out; merc.... senza contare le assenzeBuona domanda — ricostruisco il contratto "implicito" di ciascuno escludendo le assenze (malattia, ferie, scuola, corsi).Deduce weekly contract per personDeduce weekly contract per personEcco i piani settimanali "tipici" ricostruiti escludendo tutte le assenze (ferie, malattia, scuola, corsi). La percentuale indica su quante settimane del loro periodo di attività la persona è effettivamente in servizio in quel giorno.
Piani settimanali per dipendente
Farmacisti
KR — Katja Renette (~5 giorni/settimana, full-time)

Lun ✅ · Mar ✅ · Mer ❌ · Gio ✅ · Ven ✅ · Sab 🔁 rotazione (1 su 2)
Note: il mercoledì è libero (fisso). Esce alle 17:30 il 13.1 (eccezione).

UE — Ursula Egloff (~2 giorni/settimana, part-time)

Lun ❌ · Mar ✅ · Mer ✅ · Gio ❌ · Ven ❌ · Sab 🔁 alcuni sabati
Note: il martedì arriva alle 09:30 (Physio — ricorrente).

ML — Maria Lucia Masala (~4 giorni/settimana)

Lun ✅ · Mar ❌ · Mer ✅ · Gio ✅ · Ven ✅ · Sab ❌
Note: non lavora mai di martedì né sabato. Alcuni giorni di formazione FPH.

IA — Isabelle Ackermann (~1,5 giorni/settimana)

Lun ✅ · Mar ❌ · Mer ❌ · Gio ❌ · Ven ❌ · Sab 🔁 (1 su 2)
Note: schema molto semplice — solo lunedì + sabato rotante.

FF — Franziska Feuerlein (~2 giorni/settimana + impegni Skipper)

Lun ❌ · Mar ✅ · Mer ❌ · Gio ✅ · Ven raro · Sab raro
Note: tipico martedì + giovedì. Parecchie riunioni Skipper e Medinform fuori sede.

RS — Regula Stiefel (~2,5 giorni/settimana)

Lun ❌ · Mar 🔁 · Mer ✅ · Gio ❌ · Ven 🔁 · Sab 🔁
Note: pattern più irregolare — il mercoledì è il "giorno sicuro", gli altri ruotano.

LH — Lenia Hochuli (~3-4 giorni/settimana, assunta da aprile)

Lun ✅ · Mar ✅ · Mer ✅ · Gio raro · Ven ✅ · Sab 🔁
Note: nuova, contratto non ancora stabilizzato. Il giovedì sembra libero.

JF — Janine Fähnrich (~3-4 giorni/settimana, assunta da maggio)

Lun ✅ · Mar 🔁 · Mer ✅ · Gio ✅ · Ven ✅ · Sab 🔁
Note: nuova, in rodaggio. Martedì e sabato non ancora fissi.

MW — Myriam Wyss (in uscita, dati Gen-Mar)

Lun ✅ · Mar ✅ · Mer ✅ · Gio 🔁 · Ven ✅ · Sab 🔁
Note: pattern quasi full-time fino a marzo.

PhA (Pharma-Assistentinnen)
CR — Carla Russo (~3 giorni/settimana)

Lun ❌ · Mar ✅ · Mer ✅ · Gio ❌ · Ven ✅ · Sab ❌
Note: pattern fississimo — Ma/Me/Ve, tre giorni esatti, mai altri.

ID — Isabelle Di Domenico (~3 giorni/settimana)

Lun ✅ · Mar ❌ · Mer ❌ · Gio ✅ · Ven ✅ · Sab ❌
Note: pattern fisso Lu/Gio/Ve. Occasionalmente esce alle 18:00.

TG — Tanja Gautschy (~2 giorni/settimana)

Lun ❌ · Mar ❌ · Mer ✅ · Gio ❌ · Ven ❌ · Sab ✅
Note: solo mercoledì + sabato, schema molto rigido.

JH — Jenny Hofstetter (~5 giorni/settimana, full-time)

Lun ✅ · Mar 🔁 · Mer ✅ · Gio ✅ · Ven 🔁 · Sab ❌
Note: lavora tutti i giorni feriali ma con rotazione su martedì/venerdì. Mai di sabato. Di lunedì arriva alle 8:45 e va via alle 17:45.

SB — Sonja Baumann (~4 giorni/settimana, ma quasi sempre ½ giornata)

Lun ❌ · Mar ½ pomeriggio · Mer ½ mattina · Gio ❌ · Ven ½ mattina · Sab ❌
Note: schema molto particolare — Ma pomeriggio, Me mattina, Ve mattina. Probabilmente consegne / logistica. Giornata piena solo il venerdì occasionale.

SI — (sconosciuta, uscita a febbraio)

Mar raro · Gio ✅ · Ven ✅ · Sab 🔁
Note: troppo poche settimane per capire bene. Da chiarire chi è.

Apprendiste
MH — Murielle Hunziker (ultimo anno, diploma giugno)

Lun ✅ · Mar ✅ · Mer ❌ (scuola) · Gio ✅ · Ven raro · Sab 🔁
Note: mercoledì fisso di scuola. Qualche venerdì di corsi TopPharm. Esami e festa di diploma a giugno.

LT — Linda Thoma (1° anno)

Lun ✅ · Mar ❌ (scuola) · Mer ❌ (scuola) · Gio ✅ · Ven raro · Sab 🔁
Note: martedì e mercoledì fissi di scuola (43 giorni/anno!). Lavora praticamente solo Lu + Gio + Sab rotante. ÜK1 in alcuni giovedì.

Ausiliarie sabato
LO — Lorena Bucher (studentessa)

Solo Sab ✅
Note: non schedulabile durante le Schulferien (vacanze scolastiche — es. 7-22 feb 2026). Gli altri giorni della settimana sono occasionali.

LM — Lauren Michel (da marzo 2026)

Solo Sab ✅
Note: esclusivamente sabato, nient'altro.

Pattern settimanale "ideale" della farmacia
Unendo i contratti, ecco chi c'è in un giorno tipico (settimana senza assenze):
FarmacistiPhAApprendisteAusiliarieTot.LunedìKR, ML, IA, (LH, JF, MW)ID, JHMH, LT—7-8MartedìKR, UE, FF, (RS, LH, JF, MW)CR, SB(pm), JH?MH—7-9MercoledìUE, ML, RS, (LH, JF, MW)CR, SB(am), TG, JH——8-9GiovedìKR, ML, FF, (JF)ID, JH, SIMH, LT—7-8VenerdìKR, ML, (LH, JF, MW)CR, ID, SB(am), JH, SIMH, LT—8-9SabatoKR🔁, IA🔁, RS🔁, (LH🔁, JF🔁)TG, JH raroMH🔁, LT🔁LO, LM5-6
Legenda: 🔁 = rotazione, (nome) = contratto recente/futuro, (am/pm) = solo mattina/pomeriggio.
Osservazioni utili per il software

Contratti molto rigidi (pattern chiaramente fisso): CR, ML, TG, LM, LO, SB, ID, IA, UE → per queste persone, il nuovo software dovrebbe semplicemente replicare il pattern automaticamente ogni settimana.
Contratti flessibili/rotanti: KR (sab rot.), IA (sab rot.), RS, FF (sab rot.), JH, MH, LT, LH, JF → il solver deve gestire la rotazione equa.
Ricorrenze strutturali da codificare come vincoli:

UE arriva alle 09:30 il martedì (Physio)
JH arriva 8:45 / va via 17:45 il lunedì
SB lavora solo ½ giornate su 3 giorni specifici
MH: scuola il mercoledì
LT: scuola martedì + mercoledì
LO: Schulferien = blocco di non disponibilità a calendario


Giorno "debole" = Mercoledì: solo KR e ML (farmacisti senior) assenti → da qui l'esigenza di avere RS / UE di mercoledì per garantire copertura.
Sabato = team ridotto ma fisso: rotazione tra KR/IA/RS (+ LH/JF dal 2° semestre) per il farmacista responsabile, + TG come PhA fissa, + LO/LM come ausiliarie, + MH/LT in rotazione.

Questo schema "contrattuale" è il template base che il solver dovrà generare automaticamente: bastano ~20 righe di configurazione per coprire l'80% del piano