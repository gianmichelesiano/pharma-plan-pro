import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;
  email: string | null;
  admin: boolean;
  approved: boolean;
};

export function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, admin, approved")
      .order("approved", { ascending: true })
      .order("email");
    if (error) setError(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function update(id: string, patch: Partial<Pick<Row, "admin" | "approved">>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return alert(error.message);
    load();
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Gestione utenti</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Email</th>
            <th style={th}>Admin</th>
            <th style={th}>Stato</th>
            <th style={th}>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}>{r.email ?? "—"}</td>
              <td style={td}>
                <input
                  type="checkbox"
                  checked={r.admin}
                  onChange={(e) => update(r.id, { admin: e.target.checked })}
                  style={{ accentColor: "#2d7a4f" }}
                />
              </td>
              <td style={td}>{r.approved ? "Approvato" : "In attesa"}</td>
              <td style={td}>
                {!r.approved ? (
                  <button onClick={() => update(r.id, { approved: true })}>Approva</button>
                ) : (
                  <button onClick={() => update(r.id, { approved: false })}>Revoca</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #444" };
const td: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #333" };
