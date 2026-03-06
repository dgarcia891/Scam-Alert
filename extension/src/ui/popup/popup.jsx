import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, ShieldAlert, Settings, ExternalLink, Activity, Info, AlertTriangle, ChevronRight, ArrowRight, Bug, Copy, Check, ChevronDown, RefreshCw, Trash2, Terminal, Globe, Mail, Lock, Unlock, Clock, Zap, Database, Key, Cpu, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MessageTypes } from '../../lib/messaging';
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

const getStatusConfig = (status) => {
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
            title: "High Risk", subtitle: "Go back \u2014 don't enter information here.",
            cardBg: "bg-slate-900/40", cardBorder: "border-rose-900/20",
            titleColor: "text-rose-50", subColor: "text-rose-200/70",
            accent: "bg-rose-500", icon: ShieldAlert
        }
    };
    return configs[status] || configs.secure;
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
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border inline-block", map[severity] || map.SAFE)}>
            {severity || 'SAFE'}
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

const StageHeader = ({ icon: Icon, title, status, timing, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    const statusColor = {
        pass: "text-emerald-400", flag: "text-rose-400", skip: "text-slate-500",
        error: "text-orange-400", clean: "text-emerald-400"
    };
    return (
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-800/50 transition-colors">
                <ChevronDown size={10} className={cn("text-slate-500 transition-transform shrink-0", !open && "-rotate-90")} />
                {Icon && <Icon size={12} className="text-slate-500 shrink-0" />}
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex-1 text-left">{title}</span>
                {status && <span className={cn("text-[9px] font-bold uppercase", statusColor[status] || "text-slate-500")}>{status}</span>}
                {timing != null && <span className="text-[9px] text-slate-600 font-mono">{timing}ms</span>}
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

const DevPanel = ({ scanResults, currentUrl, settings, onForceRescan, onClearCache, isRescanning }) => {
    const version = (() => { try { return chrome.runtime.getManifest().version; } catch { return '?.?.?'; } })();
    const meta = scanResults?.meta || {};
    const timing = meta.timing || {};
    const checks = scanResults?.checks || {};
    const signals = scanResults?.signals || { hard: [], soft: [] };
    const sources = meta.sources || [];
    const aiVerification = scanResults?.aiVerification || checks?.aiVerification || null;

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
    const pageContext = hasEmailChecks ? (isGmail ? 'EMAIL (Gmail)' : isOutlook ? 'EMAIL (Outlook)' : 'EMAIL') : 'WEB';

    // Source lookup helper
    const getSource = (id) => sources.find(s => s.id === id) || null;

    // Check entries sorted: flagged first
    const checkEntries = Object.entries(checks).filter(([k]) => k !== 'aiVerification');
    const flaggedChecks = checkEntries.filter(([, v]) => v.flagged);
    const passedChecks = checkEntries.filter(([, v]) => !v.flagged && v.isProFeature !== true);
    const skippedChecks = checkEntries.filter(([, v]) => !v.flagged && v.isProFeature === true);

    // Pipeline summary counts
    const totalChecks = checkEntries.length + (aiVerification ? 1 : 0);
    const totalFlagged = flaggedChecks.length + (aiVerification?.flagged ? 1 : 0);
    const totalPassed = passedChecks.length + (aiVerification && !aiVerification.flagged ? 1 : 0);
    const totalSkipped = skippedChecks.length;
    const stageCount = 5; // Blocklist, Patterns, PhishTank, GSB, AI
    const activeStages = sources.filter(s => s.status === 'success').length + 1; // +1 for blocklist always

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
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                    <Activity size={10} className="text-violet-400 shrink-0" />
                    <span className="text-[9px] font-bold text-violet-300 uppercase tracking-wider">Pipeline Overview</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-slate-300">
                        <span className="font-bold text-white">{totalChecks}</span> checks run
                    </span>
                    {totalFlagged > 0 && (
                        <span className="text-[10px] text-rose-400">
                            <span className="font-bold">{totalFlagged}</span> flagged
                        </span>
                    )}
                    <span className="text-[10px] text-emerald-400/70">
                        <span className="font-bold">{totalPassed}</span> passed
                    </span>
                    {totalSkipped > 0 && (
                        <span className="text-[10px] text-slate-500">
                            <span className="font-bold">{totalSkipped}</span> skipped
                        </span>
                    )}
                    <span className="text-slate-700">|</span>
                    <span className="text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">{activeStages}</span>/{stageCount} stages active
                    </span>
                </div>
            </div>

            {/* ── B. URL & CONTEXT ──────────────────────────────────────────── */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg px-2.5 py-2 space-y-1">
                <div className="flex items-center gap-1.5">
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
            >
                <div className="space-y-0.5">
                    {/* Flagged checks first */}
                    {flaggedChecks.map(([key, val]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="flag" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-rose-300 font-mono font-semibold">{key}</span>
                                    {val.severity && val.severity !== 'NONE' && <SeverityPill severity={val.severity} />}
                                </div>
                                {(val.details || val.message || val.description) && (
                                    <div className="text-[9px] text-slate-500 truncate">{val.details || val.message || val.description}</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {/* Passed checks */}
                    {passedChecks.map(([key, val]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="pass" />
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-emerald-400/60 font-mono">{key}</span>
                                {val.details && <span className="text-[9px] text-slate-600 ml-1.5">{typeof val.details === 'string' ? val.details : ''}</span>}
                            </div>
                        </div>
                    ))}
                    {/* Skipped (PRO) checks */}
                    {skippedChecks.map(([key]) => (
                        <div key={key} className="flex items-start gap-1.5 py-0.5">
                            <StatusIcon status="skip" />
                            <span className="text-[10px] text-slate-600 font-mono">{key}</span>
                            <span className="text-[8px] text-violet-500 font-bold">PRO</span>
                        </div>
                    ))}
                    {checkEntries.length === 0 && <div className="text-[10px] text-slate-600 italic">No check data available</div>}
                </div>
            </StageHeader>

            {/* Stage 3: PhishTank */}
            {(() => {
                const pt = getSource('phishtank');
                const ptCheck = checks.phishTank;
                const ptStatus = !pt ? 'skip' : pt.status === 'success' ? (ptCheck?.flagged ? 'flag' : 'pass') : pt.status === 'failed' ? 'error' : 'skip';
                return (
                    <StageHeader icon={Database} title="3. PhishTank" status={ptStatus} timing={timing.phishtank} defaultOpen={pt?.status === 'success' || ptCheck?.flagged}>
                        {!pt ? (
                            <div className="text-[10px] text-slate-600 italic">Not in scan data</div>
                        ) : pt.status === 'skipped' ? (
                            <div className="text-[10px] text-slate-500">Skipped — {pt.reason || 'disabled'}</div>
                        ) : pt.status === 'failed' ? (
                            <div className="text-[10px] text-orange-400">Error — {pt.reason || 'unknown'}</div>
                        ) : ptCheck?.flagged ? (
                            <div className="text-[10px] text-rose-400 font-semibold">MATCH — {ptCheck.details || 'Listed in PhishTank'}</div>
                        ) : (
                            <div className="text-[10px] text-emerald-400/70">Clean — not in PhishTank database</div>
                        )}
                    </StageHeader>
                );
            })()}

            {/* Stage 4: Google Safe Browsing */}
            {(() => {
                const gsb = getSource('gsb');
                const gsbCheck = checks.googleSafeBrowsing;
                const gsbStatus = !gsb ? 'skip' : gsb.status === 'success' ? (gsbCheck?.flagged ? 'flag' : 'pass') : gsb.status === 'failed' ? 'error' : 'skip';
                return (
                    <StageHeader icon={Globe} title="4. Google Safe Browsing" status={gsbStatus} timing={timing.gsb} defaultOpen={gsb?.status === 'success' || gsbCheck?.flagged}>
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
                const aiStatus = hasAI ? (aiVerification.verdict === 'ESCALATED' ? 'flag' : aiVerification.verdict === 'DOWNGRADED' ? 'pass' : 'pass') : 'skip';
                return (
                    <StageHeader icon={Cpu} title="5. AI Second Opinion" status={aiStatus} timing={timing.ai} defaultOpen={hasAI}>
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
                                    {aiVerification.details && (
                                        <>
                                            <span className="text-slate-500">Reason</span>
                                            <span className="text-slate-400 text-[9px]">{aiVerification.details}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </StageHeader>
                );
            })()}

            {/* ── D. SEVERITY TRACE ──────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-1 pt-1">
                <Zap size={10} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Analysis</span>
                <div className="flex-1 h-px bg-slate-800" />
            </div>
            <StageHeader icon={Zap} title="Severity Trace" defaultOpen={signals.hard?.length > 0 || signals.soft?.length > 0}>
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
                        { label: 'PhishTank', ok: !!settings?.phishTankApiKey, detail: settings?.phishTankApiKey ? `Key: ...${settings.phishTankApiKey.slice(-4)}` : 'No API key (rate-limited mode)' },
                        { label: 'AI Second Opinion', ok: settings?.aiEnabled && !!settings?.aiApiKey, detail: settings?.aiEnabled ? (settings?.aiApiKey ? `Enabled (key: ...${settings.aiApiKey.slice(-4)})` : 'Enabled but no key') : 'Disabled' },
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

// ═══════════════════════════════════════════════════════════════
// MAIN POPUP COMPONENT
// ═══════════════════════════════════════════════════════════════

const Popup = () => {
    const [status, setStatus] = useState('secure');
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
                    if (data?.results) {
                        const res = data.results;
                        setScanResults(res);
                        if (res.whitelisted) { setIsWhitelisted(true); setStatus('secure'); }
                        else if (['CRITICAL', 'HIGH'].includes(res.overallSeverity)) setStatus('danger');
                        else if (['MEDIUM'].includes(res.overallSeverity)) setStatus('caution');
                        else setStatus('secure');
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
                if (res.whitelisted) { setIsWhitelisted(true); setStatus('secure'); }
                else if (['CRITICAL', 'HIGH'].includes(res.overallSeverity)) setStatus('danger');
                else if (['MEDIUM'].includes(res.overallSeverity)) setStatus('caution');
                else setStatus('secure');
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
            chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_REPORT_MODAL' }, () => {
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
            // Wait a moment for the scan to complete, then re-fetch results
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: MessageTypes.GET_SCAN_RESULTS, data: { tabId: currentTabId } }, (response) => {
                    const data = response?.data;
                    if (data?.results) {
                        const res = data.results;
                        setScanResults(res);
                        if (res.whitelisted) { setIsWhitelisted(true); setStatus('secure'); }
                        else if (['CRITICAL', 'HIGH'].includes(res.overallSeverity)) setStatus('danger');
                        else if (['MEDIUM'].includes(res.overallSeverity)) setStatus('caution');
                        else setStatus('secure');
                    }
                    setIsRescanning(false);
                });
            }, 3000);
        });
    }, [currentTabId]);

    const handleClearCache = useCallback(() => {
        if (!currentUrl) return;
        chrome.runtime.sendMessage({ type: MessageTypes.CLEAR_URL_CACHE, data: { url: currentUrl } }, () => {
            // Visual feedback
            alert('Cache cleared for this URL. Click Force Rescan to get fresh results.');
        });
    }, [currentUrl]);

    const config = getStatusConfig(status);

    return (
        <div className={cn(
            "w-[360px] h-fit bg-slate-900 text-white font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col p-4 pb-5",
            devMode && "w-[420px]"
        )}>

            {/* ── HEADER ────────────────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Security Check</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleDevMode}
                        className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border",
                            devMode
                                ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                                : "bg-slate-800/60 text-slate-600 border-slate-700/50 hover:text-slate-400"
                        )}
                        title="Toggle Developer Mode"
                    >
                        <Bug size={10} />
                        DEV
                    </button>
                    {isPro && (
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-700">PRO</span>
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

            {/* ── MAIN STATUS CARD ─────────────────────────────────────────────────────────────── */}
            <div className={cn(
                "relative rounded-2xl border p-5 overflow-hidden transition-all duration-300",
                config.cardBg, config.cardBorder
            )}>
                <div className={cn("absolute left-0 top-0 h-full w-1.5", config.accent)} />
                <div className="flex flex-col gap-1">
                    <h1 className={cn("text-xl font-bold tracking-tight", config.titleColor)}>
                        {config.title}
                    </h1>
                    <p className={cn("text-sm leading-snug font-medium", config.subColor)}>
                        {config.subtitle}
                    </p>
                    {!devMode && status === 'secure' && currentUrl && (
                        <div className="flex items-center gap-1 mt-0.5">
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
                <DevPanel
                    scanResults={scanResults}
                    currentUrl={currentUrl}
                    settings={settings}
                    onForceRescan={handleForceRescan}
                    onClearCache={handleClearCache}
                    isRescanning={isRescanning}
                />
            )}

            {/* ═══ NORMAL MODE: Standard UI ═══ */}
            {!devMode && (
                <>
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
                                    {(status !== 'secure' || isWhitelisted || isAlreadyReported) && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <button onClick={isWhitelisted ? null : handleWhitelist} disabled={isWhitelisted} className={cn(
                                                "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                isWhitelisted ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                            )}>
                                                {isWhitelisted ? 'Trusted' : 'Trust Site'}
                                            </button>
                                            <button onClick={isAlreadyReported ? null : handleReportScam} disabled={isAlreadyReported} className={cn(
                                                "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                isAlreadyReported ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                            )}>
                                                {isAlreadyReported ? 'Reported' : 'Report Scam'}
                                            </button>
                                        </div>
                                    )}
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
