import { useEffect, useMemo, useState } from "react";
import { clamp } from "../lib/time";

interface PieTimerProps {
  durationSeconds?: number;
  startedAt: string | null;
  elapsedSeconds: number;
}

export function PieTimer({ durationSeconds = 60, startedAt, elapsedSeconds }: PieTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const consumed = useMemo(() => {
    const running = startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0;
    return clamp(elapsedSeconds + running, 0, durationSeconds);
  }, [durationSeconds, elapsedSeconds, now, startedAt]);

  const angle = (consumed / durationSeconds) * 360;

  return (
    <div className="pie-wrap" aria-label="presentation timer">
      <div
        className="pie"
        style={{
          background: `conic-gradient(var(--accent) ${angle}deg, rgba(255,255,255,0.18) ${angle}deg)`,
        }}
      />
      <div className="pie-label" aria-hidden>
        ●
      </div>
    </div>
  );
}
