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
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-dialog-lg">
        <h3 className="modal-title">{shiftDate.slice(5)}</h3>
        <p className="modal-message">{subtitleText}</p>

        {candidates.length === 0 ? (
          <p className="modal-error">{noCandidatesText}</p>
        ) : (
          <>
            <p className="modal-meta">
              {available.length} disponibili su {candidates.length}
            </p>
            <div className="table-scroll">
              <table className="table modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>Turni</th>
                    <th>Stato</th>
                    {onAssign ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((cand, i) => {
                    const isFirst = i === 0 && cand.available;
                    const rowStyle: React.CSSProperties = {
                      background: isFirst ? "#f0fdf4" : undefined,
                      opacity: cand.available ? 1 : 0.7,
                    };

                    return (
                      <tr key={cand.employee_id} style={rowStyle}>
                        <td style={{ fontWeight: isFirst ? 600 : undefined }}>{i + 1}</td>
                        <td style={{ fontWeight: isFirst ? 600 : undefined }}>{cand.first_name} {cand.last_name}</td>
                        <td>{cand.available ? cand.shift_count : "—"}</td>
                        <td>
                          {!cand.available ? (
                            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>
                              {cand.unavailable_reason === "absent"
                                ? "assente"
                                : cand.unavailable_reason === "already_shifted"
                                  ? "già in turno"
                                  : "nessuna disponibilità"}
                            </span>
                          ) : cand.pattern_type === "accessory" ? (
                            <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>
                              accessorio
                            </span>
                          ) : (
                            <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: "6px", padding: "1px 6px", fontSize: "0.75rem" }}>
                              standard
                            </span>
                          )}
                        </td>
                        {onAssign ? (
                          <td>
                            {cand.unavailable_reason !== "already_shifted" ? (
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
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{cancelLabel}</button>
          {onConfirm && available.length > 0 ? (
            <button type="button" className="primary" disabled={isPending} onClick={onConfirm}>
              {confirmLabel}
            </button>
          ) : null}
        </div>
        {actionHelpText ? <p className="modal-footer-note">{actionHelpText}</p> : null}
      </div>
    </div>
  );
}
