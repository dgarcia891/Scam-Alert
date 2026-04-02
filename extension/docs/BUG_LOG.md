# Hydra Guard: Bug Log

## BUG-148: Orphaned Content Script Failure
- **Date**: 2026-04-02
- **Symptoms**: After extension reload, "No content extracted" error. Analyses skip email context.
- **Root Cause**: Content scripts lose `onMessage` listeners when the extension reloads. Background scripts assume persistent connection.
- **Fix**: Implemented on-demand injection fail-safe with 3-attempt polling retry loop in `service-worker.js`.
- **Status**: Fixed in v1.1.18.

## BUG-149: Exponential Heuristic Scoring
- **Date**: 2026-04-02
- **Symptoms**: Safe enterprise emails flagged as CRITICAL due to "Obfuscated Link" stacking.
- **Root Cause**: Heuristic engine applied penalties per-link without deduplication. ESP tracking links (Vialoops, etc.) trip hex-obfuscation thresholds.
- **Fix**: 
    - Deduplicated `externalLinks` source array.
    - Added `linkTriggers` to cap penalties per-email.
    - Whitelisted common ESP hosts (`vialoops.com`, `klaviyo.com`, etc.).
- **Status**: Fixed in v1.1.18.
