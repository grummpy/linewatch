/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
export type Category =
  | "adult"
  | "social"
  | "gaming"
  | "streaming"
  | "search"
  | "shopping"
  | "education"
  | "news"
  | "messaging"
  | "ads"
  | "cloud"
  | "system"
  | "unknown";

export type DeviceKind = "phone" | "tablet" | "laptop" | "console" | "tv" | "iot";
export type DeviceRole = "parent" | "child" | "shared" | "iot";
export type Protocol = "https" | "http" | "quic" | "dns";
export type Risk = "ok" | "watch" | "alert";
export type PathKind = "wan" | "sidewalk" | "amazon";
export type FirewallMode = "monitor" | "blacklist" | "whitelist";
export type FeedFilter = "all" | "adult" | "kids" | "blocked" | "sidewalk" | "wan" | "location";

export type Destination = {
  host: string;
  category: Category;
  label: string;
  path?: PathKind;
  locationHint?: string | null;
};

export type Device = {
  id: string;
  name: string;
  owner: string;
  role: DeviceRole;
  ip: string;
  mac: string;
  kind: DeviceKind;
  blocked: boolean;
  lastSeen: number;
};

export type TrafficEvent = {
  id: string;
  ts: number;
  deviceId: string;
  owner: string;
  sourceIp: string;
  destIp: string;
  destHost: string;
  destLabel: string;
  destPort: number;
  destRegion: string;
  protocol: Protocol;
  category: Category;
  path: PathKind;
  locationHint: string | null;
  bytes: number;
  risk: Risk;
  blocked: boolean;
};

export type Alert = {
  id: string;
  eventId: string;
  ts: number;
  deviceId: string;
  category: Category;
  host: string;
  destIp: string;
  sourceIp: string;
  label: string;
  acknowledged: boolean;
  severity: "high" | "medium";
};

export type Archive = {
  id: string;
  createdAt: number;
  from: number;
  to: number;
  eventCount: number;
  adultCount: number;
  sidewalkCount: number;
  locationCount: number;
  people: string[];
  rows: ArchiveRow[];
};

export type ArchiveRow = {
  ts: number;
  owner: string;
  device: string;
  sourceIp: string;
  destHost: string;
  destIp: string;
  destRegion: string;
  genre: string;
  path: PathKind;
  locationHint: string | null;
  bytes: number;
  blocked: boolean;
};

export type Rules = {
  alertAdult: boolean;
  alertAfterHoursSocial: boolean;
  quietStartHour: number;
  quietEndHour: number;
  sound: boolean;
  browserNotify: boolean;
  blocklist: string[];
  firewallMode: FirewallMode;
  houseAllowlist: string[];
  keepSystemUpdates: boolean;
  personBlocks: Record<string, string[]>;
};

export const DEFAULT_RULES: Rules = {
  alertAdult: true,
  alertAfterHoursSocial: true,
  quietStartHour: 21,
  quietEndHour: 7,
  sound: true,
  browserNotify: false,
  blocklist: [],
  firewallMode: "monitor",
  houseAllowlist: ["apple.com", "icloud.com", "google.com", "windowsupdate.com", "cloudflare.com"],
  keepSystemUpdates: true,
  personBlocks: {},
};

export const CATEGORY_LABEL: Record<Category, string> = {
  adult: "Adult",
  social: "Social",
  gaming: "Gaming",
  streaming: "Streaming",
  search: "Search",
  shopping: "Shopping",
  education: "Education",
  news: "News",
  messaging: "Messaging",
  ads: "Ads",
  cloud: "Cloud",
  system: "System",
  unknown: "Unknown",
};

export const PATH_LABEL: Record<PathKind, string> = {
  wan: "WAN data",
  sidewalk: "Sidewalk",
  amazon: "Amazon net",
};

export const SYSTEM_HOSTS = [
  "apple.com",
  "icloud.com",
  "icloud-content.com",
  "mzstatic.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "windowsupdate.com",
  "microsoft.com",
  "live.com",
  "cloudflare.com",
];
