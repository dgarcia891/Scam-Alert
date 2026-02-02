import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, ShieldAlert, Settings, ExternalLink, Activity } from 'lucide-react';
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

const Popup = () => {
    const [status, setStatus] = useState('secure'); // 'secure' | 'caution' | 'danger'
    const [stats, setStats] = useState({ totalScans: 0, threatsBlocked: 0 });
    const [isPro, setIsPro] = useState(false);
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [isAlreadyReported, setIsAlreadyReported] = useState(false); // BUG-052
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [currentUrl, setCurrentUrl] = useState('');
    const [scanResults, setScanResults] = useState(null); // NEW


    useEffect(() => {
        const fetchData = () => {
            chrome.storage?.local.get(['statistics', 'settings'], (result) => {
                if (result.statistics) {
                    setStats({
                        totalScans: result.statistics.totalScans || 0,
                        threatsBlocked: result.statistics.threatsBlocked || 0
                    });
                }
                if (result.settings?.planType === 'pro') setIsPro(true);
                if (result.settings?.emailScanningEnabled !== undefined) {
                    setEmailEnabled(result.settings.emailScanningEnabled);
                }

                // BUG-052: Check if current site already reported
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const url = tabs[0]?.url;
                    if (url && result.reportedSites?.[url]) {
                        setIsAlreadyReported(true);
                    }
                });
            });

            // Add initial stats sync message if needed
            chrome.runtime.sendMessage({ type: MessageTypes.GET_STATS }, (response) => {
                if (response?.data) {
                    const stats = response.data;
                    setStats({
                        totalScans: stats.totalScans || 0,
                        threatsBlocked: stats.threatsBlocked || 0
                    });
                }
            });

            chrome.runtime.sendMessage({ type: MessageTypes.GET_SCAN_RESULTS, data: { tabId: null } }, (response) => {
                const data = response?.data;
                console.log('[Popup] Scan results response:', data);

                if (data?.url) setCurrentUrl(data.url);
                if (data?.results) {
                    const res = data.results;
                    setScanResults(res); // Store full results
                    console.log('[Popup] Setting status from severity:', res.overallSeverity);

                    if (res.whitelisted) {
                        setIsWhitelisted(true);
                        setStatus('secure');
                    } else if (res.overallSeverity === 'CRITICAL' || res.overallSeverity === 'HIGH') {
                        setStatus('danger');
                    } else if (res.overallSeverity === 'MEDIUM' || res.overallSeverity === 'LOW') {
                        setStatus('caution');
                    } else {
                        setStatus('secure');
                    }
                }
            });
        };

        fetchData();

        const listener = (changes, areaName) => {
            if (areaName === 'local' && changes.statistics?.newValue) {
                const newStats = changes.statistics.newValue;
                setStats({
                    totalScans: newStats.totalScans || 0,
                    threatsBlocked: newStats.threatsBlocked || 0
                });
            }
            if (areaName === 'local' && changes.settings?.newValue) {
                const newSettings = changes.settings.newValue;
                if (newSettings.planType === 'pro') setIsPro(true);
                if (newSettings.emailScanningEnabled !== undefined) {
                    setEmailEnabled(newSettings.emailScanningEnabled);
                }
            }
        };

        chrome.storage?.onChanged.addListener(listener);
        return () => chrome.storage?.onChanged.removeListener(listener);
    }, []);

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
        const url = chrome.runtime?.getURL ? chrome.runtime.getURL(`options/index.html#${hash}`) : `options/index.html#${hash}`;
        window.open(url);
    };

    const handleToggleEmail = () => {
        const newValue = !emailEnabled;
        setEmailEnabled(newValue);
        chrome.storage?.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            settings.emailScanningEnabled = newValue;
            chrome.storage.local.set({ settings });
        });
    };

    const handleUpgrade = () => {
        chrome.storage?.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            settings.planType = 'pro';
            chrome.storage.local.set({ settings }, () => setIsPro(true));
        });
    };

    const handleReportScam = async () => {
        // Phase 23.8: Unified Reporting Flow
        // Trigger the in-page modal via message instead of using native prompt
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab?.url || tab.url.startsWith('chrome://')) {
                alert('Cannot report on this page type.');
                return;
            }

            chrome.tabs.sendMessage(tab.id, { type: 'OPEN_REPORT_MODAL' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script not ready or not injected
                    console.warn('[Scam Alert] content script not responding', chrome.runtime.lastError);
                    alert('Please refresh the page and try again. (The detection script may not be loaded)');
                } else {
                    // Success - modal is opening on the page
                    window.close(); // Close popup so user can see the modal
                }
            });
        } catch (e) {
            console.error('Failed to trigger report modal:', e);
            alert('Error triggering report.');
        }
    };

    const getStatusConfig = () => {
        switch (status) {
            case 'danger':
                return {
                    gradient: "from-rose-600 to-orange-600",
                    iconColor: "text-rose-200",
                    title: "High Risk Detected",
                    subtitle: "Immediate action recommended",
                    iconPulse: "shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse"
                };
            case 'caution':
                return {
                    gradient: "from-amber-500 to-yellow-500",
                    iconColor: "text-amber-100",
                    title: "Suspicious Patterns",
                    subtitle: "Proceed with caution",
                    iconPulse: "shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                };
            default:
                return {
                    gradient: "from-indigo-600 to-violet-700",
                    iconColor: "text-emerald-300",
                    title: "No Threats Detected",
                    subtitle: "No phishing or scams found",
                    iconPulse: ""
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className="w-[360px] h-fit bg-slate-900 text-white font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col">
            {/* Header / Status Card */}
            <div className={cn(
                "relative p-4 pt-2 pb-5 rounded-b-[2rem] shadow-2xl transition-all duration-500 ease-out shrink-0",
                "bg-gradient-to-br", config.gradient
            )}>
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black rounded-full blur-2xl"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className={cn(
                        "p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-inner mb-1.5 animate-in fade-in zoom-in duration-300",
                        config.iconColor, config.iconPulse
                    )}>
                        {status === 'secure' ? <Shield size={24} strokeWidth={1.5} /> : <ShieldAlert size={24} strokeWidth={1.5} />}
                    </div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-bold tracking-tight">
                            {config.title}
                        </h1>
                        {isPro && (
                            <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/30">PRO</span>
                        )}
                    </div>
                    <p className="text-white/70 text-sm font-medium">
                        {config.subtitle}
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-5 -mt-4 relative z-20 flex-1 overflow-y-auto pb-6 custom-scrollbar">

                {/* 1. Statistics (Grid) - Moved to top of content */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-2.5 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-800 transition-colors">
                        <span className="text-slate-400 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Pages Scanned</span>
                        <span className="text-lg font-bold text-white">{stats.totalScans.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-2.5 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-800 transition-colors">
                        <span className="text-slate-400 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Blocked</span>
                        <span className="text-lg font-bold text-rose-400">{stats.threatsBlocked.toLocaleString()}</span>
                    </div>
                </div>

                {/* Hydra Hub: Scan Summary (Transparency) */}
                {scanResults && (
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-3 mb-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="text-emerald-400" size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Verified Protection Scans</span>
                        </div>
                        <div className="space-y-1.5">
                            {scanResults.checksPerformed?.map((check, idx) => (
                                <div
                                    key={check.id}
                                    className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/40 px-2 py-1.5 rounded-lg border border-slate-700/30"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <span>{check.label}</span>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]",
                                        check.status === 'passed' ? "bg-emerald-500 text-emerald-500" :
                                            check.status === 'warning' ? "bg-amber-500 text-amber-500" : "bg-rose-500 text-rose-500"
                                    )} />
                                </div>
                            ))}
                        </div>
                        {scanResults.context?.type === 'email' && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50 text-[9px] text-slate-500 font-medium">
                                Detected: <span className="text-slate-300">{scanResults.context.provider} email context</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2.5">
                    {/* 2. Activity Log */}
                    <button
                        onClick={() => handleOpenTab('logs')}
                        className="w-full group relative flex items-center justify-between p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all duration-200"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                <Activity size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-slate-200">View Activity Log</div>
                                <div className="text-xs text-slate-500">Recent scans & threats</div>
                            </div>
                        </div>
                        <ExternalLink size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>

                    {/* 3. Email Protection Toggle - Repositioned */}
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-2.5">
                            <div
                                onClick={() => handleOpenTab('dashboard')}
                                className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-all"
                            >
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    emailEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-500"
                                )}>
                                    <Shield size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                                        Email Protection
                                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-xs text-slate-500">{emailEnabled ? 'Scanning Gmail & Outlook' : 'Protection Disabled'}</div>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleEmail}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative flex items-center",
                                    emailEnabled ? "bg-indigo-600" : "bg-slate-700"
                                )}>
                                <div className={cn(
                                    "absolute w-4 h-4 bg-white rounded-full transition-all",
                                    emailEnabled ? "right-1" : "left-1"
                                )} />
                            </button>
                        </div>
                    </div>

                    {/* 4. Report Detected Scam - Conditional "Ghosted" Style */}
                    <button
                        onClick={isAlreadyReported ? null : handleReportScam}
                        disabled={isAlreadyReported}
                        className={cn(
                            "w-full group relative flex items-center justify-between p-2.5 rounded-xl transition-all duration-300",
                            isAlreadyReported
                                ? "bg-emerald-500/10 border border-emerald-500/20 opacity-80 cursor-default"
                                : cn(
                                    "border transition-all duration-300",
                                    status === 'danger'
                                        ? "bg-rose-500/20 border-rose-500/40 opacity-100 hover:bg-rose-500/30"
                                        : "bg-rose-500/5 border-rose-500/10 opacity-30 hover:opacity-50 grayscale"
                                )
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                isAlreadyReported
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : (status === 'danger' ? "bg-rose-500/20 text-rose-400" : "bg-rose-500/10 text-rose-500/40")
                            )}>
                                {isAlreadyReported ? <Shield size={20} /> : <ShieldAlert size={20} />}
                            </div>
                            <div className="text-left">
                                <div className={cn(
                                    "text-sm font-semibold transition-colors",
                                    isAlreadyReported ? "text-emerald-200" : (status === 'danger' ? "text-rose-200" : "text-rose-200/40")
                                )}>
                                    {isAlreadyReported ? 'Submitted Already' : 'Report Detected Scam'}
                                </div>
                                <div className={cn(
                                    "text-xs transition-colors",
                                    isAlreadyReported ? "text-emerald-500/70" : (status === 'danger' ? "text-rose-500/70" : "text-rose-500/30")
                                )}>
                                    {isAlreadyReported ? 'Your report has been received' : 'Submit to community database'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* 5. Always Trust this Site - Conditional "Ghosted" Style */}
                    <button
                        onClick={isWhitelisted ? null : handleWhitelist}
                        disabled={isWhitelisted}
                        className={cn(
                            "w-full group relative flex items-center justify-between p-2.5 rounded-xl transition-all duration-300",
                            isWhitelisted
                                ? "bg-emerald-500/10 border border-emerald-500/20 opacity-80 cursor-default"
                                : cn(
                                    "border transition-all duration-300",
                                    status === 'danger'
                                        ? "bg-emerald-500/20 border-emerald-500/40 opacity-100 hover:bg-emerald-500/30"
                                        : "bg-emerald-500/5 border-emerald-500/10 opacity-30 hover:opacity-50 grayscale"
                                )
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                (isWhitelisted || status === 'danger') ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-500/40"
                            )}>
                                <Shield size={20} />
                            </div>
                            <div className="text-left">
                                <div className={cn(
                                    "text-sm font-semibold transition-colors",
                                    (isWhitelisted || status === 'danger') ? "text-emerald-200" : "text-emerald-200/40"
                                )}>
                                    {isWhitelisted ? 'Site Whitelisted' : 'Always Trust this Site'}
                                </div>
                                <div className={cn(
                                    "text-xs transition-colors",
                                    (isWhitelisted || status === 'danger') ? "text-emerald-500/70" : "text-emerald-500/30"
                                )}>
                                    {isWhitelisted ? 'This domain is safe' : 'Add to whitelist'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* 6. Settings - Moved to bottom of interactive list */}
                    <button
                        onClick={() => handleOpenTab('settings')}
                        className="w-full group relative flex items-center justify-between p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all duration-200"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 group-hover:text-white transition-colors">
                                <Settings size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-slate-200">Settings</div>
                                <div className="text-xs text-slate-500">Manage protection levels</div>
                            </div>
                        </div>
                    </button>

                    {!isPro && (
                        <button
                            onClick={handleUpgrade}
                            className="w-full relative overflow-hidden p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl group hover:border-amber-500/40 transition-all mt-1"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-amber-200">Unlock Pro Protection</div>
                                    <div className="text-xs text-amber-500/70">Advanced heuristics & Live Map</div>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

            </div>

            {/* Footer */}
            <style>{scrollbarStyles}</style>
            <div className="py-3 text-center shrink-0 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Scam Alert Pro v1.1.0 (Hydra Guard)</p>
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
