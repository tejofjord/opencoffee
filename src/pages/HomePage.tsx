import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loading } from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { useChapter } from "../context/ChapterContext";
import { useToast } from "../context/ToastContext";
import { getEventsForChapter } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { formatDateTime } from "../lib/time";
import type { EventRecord } from "../types/domain";

interface EventDraft {
  eventId?: string;
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "published" | "cancelled";
}

const initialDraft: EventDraft = {
  title: "",
  venue: "",
  startsAt: "",
  endsAt: "",
  status: "published",
};

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function HomePage() {
  const { user } = useAuth();
  const { chapterId, role, loading: chapterLoading } = useChapter();
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [draft, setDraft] = useState<EventDraft>(initialDraft);
  const [savingEvent, setSavingEvent] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    eventId: string;
    mode: "cancel" | "hard_delete";
  } | null>(null);

  const canManageEvents = role === "organizer" || role === "admin";

  const refreshEvents = useCallback(async (activeChapterId: string) => {
    const chapterEvents = await getEventsForChapter(activeChapterId);
    setEvents(chapterEvents);
  }, []);

  useEffect(() => {
    if (!chapterId) return;
    void refreshEvents(chapterId);
  }, [chapterId, refreshEvents]);

  // Refetch on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && chapterId) {
        void refreshEvents(chapterId);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [chapterId, refreshEvents]);

  async function upsertEvent(event: FormEvent) {
    event.preventDefault();
    if (!chapterId) return;
    if (!draft.title || !draft.startsAt || !draft.endsAt) return;

    setSavingEvent(true);

    const payload = {
      eventId: draft.eventId,
      chapterId: draft.eventId ? undefined : chapterId,
      title: draft.title,
      venue: draft.venue || null,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: new Date(draft.endsAt).toISOString(),
      status: draft.status,
    };

    try {
      await invokeFunction<typeof payload, { event: unknown }>("event-upsert", payload);
      setDraft(initialDraft);
      showToast(draft.eventId ? "Event updated." : "Event created.", "success");
      await refreshEvents(chapterId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save event", "error");
    } finally {
      setSavingEvent(false);
    }
  }

  async function removeEvent(eventId: string, mode: "cancel" | "hard_delete") {
    if (!chapterId) return;

    try {
      await invokeFunction<{ eventId: string; mode: "cancel" | "hard_delete" }, { ok: boolean }>(
        "event-delete",
        { eventId, mode },
      );

      if (draft.eventId === eventId) {
        setDraft(initialDraft);
      }

      showToast(mode === "cancel" ? "Event cancelled." : "Event deleted.", "success");
      await refreshEvents(chapterId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete event", "error");
    }
  }

  function startEdit(eventRecord: EventRecord) {
    setDraft({
      eventId: eventRecord.id,
      title: eventRecord.title,
      venue: eventRecord.venue || "",
      startsAt: toLocalInput(eventRecord.startsAt),
      endsAt: toLocalInput(eventRecord.endsAt),
      status: eventRecord.status,
    });
  }

  function resetDraft() {
    setDraft(initialDraft);
  }

  if (!user) {
    return (
      <section className="panel">
        <h1>OpenCoffee Event App</h1>
        <p>
          Structured intros, live queue management, and post-event network graph for chapter members.
        </p>
        <Link to="/auth?redirect=/app" className="button-link">
          Sign in with magic link
        </Link>
      </section>
    );
  }

  if (chapterLoading) return <Loading />;

  return (
    <div className="grid two-col">
      <section className="panel">
        <h2>Upcoming Events</h2>
        <p className="muted">Oslo-first launch. Multi-chapter model ready.</p>
        {events.length === 0 ? (
          <p className="empty-state">No upcoming events.</p>
        ) : null}
        <div className="stack gap-sm">
          {events.map((event) => (
            <article key={event.id} className="card">
              <h3>{event.title}</h3>
              <p className="small muted">{formatDateTime(event.startsAt)}</p>
              <p className="small muted">{event.venue || "Venue TBA"}</p>
              <p className="small muted">Status: {event.status}</p>
              <div className="row wrap">
                <Link to={`/app/events/${event.id}/join`}>Join flow</Link>
                {canManageEvents ? (
                  <>
                    <Link to={`/app/organizer/events/${event.id}`}>Organizer console</Link>
                    <button className="ghost" onClick={() => startEdit(event)}>
                      Edit
                    </button>
                    <button
                      className="ghost"
                      onClick={() => setConfirmAction({ eventId: event.id, mode: "cancel" })}
                    >
                      Cancel
                    </button>
                    <button
                      className="danger"
                      onClick={() => setConfirmAction({ eventId: event.id, mode: "hard_delete" })}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{draft.eventId ? "Organizer: Edit Event" : "Organizer: Create Event"}</h2>
        {!canManageEvents ? (
          <p className="muted">Only organizers/admins can create or edit events.</p>
        ) : (
          <form className="stack" onSubmit={upsertEvent}>
            <label>
              Title
              <input
                value={draft.title}
                required
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              Venue
              <input
                value={draft.venue}
                onChange={(e) => setDraft((prev) => ({ ...prev, venue: e.target.value }))}
              />
            </label>
            <label>
              Starts at
              <input
                type="datetime-local"
                value={draft.startsAt}
                required
                onChange={(e) => setDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
              />
            </label>
            <label>
              Ends at
              <input
                type="datetime-local"
                value={draft.endsAt}
                required
                onChange={(e) => setDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    status: e.target.value as EventDraft["status"],
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <div className="row wrap">
              <button type="submit" disabled={savingEvent}>
                {savingEvent ? "Saving..." : draft.eventId ? "Save event" : "Create event"}
              </button>
              {draft.eventId ? (
                <button type="button" className="ghost" onClick={resetDraft}>
                  New event
                </button>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.mode === "hard_delete" ? "Delete event?" : "Cancel event?"}
        message={
          confirmAction?.mode === "hard_delete"
            ? "This will permanently delete this event and all its data."
            : "This will mark the event as cancelled. Attendees will still see it."
        }
        confirmLabel={confirmAction?.mode === "hard_delete" ? "Delete" : "Cancel event"}
        variant={confirmAction?.mode === "hard_delete" ? "danger" : "default"}
        onConfirm={() => {
          if (confirmAction) {
            void removeEvent(confirmAction.eventId, confirmAction.mode);
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
