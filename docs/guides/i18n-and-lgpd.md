---
title: i18n and LGPD
sidebar_position: 10
description: How locales and personal-data declarations are opted in at bootstrap, declared in the spec, generated and checked.
---

# i18n and LGPD

Two standards are opted in when the project is created: extra locales and LGPD personal-data
declarations ([D-014](../../decisions.md)). Both are declared in `devai.json`, written into the
spec, emitted by the generator and checked by nodes.

## Opting in at bootstrap

```sh
devai init --product demo --locales en-US,pt-BR --lgpd
```

`--locales` defaults to `en-US` and must start with `en-US`; `--lgpd` defaults to off
([08 A.1](../framework/08-cli-and-nodes.md)). They become `locales` and `lgpd` in `devai.json`
([02 §6](../framework/02-architecture.md)). The schema refuses a list whose first entry is not
`en-US`, or that repeats a locale ([08 A.8](../framework/08-cli-and-nodes.md)).

## i18n: every message in every configured locale

i18n is mandatory; the default language is en-US, and pt-BR is opted in at bootstrap
([S-16](../framework/03-standards.md)).

**In the spec.** The machine block's `i18n` map holds every message key with a value for every
configured locale, `en-US` included; the spec cannot opt a locale out
([06 §2](../framework/06-spec-format.md)). Every `errorContract[].messageKey` must be a key of
that map. `spec-lint` rule SL12 fails a missing locale or an unresolved error message
([06 §4](../framework/06-spec-format.md)). From the fixture:

```yaml
i18n:
  demo.notes.missing: {en-US: Note not found., pt-BR: Nota não encontrada.}
```

The shipped fixture carries en-US and pt-BR for all five keys, so it passes SL12 in both an
en-US-only workspace and an en-US + pt-BR workspace ([09 §1](../framework/09-rail.md),
[D-059](../../decisions.md)).

**In the module.** The generator writes one catalog per configured locale,
`api/src/<slug>.i18n.<locale>.ts` with the locale tag lowercased (`notes.i18n.en-us.ts`,
`notes.i18n.pt-br.ts`), as a `@generated` TypeScript `as const` object with sorted keys. It is
TypeScript rather than JSON because a generated file needs a header comment
([09 §2](../framework/09-rail.md), [D-060](../../decisions.md)). Do not edit a catalog by hand:
change the spec (through a successor) and regenerate.

**The `i18n` node** ([08 B.13](../framework/08-cli-and-nodes.md)) fails when:

- a key in the `en-US` catalog is missing from an opted-in locale;
- a spec `i18n` key is absent from the `en-US` catalog;
- an Angular template carries text not marked for i18n (`@angular-eslint/template/i18n`).

A finding reads, for example,
`<catalog pt-BR>:1 missing key demo.notes.missing [S-16] add the pt-BR text`. The node is `SKIPPED`
only when there is no opted-in locale beyond en-US and no Angular app
([05 §3](../framework/05-task-packet.md)). It compares catalogs; it does not extract strings
([08 Part D](../framework/08-cli-and-nodes.md)).

## LGPD: every personal-data column declares basis and retention

With `lgpd: true`, every column holding personal data declares its legal basis and retention policy
([S-15](../framework/03-standards.md)).

**In the spec.** A `pii` object on the column positively classifies it
([06 §2](../framework/06-spec-format.md)). From the fixture:

```yaml
        - name: author_alias
          type: varchar
          limits: {minLength: 1, maxLength: 40}
          nullable: false
          pii:
            basis: RN-DEMO-002/demo-consent
            retention: RN-DEMO-002/until-workspace-destruction
```

When `lgpd: true`, both declarations must be meaningful; SL05 fails incomplete declared PII
([06 §2, §4](../framework/06-spec-format.md)). Here basis and retention identify the exact
RN-DEMO-002 sentence; the fixture makes no legal claim ([06 §7](../framework/06-spec-format.md)).

**In the module SQL.** Under `lgpd`, the generator writes
`-- @pii: basis=…, retention=…` on the line directly above the column in the module's
`db/*.sql` ([09 §2](../framework/09-rail.md)):

```sql
-- @pii: basis=RN-DEMO-002/demo-consent, retention=RN-DEMO-002/until-workspace-destruction
```

**The check.** `sql-lint` rule LINT012 requires that annotation on every PII column when
`lgpd: true` ([02 §2](../framework/02-architecture.md), [D-043](../../decisions.md)). Removing the
annotation from an applied file fails twice: LINT012 for the missing annotation and LINT013 for
changing a base-present file ([09 §4](../framework/09-rail.md), cell N5).

**What no check can prove.** The checks verify the declarations that exist; they cannot show that
a column holding personal data was *left undeclared*. That is semantic review: the independent
reviewer's job, and yours when you approve the spec ([06 §2](../framework/06-spec-format.md)).

**At runtime.** The template logs with pino with redaction ([S-71](../framework/03-standards.md)).
The fixture's Contract notes ask that logs redact `author_alias` and `Authorization`, and that
errors expose no note contents ([06 §7](../framework/06-spec-format.md)).

## Who does what

| | You (pilot) | The agent |
|---|---|---|
| Locales, `lgpd` | Choose at `devai init` | Reads them from `devai.json` |
| `i18n` values | Approve them with the spec | Writes every key in every configured locale in the draft spec |
| `pii` declarations | Approve basis and retention with the spec | Writes them in the draft spec, citing the rules |

`devai.json` is in the `standards` protected class ([02 §5](../framework/02-architecture.md)); a
change to it belongs to a `standards` packet ([05 §3](../framework/05-task-packet.md)).

Source: [02 §2, §5, §6](../framework/02-architecture.md), [03 S-15, S-16, S-71](../framework/03-standards.md),
[05 §3](../framework/05-task-packet.md), [06 §2, §4, §7](../framework/06-spec-format.md),
[08 A.1, A.8, B.13](../framework/08-cli-and-nodes.md), [09 §1, §2, §4](../framework/09-rail.md),
[D-014, D-043, D-059, D-060](../../decisions.md).
