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
        if (data.error === "token_expired") setState("expired");
        else if (data.error === "already_responded") setState("already_responded");
        else if (data.result === "accepted") setState("accepted");
        else setState("rejected");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = err && typeof err === "object" && "context" in err
          ? (err as { context: { status: number } }).context.status
          : 0;
        if (status === 410) setState("expired");
        else if (status === 409) setState("already_responded");
        else setState("error");
      });

    return () => { cancelled = true; };
  }, []);

  const messages: Record<State, string> = {
    loading: "...",
    accepted: t.respondAccepted,
    rejected: t.respondRejected,
    expired: t.respondExpired,
    already_responded: t.respondAlreadyUsed,
    error: t.respondError,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        fontSize: "1.25rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <p>{messages[state]}</p>
    </div>
  );
}
