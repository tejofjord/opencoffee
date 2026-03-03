import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { invokeFunction } from "../lib/functions";
import type { SignupSubmission } from "../types/domain";

interface SessionJoinResponse {
  allowed: boolean;
  message: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
}

interface SignupUpsertResponse {
  signupId: string;
  queuePosition: number;
}

const stepLabels = [
  "Who are you?",
  "What is your project?",
  "What do you need?",
  "How can you help?",
  "Links and bio",
  "Review and submit",
] as const;

export function EventJoinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [search] = useSearchParams();
  const tokenFromUrl = search.get("token") || "";

  const [sessionToken, setSessionToken] = useState(tokenFromUrl);
  const [sessionPin, setSessionPin] = useState("");
  const [verified, setVerified] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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
  const autoVerifyAttemptedRef = useRef(false);

  const canSubmit = useMemo(
    () => Boolean(form.who && form.project && form.need && form.canHelp),
    [form.canHelp, form.need, form.project, form.who],
  );

  if (!eventId) {
    return <section className="panel">Missing event ID.</section>;
  }
  const resolvedEventId = eventId;

  const totalSteps = stepLabels.length;
  const progressPct = ((currentStep + 1) / totalSteps) * 100;

  function updateField<K extends keyof Omit<SignupSubmission, "eventId">>(
    key: K,
    value: Omit<SignupSubmission, "eventId">[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (currentStep === 0 && !form.who.trim()) {
      setError("Please complete this step before continuing.");
      return;
    }
    if (currentStep === 1 && !form.project.trim()) {
      setError("Please complete this step before continuing.");
      return;
    }
    if (currentStep === 2 && !form.need.trim()) {
      setError("Please complete this step before continuing.");
      return;
    }
    if (currentStep === 3 && !form.canHelp.trim()) {
      setError("Please complete this step before continuing.");
      return;
    }

    setError(null);
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  }

  function prevStep() {
    setError(null);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  async function verifyAccessRequest(token: string, pin: string, auto = false) {
    setError(null);
    setStatus(auto ? "Verifying QR check-in link..." : "Verifying access...");

    try {
      const response = await invokeFunction<
        { eventId: string; token?: string; pin?: string },
        SessionJoinResponse
      >("session-join", {
        eventId: resolvedEventId,
        token: token || undefined,
        pin: pin || undefined,
      });

      if (!response.allowed) {
        const details: string[] = [response.message];
        if (typeof response.remainingAttempts === "number") {
          details.push(`Remaining attempts: ${response.remainingAttempts}`);
        }
        if (typeof response.retryAfterSeconds === "number") {
          details.push(`Try again in ${response.retryAfterSeconds}s`);
        }
        setError(details.join(" "));
        setVerified(false);
        setStatus(null);
        return;
      }

      setVerified(true);
      setCurrentStep(0);
      setStatus("Access granted. Step through the intro flow.");
      setForm((prev) => ({ ...prev, sessionToken: token, sessionPin: pin }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session validation failed");
      setStatus(null);
    }
  }

  async function verifyAccess(event: FormEvent) {
    event.preventDefault();
    await verifyAccessRequest(sessionToken, sessionPin);
  }

  useEffect(() => {
    if (!tokenFromUrl || verified || autoVerifyAttemptedRef.current) return;
    autoVerifyAttemptedRef.current = true;
    void verifyAccessRequest(tokenFromUrl, sessionPin, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl, verified]);

  async function submitSignup(event: FormEvent) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Please complete all 4 required intro prompts before submitting.");
      return;
    }

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
    <div className="grid join-layout">
      <section className="panel">
        <h1>Event Check-In</h1>
        <p className="muted">Use organizer QR token or PIN while signup window is open.</p>
        {tokenFromUrl ? (
          <p className="small muted">QR link detected. Access will be verified automatically.</p>
        ) : null}

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

        <div className="card small-card">
          <strong>Flow:</strong>
          <p className="small muted">1. Verify session</p>
          <p className="small muted">2. Answer the 4 intro prompts</p>
          <p className="small muted">3. Optional links and bio</p>
          <p className="small muted">4. Review and submit queue entry</p>
        </div>
      </section>

      <section className="panel">
        <h2>Presenter Intro</h2>
        {!verified ? <p className="muted">Verify access to unlock the guided form.</p> : null}

        {verified ? (
          <form className="stack" onSubmit={submitSignup}>
            <div className="stepper-head">
              <div className="row wrap step-meta-row">
                <span className="small muted">
                  Step {currentStep + 1}/{totalSteps} — {stepLabels[currentStep]}
                </span>
              </div>
              <div className="step-progress">
                <span style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {currentStep === 0 ? (
              <label>
                Who are you?
                <textarea
                  required
                  value={form.who}
                  onChange={(e) => updateField("who", e.target.value)}
                  placeholder="Name, background, and your role"
                />
              </label>
            ) : null}

            {currentStep === 1 ? (
              <label>
                What is your project?
                <textarea
                  required
                  value={form.project}
                  onChange={(e) => updateField("project", e.target.value)}
                  placeholder="What are you building right now?"
                />
              </label>
            ) : null}

            {currentStep === 2 ? (
              <label>
                What do you need or want?
                <textarea
                  required
                  value={form.need}
                  onChange={(e) => updateField("need", e.target.value)}
                  placeholder="Advice, intro, cofounder, customers, funding..."
                />
              </label>
            ) : null}

            {currentStep === 3 ? (
              <label>
                How can you help others?
                <textarea
                  required
                  value={form.canHelp}
                  onChange={(e) => updateField("canHelp", e.target.value)}
                  placeholder="Skills, connections, hiring, technical support..."
                />
              </label>
            ) : null}

            {currentStep === 4 ? (
              <>
                <label>
                  Website URL (optional)
                  <input
                    type="url"
                    value={form.websiteUrl}
                    onChange={(e) => updateField("websiteUrl", e.target.value)}
                  />
                </label>
                <label>
                  LinkedIn URL (optional)
                  <input
                    type="url"
                    value={form.linkedinUrl}
                    onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  />
                </label>
                <label>
                  Short bio (optional)
                  <textarea
                    value={form.shortBio}
                    onChange={(e) => updateField("shortBio", e.target.value)}
                  />
                </label>
                {!form.websiteUrl && !form.linkedinUrl ? (
                  <p className="small muted">Tip: adding one link helps people find you faster after the event.</p>
                ) : null}
              </>
            ) : null}

            {currentStep === 5 ? (
              <div className="review-grid">
                <article className="card">
                  <h3>Who</h3>
                  <p className="small">{form.who || "-"}</p>
                </article>
                <article className="card">
                  <h3>Project</h3>
                  <p className="small">{form.project || "-"}</p>
                </article>
                <article className="card">
                  <h3>Need</h3>
                  <p className="small">{form.need || "-"}</p>
                </article>
                <article className="card">
                  <h3>Can Help</h3>
                  <p className="small">{form.canHelp || "-"}</p>
                </article>
                <article className="card">
                  <h3>Website</h3>
                  <p className="small break">{form.websiteUrl || "-"}</p>
                </article>
                <article className="card">
                  <h3>LinkedIn</h3>
                  <p className="small break">{form.linkedinUrl || "-"}</p>
                </article>
              </div>
            ) : null}

            <div className="row wrap step-actions">
              <button type="button" className="ghost" onClick={prevStep} disabled={currentStep === 0}>
                Back
              </button>
              {currentStep < totalSteps - 1 ? (
                <button type="button" onClick={nextStep}>Continue</button>
              ) : (
                <button type="submit" disabled={!canSubmit}>Submit intro</button>
              )}
            </div>
          </form>
        ) : null}
      </section>

      {status ? <p className="success full">{status}</p> : null}
      {error ? <p className="error full">{error}</p> : null}
    </div>
  );
}
