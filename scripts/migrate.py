import pathlib
import psycopg2

import dotenv

root_dir = pathlib.Path(__file__).resolve().parent.parent
migrations_dir = root_dir / 'db_migrations'

# Connect using DATABASE_URL from .env
env = dotenv.dotenv_values(root_dir / '.env')
database_url = env.get('DATABASE_URL')
if not database_url:
    raise SystemExit("DATABASE_URL is not set. Add it to .env.")
conn = psycopg2.connect(database_url)
cur = conn.cursor()

# Create migrations tracking table if not exists
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
)
conn.commit()


# Apply migrations in order
migration_files = sorted(migrations_dir.glob('*.sql'))
applied_count = 0
skipped_files = []
for file in migration_files:
    filename = file.name
    cur.execute("SELECT 1 FROM schema_migrations WHERE filename = %s", (filename,))
    already_applied = cur.fetchone() is not None
    if not already_applied:
        with open(file, 'r') as f:
            cur.execute(f.read())
        cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (filename,))
        conn.commit()
        print(f"Applied {filename}")
        applied_count += 1
    else:
        skipped_files.append(filename)

cur.close()
conn.close()
if applied_count == 0:
    print("No pending migrations.")
else:
    if skipped_files:
        print(f"Skipped {len(skipped_files)} already-applied migrations.")
print("Migrations completed.")
