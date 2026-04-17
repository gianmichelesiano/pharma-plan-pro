import { ChangeEvent, FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type RegisterForm = {
  full_name: string;
  email: string;
  password: string;
  confirm: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { session, signUp } = useAuth();
  const [form, setForm] = useState<RegisterForm>({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  if (session) return <Navigate to="/" replace />;

  function set<K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Le password non coincidono");
      return;
    }
    if (form.password.length < 6) {
      setError("Password minimo 6 caratteri");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { needsEmailConfirm } = await signUp(form.email, form.password, form.full_name);
      if (needsEmailConfirm) {
        setDone(true);
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="card text-center max-w-sm mx-4">
          <span
            className="material-symbols-outlined text-primary text-5xl mb-4 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mark_email_read
          </span>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Controlla la tua email</h2>
          <p className="text-secondary text-sm mb-6">
            Ti abbiamo inviato un link di conferma. Clicca il link per attivare il tuo account.
          </p>
          <button onClick={() => navigate("/login")} className="btn-primary w-full">
            Vai al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-body">
      <section className="hidden lg:flex flex-col justify-between p-16 bg-surface-container-low relative overflow-hidden">
        <div className="z-10">
          <span className="font-headline font-bold text-primary text-2xl tracking-tight">Pharma Plan Pro</span>
          <div className="mt-24 max-w-md">
            <h1 className="font-headline text-5xl font-extrabold text-primary leading-tight mb-8">
              Benvenuto in Pharma Plan Pro.
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Gestisci team, turni e assenze in un unico posto.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-2xl" />
        <div className="z-10">
          <p className="text-xs uppercase tracking-widest text-outline">Pharma Plan Pro · TPZ Muhen</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-8 bg-surface-container-lowest">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <span className="font-headline font-bold text-primary text-xl">Pharma Plan Pro</span>
          </div>
          <div className="mb-8 text-center lg:text-left">
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-1">Crea account</h2>
            <p className="text-on-surface-variant text-sm">Inizia gratis, nessuna carta richiesta.</p>
          </div>

          <div className="flex p-1 rounded-full bg-surface-container-low mb-8">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex-1 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all"
            >
              Accedi
            </button>
            <button
              type="button"
              className="flex-1 py-2 text-sm font-medium rounded-full bg-surface-container-lowest text-primary shadow-card transition-all"
            >
              Registrati
            </button>
          </div>

          {error && <p className="text-error text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-caps block mb-1.5 ml-1">Nome completo</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => set("full_name", e.target.value)}
                className="input"
                placeholder="Dr. Mario Rossi"
                required
              />
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => set("email", e.target.value)}
                className="input"
                placeholder="nome@esempio.it"
                required
              />
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("password", e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            <div>
              <label className="label-caps block mb-1.5 ml-1">Conferma password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => set("confirm", e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showConfirm ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-sm shadow-[0px_12px_32px_rgba(0,95,106,0.15)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? "Creazione..." : "Crea account"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Hai già un account?{" "}
            <Link to="/login" className="underline hover:text-primary">
              Accedi
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
