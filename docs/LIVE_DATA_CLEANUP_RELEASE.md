# LineWatch 0.1.1 live-data cleanup

Mission: ensure a live household never displays bundled example people and make the installed desk easy to reopen.

Acceptance evidence:

- Demo mode may use sample people, but connecting to a collector starts with an empty household.
- A saved live browser session filters only the exact bundled demo device IDs.
- The collector removes only policies composed entirely of bundled demo MAC addresses and owners.
- Real or mixed household policies are preserved.
- The desktop launcher opens the persistent LAN desk at `127.0.0.1:8080`.

Verification: policy unit tests, TypeScript typecheck, production build, live collector status/policy, local desk HTTP response, and repository diff check.

Standby upgrades: authenticated collector API, explicit demo/live banner on every route, real router DNS-use confirmation, and signed desktop packaging.
