import { useState } from "react";
import { supabase } from "../lib/supabase";

export function EmailTestPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Test email Pharma Plan");
  const [body, setBody] = useState("<p>Email di prova dal servizio <b>send-email</b>.</p>");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html: body },
      });
      if (error) throw error;
      setResult(JSON.stringify(data));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "1rem" }}>
      <h1>Email Test</h1>
      <form onSubmit={handleSend} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Destinatario
          <input
            type="email"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="nome@example.com"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          Oggetto
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          Corpo HTML
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: "0.5rem", fontFamily: "monospace" }}
          />
        </label>
        <button type="submit" disabled={loading} style={{ padding: "0.6rem 1rem" }}>
          {loading ? "Invio..." : "Invia email"}
        </button>
      </form>
      {result && <p style={{ color: "green", marginTop: "1rem" }}>✓ Inviata: {result}</p>}
      {error && <p style={{ color: "crimson", marginTop: "1rem" }}>✗ {error}</p>}
    </div>
  );
}
