import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import {
  fetchCoverageRequests,
  sendNext,
  cancelRequest,
  type CoverageRequest,
} from "../lib/coverage-requests";

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  proposed: "#f59e0b",
  accepted: "#22c55e",
  exhausted: "#ef4444",
  cancelled: "#94a3b8",
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(-2)}`;
}

function isExpired(request: CoverageRequest): boolean {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.expires_at) return false;
  return new Date(sent.expires_at) < new Date();
}

function currentCandidate(request: CoverageRequest): string {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.employee) return "—";
  return `${sent.employee.first_name} ${sent.employee.last_name}`;
}

function expiresLabel(request: CoverageRequest): string {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.expires_at) return "—";
  const diff = new Date(sent.expires_at).getTime() - Date.now();
  if (diff <= 0) return "Scaduto";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function CoverageRequestsPage() {
  const t = useT("coverage");
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["coverage_requests_open"],
    queryFn: fetchCoverageRequests,
    refetchInterval: 60_000,
  });

  const sendNextMutation = useMutation({
    mutationFn: (request_id: string) => sendNext(request_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (request_id: string) => cancelRequest(request_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] }),
  });

  const requests = requestsQuery.data ?? [];

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        {requestsQuery.isLoading ? <p>Caricamento...</p> : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <p>{t.noRequests}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t.shiftDate}</th>
                <th>{t.absentEmployee}</th>
                <th>{t.status}</th>
                <th>{t.currentCandidate}</th>
                <th>{t.expires}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.shift_date)}</td>
                  <td>
                    {r.absence?.employee
                      ? `${r.absence.employee.first_name} ${r.absence.employee.last_name}`
                      : "—"}
                  </td>
                  <td>
                    <span
                      style={{
                        background: STATUS_COLORS[r.status] ?? "#94a3b8",
                        color: "#fff",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {(t as unknown as Record<string, string>)[`status_${r.status}`] ?? r.status}
                    </span>
                  </td>
                  <td>{currentCandidate(r)}</td>
                  <td>{expiresLabel(r)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {r.status === "proposed" && isExpired(r) && (
                        <button
                          className="primary"
                          disabled={sendNextMutation.isPending}
                          onClick={() => sendNextMutation.mutate(r.id)}
                        >
                          {t.resend}
                        </button>
                      )}
                      {r.status === "exhausted" && (
                        <span style={{ color: "#ef4444", fontSize: "0.85rem" }}>{t.manualFix}</span>
                      )}
                      {(r.status === "pending" || r.status === "proposed") && (
                        <button
                          className="secondary"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(r.id)}
                        >
                          {t.cancel}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
