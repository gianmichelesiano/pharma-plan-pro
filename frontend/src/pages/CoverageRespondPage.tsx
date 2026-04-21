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
    const token = searchParams.get("token");
    const response = searchParams.get("response") as "accept" | "reject" | null;

    if (!token || (response !== "accept" && response !== "reject")) {
      setState("error");
      return;
    }

    respondToProposal(token, response)
      .then((data) => {
        if (data.error === "token_expired") setState("expired");
        else if (data.error === "already_responded") setState("already_responded");
        else if (data.result === "accepted") setState("accepted");
        else setState("rejected");
      })
      .catch(async (err: unknown) => {
        try {
          const body = err && typeof err === "object" && "context" in err
            ? await (err as { context: Response }).context.json()
            : {};
          if (body?.error === "token_expired") setState("expired");
          else if (body?.error === "already_responded") setState("already_responded");
          else setState("error");
        } catch {
          setState("error");
        }
      });
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
