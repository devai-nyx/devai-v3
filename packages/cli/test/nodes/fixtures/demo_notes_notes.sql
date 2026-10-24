-- @generated from SPEC-DEMO-001 do not edit
CREATE SCHEMA "demo_notes" AUTHORIZATION demo_owner;
CREATE TABLE "demo_notes"."note" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES "tenancy"."tenants"("id"),
  "title" VARCHAR(80) NOT NULL CHECK (char_length("title") BETWEEN 1 AND 80),
  -- @pii: basis=RN-DEMO-002/demo-consent, retention=RN-DEMO-002/until-workspace-destruction
  "author_alias" VARCHAR(40) NOT NULL CHECK (char_length("author_alias") BETWEEN 1 AND 40),
  PRIMARY KEY ("id")
);
ALTER TABLE "demo_notes"."note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demo_notes"."note" FORCE ROW LEVEL SECURITY;
CREATE POLICY "note_tenant_policy" ON "demo_notes"."note" FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
