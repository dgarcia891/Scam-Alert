import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, ShieldAlert, Settings, ExternalLink, Activity, Info, AlertTriangle, ChevronRight, ArrowRight } from 'lucide-react';
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
            subtitle: "Go back — don't enter information here.",
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

const Popup = () => {
    const [status, setStatus] = useState('secure');
    const [stats, setStats] = useState({ totalScans: 0, threatsBlocked: 0 });
    const [scanResults, setScanResults] = useState(null);
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [isAlreadyReported, setIsAlreadyReported] = useState(false);
    const [isPro, setIsPro] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [detailsOpen, setDetailsOpen] = useState(false);

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

    const handleOpenTab = (target) => {
        // Updated to use the correct hash or page
        const page = target === 'dashboard' ? 'dashboard.html' : 'logs.html';
        const url = chrome.runtime?.getURL ? chrome.runtime.getURL(page) : page;
        chrome.tabs.create({ url });
    };

    const config = getStatusConfig(status);

    return (
        <div className="w-[360px] h-fit bg-slate-900 text-white font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col p-4 pb-6">

            {/* Minimal Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Security Check</span>
                </div>
                {isPro && (
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-700">PRO</span>
                )}
            </div>

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
                </div>
            </div>

            {/* Conditional Action Section (Only for Caution/Danger) */}
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

            {/* Details Section (Accordion) */}
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

                        {/* 1. Technical Findings (Why this page looks unusual) */}
                        {scanResults?.reasons?.length > 0 && (
                            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 space-y-2">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Info size={12} className="text-slate-500" /> Why this page looks unusual
                                </div>
                                <div className="space-y-1.5">
                                    {scanResults.reasons.map((reason, idx) => (
                                        <div key={idx} className="flex gap-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                                            <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                                            {reason.message || reason.details}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Global Settings & Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={() => handleOpenTab('dashboard')}
                                className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <Activity size={18} className="text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-300">Activity Log & Reports</span>
                                </div>
                                <ExternalLink size={14} className="text-slate-600" />
                            </button>

                            <button
                                onClick={() => handleOpenTab('dashboard')}
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

            {/* Footer Settings Link */}
            {!detailsOpen && (
                <div className="mt-auto pt-6 flex justify-center">
                    <button
                        onClick={() => handleOpenTab('dashboard')}
                        className="text-slate-600 hover:text-slate-400 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                    >
                        <Settings size={12} />
                        Settings
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
