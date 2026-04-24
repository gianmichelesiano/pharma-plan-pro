import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import {
  fetchCoverageRequests,
  sendNext,
  cancelRequest,
  previewCandidates,
  manualAssign,
  type CoverageRequest,
  type CandidatePreview,
} from "../lib/coverage-requests";
import { CandidatePreviewModal } from "../components/CandidatePreviewModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

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
  const accepted = request.proposals.find((p) => p.status === "accepted");
  if (accepted?.employee) {
    return `${accepted.employee.first_name} ${accepted.employee.last_name}`;
  }
  const sent = request.proposals.find((p) => p.status === "sent");
  if (sent?.employee) {
    return `${sent.employee.first_name} ${sent.employee.last_name}`;
  }
  return "—";
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

function statusLabel(translations: Record<string, string>, status: string) {
  return translations[`status_${status}`] ?? status;
}

export function CoverageRequestsPage() {
  const t = useT("coverage");
  const c = useT("common");
  const labels = t as unknown as Record<string, string>;
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  type ManualModal = { shift_date: string; candidates: CandidatePreview[]; request_id: string } | null;
  const [manualModal, setManualModal] = useState<ManualModal>(null);
  const { confirmState, confirm, cancel } = useConfirm();
  const [manualLoading, setManualLoading] = useState<string | null>(null);

  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).toISOString().slice(0, 10);

  const requestsQuery = useQuery({
    queryKey: ["coverage_requests_all", monthStart, monthEnd],
    queryFn: () => fetchCoverageRequests({ start: monthStart, end: monthEnd, includeClosed: true }),
    refetchInterval: 60_000,
  });

  const sendNextMutation = useMutation({
    mutationFn: (request_id: string) => sendNext(request_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (request_id: string) => cancelRequest(request_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
    },
  });

  const requests = requestsQuery.data ?? [];

  return (
    <>
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <label className="field">
            <span>{c.month}</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {c.months.map((label, i) => <option key={label} value={i}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{c.year}</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        {requestsQuery.isLoading ? <p>Caricamento...</p> : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <p>{t.noRequests}</p>
        ) : (
          <>
            <div className="table-scroll table-responsive-desktop">
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
                          className="status-chip"
                          style={{ background: STATUS_COLORS[r.status] ?? "#94a3b8" }}
                        >
                          {statusLabel(labels, r.status)}
                        </span>
                      </td>
                      <td>{currentCandidate(r)}</td>
                      <td>{expiresLabel(r)}</td>
                      <td>
                        <div className="table-actions">
                          {r.status === "proposed" && isExpired(r) ? (
                            <button
                              className="primary"
                              disabled={sendNextMutation.isPending}
                              onClick={() => sendNextMutation.mutate(r.id)}
                            >
                              {t.resend}
                            </button>
                          ) : null}
                          {r.status === "exhausted" ? (
                            <button
                              className="secondary"
                              disabled={manualLoading === r.id}
                              onClick={async () => {
                                setManualLoading(r.id);
                                try {
                                  const candidates = await previewCandidates(r.absence_id, r.shift_date);
                                  setManualModal({ shift_date: r.shift_date, candidates, request_id: r.id });
                                } finally {
                                  setManualLoading(null);
                                }
                              }}
                            >
                              {t.manualFix}
                            </button>
                          ) : null}
                          {r.status === "pending" || r.status === "proposed" ? (
                            <button
                              className="secondary"
                              disabled={cancelMutation.isPending}
                              onClick={async () => { const ok = await confirm({ title: "Annulla richiesta", message: "Sei sicuro di voler annullare questa richiesta di copertura?", confirmLabel: "Annulla richiesta" }); if (ok) cancelMutation.mutate(r.id); }}
                            >
                              {t.cancel}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {requests.map((r) => (
                <article key={r.id} className="mobile-card">
                  <div className="mobile-card-head">
                    <div>
                      <h3 className="mobile-card-title">{formatDate(r.shift_date)}</h3>
                      <p className="mobile-card-subtitle">
                        {r.absence?.employee ? `${r.absence.employee.first_name} ${r.absence.employee.last_name}` : "—"}
                      </p>
                    </div>
                    <span className="status-chip" style={{ background: STATUS_COLORS[r.status] ?? "#94a3b8" }}>
                      {statusLabel(labels, r.status)}
                    </span>
                  </div>
                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">{t.currentCandidate}</span>
                      <span className="mobile-card-value">{currentCandidate(r)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">{t.expires}</span>
                      <span className="mobile-card-value">{expiresLabel(r)}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    {r.status === "proposed" && isExpired(r) ? (
                      <button
                        className="primary"
                        disabled={sendNextMutation.isPending}
                        onClick={() => sendNextMutation.mutate(r.id)}
                      >
                        {t.resend}
                      </button>
                    ) : null}
                    {r.status === "exhausted" ? (
                      <button
                        className="secondary"
                        disabled={manualLoading === r.id}
                        onClick={async () => {
                          setManualLoading(r.id);
                          try {
                            const candidates = await previewCandidates(r.absence_id, r.shift_date);
                            setManualModal({ shift_date: r.shift_date, candidates, request_id: r.id });
                          } finally {
                            setManualLoading(null);
                          }
                        }}
                      >
                        {t.manualFix}
                      </button>
                    ) : null}
                    {r.status === "pending" || r.status === "proposed" ? (
                      <button
                        className="secondary"
                        disabled={cancelMutation.isPending}
                        onClick={async () => { const ok = await confirm({ title: "Annulla richiesta", message: "Sei sicuro di voler annullare questa richiesta di copertura?", confirmLabel: "Annulla richiesta" }); if (ok) cancelMutation.mutate(r.id); }}
                      >
                        {t.cancel}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>

    {manualModal && (
      <CandidatePreviewModal
        shiftDate={manualModal.shift_date}
        candidates={manualModal.candidates}
        confirmLabel=""
        cancelLabel="Chiudi"
        subtitleText="Seleziona un dipendente e invia la richiesta: resterà in attesa della sua approvazione."
        noCandidatesText="Nessun dipendente trovato."
        actionHelpText="Assegna: invia la richiesta al dipendente selezionato e attende la sua risposta."
        onAssign={async (employee_id) => {
          await manualAssign(manualModal.request_id, employee_id);
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
        }}
        onClose={() => {
          setManualModal(null);
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
        }}
      />
    )}
    {confirmState && (
      <ConfirmDialog
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={cancel}
      />
    )}
    </>
  );
}
