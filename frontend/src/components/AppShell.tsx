import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LANG_FLAGS, LANG_NAMES, nextLang } from "../i18n/translations";
import { useT } from "../i18n/useT";

type NavKey = "dashboard" | "rules" | "employees" | "availability" | "absences" | "training" | "schedule" | "piano" | "users" | "coverageRequests";
type NavItem = { to: string; key: NavKey; adminOnly?: boolean };

const navRoutes: NavItem[] = [
  { to: "/", key: "dashboard" },
  { to: "/schedule", key: "schedule" },
  { to: "/piano", key: "piano" },
  { to: "/rules", key: "rules", adminOnly: true },
  { to: "/employees", key: "employees", adminOnly: true },
  { to: "/availability", key: "availability", adminOnly: true },
  { to: "/absences", key: "absences", adminOnly: true },
  { to: "/coverage-requests", key: "coverageRequests", adminOnly: true },
  { to: "/training", key: "training", adminOnly: true },
  { to: "/admin/users", key: "users", adminOnly: true },
];

export function AppShell() {
  const { lang, setLang } = useLanguage();
  const { session, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const nav = useT("nav");
  const visible = navRoutes.filter((r) => !r.adminOnly || isAdmin);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="layout">
      <button
        type="button"
        className={`mobile-nav-backdrop${mobileNavOpen ? " visible" : ""}`}
        aria-hidden={!mobileNavOpen}
        tabIndex={mobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">PP</span>
            <div>
              <h1>Pharma Plan</h1>
              <p>TPZ Muhen</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="nav">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileNavOpen(false)}
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
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            ☰
          </button>
          <div className="mobile-topbar-brand">
            <span className="brand-mark">PP</span>
            <div>
              <strong>Pharma Plan</strong>
              <span>TPZ Muhen</span>
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
