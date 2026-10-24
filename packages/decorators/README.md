# @devai-nyx/decorators

The three route-contract decorators DEVAI v3 requires on every write route (S-25, S-28).
STYNX supplies the other two contract fields (`@Idempotent`/`@NoIdempotent`, `@RequireRoles`).

```ts
import { ErrorContract, Slo, UseCase } from '@devai-nyx/decorators';

@Post('/notes')
@ErrorContract([{ status: 400, code: 'VALIDATION', messageKey: 'demo.notes.invalid' }])
@UseCase('UC-DEMO-001')
@Slo({ metric: 'http.server.duration', percentile: 95, maxMs: 500 })
create(@Body() body: unknown) { … }
```

| Decorator | Declares (06 §2 `routes[]`) |
|---|---|
| `@ErrorContract(entries)` | `errorContract`: `{ status, code, messageKey }` per error the route can return |
| `@UseCase(id)` | `useCase`: the `UC-<PRODUCT>-nnn` id the route serves |
| `@Slo(slo)` | `slo`: `{ metric: 'http.server.duration', percentile, maxMs }` |

Each is a Nest `SetMetadata` and does no validation of its own. `devai check`'s `route-contract`
node reads the arguments statically from the source, so they must be literals, and compares them
with the spec route (08 B.9). The metadata keys are not part of that contract.

The package depends on neither STYNX nor the CLI; `@nestjs/common` `^11.1.19` is a peer.
Consumers compile with `experimentalDecorators` (09 §6).
