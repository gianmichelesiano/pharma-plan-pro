import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LANG_FLAGS, LANG_NAMES, nextLang } from "../i18n/translations";
import { useT } from "../i18n/useT";

type NavKey = "dashboard" | "rules" | "employees" | "availability" | "absences" | "training" | "schedule" | "piano" | "users";
type NavItem = { to: string; key: NavKey; adminOnly?: boolean };

const navRoutes: NavItem[] = [
  { to: "/", key: "dashboard" },
  { to: "/schedule", key: "schedule" },
  { to: "/piano", key: "piano" },
  { to: "/rules", key: "rules", adminOnly: true },
  { to: "/employees", key: "employees", adminOnly: true },
  { to: "/availability", key: "availability", adminOnly: true },
  { to: "/absences", key: "absences", adminOnly: true },
  { to: "/training", key: "training", adminOnly: true },
  { to: "/admin/users", key: "users", adminOnly: true },
];

export function AppShell() {
  const { lang, setLang } = useLanguage();
  const { session, signOut, isAdmin } = useAuth();
  const nav = useT("nav");
  const visible = navRoutes.filter((r) => !r.adminOnly || isAdmin);

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
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {nav[item.key] ?? item.key}
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
        <div className="sidebar-credit">
          <a href="https://www.speats.ch" target="_blank" rel="noopener noreferrer">Built by Speats</a>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
