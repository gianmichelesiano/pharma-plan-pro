import { useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;
  email: string | null;
  admin: boolean;
  approved: boolean;
};

export function AdminUsersPage() {
  const t = useT("users");
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
    if (error) return alert(`${t.errorSaving}: ${error.message}`);
    load();
  }

  if (loading) return <div style={{ padding: 24 }}>{t.loadingUsers}</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h1>{t.title}</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>{t.emailHeader}</th>
            <th style={th}>{t.adminHeader}</th>
            <th style={th}>{t.statusHeader}</th>
            <th style={th}>{t.actionsHeader}</th>
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
              <td style={td}>{r.approved ? t.approved : t.pending}</td>
              <td style={td}>
                {!r.approved ? (
                  <button onClick={() => update(r.id, { approved: true })}>{t.approve}</button>
                ) : (
                  <button onClick={() => update(r.id, { approved: false })}>{t.revoke}</button>
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
