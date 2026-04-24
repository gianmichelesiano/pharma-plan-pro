import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { respondToProposal } from "../lib/coverage-requests";
import { useT } from "../i18n/useT";

type State = "loading" | "accepted" | "rejected" | "expired" | "already_responded" | "error";

export function CoverageRespondPage() {
  const [searchParams] = useSearchParams();
  const t = useT("coverage");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;

    const token = searchParams.get("token");
    const response = searchParams.get("response") as "accept" | "reject" | null;

    if (!token || (response !== "accept" && response !== "reject")) {
      setState("error");
      return;
    }

    respondToProposal(token, response)
      .then((data) => {
        if (cancelled) return;
        const payload = (data ?? {}) as { error?: string; result?: string };
        if (payload.error === "token_expired") setState("expired");
        else if (payload.error === "already_responded") setState("already_responded");
        else if (payload.result === "accepted") setState("accepted");
        else if (payload.result === "rejected") setState("rejected");
        else setState("error");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const maybe = err as { context?: { status?: number } } | null;
        const status = maybe?.context?.status ?? 0;
        if (status === 410) setState("expired");
        else if (status === 409) setState("already_responded");
        else setState("error");
      });

    return () => { cancelled = true; };
  }, [searchParams]);

  const messages: Record<State, string> = {
    loading: "...",
    accepted: t.respondAccepted || "Request accepted.",
    rejected: t.respondRejected || "Response saved.",
    expired: t.respondExpired || "Link expired.",
    already_responded: t.respondAlreadyUsed || "Response already submitted.",
    error: t.respondError || "Error while processing the request.",
  };

  return (
    <div className="center-page">
      <div className="card center-card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.2rem", color: "#16392c" }}>Copertura turno</h2>
        <p style={{ margin: 0, color: "#355445" }}>{messages[state] || "—"}</p>
      </div>
    </div>
  );
}
