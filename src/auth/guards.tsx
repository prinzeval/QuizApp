import { Center, Loader, VisuallyHidden } from "@mantine/core";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.tsx";

function FullPageSpinner() {
  return (
    <Center mih="100dvh" role="status" aria-live="polite">
      <Loader aria-hidden="true" />
      <VisuallyHidden>Loading…</VisuallyHidden>
    </Center>
  );
}

/** Only logged-in users get through; everyone else goes to /login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Login and signup pages bounce logged-in users to the app. */
export function RedirectIfAuthed() {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return <Navigate to={from} replace />;
  return <Outlet />;
}
