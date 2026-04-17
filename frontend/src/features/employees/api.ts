import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
export type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

export async function listEmployees(onlyActive: boolean): Promise<Employee[]> {
  let q = supabase.from("employees").select("*").order("display_code", { ascending: true });
  if (onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createEmployee(payload: EmployeeInsert): Promise<Employee> {
  const { data, error } = await supabase.from("employees").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id: string, payload: EmployeeUpdate): Promise<Employee> {
  const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function toggleEmployeeActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("employees").update({ active }).eq("id", id);
  if (error) throw error;
}
