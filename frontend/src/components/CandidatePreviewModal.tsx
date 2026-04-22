import React, { useState } from "react";
import type { CandidatePreview } from "../lib/coverage-requests";

type Props = {
  shiftDate: string;
  candidates: CandidatePreview[];
  isPending?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  subtitleText: string;
  noCandidatesText: string;
  actionHelpText?: string;
  onConfirm?: () => void;
  onAssign?: (employee_id: string) => Promise<void>;
  onClose: () => void;
};

export function CandidatePreviewModal({
  shiftDate,
  candidates,
  isPending,
  confirmLabel,
  cancelLabel,
  subtitleText,
  noCandidatesText,
  actionHelpText,
  onConfirm,
  onAssign,
  onClose,
}: Props) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const available = candidates.filter((c) => c.available);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", minWidth: "420px", maxWidth: "580px", width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 0.25rem" }}>{shiftDate.slice(5)}</h3>
        <p style={{ margin: "0 0 1rem", color: "#666", fontSize: "0.875rem" }}>{subtitleText}</p>

        {candidates.length === 0 ? (
          <p style={{ color: "#c0392b" }}>{noCandidatesText}</p>
        ) : (
          <>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#555" }}>
              {available.length} disponibili su {candidates.length}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", marginBottom: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>#</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Nome</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Turni</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Stato</th>
                  {onAssign && <th style={{ padding: "0.4rem 0.5rem" }}></th>}
                </tr>
              </thead>
              <tbody>
                {candidates.map((cand, i) => {
                  const isFirst = i === 0 && cand.available;
                  const rowStyle: React.CSSProperties = {
                    borderBottom: "1px solid #f3f4f6",
                    background: isFirst ? "#f0fdf4" : undefined,
                    opacity: cand.available ? 1 : 0.7,
                  };
                  return (
                    <tr key={cand.employee_id} style={rowStyle}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: isFirst ? 600 : undefined }}>{i + 1}</td>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: isFirst ? 600 : undefined }}>{cand.first_name} {cand.last_name}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>{cand.available ? cand.shift_count : "—"}</td>
                      <td style={{ padding: "0.4rem 0.5rem" }}>
                        {!cand.available
                          ? <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>
                              {cand.unavailable_reason === "absent" ? "assente" : cand.unavailable_reason === "already_shifted" ? "già in turno" : "nessuna disponibilità"}
                            </span>
                          : cand.pattern_type === "accessory"
                            ? <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>accessorio</span>
                            : <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>standard</span>
                        }
                      </td>
                      {onAssign && (
                        <td style={{ padding: "0.4rem 0.5rem" }}>
                          {cand.unavailable_reason !== "already_shifted" && (
                            <button
                              type="button"
                              className="primary"
                              disabled={assigningId === cand.employee_id}
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                              onClick={async () => {
                                setAssigningId(cand.employee_id);
                                try {
                                  await onAssign(cand.employee_id);
                                  onClose();
                                } finally {
                                  setAssigningId(null);
                                }
                              }}
                            >
                              {assigningId === cand.employee_id ? "..." : "Assegna"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onClose}>{cancelLabel}</button>
          {onConfirm && available.length > 0 && (
            <button type="button" className="primary" disabled={isPending} onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </div>
        {actionHelpText ? (
          <p style={{ margin: "0.75rem 0 0", color: "#666", fontSize: "0.78rem" }}>{actionHelpText}</p>
        ) : null}
      </div>
    </div>
  );
}
