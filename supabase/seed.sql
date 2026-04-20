-- Seed data for Pharma Plan Pro from docs/requisiti_muhen.md
-- Apply AFTER all migrations (0001-0008) have run.

-- ============================================================
-- SEED 1/3 — Employees (§2)
-- `active=false` for terminated staff (MW, SI).
-- ============================================================
insert into employees (display_code, first_name, last_name, email, role, employment_status, hired_at, left_at, weekly_hours_pct, active) values
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
-- One row per (employee, weekday) they normally work.
-- Saturday-rotating employees are NOT seeded here; rotation is
-- handled at scheduling time by the planning engine.
-- ============================================================
-- Pattern derivati da Arbeitsplan TPZ 2026 (threshold >=25% presenze per weekday).
-- LH (assunto da Apr) troppo pochi dati: pattern manuale full-week.
with emp as (select id, display_code from employees)
insert into weekly_patterns (employee_id, weekday, active)
select e.id, wp.weekday, true
from emp e
join (values
  ('CR', 1), ('CR', 2), ('CR', 4),
  ('FF', 1), ('FF', 3),
  ('IA', 0), ('IA', 5),
  ('ID', 0), ('ID', 3), ('ID', 4),
  ('JF', 4),
  ('JH', 0), ('JH', 2), ('JH', 3),
  ('KR', 0), ('KR', 1), ('KR', 2), ('KR', 3), ('KR', 4), ('KR', 5),
  ('LH', 0), ('LH', 1), ('LH', 2), ('LH', 3), ('LH', 4),
  ('LM', 5),
  ('LO', 5),
  ('LT', 0), ('LT', 3), ('LT', 5),
  ('MH', 0), ('MH', 1), ('MH', 3), ('MH', 5),
  ('ML', 0), ('ML', 2), ('ML', 3), ('ML', 4),
  ('MW', 0), ('MW', 1), ('MW', 2), ('MW', 4), ('MW', 5),
  ('RS', 1), ('RS', 2),
  ('SB', 1), ('SB', 2), ('SB', 4),
  ('SI', 3), ('SI', 4), ('SI', 5),
  ('TG', 2), ('TG', 5),
  ('UE', 1), ('UE', 2)
) as wp(code, weekday) on wp.code = e.display_code;

-- ============================================================
-- SEED 3/3 — Training courses + participants (§9)
-- ============================================================
insert into training_courses (code, title, location, start_date, start_time, end_time) values
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

with e as (select id, display_code from employees),
     c as (select id, code from training_courses)
insert into training_participants (training_course_id, employee_id)
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

-- ============================================================
-- SEED 4/4 — Coverage rules (HARD minimums from docs/info_extract.md)
-- weekday: 0=Mon … 5=Sat
-- time_window: 'all_day' | 'evening' (evening = after 17:45)
-- Source: MIN_COVERAGE derived from H1-2026 actuals.
-- ⚠️  Verify with Katja: minima observed may include emergency days.
-- ============================================================
insert into coverage_rules (weekday, role, min_required, time_window, note) values
  (0, 'pharmacist', 2, 'all_day', 'LUN farmacisti'),
  (0, 'pha',        1, 'all_day', 'LUN altri'),
  (1, 'pharmacist', 2, 'all_day', 'MAR farmacisti'),
  (1, 'pha',        1, 'all_day', 'MAR altri'),
  (2, 'pharmacist', 2, 'all_day', 'MER farmacisti'),
  (2, 'pha',        2, 'all_day', 'MER altri'),
  (3, 'pharmacist', 2, 'all_day', 'GIO farmacisti'),
  (3, 'pha',        1, 'all_day', 'GIO altri'),
  (4, 'pharmacist', 2, 'all_day', 'VEN farmacisti'),
  (4, 'pha',        2, 'all_day', 'VEN altri'),
  (5, 'pharmacist', 1, 'all_day', 'SAB farmacista'),
  (5, 'pha',        1, 'all_day', 'SAB altri');
