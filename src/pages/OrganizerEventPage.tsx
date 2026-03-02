import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams, useSearchParams } from "react-router-dom";
import { PieTimer } from "../components/PieTimer";
import { UrlCard } from "../components/UrlCard";
import { useAuth } from "../context/AuthContext";
import { getQueueForEvent, getSessionForEvent } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { buildQrCodeUrl } from "../lib/qr";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/time";
import type { EventSession, QueueItem, Role } from "../types/domain";

interface SessionOpenResponse {
  joinUrl: string;
  pin: string;
  session: EventSession;
}

interface SessionMutationResponse {
  session: EventSession;
}

interface SortableQueueRowProps {
  item: QueueItem;
  index: number;
  onMove: (signupId: string, direction: "up" | "down") => void;
  onSetActive: (signupId: string) => void;
}

function SortableQueueRow({ item, index, onMove, onSetActive }: SortableQueueRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={item.active ? "active-row" : ""}>
      <td>
        <button
          type="button"
          className="ghost drag-handle"
          aria-label={`Drag ${item.profileName}`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>{" "}
        {index + 1}
      </td>
      <td>
        <strong>{item.profileName}</strong>
        <div className="small muted">{item.project}</div>
      </td>
      <td className="small">{item.need}</td>
      <td>
        <div className="row">
          <button onClick={() => onMove(item.id, "up")}>↑</button>
          <button onClick={() => onMove(item.id, "down")}>↓</button>
          <button onClick={() => onSetActive(item.id)}>Set active</button>
        </div>
      </td>
    </tr>
  );
}

export function OrganizerEventPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const [search] = useSearchParams();

  const [eventTitle, setEventTitle] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [session, setSession] = useState<EventSession | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const shareStateKey = useMemo(
    () => (eventId ? `opencoffee:session-share:${eventId}` : ""),
    [eventId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function loadAll() {
    if (!eventId || !user) return;

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("id, title, chapter_id")
      .eq("id", eventId)
      .single();

    if (eventError) {
      setError(eventError.message);
      return;
    }

    setEventTitle(eventRow.title);
    setChapterId(eventRow.chapter_id);

    const { data: membership, error: membershipError } = await supabase
      .from("chapter_memberships")
      .select("role")
      .eq("chapter_id", eventRow.chapter_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError) {
      setError(membershipError.message);
      return;
    }

    setRole(membership.role);

    const [nextSession, nextQueue] = await Promise.all([
      getSessionForEvent(eventId),
      getQueueForEvent(eventId),
    ]);

    const activeSignupId = nextSession?.activeSignupId;
    const normalized = nextQueue.map((item) => ({ ...item, active: item.id === activeSignupId }));
    setSession(nextSession);
    setQueue(normalized);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user?.id]);

  useEffect(() => {
    if (!shareStateKey) return;

    const raw = window.localStorage.getItem(shareStateKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { joinUrl?: string; pin?: string };
      if (parsed.joinUrl) setJoinUrl(parsed.joinUrl);
      if (parsed.pin) setPin(parsed.pin);
    } catch {
      // Ignore malformed local share state.
    }
  }, [shareStateKey]);

  useEffect(() => {
    if (!shareStateKey) return;

    if (!joinUrl && !pin) {
      window.localStorage.removeItem(shareStateKey);
      return;
    }

    window.localStorage.setItem(
      shareStateKey,
      JSON.stringify({
        joinUrl,
        pin,
      }),
    );
  }, [joinUrl, pin, shareStateKey]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`organizer-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_signups", filter: `event_id=eq.${eventId}` },
        () => {
          void loadAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_sessions", filter: `event_id=eq.${eventId}` },
        () => {
          void loadAll();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const isOrganizer = role === "organizer" || role === "admin";
  const isProjectorMode = search.get("view") === "projector";

  const activeItem = useMemo(
    () => queue.find((item) => item.id === session?.activeSignupId) || null,
    [queue, session?.activeSignupId],
  );

  const currentChunk = useMemo(() => {
    if (!session) return queue;
    return queue.slice(session.currentChunkStart, session.currentChunkStart + session.chunkSize);
  }, [queue, session]);

  if (!eventId) return <section className="panel">Missing event ID.</section>;
  const resolvedEventId = eventId;
  const projectorUrl = `/app/organizer/events/${resolvedEventId}?view=projector`;

  async function openSession() {
    setError(null);
    try {
      const response = await invokeFunction<{ eventId: string }, SessionOpenResponse>("session-open", {
        eventId: resolvedEventId,
      });
      setJoinUrl(response.joinUrl);
      setPin(response.pin);
      setSession(response.session);
      setStatus("Session opened.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open session");
    }
  }

  async function closeSession() {
    setError(null);
    try {
      const response = await invokeFunction<{ eventId: string }, SessionMutationResponse>("session-close", {
        eventId: resolvedEventId,
      });
      setSession(response.session);
      setJoinUrl("");
      setPin("");
      setStatus("Session closed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close session");
    }
  }

  async function copyJoinLink() {
    if (!joinUrl) return;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setStatus("Join URL copied.");
    } catch {
      setError("Could not copy join URL.");
    }
  }

  async function reorderQueue(nextQueue: QueueItem[]) {
    setQueue(nextQueue);

    try {
      await invokeFunction<{ eventId: string; orderedSignupIds: string[] }, { ok: boolean }>("queue-reorder", {
        eventId: resolvedEventId,
        orderedSignupIds: nextQueue.map((item) => item.id),
      });
      setStatus("Queue order updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder queue");
      await loadAll();
    }
  }

  async function moveQueueItem(signupId: string, direction: "up" | "down") {
    const index = queue.findIndex((item) => item.id === signupId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    const nextQueue = arrayMove(queue, index, nextIndex);
    await reorderQueue(nextQueue);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((item) => item.id === String(active.id));
    const newIndex = queue.findIndex((item) => item.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    await reorderQueue(arrayMove(queue, oldIndex, newIndex));
  }

  async function shiftChunk(direction: "next" | "prev") {
    try {
      const response = await invokeFunction<
        { eventId: string; direction: "next" | "prev" },
        SessionMutationResponse
      >("queue-advance-chunk", {
        eventId: resolvedEventId,
        direction,
      });
      setSession(response.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance chunk");
    }
  }

  async function setActive(signupId: string) {
    try {
      const response = await invokeFunction<
        { eventId: string; signupId: string },
        SessionMutationResponse
      >("queue-set-active", {
        eventId: resolvedEventId,
        signupId,
      });
      setSession(response.session);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set active presenter");
    }
  }

  async function controlTimer(action: "start" | "pause" | "reset" | "next") {
    try {
      const response = await invokeFunction<
        { eventId: string; timerAction: "start" | "pause" | "reset" | "next" },
        SessionMutationResponse
      >("queue-set-active", {
        eventId: resolvedEventId,
        timerAction: action,
      });
      setSession(response.session);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed timer action");
    }
  }

  if (!isOrganizer) {
    return (
      <section className="panel">
        <h1>Organizer Access Required</h1>
        <p className="muted">You need organizer/admin role for this chapter.</p>
      </section>
    );
  }

  if (isProjectorMode) {
    return (
      <div className="grid">
        <section className="panel projector projector-stage">
          <div className="projector-banner">
            <h1>{eventTitle || "OpenCoffee Live Intros"}</h1>
            <p className="small muted">
              Chunk {session ? session.currentChunkStart + 1 : 1} to{" "}
              {session ? Math.min(session.currentChunkStart + session.chunkSize, queue.length) : queue.length} of{" "}
              {queue.length}
            </p>
          </div>

          <div className="projector-stage-grid">
            <div className="chunk-preview projector-chunk">
              <h3>Current lineup</h3>
              <ol>
                {currentChunk.map((item) => (
                  <li key={item.id} className={item.active ? "active-item" : ""}>
                    {item.profileName}
                  </li>
                ))}
              </ol>
            </div>

            <div className="active-panel projector-active">
              {activeItem ? (
                <>
                  <h2>{activeItem.profileName}</h2>
                  <p>
                    <strong>Who:</strong> {activeItem.who}
                  </p>
                  <p>
                    <strong>Project:</strong> {activeItem.project}
                  </p>
                  <p>
                    <strong>Need:</strong> {activeItem.need}
                  </p>
                  <p>
                    <strong>Can help:</strong> {activeItem.canHelp}
                  </p>

                  {session ? (
                    <PieTimer
                      durationSeconds={60}
                      startedAt={session.timerStartedAt}
                      elapsedSeconds={session.timerElapsedSeconds}
                    />
                  ) : null}

                  <UrlCard websiteUrl={activeItem.websiteUrl} linkedinUrl={activeItem.linkedinUrl} />
                </>
              ) : (
                <p className="muted">No active presenter yet.</p>
              )}
            </div>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid organizer-layout">
      <section className="panel">
        <h1>{eventTitle || "Organizer Console"}</h1>
        <p className="small muted">Chapter: {chapterId}</p>

        <div className="row wrap">
          <button onClick={() => void openSession()} disabled={session?.status === "open"}>
            Open signup
          </button>
          <button onClick={() => void closeSession()} disabled={session?.status !== "open"}>
            Close signup
          </button>
          <button onClick={() => void shiftChunk("prev")} disabled={!session}>
            Prev chunk
          </button>
          <button onClick={() => void shiftChunk("next")} disabled={!session}>
            Next chunk
          </button>
          <a href={projectorUrl} target="_blank" rel="noreferrer" className="button-link ghost-link">
            Open clean projector view
          </a>
        </div>

        {session ? (
          <div className="card">
            <p className="small">Session: {session.status}</p>
            <p className="small">Chunk size: {session.chunkSize}</p>
            {session.opensAt ? <p className="small">Opened: {formatDateTime(session.opensAt)}</p> : null}
            {session.closesAt ? <p className="small">Closes: {formatDateTime(session.closesAt)}</p> : null}
          </div>
        ) : (
          <p className="muted">No session created yet.</p>
        )}

        {(joinUrl || pin) && (
          <div className="card">
            <h3>Share with attendees</h3>
            <div className="join-share-grid">
              <div className="stack gap-sm">
                {joinUrl ? (
                  <>
                    <p className="small break">
                      Join URL:{" "}
                      <a href={joinUrl} target="_blank" rel="noreferrer">
                        {joinUrl}
                      </a>
                    </p>
                    <div className="row wrap">
                      <button type="button" className="ghost" onClick={() => void copyJoinLink()}>
                        Copy join URL
                      </button>
                    </div>
                  </>
                ) : null}
                {pin ? <p className="small">PIN: {pin}</p> : null}
              </div>

              {joinUrl ? (
                <img className="qr" src={buildQrCodeUrl(joinUrl, 220)} alt="Event join QR code" />
              ) : null}
            </div>
          </div>
        )}

        <h2>Queue</h2>
        <p className="small muted">Chunk of 10 with FCFS default and drag/drop reorder.</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="queue-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Presenter</th>
                <th>Need</th>
                <th>Actions</th>
              </tr>
            </thead>
            <SortableContext items={queue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {queue.map((item, index) => (
                  <SortableQueueRow
                    key={item.id}
                    item={item}
                    index={index}
                    onMove={(signupId, direction) => void moveQueueItem(signupId, direction)}
                    onSetActive={(signupId) => void setActive(signupId)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </section>

      <section className="panel projector">
        <h2>Projector Preview</h2>
        <p className="small muted">Open the clean projector view for full-screen display output.</p>

        <div className="chunk-preview">
          <h3>Current chunk</h3>
          <ol>
            {currentChunk.map((item) => (
              <li key={item.id} className={item.active ? "active-item" : ""}>
                {item.profileName}
              </li>
            ))}
          </ol>
        </div>

        {activeItem ? (
          <div className="active-panel">
            <h3>{activeItem.profileName}</h3>
            <p>
              <strong>Need:</strong> {activeItem.need}
            </p>

            {session ? (
              <PieTimer
                durationSeconds={60}
                startedAt={session.timerStartedAt}
                elapsedSeconds={session.timerElapsedSeconds}
              />
            ) : null}

            <div className="row wrap">
              <button onClick={() => void controlTimer("start")}>Start</button>
              <button onClick={() => void controlTimer("pause")}>Pause</button>
              <button onClick={() => void controlTimer("reset")}>Reset</button>
              <button onClick={() => void controlTimer("next")}>Next presenter</button>
            </div>

            <UrlCard websiteUrl={activeItem.websiteUrl} linkedinUrl={activeItem.linkedinUrl} />
          </div>
        ) : (
          <p className="muted">Pick an active presenter from the queue.</p>
        )}
      </section>

      {status ? <p className="success full">{status}</p> : null}
      {error ? <p className="error full">{error}</p> : null}
    </div>
  );
}
