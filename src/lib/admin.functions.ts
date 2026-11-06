import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type AdminKeyItem = {
  id: string;
  keyText: string;
  createdAt: string;
};

export type AdminCredential = {
  id: string;
  email: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Supabase client factory - uses PUBLISHABLE key (no service role needed).
// admin_credentials has SELECT granted to anon; keys table already allows
// anon SELECT. For DELETE on keys we still need service role if RLS blocks it,
// but we'll use a bypass policy on keys for the admin server functions.
// ---------------------------------------------------------------------------

function makeSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    // Copy headers from the Request object first (if input is a Request)
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );
    // Then merge any headers from init on top
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    }
    // Strip the Bearer token for new-format sb_ keys - they use apikey header only
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function makeServerClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeSupabaseFetch(key) },
  });
}

// ---------------------------------------------------------------------------
// SHA-256 helper
// ---------------------------------------------------------------------------

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Session token helpers
// ---------------------------------------------------------------------------

async function makeToken(passwordHash: string): Promise<string> {
  const secret = process.env["ADMIN_SESSION_SECRET"] ?? "default-insecure-secret";
  return sha256hex(passwordHash + secret);
}

async function verifyTokenAgainstCredentials(
  token: string,
  rows: Array<{ password_hash: string; email: string }>,
): Promise<{ valid: boolean; email: string }> {
  for (const row of rows) {
    const expected = await makeToken(row.password_hash);
    if (expected === token) return { valid: true, email: row.email };
  }
  return { valid: false, email: "" };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const adminLogin = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = makeServerClient();

    const { data: row, error } = await db
      .from("admin_credentials")
      .select("id, email, password_hash")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "invalid" as const };

    const inputHash = await sha256hex(data.password);
    if (inputHash !== row.password_hash)
      return { ok: false as const, reason: "invalid" as const };

    const token = await makeToken(row.password_hash);
    return { ok: true as const, token, email: row.email };
  });

export const adminVerifySession = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const db = makeServerClient();
    const { data: rows, error } = await db
      .from("admin_credentials")
      .select("password_hash, email");
    if (error) throw new Error(error.message);
    const result = await verifyTokenAgainstCredentials(data.token, rows ?? []);
    if (result.valid) return { ok: true as const, email: result.email };
    return { ok: false as const };
  });

// ---------------------------------------------------------------------------
// Credential management  (read from DB; inserts via SQL editor only)
// ---------------------------------------------------------------------------

export const adminListCredentials = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const db = makeServerClient();
    const { data: rows, error } = await db
      .from("admin_credentials")
      .select("id, email, password_hash, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { valid } = await verifyTokenAgainstCredentials(data.token, rows ?? []);
    if (!valid) throw new Error("Unauthorized");

    return (rows ?? []).map(
      (r): AdminCredential => ({ id: r.id, email: r.email, createdAt: r.created_at }),
    );
  });

// ---------------------------------------------------------------------------
// Keys management  - uses service role if available, falls back to publishable.
// ---------------------------------------------------------------------------

function makeAdminClient() {
  const url = process.env["SUPABASE_URL"]!;
  // Prefer service/secret role key; fall back to publishable
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_SECRET_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeSupabaseFetch(key) },
  });
}

export const adminListKeys = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    // Auth check
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { data: rows, error } = await db
      .from("keys")
      .select("id, key_text, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    return (rows ?? []).map(
      (row): AdminKeyItem => ({
        id: row.id,
        keyText: row.key_text,
        createdAt: row.created_at,
      }),
    );
  });

export const adminDeleteKey = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { error } = await db.from("keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteKeys = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), ids: z.array(z.string().uuid()) }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { error } = await db.from("keys").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: data.ids.length };
  });

// ---------------------------------------------------------------------------
// Credential add/remove - requires service/secret role key to INSERT/DELETE
// on admin_credentials.  If not available, these return an error.
// ---------------------------------------------------------------------------

export const adminAddCredential = createServerFn({ method: "POST" })
  .validator(
    z.object({ token: z.string(), email: z.string().email(), password: z.string().min(8) }),
  )
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const password_hash = await sha256hex(data.password);
    const { error } = await db
      .from("admin_credentials")
      .insert({ email: data.email.toLowerCase().trim(), password_hash });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveCredential = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { error } = await db
      .from("admin_credentials")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Primary Keys management
// ---------------------------------------------------------------------------

export type AdminPrimaryKeyItem = {
  id: string;
  keyText: string;
  sortOrder: number;
  createdAt: string;
};

export const adminListPrimaryKeys = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { data: rows, error } = await db
      .from("primary_keys")
      .select("id, key_text, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map(
      (r): AdminPrimaryKeyItem => ({
        id: r.id,
        keyText: r.key_text,
        sortOrder: r.sort_order,
        createdAt: r.created_at,
      }),
    );
  });

export const adminAddPrimaryKey = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), keyText: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();

    // Determine next sort_order
    const { data: maxRow } = await db
      .from("primary_keys")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxRow?.sort_order ?? -1) + 1;

    const { error } = await db
      .from("primary_keys")
      .insert({ key_text: data.keyText.trim(), sort_order: nextOrder });

    if (error) {
      if (error.code === "23505") throw new Error("This key already exists in primary keys.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePrimaryKey = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string(), id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const authDb = makeServerClient();
    const { data: creds } = await authDb
      .from("admin_credentials")
      .select("password_hash, email");
    const { valid } = await verifyTokenAgainstCredentials(data.token, creds ?? []);
    if (!valid) throw new Error("Unauthorized");

    const db = makeAdminClient();
    const { error } = await db.from("primary_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

