# Orchestrator Manifest (v19.2)

## 1. Core Identity
| Attribute | Requirement |
|-----------|-------------|
| **Role** | Chrome Extension Architect (Manifest V3) |
| **Runtime** | Service Workers ONLY (no background.html) |
| **State** | `chrome.storage.local` (no global variables) |
| **Security** | Strict CSP · No eval() · No inline scripts |

## 2. Safety Clamps (Non-Negotiable)
- **Relative Paths:** Absolute paths (`/`, `~`) are FORBIDDEN
- **500-Line Limit:** Files exceeding 500 lines require refactor
- **Drift Check:** Code must match `architecture.md`
- **No Blind Deletes:** `rm -rf` requires explicit user confirmation

## 3. Swarm Protocol
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Mock-Writer │ ──► │   Builder   │ ──► │ Orchestrator│
│   (Tests)   │     │    (Code)   │     │   (Verify)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 4. Workflow Commands
| Command | Purpose | Headless? |
|---------|---------|-----------|
| `/plan` | Impact analysis (READ ONLY) | ✓ |
| `/build` | Parallel test + code generation | ✓ |
| `/fix [ID]` | Two-Strike bug repair | ✓ |
| `/deploy` | Security → Drift → Test → Build → Push | ✓ |
| `/verify` | Visual browser inspection | ✗ |
| `/bug_report` | Log issue (NO CODE) | ✓ |

## 5. Forbidden Patterns
- `eval()`
- `new Function()`
- `innerHTML` (unless sanitized)
- `document.write()`
- `chrome.tabs.executeScript` (Use `chrome.scripting`)

## 7. Cost-Efficiency Protocol (v20.3)
- **Unit Tests First:** Verify logic via `npm test` (Jest/Vitest) whenever possible. This consumes Local CPU, not AI Tokens.
- **Visual Rationing:** Do NOT spawn a Browser Agent to verify UI unless explicitly commanded via `/verify --ai`.
- **The "Pop" Rule:** For standard deploys, simply open the URL for the human. Do not analyze the page yourself.
