-- Treat role='pha' in coverage_rules as "any non-pharmacist operator".
-- Role='pharmacist' stays exact match.

create or replace function get_coverage_issues(p_start date, p_end date)
returns table (
  issue_date date,
  kind text,
  role employee_role,
  required smallint,
  assigned smallint,
  employee_id uuid,
  severity text
)
language sql stable as $$
  with days as (
    select generate_series(p_start, p_end, interval '1 day')::date as d
  ),
  shortage as (
    select
      d.d as issue_date,
      'shortage'::text as kind,
      r.role,
      r.min_required as required,
      coalesce(sum(
        case
          when r.role = 'pharmacist' and e.role = 'pharmacist' then 1
          when r.role = 'pha' and e.role != 'pharmacist' then 1
          else 0
        end
      ), 0)::smallint as assigned,
      null::uuid as employee_id,
      'critical'::text as severity
    from days d
    join coverage_rules r
      on r.weekday = ((extract(isodow from d.d)::int + 6) % 7)
      and r.time_window = 'all_day'
    left join shifts s on s.shift_date = d.d
    left join employees e on e.id = s.employee_id
    group by d.d, r.role, r.min_required
    having coalesce(sum(
      case
        when r.role = 'pharmacist' and e.role = 'pharmacist' then 1
        when r.role = 'pha' and e.role != 'pharmacist' then 1
        else 0
      end
    ), 0) < r.min_required
  ),
  conflict as (
    select
      s.shift_date as issue_date,
      'conflict'::text as kind,
      null::employee_role as role,
      null::smallint as required,
      null::smallint as assigned,
      s.employee_id,
      'critical'::text as severity
    from shifts s
    join absences a on a.employee_id = s.employee_id
      and s.shift_date between a.start_date and a.end_date
      and a.status = 'approved'
    where s.shift_date between p_start and p_end
  )
  select * from shortage
  union all
  select * from conflict;
$$;
