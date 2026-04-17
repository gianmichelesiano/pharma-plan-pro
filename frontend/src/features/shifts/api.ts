import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

export type Shift = Database["public"]["Tables"]["plan_shifts"]["Row"];
export type ShiftInsert = Database["public"]["Tables"]["plan_shifts"]["Insert"];

export type ShiftWithEmployee = Shift & {
  plan_employees: { display_code: string } | null;
};

export async function listShiftsForMonth(year: number, month0: number): Promise<ShiftWithEmployee[]> {
  const first = new Date(Date.UTC(year, month0, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month0 + 1, 0)).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("plan_shifts")
    .select("*, plan_employees(display_code)")
    .gte("shift_date", first)
    .lte("shift_date", last)
    .order("shift_date");
  if (error) throw error;
  return data as unknown as ShiftWithEmployee[];
}

export async function createShift(payload: ShiftInsert): Promise<Shift> {
  const { data, error } = await supabase.from("plan_shifts").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from("plan_shifts").delete().eq("id", id);
  if (error) throw error;
}
