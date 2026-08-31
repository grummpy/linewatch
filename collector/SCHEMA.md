# Linewatch data schema — Chris Decker

Domain-level only. Files live in `data/` on the always-on computer.
Logs older than 7 days are overwritten.

## `logs.jsonl` (one JSON object per line)

| field | meaning |
|---|---|
| `ts` | Unix ms |
| `deviceMac` | device MAC when known |
| `sourceIp` | who asked |
| `requestedDomain` | the name |
| `category` | adult / gaming / social / vpn / … |
| `action` | `allowed` / `blocked` / `rewritten` |
| `reason` | `global-adult`, `profile-blocklist`, `vpn-doh`, `dga-entropy`, `bedtime`, `homework`, `quarantine`, `safe-search`, … |
| `owner` | person profile |
| `entropy` | Shannon score of the label (DGA) |

## `policy.json`

- `blocklistGlobal` — house denylist (adult seeds included)
- `allowlist` — always leave (updates)
- `profiles.<name>.blocks` — person denylist
- `profiles.<name>.autoQuarantine` — default on for children, off per profile if you choose
- `blockAdult` / `blockGaming` / `blockSocial`
- `bedtimeOn` + hours, `homeworkOn` + hours
- `safeSearch`
- `quarantine` — `{ mac: { since, reason } }`

## `alerts.json` / `insights.json` / `scans.json`

Parent-facing. Insights are a daily roll-up, not a raw dump.
