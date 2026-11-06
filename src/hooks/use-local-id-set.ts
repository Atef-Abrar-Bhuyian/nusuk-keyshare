import { useEffect, useState } from "react";

/**
 * A per-device set of key IDs kept in localStorage.
 *
 * Both the "done" and "not working" marks use this: they are private to the
 * device and never written to the shared keys table, so one person flagging a
 * key never affects anybody else.
 */
export function useLocalIdSet(storageKey: string) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setIds(new Set(parsed.filter((x): x is string => typeof x === "string")));
        }
      }
    } catch {
      // Corrupted storage: start fresh.
    }
    setHydrated(true);
  }, [storageKey]);

  const toggle = (id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Storage unavailable (private mode): marks stay for this visit only.
      }
      return next;
    });
  };

  const add = (id: string) => {
    setIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Ignore.
      }
      return next;
    });
  };

  const remove = (id: string) => {
    setIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Ignore.
      }
      return next;
    });
  };

  const clearAll = () => {
    setIds(new Set());
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore.
    }
  };

  return { ids, toggle, add, remove, clearAll, hydrated };
}
