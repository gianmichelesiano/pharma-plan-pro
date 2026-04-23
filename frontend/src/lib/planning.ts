import type { Tables } from "./database.types";

type Employee = Tables<"employees">;
type ShiftRow = Tables<"shifts"> & { employee?: Pick<Employee, "id" | "first_name" | "last_name" | "display_code" | "role"> };
type WeeklyPatternNoteRow = Pick<Tables<"weekly_patterns">, "employee_id" | "weekday" | "special_note" | "pattern_type"> & {
  employee?: Pick<Employee, "display_code"> | null;
};
type DailyPlanningNoteRow = Pick<Tables<"daily_notes">, "id" | "note_date" | "text" | "title">;

export type PlanningEmployee = Employee;
export type PlanningShiftRow = ShiftRow;
export type PlanningPatternNoteRow = WeeklyPatternNoteRow;
export type PlanningDailyNoteRow = DailyPlanningNoteRow;

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const s = new Date(Date.UTC(year, month - 1, 1));
  const e = new Date(Date.UTC(year, month, 0));
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}

export function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function formatDateLabel(dateStr: string, lang: string): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, da));
  const locale = { it: "it-IT", en: "en-GB", de: "de-DE", fr: "fr-FR" }[lang] ?? "en-GB";
  const label = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthYearLabel(year: number, month: number, lang: string): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const locale = { it: "it-IT", en: "en-GB", de: "de-DE", fr: "fr-FR" }[lang] ?? "en-GB";
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isWeekend(dateStr: string): boolean {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function weekdayMon0(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
}
