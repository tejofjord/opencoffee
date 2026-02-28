import { FormEvent, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { invokeFunction } from "../lib/functions";
import type { SignupSubmission } from "../types/domain";

interface SessionJoinResponse {
  allowed: boolean;
  message: string;
}

interface SignupUpsertResponse {
  signupId: string;
  queuePosition: number;
}

export function EventJoinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [search] = useSearchParams();
  const tokenFromUrl = search.get("token") || "";

  const [sessionToken, setSessionToken] = useState(tokenFromUrl);
  const [sessionPin, setSessionPin] = useState("");
  const [verified, setVerified] = useState(false);

  const [form, setForm] = useState<Omit<SignupSubmission, "eventId">>({
    who: "",
    project: "",
    need: "",
    canHelp: "",
    websiteUrl: "",
    linkedinUrl: "",
    shortBio: "",
    sessionToken: tokenFromUrl,
    sessionPin: "",
  });

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(form.who && form.project && form.need && form.canHelp),
    [form.canHelp, form.need, form.project, form.who],
  );

  if (!eventId) {
    return <section className="panel">Missing event ID.</section>;
  }
  const resolvedEventId = eventId;

  async function verifyAccess(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const response = await invokeFunction<
        { eventId: string; token?: string; pin?: string },
        SessionJoinResponse
      >("session-join", {
        eventId: resolvedEventId,
        token: sessionToken || undefined,
        pin: sessionPin || undefined,
      });

      if (!response.allowed) {
        setError(response.message);
        setVerified(false);
        return;
      }

      setVerified(true);
      setStatus("Access granted. Submit your intro.");
      setForm((prev) => ({ ...prev, sessionToken, sessionPin }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session validation failed");
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("Saving signup...");

    try {
      const response = await invokeFunction<SignupSubmission, SignupUpsertResponse>("signup-upsert", {
        eventId: resolvedEventId,
        who: form.who,
        project: form.project,
        need: form.need,
        canHelp: form.canHelp,
        websiteUrl: form.websiteUrl,
        linkedinUrl: form.linkedinUrl,
        shortBio: form.shortBio,
        sessionToken: form.sessionToken,
        sessionPin: form.sessionPin,
      });

      setStatus(`You are in the queue. Position #${response.queuePosition}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit signup");
      setStatus(null);
    }
  }

  return (
    <div className="grid two-col">
      <section className="panel">
        <h1>Event Check-In</h1>
        <p className="muted">Use organizer QR token or PIN while signup window is open.</p>

        <form className="stack" onSubmit={verifyAccess}>
          <label>
            QR token
            <input
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="optional if PIN is provided"
            />
          </label>
          <label>
            Session PIN
            <input
              value={sessionPin}
              onChange={(e) => setSessionPin(e.target.value)}
              placeholder="6 digits"
            />
          </label>
          <button type="submit">Verify access</button>
        </form>
      </section>

      <section className="panel">
        <h2>Intro Submission (4 required)</h2>
        {!verified ? <p className="muted">Verify access to unlock form.</p> : null}

        <form className="stack" onSubmit={submitSignup}>
          <label>
            Who are you?
            <textarea
              required
              disabled={!verified}
              value={form.who}
              onChange={(e) => setForm((prev) => ({ ...prev, who: e.target.value }))}
            />
          </label>
          <label>
            What is your project?
            <textarea
              required
              disabled={!verified}
              value={form.project}
              onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
            />
          </label>
          <label>
            What do you need or want?
            <textarea
              required
              disabled={!verified}
              value={form.need}
              onChange={(e) => setForm((prev) => ({ ...prev, need: e.target.value }))}
            />
          </label>
          <label>
            How can you help others?
            <textarea
              required
              disabled={!verified}
              value={form.canHelp}
              onChange={(e) => setForm((prev) => ({ ...prev, canHelp: e.target.value }))}
            />
          </label>
          <label>
            Website URL (optional)
            <input
              type="url"
              disabled={!verified}
              value={form.websiteUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
            />
          </label>
          <label>
            LinkedIn URL (optional)
            <input
              type="url"
              disabled={!verified}
              value={form.linkedinUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
            />
          </label>
          <label>
            Short bio (optional)
            <textarea
              disabled={!verified}
              value={form.shortBio}
              onChange={(e) => setForm((prev) => ({ ...prev, shortBio: e.target.value }))}
            />
          </label>
          <button type="submit" disabled={!verified || !canSubmit}>
            Submit intro
          </button>
        </form>
      </section>

      {status ? <p className="success full">{status}</p> : null}
      {error ? <p className="error full">{error}</p> : null}
    </div>
  );
}
