"""
Simple backup and restore helpers using pg_dump and pg_restore.

Usage:
  python backend/scripts/backup_restore.py backup /path/to/dump.sql
  python backend/scripts/backup_restore.py restore /path/to/dump.sql

Notes:
- Requires pg_dump/pg_restore in PATH and network access to DB defined by settings.database_url
- On Windows the command will invoke pg_dump.exe
"""
import sys
import subprocess
from urllib.parse import urlparse
import shlex

sys.path.insert(0, 'backend')
from app.config import settings


def parse_db_url(url):
    # Handles postgresql://user:pass@host:port/db
    parsed = urlparse(url)
    return {
        'user': parsed.username,
        'password': parsed.password,
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'dbname': parsed.path.lstrip('/')
    }


def backup(path):
    cfg = parse_db_url(settings.database_url)
    cmd = [
        'pg_dump',
        f"-h", cfg['host'],
        f"-p", str(cfg['port']),
        f"-U", cfg['user'],
        '-F', 'c',
        '-b',
        '-f', path,
        cfg['dbname']
    ]
    env = dict(**__import__('os').environ)
    if cfg['password']:
        env['PGPASSWORD'] = cfg['password']
    print('Running:', ' '.join(shlex.quote(c) for c in cmd))
    subprocess.check_call(cmd, env=env)


def restore(path):
    cfg = parse_db_url(settings.database_url)
    cmd = [
        'pg_restore',
        '-h', cfg['host'],
        '-p', str(cfg['port']),
        '-U', cfg['user'],
        '-d', cfg['dbname'],
        '-c',
        path
    ]
    env = dict(**__import__('os').environ)
    if cfg['password']:
        env['PGPASSWORD'] = cfg['password']
    print('Running:', ' '.join(shlex.quote(c) for c in cmd))
    subprocess.check_call(cmd, env=env)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: backup|restore path')
        sys.exit(2)
    op = sys.argv[1]
    path = sys.argv[2]
    if op == 'backup':
        backup(path)
    elif op == 'restore':
        restore(path)
    else:
        print('Unknown op')
        sys.exit(2)
