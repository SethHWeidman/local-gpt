1. `brew install postgresql`
2. `createdb local-gpt` (`psql -d local-gpt` connects)
3. `psql -d local-gpt -U sethweidman -a -f db/db.sql`

Confirm tables were created: 

```sql
SELECT tablename
FROM pg_catalog.pg_tables 
WHERE schemaname = 'public'; 
```