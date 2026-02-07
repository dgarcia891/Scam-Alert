# Coding Conventions

This document outlines the standard coding patterns and design rules for the Scam Alert extension.

## UI Design Rules

### Boring SAFE UI Rule

The "SAFE" (Secure) state of the extension is designed to be calm and non-intrusive. To prevent feature creep and maintain a clean user experience for seniors, the following rules apply:

1. **No Mandatory Actions**: The SAFE UI must never require user action (e.g., "Confirm you've seen this").
2. **No Questions**: The SAFE UI must never ask the user questions.
3. **No Advertising**: The SAFE UI must never advertise new features or upsell PRO/Premium services.
4. **Subdued Visuals**: The SAFE UI must remain visually neutral, avoiding vibrant gradients or pulsing animations that draw undue attention.

### Popup State Contract

This contract defines the allowed UI, language, and actions for each security state. Deviations require explicit PRD revision.

| Severity | Headline | Description | Accent | Actions | Interrupts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SAFE** | "You're safe" | "This page looks safe..." | Emerald | None | None |
| **CAUTION** | "Take a moment" | "Something looks unusual..." | Amber | View Details | None |
| **DANGER** | "High Risk" | "Go back — don't enter info..." | Rose | Go Back / Details | Overlay |

## Component Patterns

- Logic should be decoupled from UI components where possible.
- All UI components must use standard Tailwind CSS classes from the design system.
