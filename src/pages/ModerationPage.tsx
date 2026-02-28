import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPrimaryMembership } from "../lib/data";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { ModerationReport, Role } from "../types/domain";

export function ModerationPage() {
  const { user } = useAuth();
  const [chapterId, setChapterId] = useState<string>("");
  const [role, setRole] = useState<Role | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const membership = await getPrimaryMembership(user);
        setChapterId(membership.chapter_id);
        setRole(membership.role);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load membership");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!chapterId) return;
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  async function loadReports() {
    const { data, error: reportError } = await supabase
      .from("reports")
      .select(
        "id, chapter_id, reporter_id, reported_user_id, reason, context, status, resolution_note, created_at",
      )
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false });

    if (reportError) {
      setError(reportError.message);
      return;
    }

    const mapped: ModerationReport[] = (data ?? []).map((row) => ({
      id: row.id,
      chapterId: row.chapter_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      context: row.context,
      status: row.status,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
    }));

    setReports(mapped);
  }

  async function resolveReport(reportId: string, decision: "resolved" | "dismissed") {
    try {
      await invokeFunction<
        { reportId: string; status: "resolved" | "dismissed"; resolutionNote?: string },
        { ok: boolean }
      >("report-resolve", {
        reportId,
        status: decision,
        resolutionNote: decision === "resolved" ? "Action taken by organizer" : "No action required",
      });
      setStatus(`Report marked ${decision}.`);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    }
  }

  const canModerate = role === "organizer" || role === "admin";

  if (!canModerate) {
    return (
      <section className="panel">
        <h1>Moderation</h1>
        <p className="muted">Organizer/admin access required.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Moderation Queue</h1>
      <p className="muted">Review reports, then resolve or dismiss.</p>

      <div className="stack gap-sm">
        {reports.length === 0 ? <p>No reports.</p> : null}
        {reports.map((report) => (
          <article key={report.id} className="card">
            <p className="small">
              Reporter {report.reporterId.slice(0, 8)} to user {report.reportedUserId.slice(0, 8)}
            </p>
            <p>
              <strong>Reason:</strong> {report.reason}
            </p>
            {report.context ? (
              <p>
                <strong>Context:</strong> {report.context}
              </p>
            ) : null}
            <p className="small muted">Status: {report.status}</p>
            {report.status === "open" || report.status === "reviewing" ? (
              <div className="row">
                <button onClick={() => void resolveReport(report.id, "resolved")}>Resolve</button>
                <button className="ghost" onClick={() => void resolveReport(report.id, "dismissed")}>
                  Dismiss
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {status ? <p className="success">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
