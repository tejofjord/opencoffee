import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPrimaryMembership } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { ConnectionRequest } from "../types/domain";

interface Conversation {
  id: string;
  chapter_id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
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
  const [chapterId, setChapterId] = useState<string>("");

  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const membership = await getPrimaryMembership(user);
        setChapterId(membership.chapter_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load membership");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !chapterId) return;
    void loadRequests();
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, chapterId]);

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

  async function loadRequests() {
    if (!user) return;

    const { data, error: requestError } = await supabase
      .from("connection_requests")
      .select("id, chapter_id, event_id, requester_id, target_user_id, request_type, message, status, created_at")
      .eq("chapter_id", chapterId)
      .or(`requester_id.eq.${user.id},target_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const mapped: ConnectionRequest[] = (data ?? []).map((row) => ({
      id: row.id,
      chapterId: row.chapter_id,
      eventId: row.event_id,
      requesterId: row.requester_id,
      targetUserId: row.target_user_id,
      requestType: row.request_type,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));

    setIncoming(mapped.filter((request) => request.targetUserId === user.id));
    setOutgoing(mapped.filter((request) => request.requesterId === user.id));
  }

  async function loadConversations() {
    if (!user) return;

    const { data, error: conversationError } = await supabase
      .from("conversations")
      .select("id, chapter_id, user_a_id, user_b_id, created_at")
      .eq("chapter_id", chapterId)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (conversationError) {
      setError(conversationError.message);
      return;
    }

    setConversations(data ?? []);

    if (!activeConversationId && data && data.length > 0) {
      setActiveConversationId(data[0].id);
    }
  }

  async function loadMessages(conversationId: string) {
    const { data, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messageError) {
      setError(messageError.message);
      return;
    }

    setMessages(data ?? []);
  }

  async function respond(requestId: string, decision: "accept" | "decline") {
    setError(null);

    try {
      await invokeFunction<{ requestId: string; decision: "accept" | "decline" }, { ok: boolean }>(
        "connect-respond",
        {
          requestId,
          decision,
        },
      );
      setStatus(`Request ${decision}ed.`);
      await loadRequests();
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
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
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  return (
    <div className="grid inbox-layout">
      <section className="panel">
        <h1>Connection Requests</h1>
        <h3>Incoming</h3>
        <div className="stack gap-sm">
          {incoming.filter((item) => item.status === "pending").length === 0 ? (
            <p className="muted">No pending incoming requests.</p>
          ) : null}
          {incoming
            .filter((item) => item.status === "pending")
            .map((request) => (
              <article key={request.id} className="card">
                <p className="small">
                  Type: {request.requestType} from user {request.requesterId.slice(0, 8)}
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
          {outgoing.length === 0 ? <p className="muted">No sent requests.</p> : null}
          {outgoing.map((request) => (
            <article key={request.id} className="card">
              <p className="small">
                To user {request.targetUserId.slice(0, 8)} | {request.requestType}
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
            {conversations.length === 0 ? <p className="muted">No conversations yet.</p> : null}
            {conversations.map((conversation) => {
              const otherId = user
                ? conversation.user_a_id === user.id
                  ? conversation.user_b_id
                  : conversation.user_a_id
                : conversation.user_a_id;
              return (
                <button
                  key={conversation.id}
                  className={activeConversationId === conversation.id ? "active" : ""}
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  User {otherId.slice(0, 8)}
                </button>
              );
            })}
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

      {status ? <p className="success full">{status}</p> : null}
      {error ? <p className="error full">{error}</p> : null}
    </div>
  );
}
