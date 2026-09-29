import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { RedirectIfAuthed, RequireAuth } from "./auth/guards.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RedirectIfAuthed />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
