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
  | "vpn"
  | "unknown";

export type DeviceKind = "phone" | "tablet" | "laptop" | "console" | "tv" | "iot";
export type DeviceRole = "parent" | "child" | "shared" | "iot";
export type Protocol = "https" | "http" | "quic" | "dns";
export type Risk = "ok" | "watch" | "alert";
export type PathKind = "wan" | "sidewalk" | "amazon";
export type FirewallMode = "monitor" | "blacklist" | "whitelist";
export type FeedFilter = "all" | "adult" | "kids" | "blocked" | "sidewalk" | "wan" | "location" | "vpn";
export type DnsAction = "allowed" | "blocked" | "rewritten";

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
  quarantined?: boolean;
  quarantineReason?: string;
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
  action?: DnsAction;
  reason?: string;
  entropy?: number;
  mac?: string;
};

export type AlertKind =
  | "adult"
  | "vpn"
  | "dga"
  | "repeat"
  | "bedtime"
  | "homework"
  | "quarantine"
  | "scan"
  | "watch";

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
  kind?: AlertKind;
  sentence?: string;
  count?: number;
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
  safeSearch: boolean;
  bedtimeOn: boolean;
  homeworkOn: boolean;
  homeworkStartHour: number;
  homeworkEndHour: number;
  blockAdult: boolean;
  blockGaming: boolean;
  blockSocial: boolean;
  autoQuarantine: boolean;
  profileQuarantine: Record<string, boolean>;
};

export const DEFAULT_RULES: Rules = {
  alertAdult: true,
  alertAfterHoursSocial: true,
  quietStartHour: 21,
  quietEndHour: 7,
  sound: true,
  browserNotify: false,
  blocklist: [],
  firewallMode: "blacklist",
  houseAllowlist: ["apple.com", "icloud.com", "google.com", "windowsupdate.com", "cloudflare.com", "microsoft.com"],
  keepSystemUpdates: true,
  personBlocks: {},
  safeSearch: true,
  bedtimeOn: true,
  homeworkOn: false,
  homeworkStartHour: 16,
  homeworkEndHour: 18,
  blockAdult: true,
  blockGaming: false,
  blockSocial: false,
  autoQuarantine: true,
  profileQuarantine: {},
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
  vpn: "VPN / DNS",
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

export type ScanFinding = {
  ip: string;
  name: string;
  mac: string;
  port: number;
  label: string;
  severity: "high" | "medium";
  sentence: string;
};

export type ScanReport = {
  at: number;
  targets: number;
  findings: ScanFinding[];
  running?: boolean;
};

export type InsightReport = {
  date: string;
  queries: number;
  blocked: number;
  adultAttempts: number;
  vpnAttempts: number;
  dgaFlags: number;
  bedtimeHits: number;
  homeworkHits: number;
  topBlocked: { host: string; count: number; people: string[] }[];
  repeatOffenders: { owner: string; host: string; count: number; sentence: string }[];
  sentences: string[];
};
