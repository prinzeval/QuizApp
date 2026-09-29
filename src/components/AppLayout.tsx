import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { useRooms } from "../hooks/rooms.ts";
import { initials, roomColor } from "../lib/format.ts";
import { RoomAvatar } from "./RoomAvatar.tsx";
import { UserAvatar } from "./UserAvatar.tsx";

/** Shell for every logged-in page: sidebar (a drawer on phones) + page content. */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the page changes.
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className={`shell ${drawerOpen ? "drawer-open" : ""}`}>
      <header className="mobile-bar">
        <button type="button" className="icon-button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="logo logo-link">
          <img src="/favicon.jpg" alt="" className="logo-mark" />
          <span>SmartQuiz</span>
        </Link>
        <MobileAvatarLink />
      </header>

      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <Sidebar />

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

function MobileAvatarLink() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link to="/settings" aria-label="Profile and settings">
      <UserAvatar name={user.name} url={user.avatarUrl} size="sm" />
    </Link>
  );
}

function Sidebar() {
  const rooms = useRooms();

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link to="/" className="logo logo-link sidebar-logo">
        <img src="/favicon.jpg" alt="" className="logo-mark" />
        <span>SmartQuiz</span>
      </Link>

      <nav className="sidebar-nav">
        <NavLink to="/" end className="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
          All rooms
        </NavLink>
        <NavLink to="/settings" className="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          Profile & settings
        </NavLink>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Your rooms</span>
          <Link to="/?new=1" className="icon-button icon-button-sm" aria-label="New room" title="New room">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
        <ul className="sidebar-rooms">
          {rooms.isPending && <li className="sidebar-muted">Loading…</li>}
          {rooms.data?.length === 0 && <li className="sidebar-muted">No rooms yet</li>}
          {rooms.data?.map(room => (
            <li key={room.id}>
              <NavLink to={`/rooms/${room.id}`} className="nav-item nav-room" title={room.name}>
                <RoomAvatar name={initials(room.name)} color={roomColor(room.id)} size="sm" />
                <span className="nav-room-name">{room.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <UserMenu />
    </aside>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="user-menu" ref={ref}>
      {open && (
        <div className="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            Profile & settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              navigate("/settings/security");
            }}
          >
            Change password
          </button>
          <div className="menu-divider" role="separator" />
          <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={logout}>
            Log out
          </button>
        </div>
      )}
      <button type="button" className="user-card" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        <UserAvatar name={user.name} url={user.avatarUrl} size="sm" />
        <span className="user-card-text">
          <span className="user-card-name">{user.name}</span>
          <span className="user-card-email">{user.email}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
        </svg>
      </button>
    </div>
  );
}
