import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loading } from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { useChapter } from "../context/ChapterContext";
import { useToast } from "../context/ToastContext";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { ConnectionRequest } from "../types/domain";

interface Conversation {
  id: string;
  chapter_id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
  otherName: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export function InboxPage() {
  const { user } = useAuth();
  const { chapterId, loading: chapterLoading } = useChapter();
  const { showToast } = useToast();

  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const loadRequests = useCallback(async () => {
    if (!user || !chapterId) return;

    const { data, error: requestError } = await supabase
      .from("connection_requests")
      .select(
        "id, chapter_id, event_id, requester_id, target_user_id, request_type, message, status, created_at, requester:profiles!connection_requests_requester_id_fkey(display_name), target:profiles!connection_requests_target_user_id_fkey(display_name)",
      )
      .eq("chapter_id", chapterId)
      .or(`requester_id.eq.${user.id},target_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (requestError) {
      showToast(requestError.message, "error");
      return;
    }

    const mapped: ConnectionRequest[] = (data ?? []).map((row: Record<string, unknown>) => {
      const requesterProfile = Array.isArray(row.requester) ? row.requester[0] : row.requester;
      const targetProfile = Array.isArray(row.target) ? row.target[0] : row.target;
      return {
        id: row.id as string,
        chapterId: row.chapter_id as string,
        eventId: row.event_id as string | null,
        requesterId: row.requester_id as string,
        targetUserId: row.target_user_id as string,
        requesterName: (requesterProfile as { display_name?: string } | null)?.display_name ?? null,
        targetName: (targetProfile as { display_name?: string } | null)?.display_name ?? null,
        requestType: row.request_type as ConnectionRequest["requestType"],
        message: row.message as string | null,
        status: row.status as ConnectionRequest["status"],
        createdAt: row.created_at as string,
      };
    });

    setIncoming(mapped.filter((request) => request.targetUserId === user.id));
    setOutgoing(mapped.filter((request) => request.requesterId === user.id));
  }, [user, chapterId, showToast]);

  const loadConversations = useCallback(async () => {
    if (!user || !chapterId) return;

    const { data, error: conversationError } = await supabase
      .from("conversations")
      .select(
        "id, chapter_id, user_a_id, user_b_id, created_at, user_a:profiles!conversations_user_a_id_fkey(display_name), user_b:profiles!conversations_user_b_id_fkey(display_name)",
      )
      .eq("chapter_id", chapterId)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (conversationError) {
      showToast(conversationError.message, "error");
      return;
    }

    const mapped: Conversation[] = (data ?? []).map((row: Record<string, unknown>) => {
      const isUserA = row.user_a_id === user.id;
      const otherProfile = isUserA
        ? (Array.isArray(row.user_b) ? row.user_b[0] : row.user_b)
        : (Array.isArray(row.user_a) ? row.user_a[0] : row.user_a);
      return {
        id: row.id as string,
        chapter_id: row.chapter_id as string,
        user_a_id: row.user_a_id as string,
        user_b_id: row.user_b_id as string,
        created_at: row.created_at as string,
        otherName: (otherProfile as { display_name?: string } | null)?.display_name ?? null,
      };
    });

    setConversations(mapped);

    if (!activeConversationId && mapped.length > 0) {
      setActiveConversationId(mapped[0].id);
    }
  }, [user, chapterId, showToast, activeConversationId]);

  useEffect(() => {
    if (!user || !chapterId) return;
    void loadRequests();
    void loadConversations();
  }, [user?.id, chapterId, loadRequests, loadConversations]);

  // Refetch on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && chapterId) {
        void loadRequests();
        void loadConversations();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [chapterId, loadRequests, loadConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeConversationId);

    const channel = supabase
      .channel(`conversation-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        () => {
          void loadMessages(activeConversationId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  async function loadMessages(conversationId: string) {
    const { data, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messageError) {
      showToast(messageError.message, "error");
      return;
    }

    setMessages(data ?? []);
  }

  async function respond(requestId: string, decision: "accept" | "decline") {
    try {
      await invokeFunction<{ requestId: string; decision: "accept" | "decline" }, { ok: boolean }>(
        "connect-respond",
        { requestId, decision },
      );
      showToast(`Request ${decision}ed.`, "success");
      await loadRequests();
      await loadConversations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to respond", "error");
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeConversationId || !draft.trim()) return;

    try {
      await invokeFunction<{ conversationId: string; body: string }, { messageId: string }>("message-send", {
        conversationId: activeConversationId,
        body: draft.trim(),
      });
      setDraft("");
      await loadMessages(activeConversationId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send message", "error");
    }
  }

  if (chapterLoading) return <Loading />;

  return (
    <div className="grid inbox-layout">
      <section className="panel">
        <h2>Connection Requests</h2>
        <h3>Incoming</h3>
        <div className="stack gap-sm">
          {incoming.filter((item) => item.status === "pending").length === 0 ? (
            <p className="empty-state">No pending incoming requests.</p>
          ) : null}
          {incoming
            .filter((item) => item.status === "pending")
            .map((request) => (
              <article key={request.id} className="card">
                <p className="small">
                  Type: {request.requestType} from {request.requesterName ?? "Unknown"}
                </p>
                {request.message ? <p>{request.message}</p> : null}
                <div className="row">
                  <button onClick={() => void respond(request.id, "accept")}>Accept</button>
                  <button className="ghost" onClick={() => void respond(request.id, "decline")}>Decline</button>
                </div>
              </article>
            ))}
        </div>

        <h3>Outgoing</h3>
        <div className="stack gap-sm">
          {outgoing.length === 0 ? (
            <p className="empty-state">No sent requests.</p>
          ) : null}
          {outgoing.map((request) => (
            <article key={request.id} className="card">
              <p className="small">
                To {request.targetName ?? "Unknown"} | {request.requestType}
              </p>
              <p className="small muted">Status: {request.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Chats</h2>
        <div className="row gap-md">
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <p className="empty-state">No conversations yet.</p>
            ) : null}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={activeConversationId === conversation.id ? "active" : ""}
                onClick={() => setActiveConversationId(conversation.id)}
              >
                {conversation.otherName ?? "Unknown"}
              </button>
            ))}
          </div>

          <div className="conversation-panel">
            {!activeConversation ? (
              <p className="muted">Select a conversation.</p>
            ) : (
              <>
                <div className="messages">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={message.sender_id === user?.id ? "message self" : "message"}
                    >
                      <div>{message.body}</div>
                      <div className="small muted">{new Date(message.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="row">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message"
                  />
                  <button type="submit">Send</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
