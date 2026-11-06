import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  adminLogin,
  adminVerifySession,
  adminListKeys,
  adminDeleteKey,
  adminDeleteKeys,
  adminListCredentials,
  adminAddCredential,
  adminRemoveCredential,
  adminListPrimaryKeys,
  adminAddPrimaryKey,
  adminDeletePrimaryKey,
  type AdminKeyItem,
  type AdminCredential,
  type AdminPrimaryKeyItem,
} from "@/lib/admin.functions";

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Nusuk Keys" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Session helpers (sessionStorage)
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "admin_session_token";
const SESSION_EMAIL_KEY = "admin_session_email";

function getSession(): { token: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(SESSION_KEY);
  const email = sessionStorage.getItem(SESSION_EMAIL_KEY);
  if (!token || !email) return null;
  return { token, email };
}

function saveSession(token: string, email: string) {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(SESSION_EMAIL_KEY, email);
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EMAIL_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level page - handles login vs. dashboard
// ─────────────────────────────────────────────────────────────────────────────

function AdminPage() {
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);

  // Re-hydrate from sessionStorage and verify token with server
  useEffect(() => {
    const stored = getSession();
    if (!stored) {
      setChecking(false);
      return;
    }
    adminVerifySession({ data: { token: stored.token } })
      .then((res) => {
        if (res.ok) setSession(stored);
        else clearSession();
      })
      .catch(() => clearSession())
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (token: string, email: string) => {
    saveSession(token, email);
    setSession({ token, email });
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <AdminDashboard session={session} onLogout={handleLogout} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (token: string, email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminLogin({ data: { email, password } });
      if (res.ok) {
        onLogin(res.token, res.email);
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-hero shadow-lg">
            <Shield className="size-7 text-hero-foreground" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold text-foreground">Admin Access</h1>
            <p className="mt-1 text-sm text-muted-foreground">Only For Admin</p>
          </div>
        </div>

        {/* Form card */}
        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            {error ? (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          If you are not an ADMIN, PLEASE DO NOT TRY TO LOGIN.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type DashTab = "keys" | "duplicates" | "credentials" | "primary";

function AdminDashboard({
  session,
  onLogout,
}: {
  session: { token: string; email: string };
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<DashTab>("keys");
  const [keys, setKeys] = useState<AdminKeyItem[]>([]);
  const [credentials, setCredentials] = useState<AdminCredential[]>([]);
  const [primaryKeys, setPrimaryKeys] = useState<AdminPrimaryKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, c, p] = await Promise.all([
        adminListKeys({ data: { token: session.token } }),
        adminListCredentials({ data: { token: session.token } }),
        adminListPrimaryKeys({ data: { token: session.token } }),
      ]);
      setKeys(k);
      setCredentials(c);
      setPrimaryKeys(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group duplicates by key_text (should not exist due to UNIQUE constraint,
  // but we surface keys that look the same after normalisation - e.g. different
  // casing or surrounding whitespace that somehow got through).
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, AdminKeyItem[]>();
    for (const k of keys) {
      const norm = k.keyText.trim().toLowerCase();
      const arr = map.get(norm) ?? [];
      arr.push(k);
      map.set(norm, arr);
    }
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [keys]);

  const totalDuplicateCount = useMemo(
    () => duplicateGroups.reduce((s, g) => s + g.length - 1, 0), // extra copies
    [duplicateGroups],
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Shield className="size-5 text-primary" />
            <span className="font-display text-xl font-semibold text-foreground">Admin</span>
            {!loading && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                {keys.length} keys
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{session.email}</span>
            <button
              type="button"
              onClick={loadAll}
              aria-label="Refresh"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              Logout
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="mt-3 flex gap-1">
          {(
            [
              { id: "keys", label: "Keys", icon: KeyRound, badge: keys.length },
              {
                id: "duplicates",
                label: "Duplicates",
                icon: Copy,
                badge: totalDuplicateCount,
                warn: totalDuplicateCount > 0,
              },
              { id: "credentials", label: "Admins", icon: Users, badge: credentials.length },
              { id: "primary", label: "Primary", icon: Star, badge: primaryKeys.length },
            ] as const
          ).map(({ id, label, icon: Icon, badge, warn }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {badge != null && badge > 0 ? (
                <span
                  className={cn(
                    "min-w-4 rounded-full px-1 py-0.5 text-center text-[10px] font-semibold leading-none",
                    tab === id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : warn
                        ? "bg-destructive/15 text-destructive"
                        : "bg-accent text-accent-foreground",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <main className="flex-1 px-4 py-4 sm:px-6">
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {tab === "keys" && (
              <KeysTab keys={keys} token={session.token} onRefresh={loadAll} />
            )}
            {tab === "duplicates" && (
              <DuplicatesTab
                groups={duplicateGroups}
                token={session.token}
                onRefresh={loadAll}
              />
            )}
            {tab === "credentials" && (
              <CredentialsTab
                credentials={credentials}
                token={session.token}
                onRefresh={loadAll}
                currentEmail={session.email}
              />
            )}
            {tab === "primary" && (
              <PrimaryKeysTab
                primaryKeys={primaryKeys}
                token={session.token}
                onRefresh={loadAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Keys Tab
// ─────────────────────────────────────────────────────────────────────────────

function KeysTab({
  keys,
  token,
  onRefresh,
}: {
  keys: AdminKeyItem[];
  token: string;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.keyText.toLowerCase().includes(q));
  }, [keys, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(visible.map((k) => k.id)));
  const clearSelect = () => setSelected(new Set());

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this key permanently?")) return;
    setDeletingId(id);
    try {
      await adminDeleteKey({ data: { token, id } });
      showToast("Key deleted.");
      onRefresh();
    } catch {
      showToast("Failed to delete key.");
    } finally {
      setDeletingId(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected key${ids.length === 1 ? "" : "s"} permanently?`)) return;
    setBulkDeleting(true);
    try {
      await adminDeleteKeys({ data: { token, ids } });
      showToast(`${ids.length} key${ids.length === 1 ? "" : "s"} deleted.`);
      setSelected(new Set());
      onRefresh();
    } catch {
      showToast("Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        {selected.size > 0 ? (
          <>
            <button
              type="button"
              onClick={clearSelect}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="size-3.5" />
              Deselect ({selected.size})
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground disabled:opacity-60 hover:opacity-90"
            >
              {bulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete {selected.size}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={selectAll}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent"
          >
            Select all ({visible.length})
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total keys" value={keys.length} />
        <StatCard label="Shown" value={visible.length} />
        <StatCard label="Selected" value={selected.size} className="hidden sm:flex" />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <EmptyBox message="No keys match your search." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((k) => (
            <li
              key={k.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors",
                selected.has(k.id) && "border-primary/40 bg-primary/5",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(k.id)}
                onChange={() => toggleSelect(k.id)}
                className="size-4 shrink-0 accent-primary"
                aria-label={`Select key ${k.keyText}`}
              />
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
                {k.keyText}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                onClick={() => deleteKey(k.id)}
                disabled={deletingId === k.id}
                aria-label="Delete key"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                {deletingId === k.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicates Tab
// ─────────────────────────────────────────────────────────────────────────────

function DuplicatesTab({
  groups,
  token,
  onRefresh,
}: {
  groups: AdminKeyItem[][];
  token: string;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const deleteExtras = async (group: AdminKeyItem[]) => {
    // Keep the oldest, delete the rest
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const toDelete = sorted.slice(1).map((k) => k.id);
    if (!toDelete.length) return;
    if (!confirm(`Delete ${toDelete.length} duplicate(s)?`)) return;
    setDeleting(true);
    try {
      await adminDeleteKeys({ data: { token, ids: toDelete } });
      onRefresh();
    } catch {
      alert("Failed to delete duplicates.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllExtras = async () => {
    const toDelete = groups.flatMap((g) => {
      const sorted = [...g].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return sorted.slice(1).map((k) => k.id);
    });
    if (!toDelete.length) return;
    if (!confirm(`Delete ALL ${toDelete.length} duplicate copies?`)) return;
    setDeleting(true);
    try {
      await adminDeleteKeys({ data: { token, ids: toDelete } });
      onRefresh();
    } catch {
      alert("Failed to delete duplicates.");
    } finally {
      setDeleting(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <CheckCircle2 className="size-10 text-primary/60" />
        <p className="font-display text-xl font-semibold text-foreground">No duplicates found</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          All keys in the database are unique. Great shape!
        </p>
      </div>
    );
  }

  const totalExtras = groups.reduce((s, g) => s + g.length - 1, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>{groups.length}</strong> duplicate group{groups.length !== 1 ? "s" : ""} -{" "}
            <strong>{totalExtras}</strong> extra cop{totalExtras === 1 ? "y" : "ies"} can be removed.
          </span>
        </div>
        <button
          type="button"
          onClick={deleteAllExtras}
          disabled={deleting}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60 hover:opacity-90"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete all extras
        </button>
      </div>

      <ul className="flex flex-col gap-3">
        {groups.map((group) => {
          const norm = group[0].keyText.trim().toLowerCase();
          const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <li key={norm} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="break-all font-mono text-sm font-medium text-foreground">
                  {group[0].keyText}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                    ×{group.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExtras(group)}
                    disabled={deleting}
                    className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive disabled:opacity-60 hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3" />
                    Keep oldest
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {sorted.map((k, i) => (
                  <li key={k.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "size-5 shrink-0 rounded-full text-center text-[10px] font-bold leading-5",
                        i === 0
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {i === 0 ? "✓" : i + 1}
                    </span>
                    <span className="font-mono">{k.id.slice(0, 8)}…</span>
                    <span>{new Date(k.createdAt).toLocaleString()}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        kept
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Credentials Tab
// ─────────────────────────────────────────────────────────────────────────────

function CredentialsTab({
  credentials,
  token,
  onRefresh,
  currentEmail,
}: {
  credentials: AdminCredential[];
  token: string;
  onRefresh: () => void;
  currentEmail: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const addCred = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await adminAddCredential({ data: { token, email: newEmail, password: newPassword } });
      setNewEmail("");
      setNewPassword("");
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add credential.");
    } finally {
      setAdding(false);
    }
  };

  const removeCred = async (id: string, email: string) => {
    if (email === currentEmail) {
      alert("You cannot remove your own credential while logged in.");
      return;
    }
    if (!confirm(`Remove admin access for ${email}?`)) return;
    setRemovingId(id);
    try {
      await adminRemoveCredential({ data: { token, id } });
      onRefresh();
    } catch {
      alert("Failed to remove credential.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Admin accounts</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {showAdd ? <X className="size-3.5" /> : <UserPlus className="size-3.5" />}
          {showAdd ? "Cancel" : "Add admin"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={addCred}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="mb-3 text-sm font-semibold text-foreground">New admin credential</h3>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              placeholder="Email"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            {addError ? (
              <p className="text-xs text-destructive">{addError}</p>
            ) : null}
            <button
              type="submit"
              disabled={adding}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60 hover:opacity-90"
            >
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {adding ? "Adding…" : "Add admin"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {credentials.length === 0 ? (
        <EmptyBox message="No admin credentials found. Add one above." />
      ) : (
        <ul className="flex flex-col gap-2">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-hero">
                <UserCheck className="size-4 text-hero-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.email}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              {c.email === currentEmail ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  You
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeCred(c.id, c.email)}
                  disabled={removingId === c.id}
                  aria-label={`Remove ${c.email}`}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                >
                  {removingId === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared small components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3",
        className,
      )}
    >
      <p className="font-display text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary Keys Tab
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryKeysTab({
  primaryKeys,
  token,
  onRefresh,
}: {
  primaryKeys: AdminPrimaryKeyItem[];
  token: string;
  onRefresh: () => void;
}) {
  const [keyText, setKeyText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const addKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyText.trim()) return;
    setAddError(null);
    setAdding(true);
    try {
      await adminAddPrimaryKey({ data: { token, keyText: keyText.trim() } });
      setKeyText("");
      showToast("Primary key added.");
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add key.");
    } finally {
      setAdding(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Remove this primary key?")) return;
    setDeletingId(id);
    try {
      await adminDeletePrimaryKey({ data: { token, id } });
      showToast("Primary key removed.");
      onRefresh();
    } catch {
      showToast("Failed to remove key.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Star className="mt-0.5 size-4 shrink-0 fill-primary/20" />
        <p>
          Primary keys always appear <strong>at the top</strong> of the list for every user —
          without any special label. Add keys here that everyone should see first.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={addKey} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Add a primary key</h2>
        <div className="flex gap-2">
          <input
            value={keyText}
            onChange={(e) => setKeyText(e.target.value)}
            placeholder="Paste key here…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={adding || !keyText.trim()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60 hover:opacity-90"
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
        </div>
        {addError ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            {addError}
          </p>
        ) : null}
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Primary keys" value={primaryKeys.length} />
        <StatCard label="Shown first to all users" value={primaryKeys.length} />
      </div>

      {/* List */}
      {primaryKeys.length === 0 ? (
        <EmptyBox message="No primary keys yet. Add one above." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {primaryKeys.map((k, i) => (
            <li
              key={k.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              {/* Position badge */}
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                #{i + 1}
              </span>
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
                {k.keyText}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                onClick={() => deleteKey(k.id)}
                disabled={deletingId === k.id}
                aria-label="Remove primary key"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                {deletingId === k.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
