# Roadmap: Community Defense & AI Analysis

This document outlines the strategic progression of Scam Alert from a heuristic-based utility to a community-driven semantic protection engine.

## Phase 1: Heuristic MVP (Current)

**Goal**: Zero-cost, privacy-first detection.

- **Engine**: Keyword matching and pattern analysis.
- **Sync**: Static `patterns.json` fetched from GitHub/CDN.
- **Infrastructure**: No backend required.

## Phase 2: Community Defense (Near Future)

**Goal**: Immediate immunization of all users when one user encounters a new threat.

- **Mechanism**: "Report" feature in the extension.
- **Infrastructure**: Migration to **PostgreSQL (Supabase)**.
- **Logic**:
  1. Local extension flags a suspicious site.
  2. Finding is reported to a central `reports` table.
  3. Verified threats are added to a global `blacklisted_urls` table.
  4. Extensions pull updates from this table via API.

## Phase 3: Semantic "Buffoonery" Analysis (Long-term)

**Goal**: Detection based on intent and meaning rather than exact keywords.

- **Mechanism**: AI-driven "Judge" that analyzes site content for social engineering markers.
- **Infrastructure**: **Vector Database** (via `pgvector` in Postgres).
- **Workflow**:
  1. **Local Filter**: Fast keyword/heuristic scan triggers a report.
  2. **AI Judge**: Server-side LLM analyzes page content and generates a **Semantic Vector (Embedding)**.
  3. **Vector Comparison**: Compare the site against known "Scam Blueprints" (e.g., tech support, IRS impersonation) stored in the vector DB.
  4. **Categorization**: Group scams by "Vibe/Narrative" to catch brand-new URLs using old tactics.

## Cost-Control Strategy

To scale without immense overhead:

- **Async Defense**: Don't run AI on every visit. Only analyze sites that pass a specific "Suspicion Threshold" locally.
- **Hybrid Storage**: Use the same Postgres instance for both standard relational data (Phase 2) and Vector data (Phase 3).
