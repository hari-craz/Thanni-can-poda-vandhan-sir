"""
Partition helper for Hydronix sensor_data table (PostgreSQL).

Usage (run from repo root):
  python backend/scripts/setup_partitions.py --months 12 --move-old --dry-run

What it does:
- Creates child tables named sensor_data_YYYY_MM that inherit from sensor_data.
- Adds CHECK constraints to child tables to restrict timestamp range.
- Creates/updates a trigger function sensor_data_insert_trigger() that routes new inserts into the correct child table.
- Optionally moves existing rows into partition tables (move-old flag).

Notes:
- Requires psycopg2 and correct DATABASE_URL in backend/app/config.py (settings.database_url).
- Designed to be safe: when dry-run is provided, shows SQL to be executed without running it.
"""
import argparse
from datetime import datetime, timedelta
import logging
from urllib.parse import urlparse

import psycopg2
from psycopg2 import sql

# Load settings from backend app
import sys
sys.path.insert(0, 'backend')
from app.config import settings

logger = logging.getLogger('partition_setup')
logging.basicConfig(level=logging.INFO)


def get_conn():
    return psycopg2.connect(settings.database_url)


def month_ranges(start_month: datetime, months: int):
    ranges = []
    for i in range(months):
        y = (start_month.year + (start_month.month - 1 + i) // 12)
        m = ((start_month.month - 1 + i) % 12) + 1
        start = datetime(y, m, 1)
        if m == 12:
            end = datetime(y + 1, 1, 1)
        else:
            end = datetime(y, m + 1, 1)
        ranges.append((start, end))
    return ranges


def create_partition(cur, table, start, end, dry_run=False):
    name = f"{table}_{start.year}_{str(start.month).zfill(2)}"
    create_tbl = sql.SQL(
        "CREATE TABLE IF NOT EXISTS {child} (LIKE {parent} INCLUDING ALL) INHERITS ({parent});"
    ).format(child=sql.Identifier(name), parent=sql.Identifier(table))

    add_check = sql.SQL(
        "ALTER TABLE {child} ADD CONSTRAINT {chk} CHECK (timestamp >= %s AND timestamp < %s)"
    ).format(child=sql.Identifier(name), chk=sql.Identifier(f"{name}_ts_check"))

    if dry_run:
        logger.info("DRY RUN: Would create partition %s", name)
        return name

    cur.execute(create_tbl)
    # Add check constraint if not exists (safe approach: try/except)
    try:
        cur.execute(add_check, (start, end))
    except Exception:
        # constraint may already exist
        pass
    logger.info("Created/ensured partition %s", name)
    return name


def create_insert_trigger(cur, parent_table, dry_run=False):
    # Trigger function using PL/pgSQL to route based on month partitions
    fn = f"""
    CREATE OR REPLACE FUNCTION sensor_data_insert_trigger()
    RETURNS TRIGGER AS $$
    DECLARE
        target_table TEXT := NULL;
    BEGIN
        -- Compute partition name based on new.timestamp
        target_table := format('%s_%s_%s', TG_TABLE_NAME, to_char(NEW.timestamp, 'YYYY'), to_char(NEW.timestamp, 'MM'));
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = target_table) THEN
            EXECUTE format('INSERT INTO %I VALUES ($1.*)', target_table) USING NEW;
            RETURN NULL;
        ELSE
            -- Fallback: insert into parent
            RETURN NEW;
        END IF;
    END;
    $$ LANGUAGE plpgsql;
    """

    trig = f"DROP TRIGGER IF EXISTS sensor_data_insert ON {parent_table}; CREATE TRIGGER sensor_data_insert BEFORE INSERT ON {parent_table} FOR EACH ROW EXECUTE FUNCTION sensor_data_insert_trigger();"

    if dry_run:
        logger.info("DRY RUN: Would create trigger function and trigger on %s", parent_table)
        return

    cur.execute(fn)
    cur.execute(trig)
    logger.info("Created insert trigger on %s", parent_table)


def move_existing_data(cur, parent_table, partitions, dry_run=False):
    for name, (start, end) in partitions.items():
        move_sql = sql.SQL("INSERT INTO {child} SELECT * FROM {parent} WHERE timestamp >= %s AND timestamp < %s;")
        del_sql = sql.SQL("DELETE FROM {parent} WHERE timestamp >= %s AND timestamp < %s;")
        if dry_run:
            logger.info("DRY RUN: Would move rows for %s -> %s", parent_table, name)
            continue
        cur.execute(move_sql.format(child=sql.Identifier(name), parent=sql.Identifier(parent_table)), (start, end))
        cur.execute(del_sql.format(child=sql.Identifier(name), parent=sql.Identifier(parent_table)), (start, end))
        logger.info("Moved rows into partition %s", name)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--months', type=int, default=12, help='Number of monthly partitions to create (starting current month)')
    parser.add_argument('--move-old', action='store_true', help='Move existing data into partitions')
    parser.add_argument('--dry-run', action='store_true', help='Print SQL without executing')
    args = parser.parse_args(argv)

    table = 'sensor_data'
    now = datetime.utcnow().replace(day=1)
    months = args.months
    ranges = month_ranges(now, months)

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Create partitions
                partitions = {}
                for start, end in ranges:
                    name = create_partition(cur, table, start, end, dry_run=args.dry_run)
                    partitions[name] = (start, end)

                # Create insert trigger
                create_insert_trigger(cur, table, dry_run=args.dry_run)

                # Optionally move existing data
                if args.move_old and not args.dry_run:
                    move_existing_data(cur, table, partitions, dry_run=args.dry_run)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
