import { FormEvent, useEffect, useMemo, useState } from "react";
import { GraphCanvas } from "../components/GraphCanvas";
import { useAuth } from "../context/AuthContext";
import { getEventsForChapter, getPrimaryMembership } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { EventRecord, GraphEdge, GraphNode } from "../types/domain";

export function NetworkPage() {
  const { user } = useAuth();
  const [chapterId, setChapterId] = useState<string>("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const membership = await getPrimaryMembership(user);
        setChapterId(membership.chapter_id);
        const chapterEvents = await getEventsForChapter(membership.chapter_id);
        setEvents(chapterEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chapter context");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!chapterId) return;
    void loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, eventFilter, dateFrom, dateTo]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  async function loadGraph() {
    setError(null);

    try {
      const eventIds =
        eventFilter === "all"
          ? events.map((event) => event.id)
          : events.filter((event) => event.id === eventFilter).map((event) => event.id);

      if (eventIds.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const { data: signups, error: signupsError } = await supabase
        .from("event_signups")
        .select(
          "id, user_id, event_id, need, can_help, short_bio, website_url, linkedin_url, created_at, profiles(display_name, bio, website_url, linkedin_url)",
        )
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });

      if (signupsError) throw signupsError;

      const filteredSignups = (signups ?? []).filter((signup) => {
        if (!dateFrom && !dateTo) return true;
        const eventRef = events.find((event) => event.id === signup.event_id);
        if (!eventRef) return false;
        const start = new Date(eventRef.startsAt);
        if (dateFrom && start < new Date(dateFrom)) return false;
        if (dateTo && start > new Date(dateTo)) return false;
        return true;
      });

      const latestByUser = new Map<string, GraphNode>();

      for (const signup of filteredSignups) {
        if (latestByUser.has(signup.user_id)) continue;
        const profile = Array.isArray(signup.profiles) ? signup.profiles[0] : signup.profiles;
        latestByUser.set(signup.user_id, {
          id: signup.user_id,
          label: profile?.display_name || "Presenter",
          need: signup.need,
          canHelp: signup.can_help,
          bio: signup.short_bio || profile?.bio || null,
          websiteUrl: signup.website_url || profile?.website_url || null,
          linkedinUrl: signup.linkedin_url || profile?.linkedin_url || null,
        });
      }

      const { data: accepted, error: acceptedError } = await supabase
        .from("connection_requests")
        .select("id, requester_id, target_user_id, request_type")
        .eq("chapter_id", chapterId)
        .eq("status", "accepted");

      if (acceptedError) throw acceptedError;

      const nextEdges: GraphEdge[] = (accepted ?? [])
        .filter(
          (request) => latestByUser.has(request.requester_id) && latestByUser.has(request.target_user_id),
        )
        .map((request) => ({
          id: request.id,
          from: request.requester_id,
          to: request.target_user_id,
          type: request.request_type,
        }));

      setNodes(Array.from(latestByUser.values()));
      setEdges(nextEdges);
      if (!selectedNodeId && latestByUser.size > 0) {
        setSelectedNodeId(Array.from(latestByUser.keys())[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    }
  }

  async function sendRequest(type: "need_help" | "can_help") {
    if (!selectedNode || !user || !chapterId) return;

    try {
      const payload = {
        chapterId,
        targetUserId: selectedNode.id,
        eventId: eventFilter === "all" ? null : eventFilter,
        type,
        message: requestMessage || null,
      };
      await invokeFunction<typeof payload, { requestId: string }>("connect-request", payload);
      setStatus(`Request sent (${type}).`);
      setRequestMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    }
  }

  async function blockSelected() {
    if (!selectedNode || !user || !chapterId) return;

    const { error: blockError } = await supabase.from("user_blocks").insert({
      chapter_id: chapterId,
      blocker_id: user.id,
      blocked_id: selectedNode.id,
    });

    if (blockError) {
      setError(blockError.message);
      return;
    }

    setStatus("User blocked for this chapter.");
  }

  async function reportSelected(event: FormEvent) {
    event.preventDefault();
    if (!selectedNode || !chapterId) return;

    try {
      await invokeFunction<
        { chapterId: string; reportedUserId: string; reason: string; context?: string },
        { reportId: string }
      >("report-create", {
        chapterId,
        reportedUserId: selectedNode.id,
        reason: "chapter_member_report",
        context: requestMessage || undefined,
      });
      setStatus("Report submitted to organizers.");
      setRequestMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    }
  }

  return (
    <div className="grid network-layout">
      <section className="panel">
        <h1>Chapter Network</h1>
        <p className="muted">Graph of presenters with accepted help connections.</p>

        <div className="filters">
          <label>
            Event
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">All chapter events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button onClick={() => void loadGraph()}>Refresh</button>
        </div>

        <GraphCanvas
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
        />
      </section>

      <section className="panel">
        <h2>Presenter Details</h2>
        {!selectedNode ? (
          <p className="muted">Select a node from the graph.</p>
        ) : (
          <div className="stack gap-sm">
            <h3>{selectedNode.label}</h3>
            <p>
              <strong>Need:</strong> {selectedNode.need}
            </p>
            <p>
              <strong>Can help:</strong> {selectedNode.canHelp}
            </p>
            {selectedNode.bio ? <p className="small">{selectedNode.bio}</p> : null}
            {selectedNode.websiteUrl ? (
              <a href={selectedNode.websiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {selectedNode.linkedinUrl ? (
              <a href={selectedNode.linkedinUrl} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            ) : null}

            <label>
              Optional message/context
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Add context for your request"
              />
            </label>

            <div className="row wrap">
              <button onClick={() => void sendRequest("need_help")}>I need this person</button>
              <button onClick={() => void sendRequest("can_help")}>I can help this person</button>
              <button className="ghost" onClick={() => void blockSelected()}>
                Block
              </button>
            </div>

            <form onSubmit={reportSelected}>
              <button className="danger" type="submit">
                Report to organizer
              </button>
            </form>
          </div>
        )}
      </section>

      {status ? <p className="success full">{status}</p> : null}
      {error ? <p className="error full">{error}</p> : null}
    </div>
  );
}
