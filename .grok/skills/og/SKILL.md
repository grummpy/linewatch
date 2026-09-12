# Open Graph asset pass

## Brand-asset pass:

Generate the Open Graph and social preview assets for the app. Use the marker
`/workspace/.grok/og-pending` while work is in progress; it expires after 10 minutes.
Run `node scripts/brand-check.mjs --placeholder-ok` before reporting completion.
The pass must never wait_tasks or get_task_output for brand work; it reports its own
filesystem result and lets the parent verify it.
