# Linewatch Upgrade Action Plan

## Mission

Make Linewatch the most trustworthy, understandable household network-protection tool for a parent who does not want to become a network administrator. It should keep the house collector reliable, block known dangerous or unwanted categories, identify bypass attempts and unusual domains, and explain device activity without claiming to see page content, messages, or encrypted details it cannot observe.

Linewatch remains independent. It does not exchange data with Decker Family HUD, share its database, or require another application to protect the network.

## Current baseline observed

- Browser parent desk with device, people, house, logs, alerts, analytics, settings, scan, and collector-connection views.
- Node, Python, and Java collector paths; local JSON retention; DNS policy decisions; safe-search rewrites; category and profile rules; DGA/VPN indicators; repeated-block alerts; optional quarantine; and on-demand LAN scan.
- The product documents important limits: DNS/domain visibility is not page inspection, quarantine is a DNS sinkhole rather than a VLAN, and the scan is not a full network scanner.
- The main gaps are installer/setup reliability, router verification, operational hardening, evidence quality, false-positive recovery, privacy controls, and a visual workflow designed for non-technical parents.

## Product upgrades

### A. Parent-first protection workflow

1. Make the first screen a protection status: **Protected**, **Needs attention**, **Not connected**, or **Demo only**.
2. Add a guided setup wizard for collector installation, service start, router DNS, test device, profile assignment, and starter policy.
3. Detect and explain common failures: collector stopped, router still using old DNS, device using private DNS/VPN, phone off Wi-Fi, clock drift, or stale event feed.
4. Use safe starter policies with preview, per-person overrides, temporary exceptions, and one-step rollback.
5. Add a parent emergency control with confirmation, scope, reason, and automatic review date.

### B. Evidence and family visibility

1. Present activity as device, profile, domain, category, time, action, reason, and confidence.
2. Add “what we know / what we do not know” beside every activity summary.
3. Group repeated events into understandable episodes while retaining drill-down evidence.
4. Add daily and weekly patterns by device and category, with minimum-volume thresholds to avoid overinterpreting sparse data.
5. Add family-facing transparency text and configurable retention; default to the shortest useful retention.
6. Support shared-device and unknown-device states instead of forcing a person assignment.
7. Keep exact-content inspection, message interception, TLS decryption, hidden monitoring, and sensitive behavioral profiling out of scope.

### C. Detection and policy engineering (Jarvis)

1. Separate policy decision, enforcement result, alert, and quarantine state in the event model.
2. Add signed/versioned policy snapshots and a dry-run simulator before applying rule changes.
3. Add a conformance suite across Node, Python, and Java collectors so the same input produces the same decision.
4. Add DNS protocol robustness: malformed packets, IPv6, retries, timeouts, cache poisoning defenses, and upstream failure behavior.
5. Add authenticated, scoped local APIs with replay protection, rate limits, request logging, and safe CORS/origin rules.
6. Harden the service: least privilege, explicit bind addresses, secure file permissions, safe update/rollback, watchdog, and health heartbeat.
7. Make quarantine safe and reversible: clear reason, affected device, expiry/review state, connectivity warning, and release test.
8. Treat LAN scanning as an explicit user action with scope, rate limits, evidence, and a clear statement of coverage.
9. Add adversarial tests for bypass: DoH/DoT, VPN endpoints, alternate DNS, IPv6 DNS, randomized labels, spoofed device identity, and clock changes.

### D. Modeling, LLM, and predictive analytics (Decker)

1. Use deterministic rules for category, profile, quiet hours, repeated blocks, quarantine, and known bypass indicators.
2. Add trend models for baseline traffic volume, category shifts, repeated policy conflicts, unusual device behavior, and collector health.
3. Use anomaly detection only to create a review item, never as automatic proof of wrongdoing.
4. Use an LLM only to summarize already-classified events into plain-language parent explanations, suggest a policy review, and answer “what happened?” from stored evidence.
5. Require each generated explanation to cite event IDs, time ranges, categories, and policy reasons; do not let the LLM invent domains or intent.
6. Add feedback: parent confirms useful, false positive, unknown device, or policy change. Track model and rule versions.
7. Evaluate forecasts against later observed events and show confidence, sample size, and limitations.

### E. Visual and UI system (Leonardo)

1. Establish a calm safety-oriented visual system: neutral background, one trust/status color, reserved danger color, and consistent severity language.
2. Put setup and protection status above charts; a non-technical parent should know what to do within five seconds.
3. Use a clear event grammar: device icon, person/profile, domain, category, action, reason, timestamp, and confidence.
4. Replace dense tables with episode cards, expandable evidence, and guided next actions.
5. Use accessible status shapes and labels in addition to color; support keyboard, screen reader, reduced motion, and mobile touch targets.
6. Design empty, stale, disconnected, demo, blocked, quarantined, and recovery states as first-class screens.
7. Create a small icon set and reusable visual tokens for protected, watch, blocked, bypass, unknown, and service health.

## Iteration plan

### Iteration 1 — Operational truth (2 weeks)

- Define event, policy, enforcement, alert, quarantine, device, and health schemas.
- Add collector heartbeat, router-DNS verification, stale-state handling, and service watchdog.
- Add conformance tests across collector implementations.

**Gate:** the UI cannot report “protected” unless the collector and router path are verified.

### Iteration 2 — Setup and recovery (3 weeks)

- Build the guided installer/setup wizard.
- Add test-device flow, profile assignment, starter policy preview, exception, rollback, and recovery instructions.

**Gate:** a non-technical parent completes setup and restores service after a simulated failure without developer assistance.

### Iteration 3 — Explainable protection (3 weeks)

- Redesign home, alerts, logs, and event detail around episode cards and evidence.
- Add “know / do not know” explanations, policy reason, confidence, and parent action.

**Gate:** pilot users correctly explain why a sample event was allowed, blocked, watched, or quarantined.

### Iteration 4 — Privacy and policy assurance (3–4 weeks)

- Add retention controls, export/delete tools, audit history, scoped APIs, permissions, and threat-model findings.
- Add bypass and malformed-input tests.

**Gate:** privacy review and adversarial test suite pass with no untracked sensitive retention.

### Iteration 5 — Trends and bounded intelligence (4–6 weeks)

- Add trend baselines, anomaly review, parent feedback, source-linked summaries, and forecast evaluation.

**Gate:** every intelligent insight is evidence-linked, confidence-labeled, reversible, and measured for false positives.

### Iteration 6 — Release hardening (3 weeks)

- Test upgrades, rollback, power loss, full disk, time changes, network outage, IPv6, multi-device load, and collector replacement.
- Publish platform-specific support and recovery guides.

**Gate:** release candidate meets reliability, security, usability, privacy, and support checklists.

## Measures

- Setup completion time and help requests
- Percentage of protection sessions with verified router DNS
- Collector uptime, stale-feed duration, and recovery time
- Block precision, false-positive rate, and exception reversal rate
- Bypass detection coverage in the conformance suite
- Parent comprehension and “know what to do next” score
- Retention-policy compliance and audit completeness
- Forecast precision, recall, and calibration for anomaly review

## Top risks and controls

- **False sense of protection:** verify the actual DNS path and show degraded status.
- **Overclaiming visibility:** state DNS/domain limits beside every insight.
- **False positives:** preview, scope, release, reason, expiry, and audit every exception.
- **Collector compromise:** least privilege, signed updates, authenticated APIs, secure storage, and rollback.
- **Covert-surveillance concern:** transparent family policy, configurable retention, and no content interception.
- **Automation overreach:** anomaly results require parent review; quarantine is reversible and reasoned.

## First build sequence

Start with router-DNS verification, collector health, setup/recovery, policy simulation, and event explanations. Add visual polish next, then trend and LLM summaries only after enforcement truth and evidence quality are reliable.

