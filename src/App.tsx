import { lazy, Suspense } from "react";
import { Center, Loader } from "@mantine/core";
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
import { QuizPlayerPage } from "./features/quizzes/QuizPlayerPage.tsx";
import { InvitePage } from "./features/members/InvitePage.tsx";
import { RealtimeProvider } from "./realtime/RealtimeProvider.tsx";

// The viewer brings pdf.js and the Word renderer; load them only when a file is opened.
const StudioItemPage = lazy(() => import("./features/studio/StudioItemPage.tsx").then(module => ({ default: module.StudioItemPage })));
const MaterialViewerPage = lazy(() => import("./features/materials/viewer/MaterialViewerPage.tsx").then(module => ({ default: module.MaterialViewerPage })));

const pageLoader = (
  <Center py={96}>
    <Loader aria-label="Loading" />
  </Center>
);

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
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RedirectIfAuthed />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route
                element={
                  <RealtimeProvider>
                    <AppLayout />
                  </RealtimeProvider>
                }
              >
                <Route path="/" element={<RoomsPage />} />
                <Route path="/rooms/:roomId" element={<RoomPage />} />
                <Route path="/rooms/:roomId/quizzes/:quizId" element={<QuizPlayerPage />} />
                <Route
                  path="/rooms/:roomId/studio/:itemId"
                  element={
                    <Suspense fallback={pageLoader}>
                      <StudioItemPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/rooms/:roomId/materials/:materialId"
                  element={
                    <Suspense fallback={pageLoader}>
                      <MaterialViewerPage />
                    </Suspense>
                  }
                />
                <Route path="/settings/*" element={<SettingsPage />} />
              </Route>
            </Route>
            {/* Works logged in or out: shows the room, then log in / sign up / join. */}
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
