import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, ShieldAlert, Settings, ExternalLink, Activity, Info, AlertTriangle, ChevronRight, Share2, ArrowRight, Bug, Copy, Check, ChevronDown, RefreshCw, Trash2, Terminal, Globe, Mail, Lock, Unlock, Clock, Zap, Database, Key, Cpu, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MessageTypes } from '../../lib/messaging';
import { isKnownEmailClient, getMatchingClient } from '../../config/email-clients';
import { deriveStatusFromResults } from './status-helper';
import '../index.css';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const scrollbarStyles = `
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
`;

const getStatusConfig = (status, contextType = 'WEB') => {
    const configs = {
        secure: {
            tone: "safe", dot: "bg-emerald-400", ring: "ring-emerald-400/30",
            title: "You're safe", subtitle: "This page looks safe to use.",
            cardBg: "bg-slate-900/40", cardBorder: "border-slate-800",
            titleColor: "text-slate-50", subColor: "text-slate-300",
            accent: "bg-emerald-400", icon: Shield
        },
        caution: {
            tone: "caution", dot: "bg-amber-400", ring: "ring-amber-400/30",
            title: "Take a moment", subtitle: "Something about this site looks unusual. It may be safe, but please be careful.",
            cardBg: "bg-slate-900/40", cardBorder: "border-amber-900/20",
            titleColor: "text-amber-50", subColor: "text-amber-200/70",
            accent: "bg-amber-500", icon: ShieldAlert
        },
        danger: {
            tone: "danger", dot: "bg-rose-500", ring: "ring-rose-500/30",
            title: "High Risk", subtitle: contextType === 'EMAIL' ? "Do not click any links or reply to this email." : "Go back \u2014 don't enter information here.",
            cardBg: "bg-slate-900/40", cardBorder: "border-rose-900/20",
            titleColor: "text-rose-50", subColor: "text-rose-200/70",
            accent: "bg-rose-500", icon: ShieldAlert
        },
        loading: {
            tone: "caution", dot: "bg-violet-400", ring: "ring-violet-400/30",
            title: "Analyzing Safety...", subtitle: "Verifying page security signals.",
            cardBg: "bg-slate-900/40", cardBorder: "border-slate-800",
            titleColor: "text-slate-50", subColor: "text-slate-300",
            accent: "bg-violet-400", icon: Loader2
        },
        empty: {
            tone: "neutral", dot: "bg-slate-500", ring: "ring-slate-500/30",
            title: "No Data Found", subtitle: "Analysis has not run for this page yet.",
            cardBg: "bg-slate-900/40", cardBorder: "border-slate-800",
            titleColor: "text-slate-400", subColor: "text-slate-500",
            accent: "bg-slate-600", icon: Info
        },
        unknown: {
            tone: "caution", dot: "bg-amber-400", ring: "ring-amber-400/30",
            title: "Scanning email...", subtitle: "We couldn't extract the email content yet. Retrying automatically.",
            cardBg: "bg-slate-900/40", cardBorder: "border-amber-900/20",
            titleColor: "text-amber-50", subColor: "text-amber-200/70",
            accent: "bg-amber-500", icon: Loader2
        }
    };
    return configs[status] || configs.loading;
};

// ═══════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════

const SeverityPill = ({ severity }) => {
    const map = {
        CRITICAL: "bg-rose-500/20 text-rose-400 border-rose-500/30",
        HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        LOW: "bg-sky-500/20 text-sky-400 border-sky-500/30",
        SAFE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return (
        <span 
            className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border inline-block cursor-help align-middle", 
                map[severity] || (severity ? map.SAFE : "bg-slate-500/10 text-slate-500 border-slate-700/50")
            )}
            title={severity ? `Current Risk Level: ${severity}` : "Scanning Required: No analysis results were found for this URL. High-risk indicators will appear here after a scan."}
        >
            {severity || 'NO SCAN'}
        </span>
    );
};

const StatusIcon = ({ status }) => {
    if (status === 'pass') return <span className="text-emerald-400 text-[10px] font-bold">✓</span>;
    if (status === 'flag') return <span className="text-rose-400 text-[10px] font-bold">✗</span>;
    if (status === 'skip') return <span className="text-slate-500 text-[10px] font-bold">⊘</span>;
    if (status === 'error') return <span className="text-orange-400 text-[10px] font-bold">⚠</span>;
    return <span className="text-slate-600 text-[10px]">—</span>;
};

const StageHeader = ({ icon: Icon, title, status, timing, children, defaultOpen = false, description = "" }) => {
    const [open, setOpen] = useState(defaultOpen);
    const statusColor = {
        pass: "text-emerald-400", flag: "text-rose-400", skip: "text-slate-500",
        error: "text-orange-400", clean: "text-emerald-400"
    };
    return (
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg overflow-hidden" title={description}>
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-800/50 transition-colors">
                <ChevronDown size={10} className={cn("text-slate-500 transition-transform shrink-0", !open && "-rotate-90")} />
                {Icon && <Icon size={12} className="text-slate-500 shrink-0" />}
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex-1 text-left">{title}</span>
                {status && <span className={cn("text-[9px] font-bold uppercase", statusColor[status] || "text-slate-500")}>{status}</span>}
                {timing != null && <span className="text-[9px] text-slate-600 font-mono" title="Execution time">{timing}ms</span>}
            </button>
            {open && <div className="px-2.5 pb-2.5 space-y-1">{children}</div>}
        </div>
    );
};

const CopyBtn = ({ text, label = "Copy" }) => {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button onClick={handle} className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            {copied ? 'Copied' : label}
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Format cache age
// ═══════════════════════════════════════════════════════════════
function formatAge(ms) {
    if (!ms || ms < 0) return 'just now';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

// Derive the scoring rule path from signals
function deriveSeverityRule(signals) {
    const hard = signals?.hard || [];
    const soft = signals?.soft || [];
    const hasRepHit = hard.some(s => (typeof s === 'string' ? s : s.code) === 'REPUTATION_HIT');
    if (hard.length > 0) {
        if (hasRepHit) return 'HARD + REPUTATION_HIT → CRITICAL';
        return `${hard.length} HARD signal${hard.length > 1 ? 's' : ''} → HIGH`;
    }
    if (soft.length >= 2) return `${soft.length} SOFT signals → MEDIUM`;
    if (soft.length === 1) return '1 SOFT signal → LOW';
    return 'No signals → SAFE';
}

// ═══════════════════════════════════════════════════════════════
// DEV PANEL (the main developer mode view)
// ═══════════════════════════════════════════════════════════════

// Human-readable labels for check keys
const CHECK_LABELS = {
    emailScams: '✉️ Email Scam Patterns',
    urgencySignals: '⏰ Urgency / Pressure Signals',
    typosquatting: '🎭 Typosquatting (Fake Domain)',
    advancedTyposquatting: '🎭 Advanced Typosquatting',
    suspiciousKeywords: '🔍 Suspicious Keywords in URL',
    nonHttps: '🔓 Unencrypted Connection (HTTP)',
    suspiciousTLD: '🌐 Suspicious Domain Extension',
    ipAddress: '📍 IP Address as URL',
    urlObfuscation: '🕵️ URL Obfuscation',
    excessiveSubdomains: '🌿 Excessive Subdomains',
    suspiciousPort: '🔌 Non-standard Port',
    contentAnalysis: '📄 Page Content Analysis',
    googleSafeBrowsing: '🛡️ Google Safe Browsing',
};

const DevPanel = ({ scanResults, currentUrl, settings, onForceRescan, onClearCache, isRescanning, userIsPro }) => {
    const version = (() => { try { return chrome.runtime.getManifest().version; } catch { return '?.?.?'; } })();
    const meta = scanResults?.meta || {};
    const timing = meta.timing || {};
    const checks = scanResults?.checks || {};
    const signals = scanResults?.signals || { hard: [], soft: [] };
    const sources = meta.sources || [];
    const aiVerification = scanResults?.aiVerification || checks?.aiVerification || null;
    const metadata = scanResults?.metadata || {};

    // Parse URL
    let hostname = '', protocol = '', tld = '';
    try {
        const u = new URL(currentUrl);
        hostname = u.hostname;
        protocol = u.protocol.replace(':', '').toUpperCase();
        tld = '.' + hostname.split('.').pop();
    } catch { /* ignore */ }

    // Detect page context from checks (email heuristics present = email view)
    const hasEmailChecks = checks.emailScams !== undefined;
    const isGmail = currentUrl?.includes('mail.google.com');
    const isOutlook = currentUrl?.includes('outlook.live.com') || currentUrl?.includes('outlook.office');
    const matchedClient = getMatchingClient(currentUrl || '');
    const isEmailUrl = !!(isGmail || isOutlook || matchedClient);
    const pageContext = hasEmailChecks ? (matchedClient ? `EMAIL (${matchedClient.label})` : 'EMAIL') : 'WEB';

    // Source lookup helper
    const getSource = (id) => sources.find(s => s.id === id) || null;

    // Check entries sorted: flagged first
    const checkEntries = Object.entries(checks).filter(([k]) => k !== 'aiVerification');
    const flaggedChecks = checkEntries.filter(([, v]) => v.flagged);
    const passedChecks = checkEntries.filter(([, v]) => !v.flagged && (v.isProFeature !== true || userIsPro));
    const skippedChecks = checkEntries.filter(([, v]) => !v.flagged && v.isProFeature === true && !userIsPro);

    // Pipeline summary counts
    const totalChecks = checkEntries.length + (aiVerification ? 1 : 0);
    const totalFlagged = flaggedChecks.length + (aiVerification?.flagged ? 1 : 0);
    const totalPassed = passedChecks.length + (aiVerification && !aiVerification.flagged ? 1 : 0);
    const totalSkipped = skippedChecks.length;
    const stageCount = 4; // Blocklist, Patterns, GSB, AI
    const activeStages = sources.filter(s => s.status === 'success' && s.id !== 'phishtank').length + 1; // +1 for blocklist always

    // Scanned Content: what was fed into the scan
    const scannedSender = metadata.sender || null;
    const scannedSubject = metadata.subject || null;
    const scannedBodySnippet = metadata.bodySnippet || null;
    const scannedLinkCount = metadata.linkCount ?? null;
    const hasContentData = !!(scannedSender || scannedSubject || scannedBodySnippet);

    return (
        <div className="space-y-2 mt-3 custom-scrollbar" style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '2px' }}>
            <style>{scrollbarStyles}</style>

            {/* ── A. STATUS BAR ──────────────────────────────────────────── */}
            <div className="flex items-center flex-wrap gap-1.5 px-1">
                <span className="text-[9px] font-bold text-slate-500 font-mono">v{version}</span>
                <span className="text-slate-700">|</span>
                <SeverityPill severity={scanResults?.overallSeverity} />
                <span className="text-slate-700">|</span>
                {meta.cached ? (
                    <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                        <Clock size={9} /> CACHED {formatAge(meta.cacheAge)}
                    </span>
                ) : (
                    <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <Zap size={9} /> LIVE
                    </span>
                )}
                {timing.total != null && (
                    <>
                        <span className="text-slate-700">|</span>
                        <span className="text-[9px] text-slate-500 font-mono">{timing.total}ms</span>
                    </>
                )}
            </div>

            {/* ── A2. PIPELINE SUMMARY ──────────────────────────────────────────── */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-2.5 py-2 cursor-help" title="High-level overview of the security checks executed on this page.">
                <div className="flex items-center gap-1.5 mb-1.5">
                    <Activity size={10} className="text-violet-400 shrink-0" />
                    <span className="text-[9px] font-bold text-violet-300 uppercase tracking-wider">Pipeline Overview</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-slate-300" title="Total number of individual checks run against this page.">
                        <span className="font-bold text-white">{totalChecks}</span> checks run
                    </span>
                    {totalFlagged > 0 && (
                        <span className="text-[10px] text-rose-400" title="Checks that found malicious or highly suspicious indicators.">
                            <span className="font-bold">{totalFlagged}</span> flagged
                        </span>
                    )}
                    <span className="text-[10px] text-emerald-400/70" title="Checks that reported no issues.">
                        <span className="font-bold">{totalPassed}</span> passed
                    </span>
                    {totalSkipped > 0 && (
                        <span className="text-[10px] text-slate-500" title="Checks skipped (e.g., Pro features unavailable on free tier).">
                            <span className="font-bold">{totalSkipped}</span> skipped
                        </span>
                    )}
                    <span className="text-slate-700">|</span>
                    <span className="text-[10px] text-slate-400" title="Number of underlying analysis engines currently active.">
                        <span className="font-bold text-slate-300">{activeStages}</span>/{stageCount} stages
                    </span>
                </div>
            </div>

            {/* ── A3. SCANNED CONTENT (email URLs only) ──────────────────────────── */}
            {isEmailUrl && (
                <StageHeader
                    icon={Mail}
                    title="📥 Scanned Content"
                    defaultOpen={true}
                    description="The email data that was extracted and fed into the scanner. If Sender/Body are missing, the scan ran without email context and heuristics were skipped."
                >
                    <div className="space-y-1">
                        {[  
                            { label: 'Sender', value: scannedSender, missing: 'Not extracted — scan lacked email context' },
                            { label: 'Subject', value: scannedSubject, missing: 'Not captured' },
                            { label: 'Body', value: scannedBodySnippet ? `"${scannedBodySnippet.substring(0, 100)}${scannedBodySnippet.length > 100 ? '…' : ''}"` : null, missing: 'No body text — email heuristics likely skipped' },
                            { label: 'Links', value: scannedLinkCount != null ? `${scannedLinkCount} found` : null, missing: 'Not checked' },
                        ].map(({ label, value, missing }) => (
                            <div key={label} className="grid grid-cols-[50px_1fr] gap-x-2 text-[10px] py-0.5">
                                <span className="text-slate-500 font-bold">{label}</span>
                                {value
                                    ? <span className="text-slate-300 break-words leading-tight">{value}</span>
                                    : <span className="text-rose-400/80 italic">{missing}</span>
                                }
                            </div>
                        ))}
                        {!hasContentData && (
                            <div className="text-[10px] text-rose-400 font-semibold mt-1 py-1 px-2 bg-rose-900/20 rounded">
                                ⚠️ No content was extracted. The scan only checked the URL (mail.google.com) — email heuristics did not run. Try clicking Force Rescan.
                            </div>
                        )}
                    </div>
                </StageHeader>
            )}

            {/* ── B. URL & CONTEXT ──────────────────────────────────────────── */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg px-2.5 py-2 space-y-1">
                <div className="flex items-center gap-1.5" title="The communication protocol of the current page. HTTPS is secure; HTTP is not.">
                    {protocol === 'HTTPS' ? (
                        <Lock size={10} className="text-emerald-400 shrink-0" />
                    ) : (
                        <Unlock size={10} className="text-rose-400 shrink-0" />
                    )}
                    <span className={cn("text-[9px] font-bold", protocol === 'HTTPS' ? "text-emerald-400" : "text-rose-400")}>{protocol}</span>
                    <span className="text-[10px] text-slate-300 font-mono truncate flex-1">{hostname}</span>
                    <span className="text-[9px] text-slate-600 font-mono">{tld}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {pageContext.startsWith('EMAIL') ? (
                        <Mail size={10} className="text-violet-400 shrink-0" />
                    ) : (
                        <Globe size={10} className="text-slate-500 shrink-0" />
                    )}
                    <span className="text-[9px] font-bold text-slate-400">{pageContext}</span>
                </div>
                <div className="text-[8px] text-slate-600 font-mono truncate" title={currentUrl}>{currentUrl}</div>
            </div>

            {/* ── C. PIPELINE STAGES ──────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-1 pt-1">
                <Cpu size={10} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pipeline Stages</span>
                <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Stage 1: Blocklist */}
            <StageHeader
                icon={Shield}
                title="1. Blocklist"
                status={scanResults?.overallSeverity === 'CRITICAL' && signals.hard?.some(s => (typeof s === 'string' ? s : s.code) === 'USER_BLOCK') ? 'flag' : 'pass'}
                timing={timing.blocklist}
                defaultOpen={timing.blocklist != null}
                description="Checks if this domain has been manually added to your personal blocklist."
            >
                <div className="text-[10px] text-slate-400">
                    {signals.hard?.some(s => (typeof s === 'string' ? s : s.code) === 'USER_BLOCK')
                        ? <span className="text-rose-400 font-semibold">BLOCKED — URL matches personal blocklist</span>
                        : <span className="text-emerald-400/70">Clear — not on blocklist</span>
                    }
                </div>
            </StageHeader>

            {/* Stage 2: Local Patterns */}
            <StageHeader
                icon={Eye}
                title={`2. Local Patterns (${checkEntries.length} checks)`}
                status={flaggedChecks.length > 0 ? 'flag' : 'pass'}
                timing={timing.patterns}
                defaultOpen={checkEntries.length > 0}
                description="Scans the page structure, content, and headers against known scam heuristics."
            >
                <div className="space-y-0.5">
                    {/* Flagged checks first */}
                    {flaggedChecks.map(([key, val]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="flag" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-rose-300 font-semibold">{CHECK_LABELS[key] || key}</span>
                                    {val.severity && val.severity !== 'NONE' && <SeverityPill severity={val.severity} />}
                                </div>
                                {(val.details || val.message || val.description) && (
                                    <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{val.details || val.message || val.description}</div>
                                )}
                                {/* emailScams: show matched signals */}
                                {key === 'emailScams' && val.visualIndicators?.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                        {val.visualIndicators.map((ind, i) => (
                                            <div key={i} className="text-[9px] text-rose-300/70 pl-2 border-l border-rose-500/30">
                                                ↳ {ind.label || ind.phrase} {ind.score ? `(score: ${ind.score})` : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {key === 'emailScams' && val.evidence?.detectedBrands?.length > 0 && (
                                    <div className="text-[9px] text-amber-400/70 mt-0.5">
                                        Impersonated: {val.evidence.detectedBrands.join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {/* Passed checks */}
                    {passedChecks.map(([key, val]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="pass" />
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-emerald-400/60">{CHECK_LABELS[key] || key}</span>
                                {val.details && <span className="text-[9px] text-slate-600 ml-1.5">{typeof val.details === 'string' ? val.details : ''}</span>}
                            </div>
                        </div>
                    ))}
                    {/* Skipped (PRO) checks */}
                    {skippedChecks.map(([key]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="skip" />
                            <span className="text-[10px] text-slate-600">{CHECK_LABELS[key] || key}</span>
                            <span className="text-[8px] text-violet-500 font-bold">PRO</span>
                        </div>
                    ))}
                    {checkEntries.length === 0 && <div className="text-[10px] text-slate-600 italic">No check data available — try Force Rescan</div>}
                </div>
            </StageHeader>

            {/* Stage 3: Google Safe Browsing */}
            {(() => {
                const gsb = getSource('gsb');
                const gsbCheck = checks.googleSafeBrowsing;
                const gsbStatus = !gsb ? 'skip' : gsb.status === 'success' ? (gsbCheck?.flagged ? 'flag' : 'pass') : gsb.status === 'failed' ? 'error' : 'skip';
                return (
                    <StageHeader icon={Globe} title="3. Google Safe Browsing" status={gsbStatus} timing={timing.gsb} defaultOpen={gsb?.status === 'success' || gsbCheck?.flagged} description="Checks the URL against Google's constantly updated list of unsafe web resources.">
                        {!gsb ? (
                            <div className="text-[10px] text-slate-600 italic">Not in scan data</div>
                        ) : gsb.status === 'skipped' ? (
                            <div className="text-[10px] text-slate-500">
                                Skipped — {gsb.reason === 'missing_key' ? 'No API key configured' : gsb.reason || 'disabled'}
                            </div>
                        ) : gsb.status === 'failed' ? (
                            <div className="text-[10px] text-orange-400">Error — {gsb.reason || 'network error'}</div>
                        ) : gsbCheck?.flagged ? (
                            <div className="text-[10px] text-rose-400 font-semibold">FLAGGED — {gsbCheck.details || 'Threat detected'}</div>
                        ) : (
                            <div className="text-[10px] text-emerald-400/70">Clean — safe according to Google</div>
                        )}
                    </StageHeader>
                );
            })()}

            {/* Stage 5: AI Second Opinion */}
            {(() => {
                const hasAI = aiVerification != null;
                const aiSkippedReason = !settings?.aiEnabled ? 'not enabled' : !settings?.aiApiKey ? 'no API key' : 'severity too low';
                const aiStatus = hasAI ? (['ESCALATED', 'CONFIRMED'].includes(aiVerification.verdict) ? 'flag' : aiVerification.verdict === 'DOWNGRADED' ? 'pass' : 'pass') : 'skip';
                return (
                    <StageHeader icon={Cpu} title="5. AI Second Opinion" status={aiStatus} timing={timing.ai} defaultOpen={hasAI} description="Sends the page context to a Large Language Model for deep semantic analysis.">
                        {!hasAI ? (
                            <div className="text-[10px] text-slate-500">Skipped — {aiSkippedReason}</div>
                        ) : (
                            <div className="space-y-1">
                                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
                                    <span className="text-slate-500">Verdict</span>
                                    <span className={cn("font-bold",
                                        aiVerification.verdict === 'ESCALATED' ? "text-rose-400" :
                                            aiVerification.verdict === 'DOWNGRADED' ? "text-emerald-400" : "text-slate-300"
                                    )}>{aiVerification.verdict}</span>
                                    <span className="text-slate-500">Confidence</span>
                                    <span className="text-slate-300">{aiVerification.confidence != null ? `${aiVerification.confidence}%` : 'N/A'}</span>
                                    {aiVerification.reason && (
                                        <>
                                            <span className="text-slate-500">Reason</span>
                                            <span className="text-slate-400 text-[9px]">{aiVerification.reason}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </StageHeader>
                );
            })()}

            {/* ── D. SEVERITY TRACE ──────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-1 pt-1" title="The logical breakdown of how the final severity rating was calculated.">
                <Zap size={10} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Analysis</span>
                <div className="flex-1 h-px bg-slate-800" />
            </div>
            <StageHeader icon={Zap} title="Severity Trace" defaultOpen={signals.hard?.length > 0 || signals.soft?.length > 0} description="Detailed log of the scoring rules evaluated to determine the final UI state.">
                <div className="space-y-1.5 text-[10px]">
                    {/* Signals collected */}
                    <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Signals Collected</div>
                        {signals.hard?.length > 0 && (
                            <div className="space-y-0.5">
                                {signals.hard.map((s, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                                        <span className="text-rose-300 font-mono text-[9px]">HARD: {typeof s === 'string' ? s : s.code || JSON.stringify(s)}</span>
                                        {(typeof s !== 'string' && s.message) && <span className="text-slate-600 text-[8px]">({s.message})</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {signals.soft?.length > 0 && (
                            <div className="space-y-0.5">
                                {signals.soft.map((s, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                        <span className="text-amber-300 font-mono text-[9px]">SOFT: {typeof s === 'string' ? s : s.code || JSON.stringify(s)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {signals.hard?.length === 0 && signals.soft?.length === 0 && (
                            <div className="text-slate-600 italic text-[9px]">None</div>
                        )}
                    </div>
                    {/* Rule applied */}
                    <div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Rule Applied</div>
                        <div className="text-slate-300 font-mono text-[9px] bg-slate-900/50 rounded px-2 py-1">
                            {deriveSeverityRule(signals)}
                        </div>
                    </div>
                    {/* AI modification */}
                    {aiVerification && (
                        <div>
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">After AI</div>
                            <div className="text-slate-300 font-mono text-[9px]">
                                {aiVerification.verdict} (confidence: {aiVerification.confidence}%) → {scanResults?.overallSeverity}
                            </div>
                        </div>
                    )}
                    {/* Final */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
                        <span className="text-[9px] font-bold text-slate-400">Final:</span>
                        <SeverityPill severity={scanResults?.overallSeverity} />
                        <span className="text-[9px] text-slate-500">→</span>
                        <span className="text-[9px] text-slate-300 font-mono">{scanResults?.action || 'ALLOW'}</span>
                    </div>
                </div>
            </StageHeader>

            {/* ── E. ACTION BUTTONS ──────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={onForceRescan}
                    disabled={isRescanning}
                    className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] font-bold transition-colors border",
                        isRescanning
                            ? "bg-slate-800 text-slate-600 border-slate-700 cursor-wait"
                            : "bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30"
                    )}
                >
                    <RefreshCw size={10} className={isRescanning ? "animate-spin" : ""} />
                    {isRescanning ? 'Scanning...' : 'Force Rescan'}
                </button>
                <CopyBtn text={scanResults} label="Copy JSON" />
                <button
                    onClick={onClearCache}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <Trash2 size={10} />
                    Clear Cache
                </button>
                <button
                    onClick={() => console.log('[Hydra Guard DevMode] Full scan result:', scanResults)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <Terminal size={10} />
                    Console
                </button>
            </div>

            {/* ── F. CONFIGURATION STATUS ──────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-1 pt-1">
                <Settings size={10} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System</span>
                <div className="flex-1 h-px bg-slate-800" />
            </div>
            <StageHeader icon={Settings} title="Configuration">
                <div className="space-y-0.5">
                    {[
                        { label: 'Google Safe Browsing', ok: !!settings?.gsbApiKey, detail: settings?.gsbApiKey ? `Key: ...${settings.gsbApiKey.slice(-4)}` : 'No API key' },
                        { label: 'AI Engine', ok: settings?.aiEnabled && !!settings?.aiApiKey, detail: settings?.aiEnabled ? (settings?.aiApiKey ? `Enabled (key: ...${settings.aiApiKey.slice(-4)})` : 'Enabled but no key') : 'Disabled' },
                        { label: 'Email Scanning', ok: settings?.emailScanEnabled !== false, detail: settings?.emailScanEnabled !== false ? 'Enabled' : 'Disabled' },
                        { label: 'Pattern Detection', ok: settings?.usePatternDetection !== false, detail: 'Enabled' },
                        { label: 'Scanning', ok: settings?.scanningEnabled !== false, detail: settings?.scanningEnabled !== false ? 'Active' : 'PAUSED' },
                    ].map((row) => (
                        <div key={row.label} className="flex items-center gap-1.5 py-0.5">
                            <StatusIcon status={row.ok ? 'pass' : 'skip'} />
                            <span className="text-[10px] text-slate-400 flex-1">{row.label}</span>
                            <span className={cn("text-[9px] font-mono", row.ok ? "text-slate-500" : "text-slate-600")}>{row.detail}</span>
                        </div>
                    ))}
                </div>
            </StageHeader>

            {/* ── RAW JSON (collapsed by default) ───────────────────────────────── */}
            <StageHeader title="Raw JSON">
                <pre className="text-[8px] text-slate-600 font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto custom-scrollbar bg-slate-900/50 rounded p-2">
                    {JSON.stringify(scanResults, null, 2)}
                </pre>
            </StageHeader>
        </div>
    );
};

const AskAIButton = ({ settings, currentUrl, currentTabId, aiAsking, setAiAsking, aiResult, setAiResult, scanResults }) => {
    const [debugOpen, setDebugOpen] = useState(false);
    const [showConsent, setShowConsent] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [telemetryChecked, setTelemetryChecked] = useState(settings?.telemetryOptIn ?? true);
    const [submitOpen, setSubmitOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submitOptions, setSubmitOptions] = useState({ sender: true, subject: true, body: true });

    const executeAskAI = useCallback(() => {
        if (!currentUrl || aiAsking) return;
        setAiAsking(true);
        setAiResult(null);
        setDebugOpen(false);
        setShowConsent(false);
        
        chrome.runtime.sendMessage(
            { type: MessageTypes.ASK_AI_OPINION, data: { url: currentUrl, tabId: currentTabId } },
            (response) => {
                const lastError = chrome.runtime.lastError;
                setAiAsking(false);
                if (lastError) {
                    console.warn('[Hydra Guard] AI opinion port error:', lastError.message);
                    setAiResult({ verdict: 'ERROR', reason: 'Could not reach AI background service.' });
                    return;
                }
                if (response?.success) {
                    setAiResult(response);
                } else {
                    setAiResult({ verdict: 'ERROR', reason: response?.error || 'Could not reach AI.' });
                }
            }
        );
    }, [currentUrl, aiAsking, currentTabId]);

    const handleAskAI = useCallback(() => {
        if (settings?.aiConsentGiven) {
            executeAskAI();
        } else {
            setShowConsent(true);
        }
    }, [settings?.aiConsentGiven, executeAskAI]);

    const handleConsentProceed = useCallback(async () => {
        const current = await chrome.storage.local.get('settings');
        const newSettings = { ...(current.settings || {}) };
        
        if (consentChecked) {
            newSettings.aiConsentGiven = true;
        }
        
        // Save the telemetry preference user chose
        newSettings.telemetryOptIn = telemetryChecked;
        
        await chrome.storage.local.set({ settings: newSettings });

        executeAskAI();
    }, [consentChecked, telemetryChecked, executeAskAI]);

    if (!settings?.aiEnabled || !settings?.aiApiKey) return null;

    if (showConsent) {
        return (
            <div className="mt-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-xs font-medium">
                <div className="flex items-center gap-2 mb-2 text-amber-400">
                    <ShieldAlert size={14} />
                    <span className="font-bold">Privacy Notice</span>
                </div>
                <p className="text-[10.5px] text-slate-300 leading-snug mb-3">
                    {isKnownEmailClient(currentUrl) ? (
                        <>
                            Analyzing this email transmits the sender details, subject, and a 500-character body snippet directly to your configured AI provider.
                            <br/><br/>
                            <strong className="text-white">No data is ever saved on Hydra Guard servers.</strong> Please do not use this on highly sensitive emails.
                        </>
                    ) : (
                        <>
                            Analyzing this webpage transmits visible text content and links directly to your configured AI provider.
                            <br/><br/>
                            <strong className="text-white">No data is ever saved on Hydra Guard servers.</strong> Please do not use this on pages with highly sensitive personal information.
                        </>
                    )}
                </p>
                <div className="space-y-3 mb-4 bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={telemetryChecked}
                            onChange={(e) => setTelemetryChecked(e.target.checked)}
                            className="mt-0.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-1 focus:ring-offset-0 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-300 group-hover:text-white transition-colors leading-tight">
                                Help protect the community by anonymously reporting discovered scam indicators (URLs, emails, phrases) to our heuristics database.
                        </span>
                    </label>
                    <div className="h-px bg-slate-800/50 w-full" />
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-900 text-slate-500 focus:ring-1 focus:ring-offset-0 focus:ring-slate-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors">Don't show this privacy notice again</span>
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowConsent(false)}
                        className="flex-1 py-1.5 rounded-lg text-slate-400 border border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConsentProceed}
                        className="flex-[2] py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold cursor-pointer"
                    >
                        Proceed & Analyze
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-3 px-1">
            {!aiResult ? (
                <button
                    onClick={handleAskAI}
                    disabled={aiAsking}
                    title="Sends page content and metadata to your configured AI for an advanced, context-aware security check."
                    className={cn(
                        "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border",
                        aiAsking
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 cursor-wait"
                            : "bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30 cursor-pointer"
                    )}
                >
                    {aiAsking ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Analyzing with AI...
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} />
                            Ask AI for a second opinion
                        </>
                    )}
                </button>
            ) : (
                <div className={cn(
                    "w-full rounded-xl border text-xs font-medium overflow-hidden",
                    aiResult.verdict === 'DOWNGRADED'
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : (aiResult.verdict === 'ESCALATED' || aiResult.verdict === 'CONFIRMED')
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            : aiResult.verdict === 'ERROR'
                                ? "bg-slate-800/50 border-slate-700 text-slate-400"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                )}>
                    {/* Clickable verdict header */}
                    <button
                        onClick={() => setDebugOpen(!debugOpen)}
                        className="w-full p-3 text-left hover:opacity-90 transition-opacity"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={12} />
                            <span className="font-bold flex-1">
                                {aiResult.verdict === 'DOWNGRADED' ? 'AI says: Looks safe'
                                    : (aiResult.verdict === 'ESCALATED' || aiResult.verdict === 'CONFIRMED') ? 'AI says: This looks dangerous'
                                        : aiResult.verdict === 'ERROR' ? 'AI unavailable'
                                            : 'AI says: Something looks off'}
                            </span>
                            <ChevronDown size={12} className={cn("transition-transform shrink-0 opacity-50", !debugOpen && "-rotate-90")} />
                        </div>
                        <p className="text-[10px] opacity-80 leading-snug">{aiResult.reason}</p>
                        {aiResult.confidence != null && aiResult.verdict !== 'ERROR' && (
                            <p className="text-[9px] opacity-50 mt-1">Confidence: {aiResult.confidence}%</p>
                        )}
                    </button>

                    {/* Debug transparency panel */}
                    {debugOpen && aiResult._debug && (
                        <div className="border-t border-current/10 p-3 space-y-2 bg-slate-900/40">
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider opacity-50 mb-1">Prompt Sent to AI</div>
                                <pre className="text-[8px] text-slate-400 font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto custom-scrollbar bg-slate-900/60 rounded p-2 border border-slate-700/30">
                                    {aiResult._debug.promptSent || '(not available)'}
                                </pre>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider opacity-50 mb-1">Raw AI Response</div>
                                <pre className="text-[8px] text-slate-400 font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto custom-scrollbar bg-slate-900/60 rounded p-2 border border-slate-700/30">
                                    {aiResult._debug.rawResponse || '(not available)'}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="px-3 pb-3 flex items-center gap-3">
                        <button
                            onClick={() => { setAiResult(null); setDebugOpen(false); }}
                            className="text-[9px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
                        >
                            Ask again
                        </button>
                        {aiResult._debug && (
                            <button
                                onClick={() => setDebugOpen(!debugOpen)}
                                className="text-[9px] font-bold uppercase tracking-wider opacity-40 hover:opacity-80 transition-opacity"
                            >
                                {debugOpen ? 'Hide details' : 'Show details'}
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSubmitOpen(!submitOpen);
                                setDebugOpen(false);
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all",
                                submitOpen 
                                    ? "bg-indigo-500 text-white" 
                                    : "text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10"
                            )}
                        >
                            {isSubmitted ? (
                                <><Check size={10} /> Submitted</>
                            ) : (
                                <><Share2 size={10} /> Submit to Hydra Guard</>
                            )}
                        </button>
                    </div>

                    {/* Submit Data Panel */}
                    {submitOpen && !isSubmitted && (
                        <div className="mx-3 mb-3 p-3 bg-slate-900/60 rounded-xl border border-indigo-500/20 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Help the community</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-3 leading-snug">Choose what information to share with Hydra Guard to help us identify similar scams.</p>
                            
                            <div className="space-y-2 mb-3">
                                {[
                                    { id: 'sender', label: 'Sender Info', checked: submitOptions.sender },
                                    { id: 'subject', label: 'Email Subject', checked: submitOptions.subject },
                                    { id: 'body', label: 'Body Snippet', checked: submitOptions.body },
                                ].map(opt => (
                                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={opt.checked}
                                            onChange={(e) => setSubmitOptions({...submitOptions, [opt.id]: e.target.checked})}
                                            className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-300 group-hover:text-white transition-colors">{opt.label}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    const metadata = {};
                                    if (submitOptions.sender) {
                                        metadata.sender = scanResults?.metadata?.sender;
                                        metadata.senderEmail = scanResults?.metadata?.senderEmail;
                                    }
                                    if (submitOptions.subject) metadata.subject = scanResults?.metadata?.subject;
                                    if (submitOptions.body) metadata.bodyText = scanResults?.metadata?.bodySnippet || scanResults?.metadata?.body_text;
                                    
                                    chrome.runtime.sendMessage({
                                        type: MessageTypes.REPORT_SCAM,
                                        data: {
                                            url: currentUrl,
                                            type: 'community_contribution',
                                            description: 'Manual Popup Contribution',
                                            metadata: {
                                                ...metadata,
                                                aiVerdict: aiResult.verdict,
                                                aiConfidence: aiResult.confidence,
                                                isManualContribution: true
                                            }
                                        }
                                    }, (res) => {
                                        setIsSubmitting(false);
                                        if (res?.success) {
                                            setIsSubmitted(true);
                                            setSubmitOpen(false);
                                        } else {
                                            alert('Submission failed: ' + (res?.error || 'Unknown error'));
                                        }
                                    });
                                }}
                                disabled={isSubmitting || (!submitOptions.sender && !submitOptions.subject && !submitOptions.body)}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN POPUP COMPONENT
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
const Popup = () => {
    const [status, setStatus] = useState('loading');
    const [stats, setStats] = useState({ totalScans: 0, threatsBlocked: 0 });
    const [scanResults, setScanResults] = useState(null);
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [isAlreadyReported, setIsAlreadyReported] = useState(false);
    const [isPro, setIsPro] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [devMode, setDevMode] = useState(false);
    const [settings, setSettings] = useState({});
    const [isRescanning, setIsRescanning] = useState(false);
    const [currentTabId, setCurrentTabId] = useState(null);
    const [aiAsking, setAiAsking] = useState(false);
    const [aiResult, setAiResult] = useState(null);

    // Persist AI Second Opinion across popup remounts
    useEffect(() => {
        if (scanResults?.aiVerification && !aiResult) {
            setAiResult(scanResults.aiVerification);
        }
    }, [scanResults]);

    // FEAT-119: Sync localized AI verdict instantly back to main UI state so dynamic overrides apply
    useEffect(() => {
        if (aiResult) {
            const currentAiVerdict = scanResults?.aiVerification?.verdict;
            if (currentAiVerdict !== aiResult.verdict) {
                const updatedResults = scanResults ? { ...scanResults, aiVerification: aiResult } : { aiVerification: aiResult };
                setScanResults(updatedResults);
                setStatus(deriveStatusFromResults(updatedResults, false));
            }
        }
    }, [aiResult, scanResults]);

    // Load dev mode + settings on mount
    useEffect(() => {
        chrome.storage.local.get(['hydraGuardDevMode', 'settings'], (result) => {
            if (result.hydraGuardDevMode) setDevMode(true);
            if (result.settings) setSettings(result.settings);
        });
    }, []);

    const toggleDevMode = () => {
        const newVal = !devMode;
        setDevMode(newVal);
        chrome.storage.local.set({ hydraGuardDevMode: newVal });
    };

    // Main data load
    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.url) return;
            const url = tab.url;
            setCurrentUrl(url);
            setCurrentTabId(tab.id);

            let domain = '';
            try { domain = new URL(url).hostname; } catch { /* ignore */ }

            chrome.storage.local.get(['statistics', 'settings', 'reportedSites', 'pro_user'], (result) => {
                if (result.statistics) {
                    setStats({ totalScans: result.statistics.totalScans || 0, threatsBlocked: result.statistics.threatsBlocked || 0 });
                }
                if (result.settings) setSettings(result.settings);
                setIsPro(!!result.pro_user || result.settings?.planType === 'pro');

                if (result.reportedSites && (result.reportedSites[url] || (domain && result.reportedSites[domain]))) {
                    setIsAlreadyReported(true);
                }

                chrome.runtime.sendMessage({ type: MessageTypes.GET_SCAN_RESULTS, data: { tabId: tab.id } }, (response) => {
                    const data = response?.data;
                    const res = data?.results;
                    const scanInProgress = data?.scanInProgress;

                    if (res || scanInProgress) {
                        setScanResults(res);
                        const newStatus = deriveStatusFromResults(res, scanInProgress, currentUrl);
                        setStatus(newStatus);
                        if (res?.whitelisted) setIsWhitelisted(true);
                        
                        // BUG-131: Auto-rescan if extraction failed but popup was opened
                        if (newStatus === 'unknown') {
                            setIsRescanning(true);
                            chrome.runtime.sendMessage({ type: MessageTypes.FORCE_RESCAN, data: {} }, () => {
                                setTimeout(() => setIsRescanning(false), 8000);
                            });
                        }
                    } else {
                        // Truly no results and not scanning -> show empty and trigger auto-scan
                        setStatus('empty');
                        setIsRescanning(true);
                        chrome.runtime.sendMessage({ type: MessageTypes.FORCE_RESCAN, data: {} }, () => {
                            setTimeout(() => setIsRescanning(false), 8000);
                        });
                    }
                });
            });
        });
    }, []);

    // Live scan result listener — updates popup when email scan completes
    useEffect(() => {
        const handleScanUpdate = (message) => {
            const type = message.type || message.action;
            if ((type === MessageTypes.SCAN_RESULT || type === MessageTypes.SCAN_RESULT_UPDATED) && message.data?.result) {
                const res = message.data.result;
                setScanResults(res);
                const newStatus = deriveStatusFromResults(res, false, currentUrl);
                setStatus(newStatus);
                if (res.whitelisted) setIsWhitelisted(true);
                setIsRescanning(false); // BUG-129: Clear spinner on live result
            }
        };
        chrome.runtime.onMessage.addListener(handleScanUpdate);
        return () => chrome.runtime.onMessage.removeListener(handleScanUpdate);
    }, []);

    const handleGoBack = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        if (chrome.tabs.goBack) {
            try { await chrome.tabs.goBack(tab.id); window.close(); return; } catch { /* fallback */ }
        }
        chrome.tabs.sendMessage(tab.id, { type: 'HISTORY_BACK' }, () => {
            if (chrome.runtime.lastError) return;
            window.close();
        });
    };

    const handleReportScam = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'open_report_modal' }, () => {
                if (chrome.runtime.lastError) return;
                window.close();
            });
        });
    };

    const handleWhitelist = () => {
        if (!currentUrl) return;
        try {
            const domain = new URL(currentUrl).hostname.replace(/^www\./, '');
            chrome.runtime.sendMessage({ type: MessageTypes.ADD_TO_WHITELIST, data: { domain } }, (response) => {
                if (response?.success) { setIsWhitelisted(true); setStatus('secure'); }
            });
        } catch { /* ignore */ }
    };

    const handleOpenTab = (hash) => {
        const manifest = chrome.runtime.getManifest();
        const optionsPath = manifest.options_page || 'dist/options/index.html';
        chrome.tabs.create({ url: chrome.runtime.getURL(`${optionsPath}#${hash}`) });
    };

    // Dev mode actions
    const handleForceRescan = useCallback(() => {
        setIsRescanning(true);
        chrome.runtime.sendMessage({ type: MessageTypes.FORCE_RESCAN, data: {} }, () => {
            // BUG-129: Results arrive via the SCAN_RESULT_UPDATED listener.
            // The old setTimeout re-fetch was racing with the broadcast and
            // overwriting email-enriched results with stale URL-only data.
            // Safety timeout to clear spinner if broadcast is missed.
            setTimeout(() => setIsRescanning(false), 8000);
        });
    }, [currentTabId]);

    const handleClearCache = useCallback(() => {
        if (!currentUrl) return;
        chrome.runtime.sendMessage({ type: MessageTypes.CLEAR_URL_CACHE, data: { url: currentUrl } }, () => {
            // Visual feedback
            alert('Cache cleared for this URL. Click Force Rescan to get fresh results.');
        });
    }, [currentUrl]);



    const isEmail = isKnownEmailClient(currentUrl);
    const config = getStatusConfig(status, isEmail ? 'EMAIL' : 'WEB');

    return (
        <div className={cn(
            "w-[360px] h-fit bg-slate-900 text-white font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col p-4 pb-5",
            devMode && "w-[420px]"
        )}>

            {/* ── HEADER ────────────────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2" title="Hydra Guard active security scan">
                    <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Security Check</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleDevMode}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border cursor-pointer",
                            devMode
                                ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                                : "bg-slate-800/60 text-slate-600 border-slate-700/50 hover:text-slate-400"
                        )}
                        title="Toggle Developer Mode: View detailed scan logs and raw data"
                    >
                        <Bug size={10} />
                        DEV
                    </button>
                    {isPro && (
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-700 cursor-help" title="Active Pro Subscription">PRO</span>
                    )}
                </div>
            </div>

            {/* ── DEV MODE BANNER ─────────────────────────────────────────────────────────────── */}
            {devMode && (
                <div className="mb-2 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center gap-2">
                    <Bug size={11} className="text-violet-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-violet-300">Developer Mode</span>
                </div>
            )}

            {/* ── EMAIL NOT SCANNED BANNER ─────────────────────────────────────────────────── */}
            {!devMode && isEmail && status === 'empty' && (
                <div className="mb-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                    <Mail size={11} className="text-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-300">
                        Email not yet scanned — open <strong>DEV mode</strong> and click <strong>Force Rescan</strong> to analyze.
                    </span>
                </div>
            )}

            {/* ── MAIN STATUS CARD ─────────────────────────────────────────────────────────────── */}
            <div 
                className={cn(
                    "relative rounded-2xl border p-5 overflow-hidden transition-all duration-300 cursor-default",
                    config.cardBg, config.cardBorder
                )}
                title={`Hydra Guard Conclusion: ${config.title}. ${config.subtitle}`}
            >
                <div className={cn("absolute left-0 top-0 h-full w-1.5", config.accent)} />
                <div className="flex flex-col gap-1">
                    <h1 className={cn("text-xl font-bold tracking-tight", config.titleColor)}>
                        {config.title}
                    </h1>
                    <p className={cn("text-sm leading-snug font-medium", config.subColor)}>
                        {config.subtitle}
                    </p>
                    {!devMode && status === 'secure' && currentUrl && (
                        <div className="flex items-center gap-1 mt-0.5" title="The specific checks that passed to earn this rating.">
                            <span className="text-[10px] font-medium text-slate-400">
                                Checked: URL + connection security
                                {scanResults?.meta?.sources?.some(s => s.id === 'gsb' && s.status === 'success') && ' + reputation'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ DEV MODE: Full Pipeline Panel ═══ */}
            {devMode && (
                <>
                    <DevPanel
                        scanResults={scanResults}
                        currentUrl={currentUrl}
                        settings={settings}
                        onForceRescan={handleForceRescan}
                        onClearCache={handleClearCache}
                        isRescanning={isRescanning}
                        userIsPro={isPro}
                    />
                    <AskAIButton
                        settings={settings}
                        currentUrl={currentUrl}
                        currentTabId={currentTabId}
                        aiAsking={aiAsking}
                        setAiAsking={setAiAsking}
                        aiResult={aiResult}
                        setAiResult={setAiResult}
                        scanResults={scanResults}
                    />
                </>
            )}

            {/* ═══ NORMAL MODE: Standard UI ═══ */}
            {!devMode && (
                <>
                    <AskAIButton
                        settings={settings}
                        currentUrl={currentUrl}
                        currentTabId={currentTabId}
                        aiAsking={aiAsking}
                        setAiAsking={setAiAsking}
                        aiResult={aiResult}
                        setAiResult={setAiResult}
                        scanResults={scanResults}
                    />

                    {/* Action buttons for caution/danger */}
                    {status !== 'secure' && (
                        <div className="mt-4 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                            <button
                                onClick={handleGoBack}
                                className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-lg active:scale-[0.98]"
                            >
                                Go back to safety
                            </button>
                            <button
                                onClick={() => setDetailsOpen(true)}
                                className="w-full mt-2 py-2 text-slate-400 text-xs font-semibold hover:text-white transition-colors"
                            >
                                View details
                            </button>
                        </div>
                    )}

                    {/* Details accordion */}
                    <div className="mt-4">
                        <button
                            onClick={() => setDetailsOpen(!detailsOpen)}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors px-1"
                        >
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                {detailsOpen ? 'Hide Details' : 'Details (why?)'}
                            </span>
                            <ChevronRight size={12} className={cn("transition-transform duration-300", detailsOpen && "rotate-90")} />
                        </button>

                        {detailsOpen && (
                            <div className="mt-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 space-y-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Info size={12} className="text-slate-500" />
                                        {status === 'secure' ? 'Checks performed' : 'Why this page looks unusual'}
                                    </div>
                                    {status === 'secure' ? (
                                        <div className="space-y-1.5">
                                            <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                URL checks (local)
                                            </div>
                                            {(() => {
                                                try {
                                                    const urlObj = new URL(currentUrl);
                                                    if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                                                        return (
                                                            <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                                Connection security ({urlObj.protocol.replace(':', '').toUpperCase()})
                                                            </div>
                                                        );
                                                    }
                                                } catch { return null; }
                                                return null;
                                            })()}
                                            {(scanResults?.checks?.emailScams !== undefined || scanResults?.checks?.urgencySignals !== undefined) && (
                                                <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                    Email content heuristics
                                                </div>
                                            )}
                                            {(() => {
                                                const gsb = scanResults?.meta?.sources?.find(s => s.id === 'gsb');
                                                if (gsb?.status === 'success') {
                                                    return (
                                                        <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                            <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                            Reputation check: Google Safe Browsing
                                                        </div>
                                                    );
                                                } else if (gsb?.status === 'failed') {
                                                    return (
                                                        <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                            <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                                                            Reputation check: unavailable
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="flex gap-2 text-[11px] text-slate-500 leading-relaxed font-medium italic">
                                                        <div className="w-1 h-1 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                                                        Reputation checks: Off
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {scanResults?.reasons?.map((reason, idx) => (
                                                <div key={idx} className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                    <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                                                    {reason.message || reason.details}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <button onClick={() => handleOpenTab('logs')} className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all">
                                        <div className="flex items-center gap-3">
                                            <Activity size={18} className="text-slate-500" />
                                            <span className="text-xs font-semibold text-slate-300">Activity Log & Reports</span>
                                        </div>
                                        <ExternalLink size={14} className="text-slate-600" />
                                    </button>
                                    <button onClick={() => handleOpenTab('settings')} className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all">
                                        <div className="flex items-center gap-3">
                                            <Shield size={18} className="text-slate-500" />
                                            <span className="text-xs font-semibold text-slate-300">Email protection settings</span>
                                        </div>
                                        <ArrowRight size={14} className="text-slate-600" />
                                    </button>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        {(status !== 'secure' || isWhitelisted) && (
                                            <button onClick={isWhitelisted ? null : handleWhitelist} disabled={isWhitelisted} className={cn(
                                                "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                isWhitelisted ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                            )}>
                                                {isWhitelisted ? 'Trusted' : 'Trust Site'}
                                            </button>
                                        )}
                                        <button onClick={isAlreadyReported ? null : handleReportScam} disabled={isAlreadyReported} className={cn(
                                            "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                            isAlreadyReported ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700",
                                            (status === 'secure' && !isWhitelisted) && "col-span-2"
                                        )}>
                                            {isAlreadyReported ? 'Reported' : 'Report Suspicious'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center">
                                        <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Scanned</span>
                                        <span className="text-lg font-bold text-slate-200 leading-none">{stats.totalScans.toLocaleString()}</span>
                                    </div>
                                    <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center">
                                        <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Blocked</span>
                                        <span className={cn("text-lg font-bold leading-none", stats.threatsBlocked > 0 ? "text-rose-500" : "text-slate-500")}>
                                            {stats.threatsBlocked.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!detailsOpen && (
                        <div className="mt-auto pt-6 flex justify-center items-center gap-4">
                            <button onClick={() => handleOpenTab('dashboard')} className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2 flex items-center gap-1.5">
                                <Settings size={12} />
                                Settings
                            </button>
                            <div className="w-px h-3 bg-slate-800" />
                            <button onClick={() => handleOpenTab('logs')} className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2">
                                Activity Log
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── DEV MODE FOOTER ─────────────────────────────────────────────────────────────── */}
            {devMode && (
                <div className="mt-3 flex justify-center items-center gap-4">
                    <button onClick={() => handleOpenTab('dashboard')} className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2 flex items-center gap-1.5">
                        <Settings size={12} />
                        Settings
                    </button>
                    <div className="w-px h-3 bg-slate-800" />
                    <button onClick={() => handleOpenTab('logs')} className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2">
                        Activity Log
                    </button>
                </div>
            )}
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
