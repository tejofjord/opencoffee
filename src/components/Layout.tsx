import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChapter } from "../context/ChapterContext";

const navItems = [
  { to: "/app", label: "Home" },
  { to: "/app/network", label: "Network" },
  { to: "/app/inbox", label: "Inbox" },
  { to: "/app/moderation", label: "Moderation" },
];

export function Layout() {
  const { user, isSuperAdmin, signOut } = useAuth();
  const { chapters, chapterId, setChapterId } = useChapter();

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">OpenCoffee</div>
        <nav className="topnav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-meta">
          {isSuperAdmin && chapters.length > 1 && (
            <div className="chapter-selector">
              <select
                value={chapterId ?? ""}
                onChange={(e) => setChapterId(e.target.value)}
              >
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {user ? (
            <>
              <span className="muted small">{user.email}</span>
              <button className="ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/auth?redirect=/app">Sign in</NavLink>
          )}
        </div>
      </header>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
