import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { getAllChapters, getPrimaryMembership } from "../lib/data";
import { supabase } from "../lib/supabase";
import type { Role } from "../types/domain";

interface Chapter {
  id: string;
  slug: string;
  name: string;
  timezone: string | null;
  status: string;
}

interface ChapterContextValue {
  chapterId: string | null;
  chapterName: string | null;
  chapters: Chapter[];
  role: Role | null;
  setChapterId: (id: string) => void;
  loading: boolean;
}

const ChapterContext = createContext<ChapterContextValue | undefined>(undefined);

export function ChapterProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Load chapter(s) based on user type
  useEffect(() => {
    if (!user) {
      setChapters([]);
      setChapterId(null);
      setRole(null);
      setLoading(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        if (isSuperAdmin) {
          const allChapters = await getAllChapters();
          if (!active) return;
          setChapters(allChapters);
          if (allChapters.length > 0 && !chapterId) {
            setChapterId(allChapters[0].id);
          }
        } else {
          const membership = await getPrimaryMembership(user);
          if (!active) return;
          setChapterId(membership.chapter_id);
          setRole(membership.role);
        }
      } catch {
        // Silently handle — pages will show loading then empty
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin]);

  // For superadmin: fetch role for selected chapter
  const fetchRoleForChapter = useCallback(
    async (cId: string) => {
      if (!user) return;
      const { data } = await supabase
        .from("chapter_memberships")
        .select("role")
        .eq("chapter_id", cId)
        .eq("user_id", user.id)
        .maybeSingle();

      setRole((data?.role as Role) ?? (isSuperAdmin ? "admin" : null));
    },
    [user, isSuperAdmin],
  );

  useEffect(() => {
    if (!chapterId || !isSuperAdmin) return;
    void fetchRoleForChapter(chapterId);
  }, [chapterId, isSuperAdmin, fetchRoleForChapter]);

  const chapterName = useMemo(
    () => chapters.find((c) => c.id === chapterId)?.name ?? null,
    [chapters, chapterId],
  );

  const value = useMemo<ChapterContextValue>(
    () => ({
      chapterId,
      chapterName,
      chapters,
      role,
      setChapterId,
      loading,
    }),
    [chapterId, chapterName, chapters, role, loading],
  );

  return (
    <ChapterContext.Provider value={value}>{children}</ChapterContext.Provider>
  );
}

export function useChapter(): ChapterContextValue {
  const context = useContext(ChapterContext);
  if (!context) {
    throw new Error("useChapter must be used within ChapterProvider");
  }
  return context;
}
