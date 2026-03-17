# Architectural Decision Records (ADRs)
Format: ### ADR-XXX: [Title] | Date | Status | Context | Decision | Consequences

### ADR-003: Centralized Email Client Detection Configuration | 2026-03-17 | Accepted
**Context:** Email client detection was scattered across 8 call sites in 6 files, each using hardcoded `url.includes(...)` strings. Adding support for a new client (like Roundcube) required modifying all locations, which was error-prone.
**Decision:** Create a single configuration registry (`extension/src/config/email-clients.js`) defining URL patterns, DOM selectors, and extraction strategies for all supported email clients. All detection logic imports from this registry.
**Consequences:** Adding future email clients (e.g., Fastmail, Thunderbird webmail) requires only updating the registry file. The `context-detector.js` PROVIDERS object is now auto-built from the same config.
