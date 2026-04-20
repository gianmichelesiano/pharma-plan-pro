import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type CoverageIssue = {
  issue_date: string;
  kind: "shortage" | "conflict";
  role: string | null;
  required: number | null;
  assigned: number | null;
  employee_id: string | null;
  severity: string;
};

export function useCoverageIssues(start: string, end: string) {
  return useQuery({
    queryKey: ["coverage_issues", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_coverage_issues", {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return (data ?? []) as CoverageIssue[];
    },
    enabled: !!start && !!end,
  });
}

export function issuesByDate(issues: CoverageIssue[]): Map<string, CoverageIssue[]> {
  const map = new Map<string, CoverageIssue[]>();
  for (const i of issues) {
    const arr = map.get(i.issue_date) ?? [];
    arr.push(i);
    map.set(i.issue_date, arr);
  }
  return map;
}

export function roleLabel(role: string | null): string {
  switch (role) {
    case "pharmacist": return "farm";
    case "pha": return "op";
    case "apprentice_pha": return "app";
    case "driver": return "drv";
    case "auxiliary": return "aux";
    default: return role ?? "?";
  }
}
