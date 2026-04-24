import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
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

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.title} />
      <div className="card">
        {loading ? <p>{t.loadingUsers}</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {!loading ? (
          <>
            <div className="table-scroll table-responsive-desktop">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.emailHeader}</th>
                    <th>{t.adminHeader}</th>
                    <th>{t.statusHeader}</th>
                    <th>{t.actionsHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.email ?? "—"}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.admin}
                          onChange={(e) => update(r.id, { admin: e.target.checked })}
                          style={{ accentColor: "#2d7a4f", width: "1.1rem" }}
                        />
                      </td>
                      <td>
                        <span className={r.approved ? "status-badge active" : "status-badge inactive"}>
                          {r.approved ? t.approved : t.pending}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {!r.approved ? (
                            <button onClick={() => update(r.id, { approved: true })}>{t.approve}</button>
                          ) : (
                            <button className="secondary" onClick={() => update(r.id, { approved: false })}>{t.revoke}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {rows.map((r) => (
                <article key={r.id} className="mobile-card">
                  <div className="mobile-card-head">
                    <div>
                      <h3 className="mobile-card-title">{r.email ?? "—"}</h3>
                    </div>
                    <span className={r.approved ? "status-badge active" : "status-badge inactive"}>
                      {r.approved ? t.approved : t.pending}
                    </span>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={r.admin}
                      onChange={(e) => update(r.id, { admin: e.target.checked })}
                    />
                    <span>{t.adminHeader}</span>
                  </label>
                  <div className="mobile-card-actions">
                    {!r.approved ? (
                      <button onClick={() => update(r.id, { approved: true })}>{t.approve}</button>
                    ) : (
                      <button className="secondary" onClick={() => update(r.id, { approved: false })}>{t.revoke}</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
