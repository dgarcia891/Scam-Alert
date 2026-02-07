# User-Facing Copy Matrix (Senior-Friendly)

This matrix defines the official language for all Scam Alert UI surfaces. Consistency is key to maintaining trust and reducing cognitive load.

## 1. Extension Popup

| State | Title | Subtitle | Accent Bar |
| :--- | :--- | :--- | :--- |
| **SAFE** | "You're safe" | "This page looks safe to use." | Emerald |
| **CAUTION** | "Take a moment" | "Something about this site looks unusual. It may be safe, but please be careful." | Amber |
| **DANGER** | "High Risk" | "Go back — don't enter information here." | Rose |

## 2. Blocking Overlay (Content Script)

**Headline**: "High Risk Detected"
**Body**: "We recommend leaving this page. Scam Alert blocked it because it matches known scam techniques."
**Primary Button**: "Go back to safety"
**Secondary Link**: "I understand the risks, proceed anyway"

## 3. Form Interception (Future)

**Headline**: "Wait! Are you sure?"
**Body**: "You are sending sensitive info to a site Scam Alert flagged as suspicious."
**Indicators**: "[Indicator Category]: [Specific Reason]"
**Action**: "Stop & Review" | "Send Anyway"

## 4. Shared Reusable Labels

- **Trust Action**: "Trust Site" / "Trusted"
- **Report Action**: "Report Scam" / "Reported"
- **Details Toggle**: "Details (why?)" / "Hide Details"
- **Internal Link**: "[Feature Name] settings →"
