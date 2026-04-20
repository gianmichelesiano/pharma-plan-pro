import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LANG_FLAGS, LANG_NAMES, nextLang } from "../i18n/translations";
import { useT } from "../i18n/useT";

export function LoginPage() {
  const { session, signIn } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const t = useT("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginError);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <button
            className="lang-switcher"
            onClick={() => setLang(nextLang(lang))}
            title={`Switch to ${LANG_NAMES[nextLang(lang)]}`}
            style={{ alignSelf: "flex-end", marginBottom: "0.5rem" }}
          >
            <span>{LANG_FLAGS[lang]}</span>
            <span>{LANG_NAMES[lang]}</span>
          </button>
          <span className="brand-mark" style={{ margin: "0 auto 0.75rem", display: "block", width: "3rem", height: "3rem" }}>PP</span>
          <h1>Pharma Plan</h1>
          <p>TPZ Muhen</p>
        </div>

        <div className="auth-tabs">
          <button type="button" className="auth-tab active">{t.login}</button>
          <Link to="/register" style={{ flex: 1, textDecoration: "none" }}>
            <button type="button" className="auth-tab" style={{ width: "100%" }}>{t.register}</button>
          </Link>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
            />
          </label>
          <label className="field">
            <span>{t.password}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? t.loading : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
