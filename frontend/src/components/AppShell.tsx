import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useT } from "../i18n/translations";

export function AppShell() {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const nav = useT("nav");

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1 className="brand">Pharma Plan Pro</h1>
        <nav>
          <NavLink to="/" end className="nav-link">{nav.dashboard}</NavLink>
          <NavLink to="/employees" className="nav-link">{nav.employees}</NavLink>
          <NavLink to="/shifts" className="nav-link">{nav.shifts}</NavLink>
          <NavLink to="/absences" className="nav-link">{nav.absences}</NavLink>
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <select value={lang} onChange={(e) => setLang(e.target.value as never)}>
            <option value="de">DE</option>
            <option value="it">IT</option>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
          <span>{user?.email}</span>
          <button onClick={signOut}>Sign out</button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
