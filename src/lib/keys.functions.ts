import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type KeyItem = {
  id: string;
  keyText: string;
  createdAt: string;
  isPrimary: boolean;
};

function makePublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Public read of shared keys. Runs on the server with a publishable client.
 * Primary keys (admin-pinned) are fetched in parallel and prepended to the
 * list so they always appear first for every user — without any visual marker.
 */
export const listKeys = createServerFn({ method: "GET" }).handler(async () => {
  const supabasePublic = makePublicClient();

  // Fetch primary keys and regular keys in parallel
  const [primaryResult, regularResult] = await Promise.all([
    supabasePublic
      .from("primary_keys")
      .select("id, key_text, created_at, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(200),
    supabasePublic
      .from("keys")
      .select("id, key_text, created_at")
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  if (primaryResult.error) throw new Error(primaryResult.error.message);
  if (regularResult.error) throw new Error(regularResult.error.message);

  const primaryIds = new Set((primaryResult.data ?? []).map((r) => r.id));

  const primaryItems: KeyItem[] = (primaryResult.data ?? []).map((row) => ({
    id: row.id,
    keyText: row.key_text,
    createdAt: row.created_at,
    isPrimary: true,
  }));

  // Regular keys — exclude any that happen to share an id with primaries (safety guard)
  const regularItems: KeyItem[] = (regularResult.data ?? [])
    .filter((row) => !primaryIds.has(row.id))
    .map((row) => ({
      id: row.id,
      keyText: row.key_text,
      createdAt: row.created_at,
      isPrimary: false,
    }));

  // Primaries first, then regular keys
  return [...primaryItems, ...regularItems];
});
