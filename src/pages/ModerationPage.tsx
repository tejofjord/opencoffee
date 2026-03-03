import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loading } from "../components/Loading";
import { useChapter } from "../context/ChapterContext";
import { useToast } from "../context/ToastContext";
import { invokeFunction } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { ModerationReport } from "../types/domain";

export function ModerationPage() {
  const { chapterId, role, loading: chapterLoading } = useChapter();
  const { showToast } = useToast();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    reportId: string;
    decision: "resolved" | "dismissed";
  } | null>(null);

  const loadReports = useCallback(async () => {
    if (!chapterId) return;

    const { data, error: reportError } = await supabase
      .from("reports")
      .select(
        "id, chapter_id, reporter_id, reported_user_id, reason, context, status, resolution_note, created_at, reporter:profiles!reports_reporter_id_fkey(display_name), reported:profiles!reports_reported_user_id_fkey(display_name)",
      )
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false });

    if (reportError) {
      showToast(reportError.message, "error");
      return;
    }

    const mapped: ModerationReport[] = (data ?? []).map((row: Record<string, unknown>) => {
      const reporterProfile = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
      const reportedProfile = Array.isArray(row.reported) ? row.reported[0] : row.reported;
      return {
        id: row.id as string,
        chapterId: row.chapter_id as string,
        reporterId: row.reporter_id as string,
        reportedUserId: row.reported_user_id as string,
        reporterName: (reporterProfile as { display_name?: string } | null)?.display_name ?? null,
        reportedName: (reportedProfile as { display_name?: string } | null)?.display_name ?? null,
        reason: row.reason as string,
        context: row.context as string | null,
        status: row.status as ModerationReport["status"],
        resolutionNote: row.resolution_note as string | null,
        createdAt: row.created_at as string,
      };
    });

    setReports(mapped);
  }, [chapterId, showToast]);

  useEffect(() => {
    if (!chapterId) return;
    void loadReports();
  }, [chapterId, loadReports]);

  // Refetch on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && chapterId) {
        void loadReports();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [chapterId, loadReports]);

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
      showToast(`Report marked ${decision}.`, "success");
      await loadReports();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update report", "error");
    }
  }

  const canModerate = role === "organizer" || role === "admin";

  if (chapterLoading) return <Loading />;

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
        {reports.length === 0 ? (
          <p className="empty-state">All clear — no reports to review.</p>
        ) : null}
        {reports.map((report) => (
          <article key={report.id} className="card">
            <p className="small">
              {report.reporterName ?? "Unknown"} reported {report.reportedName ?? "Unknown"}
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
                <button
                  onClick={() =>
                    setConfirmAction({ reportId: report.id, decision: "resolved" })
                  }
                >
                  Resolve
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    setConfirmAction({ reportId: report.id, decision: "dismissed" })
                  }
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.decision === "resolved" ? "Resolve report?" : "Dismiss report?"}
        message={
          confirmAction?.decision === "resolved"
            ? "Mark this report as resolved — action was taken."
            : "Dismiss this report — no action required."
        }
        confirmLabel={confirmAction?.decision === "resolved" ? "Resolve" : "Dismiss"}
        variant={confirmAction?.decision === "resolved" ? "default" : "default"}
        onConfirm={() => {
          if (confirmAction) {
            void resolveReport(confirmAction.reportId, confirmAction.decision);
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}
