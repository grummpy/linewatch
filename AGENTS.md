# Workspace execution

6. **Brand-asset pass:** Run the brand check when the asset work is complete. The
brand pass must never wait_tasks or get_task_output for its own work; it reports
its filesystem result and the parent verifies it.
7. Continue the normal verification and release checks.

The marker is `/workspace/.grok/og-pending` and expires after 10 minutes.
