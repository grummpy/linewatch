/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { toast } from "sonner";
import { create } from "zustand";
import { playAlertTone, playWatchTone } from "./audio";
import { HOUSEHOLD } from "./catalog";
import { destRegionFor, parseLogLine } from "./classify";
import { newId } from "./format";
import {
  collectorUrlSuggestions,
  discoverCollector,
  fetchCollectorStatus,
  normalizeCollectorUrlExport,
  probeLan as probeLanNet,
  pullCollectorEvents,
  type CollectorStatus,
  type LanProbe,
} from "./lan";
import { eventsToArchiveRows } from "./selectors";
import { adultSample, eventFromLog, generateHistory, randomEvent } from "./simulate";
import {
  DEFAULT_RULES,
  type Alert,
  type Archive,
  type Device,
  type FeedFilter,
  type PathKind,
  type Rules,
  type TrafficEvent,
} from "./types";

export type HouseSource = "demo" | "house";

const STORAGE_KEY = "linewatch-v3";
const MAX_EVENTS = 800;
const MAX_ALERTS = 200;
const MAX_ARCHIVES = 24;
const ARCHIVE_EVERY = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pruneWeek<T extends { ts?: number; createdAt?: number }>(rows: T[], now: number): T[] {
  const cut = now - WEEK_MS;
  return rows.filter((r) => (r.ts ?? r.createdAt ?? 0) >= cut);
}

function isLoopbackUrl(url: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(url);
}

type Persisted = {
  devices: Device[];
  rules: Rules;
  events: TrafficEvent[];
  alerts: Alert[];
  archives: Archive[];
  houseSource?: HouseSource;
  collectorUrl?: string;
};

type LinewatchState = {
  ready: boolean;
  running: boolean;
  now: number;
  devices: Device[];
  events: TrafficEvent[];
  alerts: Alert[];
  archives: Archive[];
  rules: Rules;
  filter: FeedFilter;
  personFilter: string;
  selectedEventId: string | null;
  ingestNote: string | null;
  eventsPerMin: number;
  houseSource: HouseSource;
  collectorUrl: string;
  collectorStatus: CollectorStatus | null;
  lanProbe: LanProbe | null;
  discovering: boolean;
  suggestedUrls: string[];
  hydrate: () => void;
  start: () => void;
  stop: () => void;
  setFilter: (f: FeedFilter) => void;
  setPersonFilter: (owner: string) => void;
  selectEvent: (id: string | null) => void;
  acknowledge: (id: string) => void;
  acknowledgeAll: () => void;
  toggleBlockDevice: (id: string) => void;
  renameDevice: (id: string, name: string) => void;
  setRules: (patch: Partial<Rules>) => void;
  addToBlocklist: (host: string) => void;
  removeFromBlocklist: (host: string) => void;
  addToAllowlist: (host: string) => void;
  removeFromAllowlist: (host: string) => void;
  blockSiteForPerson: (owner: string, host: string) => void;
  unblockSiteForPerson: (owner: string, host: string) => void;
  ingestLog: (text: string) => number;
  fireDemoAlert: () => void;
  flushArchive: () => void;
  probeLan: () => Promise<LanProbe>;
  setCollectorUrl: (url: string) => void;
  connectCollector: (url?: string) => Promise<CollectorStatus>;
  disconnectCollector: () => void;
  useDemoHouse: () => void;
  autoJoinHouse: () => Promise<void>;
};

let tick: ReturnType<typeof setInterval> | null = null;
let archiveTick: ReturnType<typeof setInterval> | null = null;
let firstAlertTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let collectorTick: ReturnType<typeof setInterval> | null = null;
let sessionAlerted = false;
let sinceArchive = 0;
let collectorSince = 0;
const recentTimes: number[] = [];

function persist(
  state: Pick<
    LinewatchState,
    "devices" | "rules" | "events" | "alerts" | "archives" | "houseSource" | "collectorUrl"
  >,
) {
  if (typeof localStorage === "undefined") return;
  const payload: Persisted = {
    devices: state.devices,
    rules: state.rules,
    events: pruneWeek(state.events, Date.now()).slice(-500),
    alerts: pruneWeek(state.alerts, Date.now()).slice(0, 120),
    archives: pruneWeek(state.archives, Date.now()).slice(0, MAX_ARCHIVES),
    houseSource: state.houseSource,
    collectorUrl: state.collectorUrl,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function schedulePersist(get: () => LinewatchState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s = get();
    persist({
      devices: s.devices,
      rules: s.rules,
      events: s.events,
      alerts: s.alerts,
      archives: s.archives,
      houseSource: s.houseSource,
      collectorUrl: s.collectorUrl,
    });
  }, 400);
}

function maybeNotify(alert: Alert, deviceName: string, enabled: boolean) {
  if (!enabled || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Linewatch · Adult content", {
      body: `${deviceName} · ${alert.host} · ${alert.sourceIp} → ${alert.destIp}`,
      tag: alert.id,
    });
  } catch {
    /* ignore */
  }
}

function alertFromEvent(event: TrafficEvent): Alert {
  return {
    id: newId("al"),
    eventId: event.id,
    ts: event.ts,
    deviceId: event.deviceId,
    category: event.category,
    host: event.destHost,
    destIp: event.destIp,
    sourceIp: event.sourceIp,
    label: event.destLabel,
    acknowledged: false,
    severity: event.risk === "alert" ? "high" : "medium",
  };
}

function normalizeEvent(e: TrafficEvent): TrafficEvent {
  return {
    ...e,
    owner: e.owner ?? "Unknown",
    path: (e.path as PathKind | undefined) ?? "wan",
    locationHint: e.locationHint ?? null,
    destRegion: e.destRegion ?? destRegionFor(e.destIp),
  };
}

function buildArchive(events: TrafficEvent[], devices: Device[], now: number): Archive | null {
  if (!events.length) return null;
  const slice = events.slice(-ARCHIVE_EVERY);
  return {
    id: newId("arc"),
    createdAt: now,
    from: slice[0]!.ts,
    to: slice[slice.length - 1]!.ts,
    eventCount: slice.length,
    adultCount: slice.filter((e) => e.category === "adult").length,
    sidewalkCount: slice.filter((e) => e.path === "sidewalk").length,
    locationCount: slice.filter((e) => e.locationHint).length,
    people: [...new Set(slice.map((e) => e.owner))],
    rows: eventsToArchiveRows(slice, devices),
  };
}

function seedDemo(devices: Device[], rules: Rules, now: number) {
  const events = generateHistory(devices, rules, now);
  const alerts = events
    .filter((e) => e.risk === "alert" || e.risk === "watch")
    .slice(-40)
    .reverse()
    .map((e) => ({ ...alertFromEvent(e), acknowledged: e.ts < now - 30 * 60_000 }));
  const seed = buildArchive(events, devices, now);
  return { events, alerts, archives: seed ? [seed] : ([] as Archive[]) };
}

function ingestEvent(
  set: (fn: (s: LinewatchState) => Partial<LinewatchState> | LinewatchState) => void,
  get: () => LinewatchState,
  event: TrafficEvent,
  opts?: { silent?: boolean },
) {
  const state = get();
  const device = state.devices.find((d) => d.id === event.deviceId);
  const devices = state.devices.some((d) => d.id === event.deviceId)
    ? state.devices.map((d) => (d.id === event.deviceId ? { ...d, lastSeen: event.ts } : d))
    : state.devices;
  const events = [...state.events, event].slice(-MAX_EVENTS);
  let alerts = state.alerts;
  const shouldAlert =
    !event.blocked &&
    ((event.risk === "alert" && state.rules.alertAdult) ||
      (event.risk === "watch" && state.rules.alertAfterHoursSocial));
  if (shouldAlert) {
    const alert = alertFromEvent(event);
    alerts = [alert, ...state.alerts].slice(0, MAX_ALERTS);
    if (!opts?.silent) {
      if (state.rules.sound) {
        if (alert.severity === "high") playAlertTone();
        else playWatchTone();
      }
      const who = device?.name ?? event.sourceIp;
      if (alert.severity === "high") {
        toast.error(`${who} · ${alert.host}`, {
          description: `${alert.sourceIp} → ${alert.destIp}`,
        });
        maybeNotify(alert, who, state.rules.browserNotify);
      }
    }
  }
  let archives = state.archives;
  sinceArchive += 1;
  if (sinceArchive >= ARCHIVE_EVERY) {
    const arc = buildArchive(events, devices, Date.now());
    if (arc) archives = [arc, ...archives].slice(0, MAX_ARCHIVES);
    sinceArchive = 0;
  }
  set(() => ({ devices, events, alerts, archives, now: Date.now() }));
}

export const useLinewatch = create<LinewatchState>((set, get) => ({
  ready: false,
  running: false,
  now: 0,
  devices: HOUSEHOLD,
  events: [],
  alerts: [],
  archives: [],
  rules: DEFAULT_RULES,
  filter: "all",
  personFilter: "all",
  selectedEventId: null,
  ingestNote: null,
  eventsPerMin: 0,
  houseSource: "demo",
  collectorUrl: "",
  collectorStatus: null,
  lanProbe: null,
  discovering: false,
  suggestedUrls: [],

  hydrate: () => {
    if (get().ready) return;
    const now = Date.now();
    let devices = HOUSEHOLD.map((d) => ({ ...d }));
    let rules = { ...DEFAULT_RULES, personBlocks: {} as Record<string, string[]> };
    let events: TrafficEvent[] = [];
    let alerts: Alert[] = [];
    let archives: Archive[] = [];
    let houseSource: HouseSource = "demo";
    let collectorUrl = "";
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("linewatch-v1");
      if (raw) {
        const saved = JSON.parse(raw) as Persisted & { rules?: Partial<Rules> };
        if (Array.isArray(saved.devices) && saved.devices.length) {
          devices = saved.devices.map((d) => {
            const base = HOUSEHOLD.find((h) => h.id === d.id);
            return base
              ? { ...base, ...d, ip: base.ip, mac: base.mac, kind: base.kind, role: d.role ?? base.role }
              : d;
          });
          const seen = new Set(devices.map((d) => d.id));
          for (const h of HOUSEHOLD) if (!seen.has(h.id)) devices.push({ ...h });
        }
        if (saved.rules) {
          rules = {
            ...DEFAULT_RULES,
            ...saved.rules,
            personBlocks: saved.rules.personBlocks ?? {},
            houseAllowlist: saved.rules.houseAllowlist ?? DEFAULT_RULES.houseAllowlist,
          };
        }
        if (Array.isArray(saved.events) && saved.events.length) {
          if (saved.houseSource === "house" || saved.events.length > 40) {
            events = saved.events.map(normalizeEvent);
          }
        }
        if (Array.isArray(saved.alerts)) alerts = saved.alerts;
        if (Array.isArray(saved.archives)) archives = saved.archives;
        if (saved.houseSource === "house" || saved.houseSource === "demo") houseSource = saved.houseSource;
        if (typeof saved.collectorUrl === "string") collectorUrl = saved.collectorUrl;
      }
    } catch {
      /* fresh */
    }
    // Loopback was a same-computer test. A phone never talks to its own loopback.
    if (isLoopbackUrl(collectorUrl)) {
      collectorUrl = "";
      houseSource = "demo";
    }
    if (houseSource !== "house" && events.length < 40) {
      const seeded = seedDemo(devices, rules, now);
      events = seeded.events;
      alerts = seeded.alerts;
      archives = seeded.archives;
    }
    events = pruneWeek(events, now);
    alerts = pruneWeek(alerts, now);
    archives = pruneWeek(archives, now);
    set({
      ready: true,
      now,
      devices,
      rules,
      events,
      alerts,
      archives,
      houseSource,
      collectorUrl,
    });
  },

  start: () => {
    get().hydrate();
    void get().autoJoinHouse();
    if (get().running) return;
    set({ running: true });
    tick = setInterval(() => {
      const s = get();
      if (!s.running || s.houseSource === "house") return;
      const event = randomEvent(s.devices, s.rules, Date.now());
      ingestEvent(set, get, event);
      const t = Date.now();
      recentTimes.push(t);
      while (recentTimes[0] && recentTimes[0] < t - 60_000) recentTimes.shift();
      set({ eventsPerMin: recentTimes.length, now: t });
      schedulePersist(get);
    }, 1800);

    archiveTick = setInterval(() => {
      const s = get();
      const now = Date.now();
      const events = pruneWeek(s.events, now);
      const alerts = pruneWeek(s.alerts, now);
      const archives = pruneWeek(s.archives, now);
      if (events.length !== s.events.length || alerts.length !== s.alerts.length) {
        set({ events, alerts, archives, now });
        schedulePersist(get);
      }
      if (sinceArchive >= 8) get().flushArchive();
    }, 180_000);

    if (!sessionAlerted) {
      firstAlertTimer = setTimeout(() => {
        sessionAlerted = true;
        const s = get();
        if (!s.running || s.houseSource === "house") return;
        const recentAdult = s.events.some((e) => e.category === "adult" && e.ts > Date.now() - 20_000);
        if (recentAdult) return;
        const sample = adultSample(s.devices, s.rules, Date.now());
        if (sample) ingestEvent(set, get, sample);
        schedulePersist(get);
      }, 6500);
    }
  },

  stop: () => {
    if (tick) clearInterval(tick);
    tick = null;
    if (archiveTick) clearInterval(archiveTick);
    archiveTick = null;
    if (firstAlertTimer) clearTimeout(firstAlertTimer);
    firstAlertTimer = null;
    if (collectorTick) clearInterval(collectorTick);
    collectorTick = null;
    set({ running: false });
    schedulePersist(get);
  },

  setFilter: (filter) => set({ filter }),
  setPersonFilter: (personFilter) => set({ personFilter }),
  selectEvent: (selectedEventId) => set({ selectedEventId }),

  acknowledge: (id) => {
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) }));
    schedulePersist(get);
  },
  acknowledgeAll: () => {
    set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })) }));
    schedulePersist(get);
  },

  toggleBlockDevice: (id) => {
    set((s) => ({
      devices: s.devices.map((d) => (d.id === id ? { ...d, blocked: !d.blocked } : d)),
    }));
    schedulePersist(get);
  },

  renameDevice: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      devices: s.devices.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
    }));
    schedulePersist(get);
  },

  setRules: (patch) => {
    set((s) => ({ rules: { ...s.rules, ...patch } }));
    schedulePersist(get);
  },

  addToBlocklist: (host) => {
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!h) return;
    set((s) => ({
      rules: {
        ...s.rules,
        blocklist: s.rules.blocklist.includes(h) ? s.rules.blocklist : [...s.rules.blocklist, h],
      },
    }));
    schedulePersist(get);
  },

  removeFromBlocklist: (host) => {
    set((s) => ({
      rules: { ...s.rules, blocklist: s.rules.blocklist.filter((x) => x !== host) },
    }));
    schedulePersist(get);
  },

  addToAllowlist: (host) => {
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!h) return;
    set((s) => ({
      rules: {
        ...s.rules,
        houseAllowlist: s.rules.houseAllowlist.includes(h)
          ? s.rules.houseAllowlist
          : [...s.rules.houseAllowlist, h],
      },
    }));
    schedulePersist(get);
  },

  removeFromAllowlist: (host) => {
    set((s) => ({
      rules: { ...s.rules, houseAllowlist: s.rules.houseAllowlist.filter((x) => x !== host) },
    }));
    schedulePersist(get);
  },

  blockSiteForPerson: (owner, host) => {
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!h) return;
    set((s) => {
      const cur = s.rules.personBlocks[owner] ?? [];
      return {
        rules: {
          ...s.rules,
          personBlocks: {
            ...s.rules.personBlocks,
            [owner]: cur.includes(h) ? cur : [...cur, h],
          },
        },
      };
    });
    schedulePersist(get);
  },

  unblockSiteForPerson: (owner, host) => {
    set((s) => ({
      rules: {
        ...s.rules,
        personBlocks: {
          ...s.rules.personBlocks,
          [owner]: (s.rules.personBlocks[owner] ?? []).filter((x) => x !== host),
        },
      },
    }));
    schedulePersist(get);
  },

  ingestLog: (text) => {
    const s = get();
    const lines = text.split(/\r?\n/);
    let count = 0;
    for (const line of lines) {
      const parsed = parseLogLine(line);
      if (!parsed) continue;
      let devices = get().devices;
      if (!devices.some((d) => d.ip === parsed.sourceIp)) {
        const unknown: Device = {
          id: `dev-unknown-${parsed.sourceIp.replace(/\./g, "-")}`,
          name: `Unknown · ${parsed.sourceIp}`,
          owner: "Unknown",
          role: "shared",
          ip: parsed.sourceIp,
          mac: "—",
          kind: "iot",
          blocked: false,
          lastSeen: parsed.ts ?? Date.now(),
        };
        devices = [...devices, unknown];
        set({ devices });
      }
      const event = eventFromLog({
        host: parsed.host,
        sourceIp: parsed.sourceIp,
        ts: parsed.ts ?? Date.now(),
        devices,
        rules: s.rules,
      });
      ingestEvent(set, get, event, { silent: true });
      count += 1;
    }
    set({
      ingestNote: count ? `Ingested ${count} line${count === 1 ? "" : "s"} from your log.` : "No parseable lines.",
      houseSource: count ? "house" : get().houseSource,
    });
    schedulePersist(get);
    return count;
  },

  fireDemoAlert: () => {
    const s = get();
    const sample = adultSample(s.devices, s.rules, Date.now());
    if (sample) ingestEvent(set, get, sample);
    schedulePersist(get);
  },

  flushArchive: () => {
    const s = get();
    const arc = buildArchive(s.events, s.devices, Date.now());
    if (!arc) return;
    sinceArchive = 0;
    set({ archives: [arc, ...s.archives].slice(0, MAX_ARCHIVES) });
    schedulePersist(get);
  },

  probeLan: async () => {
    const lan = await probeLanNet();
    set({ lanProbe: lan });
    return lan;
  },

  setCollectorUrl: (collectorUrl) => {
    set({ collectorUrl });
    schedulePersist(get);
  },

  connectCollector: async (url) => {
    const target = normalizeCollectorUrlExport(url ?? get().collectorUrl);
    set({ collectorUrl: target });
    const status = await fetchCollectorStatus(target);
    const lan = get().lanProbe;
    const gateway = status.gateway || lan?.likelyGateway || "";
    const prefix = gateway ? gateway.split(".").slice(0, 3).join(".") : "";
    set({
      collectorStatus: status,
      lanProbe: gateway
        ? { ips: lan?.ips ?? [], likelyGateway: gateway, subnet: `${prefix}.0/24` }
        : lan,
    });
    if (!status.ok) {
      schedulePersist(get);
      return status;
    }
    // Chris Decker: drop the demo family so Live is this week's real house traffic.
    if (get().houseSource !== "house") {
      set({ events: [], alerts: [], archives: [], houseSource: "house" });
    }
    collectorSince = Date.now() - WEEK_MS;
    if (collectorTick) clearInterval(collectorTick);
    const pull = async () => {
      try {
        const rows = await pullCollectorEvents(target, collectorSince);
        if (rows.length) {
          for (const row of rows) {
            if (row.ts > collectorSince) collectorSince = row.ts;
          }
          const text = rows
            .map((row) => `${new Date(row.ts).toISOString()},${row.sourceIp},${row.host}`)
            .join("\n");
          get().ingestLog(text);
          const t = Date.now();
          recentTimes.push(t);
          while (recentTimes[0] && recentTimes[0] < t - 60_000) recentTimes.shift();
          set({ eventsPerMin: recentTimes.length, now: t });
        }
        const next = await fetchCollectorStatus(target);
        set({ collectorStatus: next, houseSource: "house" });
      } catch (err) {
        set({
          collectorStatus: {
            ok: false,
            error: err instanceof Error ? err.message : "Collector pull failed",
          },
        });
      }
    };
    await pull();
    collectorTick = setInterval(() => void pull(), 2500);
    set({ houseSource: "house", ingestNote: `Connected to collector ${target}` });
    toast.success("House collector connected", { description: status.router?.label ?? status.gateway ?? target });
    schedulePersist(get);
    return status;
  },

  disconnectCollector: () => {
    if (collectorTick) clearInterval(collectorTick);
    collectorTick = null;
    set({ collectorStatus: null });
    schedulePersist(get);
  },

  useDemoHouse: () => {
    if (collectorTick) clearInterval(collectorTick);
    collectorTick = null;
    const s = get();
    const now = Date.now();
    if (s.events.length < 40) {
      const seeded = seedDemo(s.devices, s.rules, now);
      set({
        houseSource: "demo",
        collectorStatus: null,
        events: seeded.events,
        alerts: seeded.alerts,
        archives: seeded.archives,
        now,
      });
    } else {
      set({ houseSource: "demo", collectorStatus: null });
    }
    schedulePersist(get);
  },

  autoJoinHouse: async () => {
    if (get().discovering) return;
    set({ discovering: true });
    try {
      const lan = await probeLanNet();
      const saved = get().collectorUrl;
      const suggestions = collectorUrlSuggestions(lan, saved);
      const filled = saved || suggestions[0] || "";
      set({
        lanProbe: lan,
        suggestedUrls: suggestions.slice(0, 20),
        collectorUrl: filled,
      });
      const found = await discoverCollector(lan, saved);
      if (found) {
        set({
          suggestedUrls: [found.url, ...suggestions.filter((u) => u !== found.url)].slice(0, 20),
          collectorUrl: found.url,
        });
        await get().connectCollector(found.url);
      }
    } finally {
      set({ discovering: false });
    }
  },
}));
