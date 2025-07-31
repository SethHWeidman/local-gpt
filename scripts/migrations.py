import os
import pathlib
import psycopg2

import dotenv

dotenv.load_dotenv()

root_dir = pathlib.Path(__file__).resolve().parent.parent
db_dir = root_dir / 'db'

# Connect using DATABASE_URL (from .env locally or Heroku)
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
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


# Function to check if a migration is applied
def is_applied(filename):
    cur.execute("SELECT 1 FROM schema_migrations WHERE filename = %s", (filename,))
    return cur.fetchone() is not None


# Apply initial schema if not applied (treat as '000_db.sql')
initial_schema = db_dir / 'db.sql'
initial_filename = '000_db.sql'
if not is_applied(initial_filename):
    with open(initial_schema, 'r') as f:
        cur.execute(f.read())
    cur.execute(
        "INSERT INTO schema_migrations (filename) VALUES (%s)", (initial_filename,)
    )
    conn.commit()
    print(f"Applied {initial_filename}")

# Apply numbered migrations in order
migration_dir = db_dir / 'migrations'
migration_files = sorted(migration_dir.glob('*.sql'))
for file in migration_files:
    filename = os.path.basename(file)
    if not is_applied(filename):
        with open(file, 'r') as f:
            cur.execute(f.read())
        cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (filename,))
        conn.commit()
        print(f"Applied {filename}")

cur.close()
conn.close()
print("Migrations completed.")
