import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { RedirectIfAuthed, RequireAuth } from "./auth/guards.tsx";
import { ApiError } from "./lib/api.ts";
import { AppLayout } from "./components/AppLayout.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { RoomsPage } from "./pages/RoomsPage.tsx";
import { RoomPage } from "./pages/RoomPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { ToastProvider } from "./components/Toaster.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx (not found, forbidden, logged out) won't change the answer.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<RedirectIfAuthed />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<RoomsPage />} />
                  <Route path="/rooms/:roomId" element={<RoomPage />} />
                  <Route path="/settings/*" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
