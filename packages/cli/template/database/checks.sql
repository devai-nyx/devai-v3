-- 90 assertions
DO $$
DECLARE r record;
BEGIN
  -- Every non-system table enables and forces row-level security (S-17).
  FOR r IN SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%'
            ORDER BY 1, 2 LOOP
    IF NOT r.relrowsecurity THEN RAISE EXCEPTION '%.%: missing ENABLE ROW LEVEL SECURITY', r.nspname, r.relname; END IF;
    IF NOT r.relforcerowsecurity THEN RAISE EXCEPTION '%.%: missing FORCE ROW LEVEL SECURITY', r.nspname, r.relname; END IF;
  END LOOP;
  -- The application and reader roles never bypass row-level security (S-18).
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('__PRODUCT___app', '__PRODUCT___reader') AND rolbypassrls LOOP
    RAISE EXCEPTION '%: has BYPASSRLS', r.rolname;
  END LOOP;
  -- Policy predicates read only app.* settings (S-17).
  FOR r IN SELECT p.schemaname, p.tablename, p.policyname, m[1] AS setting
             FROM pg_policies p,
                  LATERAL regexp_matches(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''), 'current_setting\(''([^'']*)''', 'g') AS m
            WHERE m[1] NOT LIKE 'app.%' LOOP
    RAISE EXCEPTION '%.% policy %: reads %, not an app.* setting', r.schemaname, r.tablename, r.policyname, r.setting;
  END LOOP;
END $$;
