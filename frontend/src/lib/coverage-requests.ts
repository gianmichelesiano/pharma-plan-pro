import { supabase } from "./supabase";

export type CoverageRequest = {
  id: string;
  absence_id: string;
  shift_date: string;
  role: string;
  status: "pending" | "proposed" | "accepted" | "exhausted" | "cancelled";
  timeout_hours: number;
  created_at: string;
  updated_at: string;
  absence: {
    employee: { first_name: string; last_name: string } | null;
  } | null;
  proposals: CoverageProposal[];
};

export type CoverageProposal = {
  id: string;
  request_id: string;
  employee_id: string;
  attempt_order: number;
  status: "pending" | "sent" | "accepted" | "rejected" | "expired";
  expires_at: string | null;
  employee: { first_name: string; last_name: string } | null;
};

export async function fetchCoverageRequests(): Promise<CoverageRequest[]> {
  const { data, error } = await supabase
    .from("coverage_requests")
    .select(`
      *,
      absence:absences(employee:employees(first_name, last_name)),
      proposals:coverage_proposals(*, employee:employees(first_name, last_name))
    `)
    .not("status", "in", '("accepted","cancelled")')
    .order("shift_date");
  if (error) throw error;
  return data as unknown as CoverageRequest[];
}

export type CandidatePreview = {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  pattern_type: "standard" | "accessory" | "none";
  shift_count: number;
  available: boolean;
  unavailable_reason?: "already_shifted" | "absent";
};

export async function previewCandidates(absence_id: string, shift_date: string): Promise<CandidatePreview[]> {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "preview", absence_id, shift_date },
  });
  if (error) throw error;
  return (data as { candidates: CandidatePreview[] }).candidates;
}

export async function initiateRequest(absence_id: string, shift_date: string) {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "initiate", absence_id, shift_date },
  });
  if (error) throw error;
  return data as { ok: boolean; request_id: string; already_open?: boolean; exhausted?: boolean };
}

export async function sendNext(request_id: string) {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "send_next", request_id },
  });
  if (error) throw error;
  return data;
}

export async function respondToProposal(token: string, response: "accept" | "reject") {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const functionUrl = `${supabaseUrl}/functions/v1/absence-coverage`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "respond", token, response }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = Object.assign(new Error(data?.error ?? "error"), { context: { status: res.status } });
    throw err;
  }
  return data as { ok: boolean; result: "accepted" | "rejected"; error?: string };
}

export async function manualAssign(request_id: string, employee_id: string) {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "manual_assign", request_id, employee_id },
  });
  if (error) throw error;
  return data;
}

export async function cancelRequest(request_id: string) {
  const { error } = await supabase
    .from("coverage_requests")
    .update({ status: "cancelled" })
    .eq("id", request_id);
  if (error) throw error;
}
