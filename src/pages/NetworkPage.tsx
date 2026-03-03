import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { GraphCanvas } from "../components/GraphCanvas";
import { Loading } from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { useChapter } from "../context/ChapterContext";
import { useToast } from "../context/ToastContext";
import { getEventsForChapter } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { EventRecord, GraphEdge, GraphNode } from "../types/domain";

type ConfirmAction = { type: "block" } | { type: "report" };

export function NetworkPage() {
  const { user } = useAuth();
  const { chapterId, loading: chapterLoading } = useChapter();
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (!chapterId) return;
    void (async () => {
      try {
        const chapterEvents = await getEventsForChapter(chapterId);
        setEvents(chapterEvents);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to load events", "error");
      }
    })();
  }, [chapterId, showToast]);

  const loadGraph = useCallback(async () => {
    if (!chapterId) return;

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

      const nextNodes = Array.from(latestByUser.values());
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (nextNodes.length > 0 && !selectedNodeId) {
        setSelectedNodeId(nextNodes[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load graph", "error");
    }
  }, [chapterId, eventFilter, events, dateFrom, dateTo, selectedNodeId, showToast]);

  useEffect(() => {
    if (!chapterId || events.length === 0) return;
    void loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, eventFilter, dateFrom, dateTo, events]);

  // Refetch on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && chapterId) {
        void loadGraph();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [chapterId, loadGraph]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleNodes = useMemo(() => {
    if (!normalizedSearch) return nodes;

    return nodes.filter((node) => {
      const blob = `${node.label} ${node.need} ${node.canHelp} ${node.bio ?? ""}`.toLowerCase();
      return blob.includes(normalizedSearch);
    });
  }, [nodes, normalizedSearch]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
    [edges, visibleNodeIds],
  );

  useEffect(() => {
    if (visibleNodes.length === 0) {
      setSelectedNodeId(null);
      return;
    }

    if (!selectedNodeId || !visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(visibleNodes[0].id);
    }
  }, [selectedNodeId, visibleNodeIds, visibleNodes]);

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
      showToast(`Request sent (${type}).`, "success");
      setRequestMessage("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send request", "error");
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
      showToast(blockError.message, "error");
      return;
    }

    showToast("User blocked for this chapter.", "success");
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
      showToast("Report submitted to organizers.", "success");
      setRequestMessage("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit report", "error");
    }
  }

  if (chapterLoading) return <Loading />;

  return (
    <div className="grid network-layout">
      <section className="panel">
        <h1>Chapter Network</h1>
        <p className="muted">Graph of presenters with accepted help connections.</p>

        <div className="filters filters-network">
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
          <label>
            Search people or needs
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="name, need, help, bio"
            />
          </label>
          <button onClick={() => void loadGraph()}>Refresh</button>
        </div>

        <div className="graph-meta row wrap">
          <span className="small muted">Showing {visibleNodes.length} of {nodes.length} presenters</span>
          <span className="legend-item"><span className="legend-line amber" /> Need help edge</span>
          <span className="legend-item"><span className="legend-line green" /> Can help edge</span>
          <span className="legend-item"><span className="legend-dot" /> Node color = primary need cluster</span>
        </div>

        {visibleNodes.length === 0 ? (
          <p className="empty-state">No presenters match your current filters.</p>
        ) : (
          <>
            <GraphCanvas
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              highlightedNodeIds={normalizedSearch ? visibleNodes.map((node) => node.id) : []}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />

            <div className="node-quicklist">
              {visibleNodes.slice(0, 18).map((node) => (
                <button
                  key={node.id}
                  className={selectedNodeId === node.id ? "ghost active-pill" : "ghost"}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  {node.label}
                </button>
              ))}
            </div>
          </>
        )}
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
              <button className="ghost" onClick={() => setConfirmAction({ type: "block" })}>
                Block
              </button>
            </div>

            <button className="danger" onClick={() => setConfirmAction({ type: "report" })}>
              Report to organizer
            </button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmAction?.type === "block"}
        title="Block user?"
        message={`Block ${selectedNode?.label ?? "this user"} from your chapter network? You won't see each other anymore.`}
        confirmLabel="Block"
        variant="danger"
        onConfirm={() => {
          void blockSelected();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.type === "report"}
        title="Report user?"
        message={`Submit a report about ${selectedNode?.label ?? "this user"} to the chapter organizers?`}
        confirmLabel="Report"
        variant="danger"
        onConfirm={() => {
          void reportSelected({ preventDefault: () => {} } as FormEvent);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
