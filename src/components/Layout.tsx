import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/app", label: "Home" },
  { to: "/app/network", label: "Network" },
  { to: "/app/inbox", label: "Inbox" },
  { to: "/app/moderation", label: "Moderation" },
];

export function Layout() {
  const { user, signOut } = useAuth();

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
