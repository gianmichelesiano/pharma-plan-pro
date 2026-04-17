import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LANG_FLAGS, LANG_NAMES, nextLang } from "../i18n/translations";
import { useT } from "../i18n/useT";

const navRoutes = [
  { to: "/", key: "dashboard" as const },
  { to: "/rules", key: "rules" as const },
  { to: "/employees", key: "employees" as const },
  { to: "/availability", key: "availability" as const },
  { to: "/absences", key: "absences" as const },
  { to: "/schedule", key: "schedule" as const },
  { to: "/training", key: "training" as const },
  { to: "/piano", key: "piano" as const },
];

export function AppShell() {
  const { lang, setLang } = useLanguage();
  const { session, signOut } = useAuth();
  const nav = useT("nav");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">PP</span>
          <div>
            <h1>Pharma Plan</h1>
            <p>TPZ Muhen</p>
          </div>
        </div>
        <nav className="nav">
          {navRoutes.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {nav[item.key]}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {session?.user?.email ? (
            <p className="user-info">{session.user.email}</p>
          ) : null}
          <button className="secondary" onClick={() => signOut()} style={{ width: "100%", marginBottom: "0.5rem" }}>
            {nav.signOut}
          </button>
          <button
            className="lang-switcher"
            onClick={() => setLang(nextLang(lang))}
            title={`Switch to ${LANG_NAMES[nextLang(lang)]}`}
          >
            <span>{LANG_FLAGS[lang]}</span>
            <span>{LANG_NAMES[lang]}</span>
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
