# MediCore OpenAPI

Canonical source-first API contract for Release 1.

- `openapi.yaml`: modular source root.
- `modules/*.yaml`: module-owned path fragments.
- `components/*.yaml`: reusable contracts.
- `medicore.openapi.yaml`: generated bundled consumer artifact; do not edit manually.

Commands:

```bash
npm run api:bundle
npm run api:lint
npm run api:check
```

Blocked/later capabilities are intentionally absent: lawful sign/publish/attestation, electronic identity provider, diagnostics, prescription, refund/reversal UI, real payment provider and inpatient.
