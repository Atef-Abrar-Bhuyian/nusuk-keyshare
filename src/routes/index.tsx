import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  HelpCircle,
  Inbox,
  Info,
  KeyRound,
  List,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listKeys, type KeyItem } from "@/lib/keys.functions";
import { useDoneKeys } from "@/hooks/use-done-keys";
import { useNotWorkingKeys } from "@/hooks/use-not-working-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const keysQueryOptions = queryOptions({
  queryKey: ["keys"],
  queryFn: () => listKeys(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(keysQueryOptions),
  head: () => ({
    meta: [
      {
        title: "Nusuk Keys | Share Your Key",
      },
      {
        name: "description",
        content:
          "A simple shared list of keys. Copy any key, mark the ones you have used as done - done marks are private to your device.",
      },
      { property: "og:title", content: "Nusuk Keys | Share Your Key" },
      {
        property: "og:description",
        content:
          "Copy any shared key and mark the ones you have used as done. Done marks are private to your device, so keys stay available for everyone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<"list" | "add" | "darud" | "info">("list");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-background">
      <div className="flex-1 pb-24">
        {tab === "list" ? (
          <KeyList />
        ) : tab === "add" ? (
          <AddKeys onDone={() => setTab("list")} />
        ) : tab === "darud" ? (
          <DarudPanel />
        ) : (
          <InfoPanel />
        )}
      </div>

      {/* Bottom tab bar - thumb friendly on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-stretch">
          <TabButton
            active={tab === "list"}
            onClick={() => setTab("list")}
            icon={<List className="size-5" />}
            label="Keys"
          />
          <TabButton
            active={tab === "add"}
            onClick={() => setTab("add")}
            icon={<Plus className="size-5" />}
            label="Add keys"
          />
          <TabButton
            active={tab === "darud"}
            onClick={() => setTab("darud")}
            icon={<Sparkles className="size-5" />}
            label="Darud"
          />
          <TabButton
            active={tab === "info"}
            onClick={() => setTab("info")}
            icon={<Info className="size-5" />}
            label="Info"
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function KeyList() {
  const { data: keys } = useSuspenseQuery(keysQueryOptions);
  const queryClient = useQueryClient();
  const { doneIds, toggleDone, unmarkDone, clearAllDone, hydrated: doneHydrated } = useDoneKeys();
  const {
    notWorkingIds,
    toggleNotWorking,
    unmarkNotWorking,
    hydrated: notWorkingHydrated,
  } = useNotWorkingKeys();
  const hydrated = doneHydrated && notWorkingHydrated;
  const [filter, setFilter] = useState<"todo" | "done" | "notWorking" | "all">("todo");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const doneCount = useMemo(
    () => keys.filter((k) => doneIds.has(k.id)).length,
    // doneIds is a Set, so this memo is stable between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, [...doneIds].length],
  );

  const notWorkingCount = useMemo(
    () => keys.filter((k) => notWorkingIds.has(k.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, [...notWorkingIds].length],
  );

  // A key is either used (done) or broken - flagging one clears the other.
  const handleToggleDone = (id: string) => {
    const wasDone = doneIds.has(id);
    if (!wasDone) unmarkNotWorking(id);
    toggleDone(id);
    toast(wasDone ? "Marked as to-do" : "Marked as done", {
      description: wasDone
        ? "Key moved back to your to-do list."
        : "Key removed from your active list.",
    });
  };

  const handleToggleNotWorking = (id: string) => {
    const wasNotWorking = notWorkingIds.has(id);
    if (!wasNotWorking) unmarkDone(id);
    toggleNotWorking(id);
    toast(wasNotWorking ? "Unmarked" : "Marked as not working", {
      description: wasNotWorking
        ? "Key is back in your active list."
        : "Key flagged as not working.",
    });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = keys;
    if (q) list = list.filter((k) => k.keyText.toLowerCase().includes(q));
    if (filter === "todo")
      list = list.filter((k) => !doneIds.has(k.id) && !notWorkingIds.has(k.id));
    if (filter === "done") list = list.filter((k) => doneIds.has(k.id));
    if (filter === "notWorking") list = list.filter((k) => notWorkingIds.has(k.id));
    // Primary keys always first, then unflagged, then flagged (done/not-working).
    return [...list].sort((a, b) => {
      // Tier 1: primaries always on top
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      // Tier 2: untouched before flagged
      const aFlagged = doneIds.has(a.id) || notWorkingIds.has(a.id) ? 1 : 0;
      const bFlagged = doneIds.has(b.id) || notWorkingIds.has(b.id) ? 1 : 0;
      if (aFlagged !== bFlagged) return aFlagged - bFlagged;
      // Tier 3: insertion order
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [keys, filter, search, doneIds, notWorkingIds]);

  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["keys"] });
    setRefreshing(false);
  };

  return (
    <>
      <section className="mx-auto w-full max-w-2xl px-3 pt-3 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-md bg-hero px-5 py-6 text-hero-foreground sm:px-8 sm:py-8">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-gold" />
            <span>Nusuk key sharing</span>
          </div>
          <h1 className="mt-4 max-w-lg font-display text-3xl font-semibold leading-tight sm:text-4xl">
            A little help, shared with care.
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-hero-foreground/80 sm:text-base">
            Find a key that helps, and leave the rest for someone else.
          </p>
          <div className="mt-6 grid max-w-sm grid-cols-2 border-t border-hero-foreground/20 pt-4">
            <div>
              <p className="font-display text-2xl font-semibold">
                {keys.length - doneCount - notWorkingCount}
              </p>
              <p className="mt-1 text-xs text-hero-foreground/75">Available to you</p>
            </div>
            <div className="border-l border-hero-foreground/20 pl-5">
              <p className="font-display text-2xl font-semibold">{hydrated ? doneCount : "-"}</p>
              <p className="mt-1 text-xs text-hero-foreground/75">Marked done on this device</p>
            </div>
          </div>
        </div>
      </section>

      <header className="sticky top-0 z-10 mt-4 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">The shared list</h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {keys.length}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh keys"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={cn("size-5", refreshing && "animate-spin")} />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys…"
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterChip active={filter === "todo"} onClick={() => setFilter("todo")}>
            To do
          </FilterChip>
          <FilterChip active={filter === "done"} onClick={() => setFilter("done")}>
            Done {hydrated ? doneCount : ""}
          </FilterChip>
          <FilterChip active={filter === "notWorking"} onClick={() => setFilter("notWorking")}>
            Not working {hydrated ? notWorkingCount : ""}
          </FilterChip>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-6">
        {visible.length === 0 ? (
          <EmptyState
            hasKeys={keys.length > 0}
            filter={filter}
            searching={search.trim().length > 0}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((k) => (
              <KeyRow
                key={k.id}
                item={k}
                done={doneIds.has(k.id)}
                notWorking={notWorkingIds.has(k.id)}
                onToggleDone={() => handleToggleDone(k.id)}
                onToggleNotWorking={() => handleToggleNotWorking(k.id)}
              />
            ))}
          </ul>
        )}

        {filter === "done" && doneCount > 0 && visible.length > 0 ? (
          <button
            type="button"
            onClick={clearAllDone}
            className="mx-auto mt-4 block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear all my done marks
          </button>
        ) : null}

        {filter === "todo" && !search.trim() ? (
          <section className="mt-8 border-t border-border px-2 py-6 text-center">
            <p className="font-display text-xl font-semibold text-primary">Jazāk Allāhu Khayran</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              To everyone who shares a key here: may Allah reward you with goodness. Your generosity
              can make someone’s day a little easier.
            </p>
          </section>
        ) : null}
      </main>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function KeyRow({
  item,
  done,
  notWorking,
  onToggleDone,
  onToggleNotWorking,
}: {
  item: KeyItem;
  done: boolean;
  notWorking: boolean;
  onToggleDone: () => void;
  onToggleNotWorking: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    const ok = await copyText(item.keyText);
    if (ok) {
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      toast.success("Key copied!", { description: "The key has been copied to your clipboard." });
    } else {
      toast.error("Copy failed", {
        description: "Could not access the clipboard. Please copy manually.",
      });
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card shadow-sm transition-opacity",
        (done || notWorking) && "opacity-60",
      )}
    >
      {/* Key text — always full width, clearly readable */}
      <div className="px-3 pt-3 pb-2">
        <span
          className={cn(
            "block break-all font-mono text-sm text-foreground",
            done && "line-through decoration-muted-foreground",
          )}
        >
          {item.keyText}
        </span>
      </div>

      {/* Action buttons — equal width, thumb-friendly */}
      <div className="flex border-t border-border">
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy key"}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
            copied ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Copy className="size-3.5" />
          {copied ? "Copied!" : "Copy"}
        </button>

        <div className="w-px bg-border" />

        <button
          type="button"
          onClick={onToggleDone}
          aria-label={done ? "Undo done mark" : "Mark as done"}
          aria-pressed={done}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
            done ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCircle2 className="size-3.5" />
          {done ? "Undo" : "Done"}
        </button>

        <div className="w-px bg-border" />

        <button
          type="button"
          onClick={onToggleNotWorking}
          aria-label={notWorking ? "Undo not working mark" : "Mark as not working"}
          aria-pressed={notWorking}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors",
            notWorking ? "text-destructive" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <XCircle className="size-3.5" />
          {notWorking ? "Undo" : "Not working"}
        </button>
      </div>
    </li>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API blocked (e.g. in-app browser): fall back to a hidden input.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function EmptyState({
  hasKeys,
  filter,
  searching,
}: {
  hasKeys: boolean;
  filter: "todo" | "done" | "notWorking" | "all";
  searching: boolean;
}) {
  let message = "No keys here yet. Tap “Add keys” below to share the first ones.";
  if (searching) message = "No keys match your search.";
  else if (hasKeys && filter === "done") message = "You haven't marked any keys as done yet.";
  else if (hasKeys && filter === "notWorking")
    message = "You haven't marked any keys as not working.";
  else if (hasKeys && filter === "todo")
    message = "Nothing left here - every key is marked done or not working.";

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="max-w-64 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

const HADITH_LIST = [
  {
    id: "h1",
    text: "Whoever sends one blessing upon me, Allah will send ten blessings upon him, erase ten of his sins, and raise him ten degrees in status.",
    source: "Sunan al-Nasa'i, 1297 — Sahih",
  },
  {
    id: "h2",
    text: "The closest of people to me on the Day of Resurrection will be those who sent the most blessings upon me.",
    source: "Sunan al-Tirmidhi, 484 — Sahih",
  },
  {
    id: "h3",
    text: "Do not make your homes graves, and do not make my grave a place of celebration. Send blessings upon me, for your blessings will reach me wherever you are.",
    source: "Sunan Abi Dawud, 2042 — Sahih",
  },
  {
    id: "h4",
    text: "The miser is the one in whose presence I am mentioned and he does not send blessings upon me.",
    source: "Sunan al-Tirmidhi, 3546 — Sahih",
  },
  {
    id: "h5",
    text: "Increase in sending blessings upon me on Fridays, for your blessings are presented to me.",
    source: "Sunan Abi Dawud, 1047 — Sahih",
  },
] as const;

const DARUD_LIST = [
  {
    id: "ibrahimi",
    title: "Durood Ibrahimi",
    arabic:
      "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ",
    transliteration:
      "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammadin kama sallayta 'ala Ibrahima wa 'ala ali Ibrahima innaka Hamidun Majid. Allahumma barik 'ala Muhammadin wa 'ala ali Muhammadin kama barakta 'ala Ibrahima wa 'ala ali Ibrahima innaka Hamidun Majid.",
    translation:
      "O Allah, send blessings upon Muhammad and the family of Muhammad, as You sent blessings upon Ibrahim and the family of Ibrahim. Truly You are Praiseworthy and Glorious. O Allah, bless Muhammad and the family of Muhammad, as You blessed Ibrahim and the family of Ibrahim. Truly You are Praiseworthy and Glorious.",
  },
  {
    id: "simple",
    title: "Durood Simple",
    arabic: "صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ",
    transliteration: "Sallallahu 'alayhi wa sallam",
    translation: "May Allah's peace and blessings be upon him.",
  },
  {
    id: "tunajjina",
    title: "Durood Tunajjina",
    arabic:
      "اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ صَلاةً تُنَجِّينَا بِهَا مِنْ جَمِيعِ الأَهْوَالِ وَالآفَاتِ وَتَقْضِي لَنَا بِهَا جَمِيعَ الحَاجَاتِ وَتُطَهِّرُنَا بِهَا مِنْ جَمِيعِ السَّيِّئَاتِ وَتَرْفَعُنَا بِهَا عِنْدَكَ أَعْلَى الدَّرَجَاتِ وَتُبَلِّغُنَا بِهَا أَقْصَى الغَايَاتِ مِنْ جَمِيعِ الخَيْرَاتِ فِي الحَيَاةِ وَبَعْدَ المَمَاتِ",
    transliteration:
      "Allahumma salli 'ala Sayyidina Muhammadin salatan tunajjina biha min jami'il ahwali wal afat, wa taqdi lana biha jami'al hajat, wa tutahhiruna biha min jami'is sayyi'at, wa tarfa'una biha 'indaka a'lad darajat, wa tuballighuna biha aqsal ghayati min jami'il khayrati fil hayati wa ba'dal mamat.",
    translation:
      "O Allah, send blessings upon our master Muhammad, blessings by which You will save us from all fears and calamities, fulfil all our needs, purify us from all sins, raise us to the highest ranks in Your presence, and bring us to the furthest goals of all goodness in this life and after death.",
  },
  {
    id: "nariya",
    title: "Durood Nariya",
    arabic:
      "اللَّهُمَّ صَلِّ صَلاةً كَامِلَةً وَسَلِّمْ سَلاماً تَامَّاً عَلَى سَيِّدِنَا مُحَمَّدٍ الَّذِي تَنْحَلُّ بِهِ الْعُقَدُ وَتَنْفَرِجُ بِهِ الْكُرَبُ وَتُقْضَى بِهِ الْحَوَائِجُ وَتُنَالُ بِهِ الرَّغَائِبُ وَحُسْنُ الْخَوَاتِمِ وَيُسْتَسْقَى الْغَمَامُ بِوَجْهِهِ الْكَرِيمِ وَعَلَى آلِهِ وَصَحْبِهِ فِي كُلِّ لَمْحَةٍ وَنَفَسٍ بِعَدَدِ كُلِّ مَعْلُومٍ لَكَ",
    transliteration:
      "Allahumma salli salatan kamilatan wa sallim salaman tamman 'ala Sayyidina Muhammadin alladhi tanhallu bihil 'uqad wa tanfariju bihil kurab wa tuqda bihil hawaij wa tunalu bihir ragha'ib wa husn al-khawatim wa yustasqal ghamamu bi wajhihil karim wa 'ala alihi wa sahbihi fi kulli lamhatin wa nafasin bi 'adadi kulli ma'lumin lak.",
    translation:
      "O Allah, bestow complete blessings and perfect peace upon our master Muhammad, through whom all difficulties are resolved, all calamities are removed, all needs are fulfilled, all desires are attained, and all good endings are achieved. The clouds are beseeched by means of his noble face. And upon his family and Companions, in every glance and breath, as many times as the number of all things known to You.",
  },
] as const;

function DarudPanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyDarud = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
      toast.success("Darud copied!", { description: "Paste it wherever you wish to recite." });
    } else {
      toast.error("Copy failed", { description: "Could not access the clipboard." });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-gold" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Darud Shareef</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Send blessings upon the Prophet ﷺ. Tap any card to copy the Arabic text.
        </p>
      </header>

      <main className="py-6">
        <div className="flex flex-col gap-6">
          {/* Sacred Places Gallery */}
          <div className="px-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sacred Places
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="group relative overflow-hidden rounded-xl">
                <img
                  src="/kaba.png"
                  alt="Masjid al-Haram - The Kaaba, Mecca"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent">
                  <p className="w-full px-3 pb-3 text-xs font-semibold text-white">
                    Masjid al-Haram
                    <br />
                    <span className="font-normal opacity-80">Mecca, Saudi Arabia</span>
                  </p>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-xl">
                <img
                  src="/madina.png"
                  alt="Masjid al-Nabawi - The Prophet's Mosque, Madina"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent">
                  <p className="w-full px-3 pb-3 text-xs font-semibold text-white">
                    Masjid al-Nabawi
                    <br />
                    <span className="font-normal opacity-80">Madina, Saudi Arabia</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hadiths */}
          <div className="px-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Hadiths on Salawat
            </p>
            <div className="flex flex-col gap-3">
              {HADITH_LIST.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-border bg-card p-4"
                  style={{ borderLeftWidth: "4px", borderLeftColor: "var(--gold)" }}
                >
                  <p className="text-sm leading-7 text-foreground">
                    <span className="mr-1 text-gold">"</span>
                    {h.text}
                    <span className="ml-1 text-gold">"</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    — <span className="font-medium">{h.source}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Darud cards */}
          <div className="px-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Durood Shareef
            </p>
            <div className="flex flex-col gap-4">
              {DARUD_LIST.map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-foreground">{d.title}</h2>
                    <Button
                      type="button"
                      variant={copiedId === d.id ? "secondary" : "outline"}
                      onClick={() => copyDarud(d.id, d.arabic)}
                      className="h-8 shrink-0 gap-1.5 px-3 text-xs"
                    >
                      <Copy className="size-3.5" />
                      {copiedId === d.id ? "Copied!" : "Copy Arabic"}
                    </Button>
                  </div>

                  {/* Arabic */}
                  <p
                    dir="rtl"
                    lang="ar"
                    className="mt-4 text-right text-xl leading-loose text-foreground sm:text-2xl"
                    style={{ fontFamily: "'Amiri', 'Scheherazade New', serif", lineHeight: "2.2" }}
                  >
                    {d.arabic}
                  </p>

                  {/* Transliteration */}
                  <p className="mt-3 border-t border-border pt-3 text-sm italic leading-7 text-muted-foreground">
                    {d.transliteration}
                  </p>

                  {/* Translation */}
                  <p className="mt-2 text-sm leading-6 text-muted-foreground/90">
                    <span className="font-medium text-foreground">Meaning: </span>
                    {d.translation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="px-4 pb-4 text-center text-xs text-muted-foreground">
            May Allah accept our ibadah and grant us the blessing of visiting His sacred houses.
            <br />
            <span className="mt-1 block text-gold">آمين</span>
          </p>
        </div>
      </main>
    </>
  );
}

const MAX_KEYS_PER_BATCH = 500;
const MAX_KEY_LENGTH = 300;

const CONTACT_EMAIL = "atefabrar101@gmail.com";

function InfoPanel() {
  const [emailCopied, setEmailCopied] = useState(false);

  const copyEmail = async () => {
    const ok = await copyText(CONTACT_EMAIL);
    if (ok) {
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 1500);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">How it works</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you need to know about using this site.
        </p>
      </header>

      <main className="px-4 py-6">
        <div className="flex flex-col gap-4">
          {/* Use one browser */}
          <InfoCard
            icon={<Monitor className="size-5 text-amber-500" />}
            title="Use only one browser"
            accent="amber"
          >
            <p>
              Your "done" and "not working" marks are saved in{" "}
              <strong>this browser's local storage</strong> - they are <em>private to you</em> and
              never stored on the server.
            </p>
            <p className="mt-2">
              If you switch to a different browser or device your marks will not carry over. Stick
              to the same browser so your progress is always visible.
            </p>
          </InfoCard>

          {/* How to add keys */}
          <InfoCard
            icon={<Plus className="size-5 text-emerald-500" />}
            title="How to add keys"
            accent="green"
          >
            <ol className="flex flex-col gap-2 pl-1">
              <StepItem n={1}>
                Tap the <strong>Add keys</strong> tab at the bottom.
              </StepItem>
              <StepItem n={2}>Type or paste your key into the input field.</StepItem>
              <StepItem n={3}>
                Need to add more? Tap <strong>Add another key</strong> (or press Enter) to get a new
                field.
              </StepItem>
              <StepItem n={4}>
                When ready, tap <strong>Add keys</strong> - duplicates are skipped automatically.
              </StepItem>
            </ol>
          </InfoCard>

          {/* How to use keys */}
          <InfoCard
            icon={<Copy className="size-5 text-blue-500" />}
            title="How to use a key"
            accent="blue"
          >
            <ol className="flex flex-col gap-2 pl-1">
              <StepItem n={1}>
                Go to the <strong>Keys</strong> tab.
              </StepItem>
              <StepItem n={2}>
                Find a key you want to use and tap <strong>Copy</strong>.
              </StepItem>
              <StepItem n={3}>
                Paste it on your nusuk app - the key is now on your clipboard.
              </StepItem>
            </ol>
          </InfoCard>

          {/* Marking keys */}
          <InfoCard
            icon={<CheckCircle2 className="size-5 text-primary" />}
            title="Marking keys"
            accent="default"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  Done
                </span>
                <p className="text-sm">
                  Tap <strong>Done</strong> once you have successfully used a key. It will be
                  visually dimmed and moved down so fresh keys stay at the top. Only visible to{" "}
                  <em>you</em> on this device.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  Not working
                </span>
                <p className="text-sm">
                  Tap <strong>Not working</strong> to flag a key that didn't work for you. This is
                  private - the key stays visible for other users who may have better luck with it.
                </p>
              </div>
            </div>
          </InfoCard>

          {/* Privacy note */}
          <InfoCard
            icon={<HelpCircle className="size-5 text-muted-foreground" />}
            title="Privacy & sharing"
            accent="muted"
          >
            <p>
              Keys you add are <strong>visible to everyone</strong> who visits this site - they are
              stored in a shared, anonymous list. Do not add any sensitive or personal information.
            </p>
            <p className="mt-2">
              Your done / not-working marks are stored only in your browser and are never sent to
              the server or shared with anyone.
            </p>
          </InfoCard>

          {/* Contact / feedback */}
          <InfoCard
            icon={<HelpCircle className="size-5 text-sky-500" />}
            title="Feedback & contact"
            accent="blue"
          >
            <p>
              Have a suggestion, found a bug, or just want to say something? Feel free to reach out
              — we'd love to hear from you.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {CONTACT_EMAIL}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                aria-label={emailCopied ? "Copied" : "Copy email address"}
                className={cn(
                  "flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent",
                  emailCopied ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Copy className="size-3.5" />
                {emailCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </InfoCard>
        </div>
      </main>
    </>
  );
}

function InfoCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: "amber" | "green" | "blue" | "default" | "muted";
  children: React.ReactNode;
}) {
  const accentBorder = {
    amber: "border-l-amber-400",
    green: "border-l-emerald-400",
    blue: "border-l-blue-400",
    default: "border-l-primary",
    muted: "border-l-border",
  }[accent];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 border-l-4", accentBorder)}>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}

function StepItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function AddKeys({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  // Each row is { id: string; value: string }
  const uid = useId();
  const [rows, setRows] = useState<{ id: string; value: string }[]>(() => [
    { id: `${uid}-0`, value: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Derive the valid, unique, non-empty keys from the rows.
  const parsed = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      const v = row.value.trim();
      if (v.length > 0 && v.length <= MAX_KEY_LENGTH) unique.add(v);
    }
    return [...unique];
  }, [rows]);

  const tooMany = parsed.length > MAX_KEYS_PER_BATCH;

  const updateRow = (id: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));

  const removeRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const addRow = () => {
    const newId = `${uid}-${Date.now()}`;
    setRows((prev) => [...prev, { id: newId, value: "" }]);
    // Focus the new input on next tick.
    requestAnimationFrame(() => inputRefs.current.get(newId)?.focus());
  };

  const clearAll = () => {
    const firstId = `${uid}-clear-${Date.now()}`;
    setRows([{ id: firstId, value: "" }]);
    setResult(null);
    setError(null);
  };

  const submit = async () => {
    if (parsed.length === 0 || tooMany) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("keys")
        .select("key_text")
        .in("key_text", parsed);
      if (fetchError) throw new Error(fetchError.message);

      const existingSet = new Set((existing ?? []).map((row) => row.key_text));
      const fresh = parsed.filter((k) => !existingSet.has(k));
      const skipped = parsed.length - fresh.length;

      if (fresh.length > 0) {
        const { error: insertError } = await supabase.from("keys").upsert(
          fresh.map((keyText) => ({ key_text: keyText })),
          { ignoreDuplicates: true, onConflict: "key_text" },
        );
        if (insertError) throw new Error(insertError.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["keys"] });
      setResult({ added: fresh.length, skipped });
      toast.success(
        fresh.length > 0
          ? `${fresh.length} key${fresh.length === 1 ? "" : "s"} added!`
          : "No new keys added",
        {
          description:
            fresh.length > 0
              ? skipped > 0
                ? `${skipped} duplicate${skipped === 1 ? " was" : "s were"} skipped.`
                : "Keys are now visible to everyone."
              : "All keys you entered already exist on the list.",
        },
      );
      clearAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      toast.error("Failed to add keys", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Add keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter one key per field. Everyone using the site will see them.
        </p>
      </header>

      <main className="px-4 py-4">
        <ul className="flex flex-col gap-2">
          {rows.map((row, idx) => (
            <li key={row.id} className="flex items-center gap-2">
              <Input
                ref={(el) => {
                  if (el) inputRefs.current.set(row.id, el);
                  else inputRefs.current.delete(row.id);
                }}
                value={row.value}
                onChange={(e) => updateRow(row.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRow();
                  }
                }}
                placeholder={`Key ${idx + 1}`}
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove this key"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-4" /> Add another key
        </button>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className={cn(tooMany ? "text-destructive" : "text-muted-foreground")}>
            {parsed.length} key{parsed.length === 1 ? "" : "s"} ready
            {tooMany ? ` - max ${MAX_KEYS_PER_BATCH} at a time` : ""}
          </span>
          {parsed.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <X className="size-3.5" /> Clear all
            </button>
          ) : null}
        </div>

        {result ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
            <p className="font-medium">
              Added {result.added} key{result.added === 1 ? "" : "s"} to the shared list.
            </p>
            {result.skipped > 0 ? (
              <p className="mt-1 text-muted-foreground">
                {result.skipped} duplicate{result.skipped === 1 ? " was" : "s were"} skipped - they
                were already on the list.
              </p>
            ) : null}
            <Button onClick={onDone} className="mt-3 w-full">
              View keys
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          onClick={submit}
          disabled={parsed.length === 0 || tooMany || submitting}
          className="mt-4 h-12 w-full text-base"
        >
          {submitting
            ? "Adding…"
            : `Add ${parsed.length || ""} ${parsed.length === 1 ? "key" : "keys"}`}
        </Button>
      </main>
    </>
  );
}
