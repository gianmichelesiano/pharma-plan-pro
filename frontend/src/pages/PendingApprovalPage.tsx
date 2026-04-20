import { useAuth } from "../contexts/AuthContext";

export function PendingApprovalPage() {
  const { session, signOut } = useAuth();

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <span className="brand-mark" style={{ margin: "0 auto 0.75rem", display: "block", width: "3rem", height: "3rem" }}>PP</span>
        <h1>In attesa di approvazione</h1>
        <p style={{ marginTop: "1rem" }}>
          L'account <strong>{session?.user?.email}</strong> è stato creato.
          <br />
          Un amministratore deve approvarlo prima dell'accesso.
        </p>
        <button onClick={() => signOut()} style={{ marginTop: "1.5rem" }}>Esci</button>
      </div>
    </div>
  );
}
