import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getEventsForChapter, getPrimaryMembership } from "../lib/data";
import { formatDateTime } from "../lib/time";
import { supabase } from "../lib/supabase";
import type { EventRecord, Role } from "../types/domain";

interface EventDraft {
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
}

const initialDraft: EventDraft = {
  title: "",
  venue: "",
  startsAt: "",
  endsAt: "",
};

export function HomePage() {
  const { user } = useAuth();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [draft, setDraft] = useState<EventDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const membership = await getPrimaryMembership(user);
        setChapterId(membership.chapter_id);
        setRole(membership.role);
        const chapterEvents = await getEventsForChapter(membership.chapter_id);
        setEvents(chapterEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      }
    })();
  }, [user]);

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    if (!user || !chapterId) return;

    const { error: insertError } = await supabase.from("events").insert({
      chapter_id: chapterId,
      title: draft.title,
      venue: draft.venue || null,
      starts_at: new Date(draft.startsAt).toISOString(),
      ends_at: new Date(draft.endsAt).toISOString(),
      status: "published",
      created_by: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDraft(initialDraft);
    const chapterEvents = await getEventsForChapter(chapterId);
    setEvents(chapterEvents);
  }

  if (!user) {
    return (
      <section className="panel">
        <h1>OpenCoffee Event App</h1>
        <p>
          Structured intros, live queue management, and post-event network graph for chapter members.
        </p>
        <Link to="/auth" className="button-link">
          Sign in with magic link
        </Link>
      </section>
    );
  }

  return (
    <div className="grid two-col">
      <section className="panel">
        <h2>Upcoming Events</h2>
        <p className="muted">Oslo-first launch. Multi-chapter model ready.</p>
        {events.length === 0 ? <p>No events yet.</p> : null}
        <div className="stack gap-sm">
          {events.map((event) => (
            <article key={event.id} className="card">
              <h3>{event.title}</h3>
              <p className="small muted">{formatDateTime(event.startsAt)}</p>
              <p className="small muted">{event.venue || "Venue TBA"}</p>
              <div className="row">
                <Link to={`/events/${event.id}/join`}>Join flow</Link>
                {(role === "organizer" || role === "admin") && (
                  <Link to={`/organizer/events/${event.id}`}>Organizer console</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Organizer: Create Event</h2>
        {role !== "organizer" && role !== "admin" ? (
          <p className="muted">Only organizers/admins can create events.</p>
        ) : (
          <form className="stack" onSubmit={createEvent}>
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
            <button type="submit">Create published event</button>
          </form>
        )}

        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
