Hydronix backend scripts

1. setup_partitions.py
   - Creates month-based partitions for `sensor_data` and a routing trigger.
   - Usage: `python backend/scripts/setup_partitions.py --months 12 --move-old`.
   - Use `--dry-run` to preview SQL without executing.

2. backup_restore.py
   - Wrapper around `pg_dump` and `pg_restore` using DATABASE_URL in backend/app/config.py.
   - Usage: `python backend/scripts/backup_restore.py backup dumpfile.dump` or `... restore dumpfile.dump`

Notes:
- Run these scripts from the repository root.
- They assume the `backend` package is importable (run from repo root) and that DB is reachable.
- Partitioning uses inheritance+trigger routing for compatibility with existing table; test on staging before running on production.
