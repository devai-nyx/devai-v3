-- 00 core bootstrap: the product roles (S-18); the platform migrations create the rest.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__PRODUCT___owner') THEN
    CREATE ROLE __PRODUCT___owner LOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__PRODUCT___app') THEN
    CREATE ROLE __PRODUCT___app LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__PRODUCT___reader') THEN
    CREATE ROLE __PRODUCT___reader LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
