import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.tsx";

function FullPageSpinner() {
  return (
    <div className="page-center" role="status" aria-live="polite">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}

/** Only logged-in users get through; everyone else goes to /login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login and signup pages bounce logged-in users to the app. */
export function RedirectIfAuthed() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}
