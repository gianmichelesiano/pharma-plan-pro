import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

export type Absence = Database["public"]["Tables"]["absences"]["Row"];
export type AbsenceInsert = Database["public"]["Tables"]["absences"]["Insert"];

export type AbsenceWithEmployee = Absence & {
  employees: { display_code: string; first_name: string; last_name: string } | null;
};

export async function listAbsences(): Promise<AbsenceWithEmployee[]> {
  const { data, error } = await supabase
    .from("absences")
    .select("*, employees(display_code, first_name, last_name)")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data as unknown as AbsenceWithEmployee[];
}

export async function createAbsence(payload: AbsenceInsert): Promise<Absence> {
  const { data, error } = await supabase.from("absences").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAbsence(id: string): Promise<void> {
  const { error } = await supabase.from("absences").delete().eq("id", id);
  if (error) throw error;
}
