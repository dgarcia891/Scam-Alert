import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, ShieldAlert, Settings, ExternalLink, Activity, Info, AlertTriangle, ChevronRight, ArrowRight, Bug, Copy, Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MessageTypes } from '../../lib/messaging';
import '../index.css';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Phase 23.16: Support for scrollbar styling
const scrollbarStyles = `
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #475569;
    }
`;

const getStatusConfig = (status) => {
    const configs = {
        secure: {
            tone: "safe",
            dot: "bg-emerald-400",
            ring: "ring-emerald-400/30",
            title: "You're safe",
            subtitle: "This page looks safe to use.",
            cardBg: "bg-slate-900/40",
            cardBorder: "border-slate-800",
            titleColor: "text-slate-50",
            subColor: "text-slate-300",
            accent: "bg-emerald-400",
            icon: Shield
        },
        caution: {
            tone: "caution",
            dot: "bg-amber-400",
            ring: "ring-amber-400/30",
            title: "Take a moment",
            subtitle: "Something about this site looks unusual. It may be safe, but please be careful.",
            cardBg: "bg-slate-900/40",
            cardBorder: "border-amber-900/20",
            titleColor: "text-amber-50",
            subColor: "text-amber-200/70",
            accent: "bg-amber-500",
            icon: ShieldAlert
        },
        danger: {
            tone: "danger",
            dot: "bg-rose-500",
            ring: "ring-rose-500/30",
            title: "High Risk",
            subtitle: "Go back \u2014 don't enter information here.",
            cardBg: "bg-slate-900/40",
            cardBorder: "border-rose-900/20",
            titleColor: "text-rose-50",
            subColor: "text-rose-200/70",
            accent: "bg-rose-500",
            icon: ShieldAlert
        }
    };
    return configs[status] || configs.secure;
};

// ─── Developer Mode Components ──────────────────────────────────────────────

const DevToggle = ({ devMode, onToggle }) => (
    <button
        onClick={onToggle}
        className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border",
            devMode
                ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                : "bg-slate-800/60 text-slate-600 border-slate-700/50 hover:text-slate-400 hover:border-slate-600"
        )}
        title="Toggle Developer Mode"
    >
        <Bug size={10} />
        DEV
    </button>
);

const SeverityBadge = ({ severity }) => {
    const colors = {
        CRITICAL: "bg-rose-500/20 text-rose-400 border-rose-500/30",
        HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        LOW: "bg-sky-500/20 text-sky-400 border-sky-500/30",
        SAFE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return (
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border", colors[severity] || colors.SAFE)}>
            {severity || 'SAFE'}
        </span>
    );
};

const CheckStatusDot = ({ flagged }) => (
    <div className={cn(
        "w-1.5 h-1.5 rounded-full mt-1 shrink-0",
        flagged ? "bg-rose-500" : "bg-emerald-500"
    )} />
);

const CollapsibleSection = ({ title, badge, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <ChevronDown size={10} className={cn("text-slate-500 transition-transform", !open && "-rotate-90")} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
                </div>
                {badge}
            </button>
            {open && (
                <div className="px-2.5 pb-2.5 animate-in fade-in duration-150">
                    {children}
                </div>
            )}
        </div>
    );
};

const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button onClick={handleCopy} className="text-slate-600 hover:text-slate-400 transition-colors p-0.5" title="Copy JSON">
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
        </button>
    );
};

const DevPanel = ({ scanResults, currentUrl }) => {
    if (!scanResults) {
        return (
            <div className="mt-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                <p className="text-[10px] text-slate-500 italic">No scan data available for this page.</p>
            </div>
        );
    }

    const checks = scanResults.checks || {};
    const signals = scanResults.signals || { hard: [], soft: [] };
    const reasons = scanResults.reasons || [];
    const meta = scanResults.meta || {};
    const sources = meta.sources || [];
    const aiVerification = scanResults.aiVerification;

    const checkEntries = Object.entries(checks);
    const flaggedChecks = checkEntries.filter(([, v]) => v.flagged);
    const passedChecks = checkEntries.filter(([, v]) => !v.flagged);

    return (
        <div className="mt-3 space-y-2 custom-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <style>{scrollbarStyles}</style>

            {/* 1. Overall Verdict */}
            <CollapsibleSection
                title="Verdict"
                badge={<SeverityBadge severity={scanResults.overallSeverity} />}
                defaultOpen={true}
            >
                <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-slate-500">Severity</span>
                        <span className="text-slate-300 font-semibold">{scanResults.overallSeverity || 'SAFE'}</span>
                        <span className="text-slate-500">Threat</span>
                        <span className="text-slate-300 font-semibold">{scanResults.overallThreat ? 'YES' : 'NO'}</span>
                        <span className="text-slate-500">Confidence</span>
                        <span className="text-slate-300 font-semibold">{scanResults.confidence || 'N/A'}</span>
                        <span className="text-slate-500">Action</span>
                        <span className="text-slate-300 font-semibold">{scanResults.action || 'ALLOW'}</span>
                        <span className="text-slate-500">Whitelisted</span>
                        <span className="text-slate-300 font-semibold">{scanResults.whitelisted ? 'YES' : 'NO'}</span>
                    </div>
                    {meta.timestamp && (
                        <div className="text-[9px] text-slate-600 pt-1 border-t border-slate-700/30">
                            Scanned: {new Date(meta.timestamp).toLocaleString()}
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            {/* 2. Signal Classification */}
            <CollapsibleSection
                title="Signals"
                badge={
                    <div className="flex gap-1">
                        {signals.hard.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                {signals.hard.length} HARD
                            </span>
                        )}
                        {signals.soft.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {signals.soft.length} SOFT
                            </span>
                        )}
                        {signals.hard.length === 0 && signals.soft.length === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                CLEAN
                            </span>
                        )}
                    </div>
                }
                defaultOpen={signals.hard.length > 0 || signals.soft.length > 0}
            >
                <div className="space-y-1.5">
                    {signals.hard.length > 0 && (
                        <div>
                            <div className="text-[9px] font-bold text-rose-400 mb-1">HARD SIGNALS (trigger HIGH/CRITICAL)</div>
                            {signals.hard.map((sig, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300 font-mono">
                                    <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                    {typeof sig === 'string' ? sig : sig.code || JSON.stringify(sig)}
                                </div>
                            ))}
                        </div>
                    )}
                    {signals.soft.length > 0 && (
                        <div>
                            <div className="text-[9px] font-bold text-amber-400 mb-1">SOFT SIGNALS (capped at MEDIUM)</div>
                            {signals.soft.map((sig, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300 font-mono">
                                    <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    {typeof sig === 'string' ? sig : sig.code || JSON.stringify(sig)}
                                </div>
                            ))}
                        </div>
                    )}
                    {signals.hard.length === 0 && signals.soft.length === 0 && (
                        <p className="text-[10px] text-slate-500 italic">No signals detected.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* 3. All Checks (Pipeline Detail) */}
            <CollapsibleSection
                title="Pipeline Checks"
                badge={
                    <span className="text-[9px] font-bold text-slate-500">
                        {flaggedChecks.length}/{checkEntries.length} flagged
                    </span>
                }
                defaultOpen={flaggedChecks.length > 0}
            >
                <div className="space-y-1">
                    {flaggedChecks.length > 0 && (
                        <div className="space-y-1">
                            {flaggedChecks.map(([key, val]) => (
                                <div key={key} className="flex items-start gap-1.5 text-[10px]">
                                    <CheckStatusDot flagged={true} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-rose-300 font-semibold font-mono">{key}</span>
                                        {val.severity && <span className="text-rose-400/70 text-[9px] ml-1">({val.severity})</span>}
                                        {val.isProFeature && <span className="text-violet-400 text-[8px] ml-1 font-bold">PRO</span>}
                                        {val.message && <div className="text-slate-500 text-[9px] truncate">{val.message}</div>}
                                        {val.details && <div className="text-slate-500 text-[9px] truncate">{typeof val.details === 'string' ? val.details : JSON.stringify(val.details)}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {passedChecks.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-700/30">
                            {passedChecks.map(([key, val]) => (
                                <div key={key} className="flex items-start gap-1.5 text-[10px]">
                                    <CheckStatusDot flagged={false} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-emerald-300/70 font-mono">{key}</span>
                                        {val.isProFeature && <span className="text-violet-400 text-[8px] ml-1 font-bold">PRO</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {checkEntries.length === 0 && (
                        <p className="text-[10px] text-slate-500 italic">No checks data available.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* 4. External API Results */}
            <CollapsibleSection
                title="External APIs"
                badge={
                    <span className="text-[9px] font-bold text-slate-500">
                        {sources.length} source{sources.length !== 1 ? 's' : ''}
                    </span>
                }
            >
                <div className="space-y-1.5">
                    {sources.length > 0 ? sources.map((src, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 font-mono">{src.id || src.name || 'unknown'}</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                                src.status === 'success'
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : src.status === 'failed'
                                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                    : src.status === 'skipped'
                                    ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                                    : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                            )}>
                                {src.status || 'unknown'}
                            </span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-500 italic">No external API sources recorded.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* 5. AI Verification */}
            {aiVerification && (
                <CollapsibleSection
                    title="AI Second Opinion"
                    badge={
                        <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                            aiVerification.verdict === 'DOWNGRADED' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : aiVerification.verdict === 'ESCALATED' ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                        )}>
                            {aiVerification.verdict}
                        </span>
                    }
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-slate-500">Verdict</span>
                        <span className="text-slate-300 font-semibold">{aiVerification.verdict}</span>
                        <span className="text-slate-500">Confidence</span>
                        <span className="text-slate-300 font-semibold">{aiVerification.confidence != null ? `${aiVerification.confidence}%` : 'N/A'}</span>
                        {aiVerification.reason && (
                            <>
                                <span className="text-slate-500">Reason</span>
                                <span className="text-slate-300 text-[9px]">{aiVerification.reason}</span>
                            </>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* 6. Reasons */}
            {reasons.length > 0 && (
                <CollapsibleSection
                    title="Reasons"
                    badge={
                        <span className="text-[9px] font-bold text-slate-500">{reasons.length}</span>
                    }
                >
                    <div className="space-y-1">
                        {reasons.map((r, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px]">
                                <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                                <div>
                                    {r.code && <span className="text-slate-400 font-mono text-[9px]">[{r.code}] </span>}
                                    <span className="text-slate-300">{r.message || r.details || JSON.stringify(r)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            )}

            {/* 7. Raw JSON */}
            <CollapsibleSection title="Raw JSON" badge={<CopyButton text={JSON.stringify(scanResults, null, 2)} />}>
                <pre className="text-[8px] text-slate-500 font-mono leading-relaxed whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto custom-scrollbar bg-slate-900/50 rounded p-2">
                    {JSON.stringify(scanResults, null, 2)}
                </pre>
            </CollapsibleSection>

            {/* URL scanned */}
            <div className="text-[9px] text-slate-600 font-mono truncate px-1 pt-1 border-t border-slate-700/30">
                {currentUrl}
            </div>
        </div>
    );
};

// ─── Main Popup ─────────────────────────────────────────────────────────────

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

    // Load dev mode preference from storage on mount
    useEffect(() => {
        chrome.storage.local.get(['hydraGuardDevMode'], (result) => {
            if (result.hydraGuardDevMode) {
                setDevMode(true);
            }
        });
    }, []);

    // Persist dev mode toggle
    const toggleDevMode = () => {
        const newVal = !devMode;
        setDevMode(newVal);
        chrome.storage.local.set({ hydraGuardDevMode: newVal });
    };

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.url) return;
            const url = tab.url;
            setCurrentUrl(url);

            let domain = '';
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                console.error('Invalid URL:', url);
            }

            chrome.storage.local.get(['statistics', 'settings', 'reportedSites', 'pro_user'], (result) => {
                if (result.statistics) {
                    setStats({
                        totalScans: result.statistics.totalScans || 0,
                        threatsBlocked: result.statistics.threatsBlocked || 0
                    });
                }
                setIsPro(!!result.pro_user || result.settings?.planType === 'pro');

                if (result.reportedSites && (result.reportedSites[url] || (domain && result.reportedSites[domain]))) {
                    setIsAlreadyReported(true);
                }

                chrome.runtime.sendMessage({ type: MessageTypes.GET_SCAN_RESULTS, data: { tabId: tab.id } }, (response) => {
                    const data = response?.data;
                    if (data?.results) {
                        const res = data.results;
                        setScanResults(res);

                        // Approved Severity Mapping: LOW | SAFE -> secure
                        if (res.whitelisted) {
                            setIsWhitelisted(true);
                            setStatus('secure');
                        } else if (['CRITICAL', 'HIGH'].includes(res.overallSeverity)) {
                            setStatus('danger');
                        } else if (['MEDIUM'].includes(res.overallSeverity)) {
                            setStatus('caution');
                        } else {
                            setStatus('secure');
                        }
                    }
                });
            });
        });
    }, []);

    const handleGoBack = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        // Try native API first
        if (chrome.tabs.goBack) {
            try {
                await chrome.tabs.goBack(tab.id);
                window.close();
                return;
            } catch (e) {
                console.warn('Native goBack failed, trying fallback', e);
            }
        }

        // Fallback: Content script history.back()
        chrome.tabs.sendMessage(tab.id, { type: 'HISTORY_BACK' }, () => {
            // Ignore error if message fails (no script on page)
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
            chrome.runtime.sendMessage({
                type: MessageTypes.ADD_TO_WHITELIST,
                data: { domain }
            }, (response) => {
                if (response?.success) {
                    setIsWhitelisted(true);
                    setStatus('secure');
                }
            });
        } catch (e) {
            console.error('Invalid URL for whitelisting');
        }
    };

    const handleOpenTab = (hash) => {
        const manifest = chrome.runtime.getManifest();
        const optionsPath = manifest.options_page || 'dist/options/index.html';
        const url = chrome.runtime.getURL(`${optionsPath}#${hash}`);
        chrome.tabs.create({ url });
    };

    const config = getStatusConfig(status);

    return (
        <div className={cn(
            "w-[360px] h-fit bg-slate-900 text-white font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col p-4 pb-6",
            devMode && "w-[400px]"
        )}>

            {/* Minimal Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Security Check</span>
                </div>
                <div className="flex items-center gap-2">
                    <DevToggle devMode={devMode} onToggle={toggleDevMode} />
                    {isPro && (
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-700">PRO</span>
                    )}
                </div>
            </div>

            {/* Dev Mode Banner */}
            {devMode && (
                <div className="mb-3 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center gap-2">
                    <Bug size={12} className="text-violet-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-violet-300">Developer Mode \u2014 full scan pipeline visible</span>
                </div>
            )}

            {/* Main Status Card - NO GRADIENTS FOR SAFE */}
            <div className={cn(
                "relative rounded-2xl border p-5 overflow-hidden transition-all duration-300",
                config.cardBg, config.cardBorder
            )}>
                {/* Left Accent Bar */}
                <div className={cn("absolute left-0 top-0 h-full w-1.5", config.accent)} />

                <div className="flex flex-col gap-1">
                    <h1 className={cn("text-xl font-bold tracking-tight", config.titleColor)}>
                        {config.title}
                    </h1>
                    <p className={cn("text-sm leading-snug font-medium", config.subColor)}>
                        {config.subtitle}
                    </p>
                    {status === 'secure' && currentUrl && !devMode && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-medium text-slate-400">
                                Checked: URL + connection security
                                {scanResults?.meta?.sources?.some(s => s.id === 'gsb' && s.status === 'success') && ' + reputation'}
                            </span>
                        </div>
                    )}
                    {/* Dev mode: show severity inline on the status card */}
                    {devMode && scanResults && (
                        <div className="flex items-center gap-2 mt-1.5">
                            <SeverityBadge severity={scanResults.overallSeverity} />
                            <span className="text-[9px] text-slate-500 font-mono">
                                {(scanResults.signals?.hard?.length || 0)}H / {(scanResults.signals?.soft?.length || 0)}S signals
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Dev Mode: Full Pipeline Panel */}
            {devMode && (
                <DevPanel scanResults={scanResults} currentUrl={currentUrl} />
            )}

            {/* Conditional Action Section (Only for Caution/Danger) */}
            {status !== 'secure' && (
                <div className="mt-4 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button
                        onClick={handleGoBack}
                        className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-lg active:scale-[0.98]"
                    >
                        Go back to safety
                    </button>

                    {!devMode && (
                        <button
                            onClick={() => setDetailsOpen(true)}
                            className="w-full mt-2 py-2 text-slate-400 text-xs font-semibold hover:text-white transition-colors"
                        >
                            View details
                        </button>
                    )}
                </div>
            )}

            {/* Standard Details Section (only when dev mode is OFF) */}
            {!devMode && (
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

                            {/* 1. Technical Findings / Checks Performed */}
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
                                            } catch (e) { /* skip if invalid */ }
                                            return null;
                                        })()}
                                        {(() => {
                                            // Dynamic check for email heuristics MUST strictly rely on backend payloads, not URL assumptions 
                                            const hasEmailHeuristics = scanResults?.checks?.emailScams !== undefined || scanResults?.checks?.urgencySignals !== undefined;

                                            if (hasEmailHeuristics) {
                                                return (
                                                    <div className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                        Email content heuristics
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
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
                                            } else {
                                                return (
                                                    <div className="flex gap-2 text-[11px] text-slate-500 leading-relaxed font-medium italic">
                                                        <div className="w-1 h-1 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                                                        Reputation checks: Off
                                                    </div>
                                                );
                                            }
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

                            {/* 2. Global Settings & Actions */}
                            <div className="space-y-2">
                                <button
                                    onClick={() => handleOpenTab('logs')}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <Activity size={18} className="text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-300">Activity Log & Reports</span>
                                    </div>
                                    <ExternalLink size={14} className="text-slate-600" />
                                </button>

                                <button
                                    onClick={() => handleOpenTab('settings')}
                                    className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <Shield size={18} className="text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-300">Email protection settings</span>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-600" />
                                </button>

                                {(status !== 'secure' || isWhitelisted || isAlreadyReported) && (
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            onClick={isWhitelisted ? null : handleWhitelist}
                                            disabled={isWhitelisted}
                                            className={cn(
                                                "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                isWhitelisted
                                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                            )}
                                        >
                                            {isWhitelisted ? 'Trusted' : 'Trust Site'}
                                        </button>
                                        <button
                                            onClick={isAlreadyReported ? null : handleReportScam}
                                            disabled={isAlreadyReported}
                                            className={cn(
                                                "flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                                isAlreadyReported
                                                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                                            )}
                                        >
                                            {isAlreadyReported ? 'Reported' : 'Report Scam'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 3. Statistics (Grid) - Moved to bottom */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center">
                                    <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Scanned</span>
                                    <span className="text-lg font-bold text-slate-200 leading-none">{stats.totalScans.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center">
                                    <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Blocked</span>
                                    <span className={cn(
                                        "text-lg font-bold leading-none",
                                        stats.threatsBlocked > 0 ? "text-rose-500" : "text-slate-500"
                                    )}>
                                        {stats.threatsBlocked.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer Settings Link */}
            {!detailsOpen && !devMode && (
                <div className="mt-auto pt-6 flex justify-center items-center gap-4">
                    <button
                        onClick={() => handleOpenTab('dashboard')}
                        className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2 flex items-center gap-1.5"
                    >
                        <Settings size={12} />
                        Settings
                    </button>
                    <div className="w-px h-3 bg-slate-800" />
                    <button
                        onClick={() => handleOpenTab('logs')}
                        className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2"
                    >
                        Activity Log
                    </button>
                </div>
            )}

            {/* Dev Mode Footer: Quick links + Stats */}
            {devMode && (
                <div className="mt-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Scanned</span>
                            <span className="text-base font-bold text-slate-200 leading-none">{stats.totalScans.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Blocked</span>
                            <span className={cn(
                                "text-base font-bold leading-none",
                                stats.threatsBlocked > 0 ? "text-rose-500" : "text-slate-500"
                            )}>
                                {stats.threatsBlocked.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-center items-center gap-4">
                        <button
                            onClick={() => handleOpenTab('dashboard')}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2 flex items-center gap-1.5"
                        >
                            <Settings size={12} />
                            Settings
                        </button>
                        <div className="w-px h-3 bg-slate-800" />
                        <button
                            onClick={() => handleOpenTab('logs')}
                            className="text-slate-500 hover:text-slate-300 text-[10px] font-medium transition-colors hover:underline underline-offset-2"
                        >
                            Activity Log
                        </button>
                    </div>
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
