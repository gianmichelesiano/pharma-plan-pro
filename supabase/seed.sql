-- Seed data for Pharma Plan Pro from docs/requisiti_muhen.md
-- Apply AFTER all migrations (0001-0008) have run.

-- ============================================================
-- SEED 1/3 — Employees (§2)
-- `active=false` for terminated staff (MW, SI).
-- ============================================================
insert into plan_employees (display_code, first_name, last_name, email, role, employment_status, hired_at, left_at, weekly_hours_pct, active) values
  ('KR', 'Katja',       'Renette',      'katjarenette@gmx.ch',             'pharmacist',     'active',     null,          null,          100.00, true),
  ('UE', 'Ursula',      'Egloff',       'zentrum-apo.muhen@bluewin.ch',    'pharmacist',     'active',     null,          null,           40.00, true),
  ('CR', 'Carla',       'Russo',        'russocarla78@gmail.com',          'pharmacist',     'active',     null,          null,           60.00, true),
  ('IA', 'Isabelle',    'Ackermann',    'isi12@gmx.ch',                    'pharmacist',     'active',     null,          null,           40.00, true),
  ('ML', 'Maria Lucia', 'Masala',       'marialucia.masala@gmail.com',     'pharmacist',     'active',     null,          null,           80.00, true),
  ('FF', 'Franziska',   'Feuerlein',    'fraenzi80@hotmail.com',           'pharmacist',     'active',     null,          '2026-06-30',   50.00, true),
  ('ID', 'Isabelle',    'Di Domenico',  'isabelle.didomenico@outlook.com', 'pha',            'active',     null,          '2026-06-30',   60.00, true),
  ('LO', 'Lorena',      'Bucher',       'lorbu2004@gmail.com',             'auxiliary',      'active',     null,          '2026-07-31',   15.00, true),
  ('MW', 'Myriam',      'Wyss',         'myriam.wyss95@bluewin.ch',        'pharmacist',     'terminated', null,          '2026-03-31',  100.00, false),
  ('RS', 'Regula',      'Stiefel',      'regi.stiefels@gmail.com',         'pharmacist',     'active',     null,          '2026-06-30',   70.00, true),
  ('SB', 'Sonja',       'Baumann',      'Baumann_s@gmx.ch',                'driver',         'active',     null,          '2026-06-30',   40.00, true),
  ('SI', 'Unknown',     'SI',            null,                              'pha',            'terminated', null,          '2026-02-28',   null,  false),
  ('TG', 'Tanja',       'Gautschy',     'tanja.gautschy@quickline.ch',     'pha',            'active',     null,          '2026-06-30',   40.00, true),
  ('JH', 'Jenny',       'Hofstetter',   'jennyhofstetter@yahoo.de',        'pha',            'active',     null,          '2026-10-31',   90.00, true),
  ('MH', 'Murielle',    'Hunziker',     'murielle.hunziker@quickline.ch',  'apprentice_pha', 'active',     null,          '2026-06-30',   null,  true),
  ('LT', 'Linda',       'Thoma',        'linda.thoma2010@gmail.com',       'apprentice_pha', 'active',     null,          '2026-06-30',   null,  true),
  ('LM', 'Lauren',      'Michel',       'lauren.michel@gmx.ch',            'auxiliary',      'active',     '2026-03-01',  null,           10.00, true),
  ('LH', 'Lenia',       'Hochuli',      'leniahochuli@icloud.com',         'pharmacist',     'planned',    '2026-04-01',  null,           90.00, true),
  ('JF', 'Janine',      'Fähnrich',      null,                              'pha',            'planned',    '2026-05-01',  null,           90.00, true);

-- ============================================================
-- SEED 2/3 — Weekly patterns (§3)
-- weekday: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
-- ============================================================
with emp as (select id, display_code from plan_employees)
insert into plan_weekly_patterns (employee_id, weekday, slot)
select e.id, wp.weekday, wp.slot
from emp e
join (values
  -- KR: Lu-Ma-Gio-Ve + sabato rotante
  ('KR', 0, 'FULL_DAY'),
  ('KR', 1, 'FULL_DAY'),
  ('KR', 3, 'FULL_DAY'),
  ('KR', 4, 'FULL_DAY'),
  ('KR', 5, 'SATURDAY_ROTATING'),
  -- UE: Ma-Me (+ occ sabato)
  ('UE', 1, 'FULL_DAY'),
  ('UE', 2, 'FULL_DAY'),
  ('UE', 5, 'SATURDAY_ROTATING'),
  -- CR: Ma-Me-Ve
  ('CR', 1, 'FULL_DAY'),
  ('CR', 2, 'FULL_DAY'),
  ('CR', 4, 'FULL_DAY'),
  -- IA: Lunedì + sabato rotante
  ('IA', 0, 'FULL_DAY'),
  ('IA', 5, 'SATURDAY_ROTATING'),
  -- ML: Lu-Me-Gio-Ve
  ('ML', 0, 'FULL_DAY'),
  ('ML', 2, 'FULL_DAY'),
  ('ML', 3, 'FULL_DAY'),
  ('ML', 4, 'FULL_DAY'),
  -- FF: Ma-Gio (+ occ sabato)
  ('FF', 1, 'FULL_DAY'),
  ('FF', 3, 'FULL_DAY'),
  ('FF', 5, 'SATURDAY_ROTATING'),
  -- ID: Lu-Gio-Ve
  ('ID', 0, 'FULL_DAY'),
  ('ID', 3, 'FULL_DAY'),
  ('ID', 4, 'FULL_DAY'),
  -- LO: solo sabato
  ('LO', 5, 'FULL_DAY'),
  -- MW: quasi full-time (Gen-Mar)
  ('MW', 0, 'FULL_DAY'),
  ('MW', 1, 'FULL_DAY'),
  ('MW', 2, 'FULL_DAY'),
  ('MW', 3, 'FULL_DAY'),
  ('MW', 4, 'FULL_DAY'),
  ('MW', 5, 'FULL_DAY'),
  -- RS: Ma-Me-Ve-Sab
  ('RS', 1, 'FULL_DAY'),
  ('RS', 2, 'FULL_DAY'),
  ('RS', 4, 'FULL_DAY'),
  ('RS', 5, 'FULL_DAY'),
  -- SB: Ma-Me-Ve (mezze giornate)
  ('SB', 1, 'MORNING'),
  ('SB', 2, 'MORNING'),
  ('SB', 4, 'MORNING'),
  -- SI: Gio-Ve (+ sabato) — Gen/Feb only
  ('SI', 3, 'FULL_DAY'),
  ('SI', 4, 'FULL_DAY'),
  ('SI', 5, 'SATURDAY_ROTATING'),
  -- TG: Mer + Sab
  ('TG', 2, 'FULL_DAY'),
  ('TG', 5, 'FULL_DAY'),
  -- JH: Lu-Ve
  ('JH', 0, 'FULL_DAY'),
  ('JH', 1, 'FULL_DAY'),
  ('JH', 2, 'FULL_DAY'),
  ('JH', 3, 'FULL_DAY'),
  ('JH', 4, 'FULL_DAY'),
  -- MH: Lu-Ma-Gio + sabato rotante (Mer/Ven scuola)
  ('MH', 0, 'FULL_DAY'),
  ('MH', 1, 'FULL_DAY'),
  ('MH', 3, 'FULL_DAY'),
  ('MH', 5, 'SATURDAY_ROTATING'),
  -- LT: Lu-Gio + sabato rotante
  ('LT', 0, 'FULL_DAY'),
  ('LT', 3, 'FULL_DAY'),
  ('LT', 5, 'SATURDAY_ROTATING'),
  -- LM: solo sabato
  ('LM', 5, 'FULL_DAY'),
  -- LH: full settimana (da Apr)
  ('LH', 0, 'FULL_DAY'),
  ('LH', 1, 'FULL_DAY'),
  ('LH', 2, 'FULL_DAY'),
  ('LH', 3, 'FULL_DAY'),
  ('LH', 4, 'FULL_DAY'),
  ('LH', 5, 'FULL_DAY'),
  -- JF: full settimana (da Mag)
  ('JF', 0, 'FULL_DAY'),
  ('JF', 1, 'FULL_DAY'),
  ('JF', 2, 'FULL_DAY'),
  ('JF', 3, 'FULL_DAY'),
  ('JF', 4, 'FULL_DAY'),
  ('JF', 5, 'FULL_DAY')
) as wp(code, weekday, slot) on wp.code = e.display_code;

-- ============================================================
-- SEED 3/3 — Training courses + participants (§9)
-- ============================================================
insert into plan_training_courses (code, title, location, start_date, start_time, end_time) values
  ('TOPKOMP_S1_A', 'TopKompetenz Schulung 1 — Migräne + Ohrengesundheit (giro A)',       'Baden/Olten', '2026-03-10', '09:00', '17:00'),
  ('TOPKOMP_S1_B', 'TopKompetenz Schulung 1 — Migräne + Ohrengesundheit (giro B)',       'Baden/Olten', '2026-03-24', '09:00', '17:00'),
  ('TOPKOMP_S2',   'TopKompetenz Schulung 2 — Reisegesundheit + Frauenthemen',           'Baden/Olten', '2026-06-11', '09:00', '17:00'),
  ('TOPKOMP_S3_A', 'TopKompetenz Schulung 3 — Herz-Kreislauf + Mundgesundheit (A)',      'Baden/Olten', '2026-09-08', '09:00', '17:00'),
  ('TOPKOMP_S3_B', 'TopKompetenz Schulung 3 — Herz-Kreislauf + Mundgesundheit (B)',      'Baden/Olten', '2026-09-09', '09:00', '17:00'),
  ('TOPKOMP_S3_C', 'TopKompetenz Schulung 3 — Herz-Kreislauf + Mundgesundheit (C)',      'Baden/Olten', '2026-09-15', '09:00', '17:00'),
  ('TOPKOMP_S4',   'TopKompetenz Schulung 4 — Allergie bei Kindern + Männergesundheit',  'Baden/Olten', '2026-11-12', '09:00', '17:00'),
  ('TP_SKIPPER_FORUM', 'TP Skipper — Kompetenz Forum Aarau',                             'Aarau',       '2026-05-06', null,    null),
  ('TP_SKIPPER_REG_1', 'TP Skipper — Regiositzung 1',                                    null,          '2026-03-19', null,    null),
  ('TP_SKIPPER_REG_2', 'TP Skipper — Regiositzung 2',                                    null,          '2026-05-27', null,    null),
  ('TP_SKIPPER_REG_3', 'TP Skipper — Regiositzung 3',                                    null,          '2026-09-02', null,    null),
  ('TP_SKIPPER_REG_4', 'TP Skipper — Regiositzung 4',                                    null,          '2026-11-05', null,    null),
  ('TP_NEU_NETCARE',   'TP Neue Kompetenzen — netcare',                                  null,          '2026-05-20', null,    null),
  ('TP_NEU_IMPFEN',    'TP Neue Kompetenzen — Impfen Zürich',                            'Zürich',      '2026-06-16', null,    null),
  ('MEDINF_05_05', 'Medinform Fortbildung',                                              'Zürich',      '2026-05-05', '13:30', '17:00'),
  ('MEDINF_07_05', 'Medinform Fortbildung',                                              'Zürich',      '2026-05-07', '13:30', '17:00'),
  ('MEDINF_12_05', 'Medinform Fortbildung',                                              'Zürich',      '2026-05-12', '08:00', '12:00'),
  ('MEDINF_28_05', 'Medinform Fortbildung',                                              'Zürich',      '2026-05-28', '08:00', '12:00');

with e as (select id, display_code from plan_employees),
     c as (select id, code from plan_training_courses)
insert into plan_training_participants (training_course_id, employee_id)
select c.id, e.id
from (values
  ('TOPKOMP_S1_A', 'IA'), ('TOPKOMP_S1_A', 'JH'),
  ('TOPKOMP_S1_B', 'ML'), ('TOPKOMP_S1_B', 'RS'),
  ('TOPKOMP_S2',   'IA'), ('TOPKOMP_S2',   'FF'),
  ('TOPKOMP_S3_A', 'IA'), ('TOPKOMP_S3_A', 'JH'),
  ('TOPKOMP_S3_B', 'MH'),
  ('TOPKOMP_S3_C', 'ML'),
  ('TOPKOMP_S4',   'ID'), ('TOPKOMP_S4',   'TG'),
  ('TP_SKIPPER_FORUM', 'FF'),
  ('TP_SKIPPER_REG_1', 'FF'),
  ('TP_SKIPPER_REG_2', 'RS'),
  ('TP_SKIPPER_REG_3', 'FF'),
  ('TP_SKIPPER_REG_4', 'RS'),
  ('TP_NEU_NETCARE',   'JH'),
  ('TP_NEU_IMPFEN',    'LH'),
  ('MEDINF_05_05', 'IA'), ('MEDINF_05_05', 'RS'), ('MEDINF_05_05', 'FF'), ('MEDINF_05_05', 'ID'),
  ('MEDINF_07_05', 'ID'), ('MEDINF_07_05', 'RS'),
  ('MEDINF_12_05', 'IA'),
  ('MEDINF_28_05', 'TG')
) as link(course_code, emp_code)
join c on c.code = link.course_code
join e on e.display_code = link.emp_code;
