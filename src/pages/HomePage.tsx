import { useAuth } from "../auth/AuthContext.tsx";

// Placeholder for the logged-in app; quiz features come next.
export function HomePage() {
  const { user, logout } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <img src="/favicon.jpg" alt="" className="logo-mark" />
          <span>SmartQuiz</span>
        </div>
        <div className="topbar-user">
          <span className="topbar-email">{user?.email}</span>
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="home">
        <h1>Hi {firstName} 👋</h1>
        <p className="muted">You're logged in. Your quizzes will show up here.</p>
      </main>
    </div>
  );
}
