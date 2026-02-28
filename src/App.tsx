import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { AuthPage } from "./pages/AuthPage";
import { EventJoinPage } from "./pages/EventJoinPage";
import { HomePage } from "./pages/HomePage";
import { InboxPage } from "./pages/InboxPage";
import { ModerationPage } from "./pages/ModerationPage";
import { NetworkPage } from "./pages/NetworkPage";
import { OrganizerEventPage } from "./pages/OrganizerEventPage";

export function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="events/:eventId/join"
          element={
            <RequireAuth>
              <EventJoinPage />
            </RequireAuth>
          }
        />
        <Route
          path="organizer/events/:eventId"
          element={
            <RequireAuth>
              <OrganizerEventPage />
            </RequireAuth>
          }
        />
        <Route
          path="network"
          element={
            <RequireAuth>
              <NetworkPage />
            </RequireAuth>
          }
        />
        <Route
          path="inbox"
          element={
            <RequireAuth>
              <InboxPage />
            </RequireAuth>
          }
        />
        <Route
          path="moderation"
          element={
            <RequireAuth>
              <ModerationPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
