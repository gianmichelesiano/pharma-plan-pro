import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-body">
      {/* Left editorial side - hidden on mobile */}
      <section className="hidden lg:flex flex-col justify-between p-16 bg-surface-container-low relative overflow-hidden">
        <div className="z-10">
          <span className="font-headline font-bold text-primary text-2xl tracking-tight">Pharma Plan Pro</span>
          <div className="mt-24 max-w-md">
            <h1 className="font-headline text-5xl font-extrabold text-primary leading-tight mb-8">
              Pianificazione turni per TPZ.
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Piano del personale per la farmacia TPZ, adattato al tuo flusso svizzero.
            </p>
          </div>
        </div>
        {/* Decorative blurs */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-2xl" />
        <div className="z-10">
          <p className="text-xs uppercase tracking-widest text-outline">Pharma Plan Pro · TPZ Muhen</p>
        </div>
      </section>

      {/* Right form side */}
      <section className="flex items-center justify-center p-8 bg-surface-container-lowest">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <span className="font-headline font-bold text-primary text-xl">Pharma Plan Pro</span>
          </div>
          <div className="mb-8 text-center lg:text-left">
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-1">Benvenuto</h2>
            <p className="text-on-surface-variant text-sm">Accedi al tuo percorso accademico.</p>
          </div>

          {/* Toggle Accedi/Registrati */}
          <div className="flex p-1 rounded-full bg-surface-container-low mb-8">
            <button
              type="button"
              className="flex-1 py-2 text-sm font-medium rounded-full bg-surface-container-lowest text-primary shadow-card transition-all"
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="flex-1 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all"
            >
              Registrati
            </button>
          </div>

          {error && <p className="text-error text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-caps block mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="nome@esempio.it"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5 px-1">
                <label className="label-caps">Password</label>
                <a href="#" className="text-xs text-primary hover:text-primary-container transition-colors">
                  Password dimenticata?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-sm shadow-[0px_12px_32px_rgba(0,95,106,0.15)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? "Accesso..." : "Accedi alla Piattaforma"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Non hai un account?{" "}
            <Link to="/register" className="underline hover:text-primary">
              Registrati
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
