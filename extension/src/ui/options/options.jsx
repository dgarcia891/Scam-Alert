import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Shield, Activity, Settings, BarChart3, Lock, ExternalLink, RefreshCw, Info, X, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { clsx } from 'clsx';
import { MessageTypes } from '../../lib/messaging.js';
import '../index.css';

const Navbar = ({ activeTab, onTabChange, isPro, onUpgrade }) => {
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'logs', label: 'Activity Logs', icon: Activity },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <nav className="flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-6 h-screen sticky top-0">
            <div className="flex items-center gap-3 mb-10 px-2">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Shield className="text-white w-6 h-6" />
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-white text-lg tracking-tight">Scam Alert</span>
                    <span className="text-xs text-slate-400 font-medium tracking-wide">SAFE BROWSING</span>
                </div>
            </div>

            <div className="space-y-2 flex-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                isActive
                                    ? "bg-indigo-600/10 text-indigo-400"
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            )}
                        >
                            <Icon size={20} className={isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="mt-auto pt-6 border-t border-slate-800">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Plan</span>
                        <Badge variant={isPro ? "success" : "info"}>{isPro ? 'Pro' : 'Free'}</Badge>
                    </div>
                    {isPro ? (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-3">
                            <Lock size={14} />
                            <span>Pro Protection Active</span>
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 mb-3">Upgrade for advanced heuristics and live mapping.</p>
                    )}
                    <Button
                        size="sm"
                        variant={isPro ? "secondary" : "primary"}
                        className="w-full text-xs"
                        onClick={isPro ? undefined : onUpgrade}
                    >
                        {isPro ? 'Manage Subscription' : 'Unlock Pro Now'}
                    </Button>
                </div>
            </div>
        </nav>
    );
};

const StatCard = ({ label, value, trend, trendUp }) => (
    <Card className="p-5 flex flex-col justify-between">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{value}</span>
            {trend && (
                <span className={clsx("text-xs font-medium px-1.5 py-0.5 rounded-full", trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                    {trend}
                </span>
            )}
        </div>
    </Card>
);

const formatLabel = (str) => {
    if (!str) return '';
    return str
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const HighlightedText = ({ text, matches = [], severity = 'NONE' }) => {
    if (!matches || matches.length === 0) return text;

    // Sort matches by length descending to avoid partial matches eating larger ones
    const sortedMatches = [...new Set(matches.filter(Boolean))].sort((a, b) => b.length - a.length);
    if (sortedMatches.length === 0) return text;

    const regex = new RegExp(`(${sortedMatches.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) => {
                const isMatch = sortedMatches.some(m => m.toLowerCase() === part.toLowerCase());
                if (isMatch) {
                    const highlightClass = severity === 'CRITICAL' || severity === 'HIGH'
                        ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded px-0.5'
                        : 'bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded px-0.5';
                    return (
                        <mark key={i} className={highlightClass}>
                            {part}
                        </mark>
                    );
                }
                return part;
            })}
        </>
    );
};

const CheckDetailModal = ({ check, onClose }) => {
    if (!check) return null;

    const title = check.title || 'Security Check';
    const description = check.description || 'Analysis performed by our detection engine.';
    const dataChecked = check.dataChecked || 'No raw data available for this check.';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl border-slate-700/50 bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <Shield size={18} className="text-indigo-400" />
                        <h3 className="font-bold text-white tracking-tight">{formatLabel(title)}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">What this check does</span>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                            "{description}"
                        </p>
                    </div>

                    <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                        <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-widest block mb-3 flex items-center gap-2">
                            <Eye size={12} /> Evidence Collected
                        </span>
                        <div className="font-mono text-[11px] text-slate-400 break-all bg-slate-900/50 p-3 rounded-lg border border-slate-800 select-all max-h-40 overflow-y-auto custom-scrollbar">
                            <HighlightedText text={dataChecked} matches={check.matches} severity={check.severity} />
                        </div>
                    </div>

                    {check.visualIndicators && check.visualIndicators.length > 0 && (
                        <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Threat Intelligence</span>
                            <div className="space-y-2">
                                {check.visualIndicators.map((ind, i) => (
                                    <div key={i} className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-indigo-300">"{ind.phrase}"</span>
                                            <Badge variant="info" className="text-[9px] py-0 px-1">{ind.category}</Badge>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed italic">"{ind.reason}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {check.details && check.description !== check.details && (
                        <div className={clsx(
                            "rounded-lg p-3 border",
                            check.severity === 'HIGH' || check.severity === 'CRITICAL'
                                ? "bg-rose-500/5 border-rose-500/10"
                                : check.severity === 'MEDIUM'
                                    ? "bg-amber-500/5 border-amber-500/10"
                                    : "bg-emerald-500/5 border-emerald-500/10"
                        )}>
                            <span className={clsx(
                                "text-[10px] font-bold uppercase tracking-widest block mb-1",
                                check.severity === 'HIGH' || check.severity === 'CRITICAL'
                                    ? "text-rose-400"
                                    : check.severity === 'MEDIUM'
                                        ? "text-amber-400"
                                        : "text-emerald-400"
                            )}>{check.severity === 'SAFE' || check.severity === 'LOW' || check.severity === 'NONE' ? 'Verification' : 'Detection'} Result</span>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                {check.details}
                            </p>
                        </div>
                    )}

                    {check.verdict && (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">AI Second Opinion</span>
                                <span className={clsx(
                                    "text-[10px] font-bold uppercase",
                                    check.verdict === 'DOWNGRADED' ? "text-emerald-400" : "text-rose-400"
                                )}>{check.verdict}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed italic mb-3">
                                {check.details}
                            </p>
                            {check.verdict === 'DOWNGRADED' && (
                                <button
                                    onClick={() => {
                                        const payload = {
                                            url: dataChecked, // Use hostname from check
                                            ruleId: 'ai_second_opinion',
                                            issueType: 'false_negative',
                                            severity: 'HIGH',
                                            explanation: `AI downgraded a local detection (${check.verdict} with ${check.confidence}% confidence), but user reported it as suspicious.`
                                        };
                                        chrome.runtime.sendMessage({ type: 'SUBMIT_FALSE_POSITIVE', data: payload });
                                        alert('Reported. Thank you for improving our AI accuracy.');
                                    }}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors underline flex items-center gap-1">
                                    Was this wrong? Report it
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-950/30 border-t border-slate-800 flex justify-end">
                    <Button variant="primary" size="sm" onClick={onClose}>Close Report</Button>
                </div>
            </Card>
        </div>
    );
};

const AnalysisTag = ({ check, onClick }) => {
    // Handle both old array format and new object format
    const label = typeof check === 'string' ? check : (check.title || 'Security Check');
    const description = typeof check === 'object' ? check.description : null;

    const severity = check.severity || 'NONE';
    const isCritical = severity === 'CRITICAL' || severity === 'HIGH';
    const isMedium = severity === 'MEDIUM';

    return (
        <button
            onClick={() => typeof check === 'object' && onClick(check)}
            title={description}
            className={clsx(
                "group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all",
                typeof check === 'object'
                    ? (isCritical
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 cursor-pointer shadow-sm shadow-rose-900/10"
                        : (isMedium
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 cursor-pointer shadow-sm shadow-amber-900/10"
                            : "bg-indigo-500/5 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40 cursor-pointer shadow-sm"))
                    : "bg-slate-800 border-slate-700/50 text-slate-400 cursor-default"
            )}
        >
            <div className={clsx(
                "w-1.5 h-1.5 rounded-full",
                isCritical ? "bg-rose-500 animate-pulse" : (isMedium ? "bg-amber-500" : "bg-indigo-500/50")
            )} />
            {formatLabel(label)}
            {typeof check === 'object' && (
                <Eye size={10} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 opacity-60" />
            )}
        </button>
    );
};

const RecentActivity = ({ activities = [], onCheckClick }) => {
    const [visibleCount, setVisibleCount] = useState(10);
    const [expandedIndex, setExpandedIndex] = useState(null);

    if (activities.length === 0) {
        return (
            <Card className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 italic">
                <Activity size={32} className="mb-2 opacity-20" />
                <p>No recent activity recorded.</p>
            </Card>
        );
    }

    const visibleActivities = activities.slice(0, visibleCount);

    return (
        <Card className="flex-1">
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <Button variant="ghost" size="sm" className="-mr-2"><RefreshCw size={16} /></Button>
            </CardHeader>
            <div className="space-y-1">
                {visibleActivities.map((item, index) => (
                    <div key={index} className="flex flex-col border border-transparent hover:border-slate-800 rounded-xl transition-all">
                        <div
                            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            className="flex items-center justify-between p-4 hover:bg-slate-800/30 cursor-pointer rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "w-2 h-2 rounded-full",
                                    item.severity === 'CRITICAL' || item.severity === 'HIGH' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" :
                                        item.severity === 'MEDIUM' ? "bg-amber-500" : "bg-emerald-500"
                                )} />
                                <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-200 text-sm font-semibold tracking-tight">{item.domain}</span>
                                        {item.metadata?.subject && (
                                            <span className="text-[10px] text-indigo-400 font-medium truncate max-w-[150px] bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                                {item.metadata.subject}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">{new Date(item.time).toLocaleString()}</span>
                                        {item.metadata?.sender && (
                                            <span className="text-[10px] text-slate-500 italic">• via {item.metadata.sender}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={item.action === 'blocked' ? 'danger' : item.action === 'error' ? 'info' : 'success'}>
                                    {item.action === 'error' ? 'FAILED' : formatLabel(item.action)}
                                </Badge>
                                <div className={clsx("transition-transform duration-200", expandedIndex === index ? "rotate-180" : "")}>
                                    <Activity size={14} className="text-slate-500" />
                                </div>
                            </div>
                        </div>

                        {expandedIndex === index && (
                            <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                {item.action === 'error' ? (
                                    <div className="bg-rose-500/10 rounded-lg p-3 border border-rose-500/20 text-rose-400 text-[11px]">
                                        <span className="font-bold uppercase tracking-widest mr-2">Scan Error:</span>
                                        {item.metadata?.error || 'Unknown system error'}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {item.indicators && item.indicators.length > 0 && (
                                            <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/10">
                                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Shield size={10} /> Risk Indicators
                                                </div>
                                                <div className="space-y-1.5">
                                                    {item.indicators.map((indicator, iIdx) => (
                                                        <div key={iIdx} className="flex items-start gap-2 text-slate-300 text-xs">
                                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                                            {indicator}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <RefreshCw size={10} /> Analysis Processes
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {item.performedChecks && (Object.keys(item.performedChecks).length > 0 || Array.isArray(item.performedChecks)) ? (
                                                    (Array.isArray(item.performedChecks) ? item.performedChecks : Object.values(item.performedChecks)).map((check, cIdx) => (
                                                        <AnalysisTag key={cIdx} check={check} onClick={onCheckClick} />
                                                    ))
                                                ) : (
                                                    <span className="text-slate-600 text-[10px] italic">Basic heuristic analysis only</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {activities.length > visibleCount && (
                <div className="mt-4 flex justify-center pb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                        onClick={() => setVisibleCount(visibleCount + 10)}
                    >
                        Load More Activity
                    </Button>
                </div>
            )}
        </Card>
    );
};

const DashboardContent = ({ isPro, stats, onUpgrade, onCheckClick }) => {
    const score = stats.totalScans > 0
        ? Math.max(70, Math.round(((stats.totalScans - stats.threatsBlocked) / stats.totalScans) * 100))
        : 100;

    const latestScan = stats.recentActivity?.[0];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-3 gap-6">
                <StatCard label="Threats Blocked" value={stats.threatsBlocked.toLocaleString()} />
                <StatCard label="Pages Scanned" value={stats.totalScans.toLocaleString()} />
                <StatCard label="Protection Score" value={`${score}/100`} />
            </div>

            {latestScan && (
                <Card className="bg-gradient-to-r from-indigo-500/5 to-transparent border-l-4 border-l-indigo-500 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">Latest Scan Breakdown</span>
                            <span className="text-xl font-bold text-white">{latestScan.domain}</span>
                        </div>
                        <Badge variant={latestScan.severity === 'SAFE' ? 'success' : 'warning'}>{latestScan.severity}</Badge>
                    </div>
                    <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            Analysis Processes Performed
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {latestScan.performedChecks && (Object.keys(latestScan.performedChecks).length > 0 || Array.isArray(latestScan.performedChecks)) ? (
                                (Array.isArray(latestScan.performedChecks) ? latestScan.performedChecks : Object.values(latestScan.performedChecks)).map((check, idx) => (
                                    <AnalysisTag key={idx} check={check} onClick={onCheckClick} />
                                ))
                            ) : (
                                <span className="text-slate-500 italic text-sm">Initializing analysis details...</span>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            <div className="flex flex-col gap-6">
                <RecentActivity activities={stats.recentActivity} onCheckClick={onCheckClick} />
            </div>
        </div>
    );
};

const Options = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isPro, setIsPro] = useState(false);
    const [stats, setStats] = useState({ totalScans: 0, threatsBlocked: 0, recentActivity: [] });
    const [selectedCheck, setSelectedCheck] = useState(null);

    useEffect(() => {
        const handleHash = () => {
            const hash = window.location.hash.replace('#', '');
            if (['dashboard', 'logs', 'settings'].includes(hash)) {
                setActiveTab(hash);
            }
        };

        handleHash(); // Check on mount
        window.addEventListener('hashchange', handleHash);

        const fetchData = () => {
            chrome.storage?.local.get(['settings', 'statistics'], (result) => {
                if (result.settings?.planType === 'pro') setIsPro(true);
                if (result.statistics) {
                    setStats(prev => ({
                        ...prev,
                        ...result.statistics,
                        recentActivity: result.statistics.recentActivity || []
                    }));
                }
            });
        };
        fetchData();
        // Listener for storage changes
        const listener = (changes) => {
            if (changes.settings?.newValue?.planType) {
                setIsPro(changes.settings.newValue.planType === 'pro');
            }
            if (changes.statistics?.newValue) {
                setStats(prev => ({
                    ...prev,
                    ...changes.statistics.newValue,
                    recentActivity: changes.statistics.newValue.recentActivity || []
                }));
            }
        };
        chrome.storage?.onChanged.addListener(listener);
        return () => {
            chrome.storage?.onChanged.removeListener(listener);
            window.removeEventListener('hashchange', handleHash);
        };
    }, []);

    const handleUpgrade = () => {
        chrome.storage?.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            settings.planType = 'pro';
            chrome.storage.local.set({ settings });
        });
    };

    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
            <Navbar activeTab={activeTab} onTabChange={setActiveTab} isPro={isPro} onUpgrade={handleUpgrade} />

            <main className="flex-1 p-10 overflow-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            {activeTab === 'dashboard' ? 'Security Overview' :
                                activeTab === 'logs' ? 'Activity Logs' : 'Settings'}
                        </h1>
                        <p className="text-slate-400 mt-1">Managed protection for your browser environment.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full text-sm font-medium border border-emerald-500/20 shadow-sm">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            Scanner Active
                        </span>
                    </div>
                </header>

                {activeTab === 'dashboard' && <DashboardContent isPro={isPro} stats={stats} onUpgrade={handleUpgrade} onCheckClick={setSelectedCheck} />}
                {activeTab === 'logs' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RecentActivity activities={stats.recentActivity} title="Full Activity History" onCheckClick={setSelectedCheck} />
                    </div>
                )}
                {activeTab === 'settings' && <WhitelistSettings />}
            </main>

            <CheckDetailModal check={selectedCheck} onClose={() => setSelectedCheck(null)} />
        </div>
    );
};

const WhitelistSettings = () => {
    const [whitelist, setWhitelist] = useState([]);
    const [settings, setSettings] = useState({
        emailScanningEnabled: true,
        highlightingEnabled: true
    });

    useEffect(() => {
        const fetchSettings = () => {
            chrome.storage?.local.get(['whitelist', 'settings'], (result) => {
                setWhitelist(result.whitelist || []);
                if (result.settings) setSettings(result.settings);
            });
        };
        fetchSettings();
    }, []);

    const handleToggleEmail = () => {
        const updated = { ...settings, emailScanningEnabled: !settings.emailScanningEnabled };
        setSettings(updated);
        chrome.storage.local.set({ settings: updated });
    };

    const handleRemove = (domain) => {
        chrome.storage?.local.get(['whitelist'], (result) => {
            const list = result.whitelist || [];
            const filtered = list.filter(d => d !== domain);
            chrome.storage.local.set({ whitelist: filtered }, () => {
                setWhitelist(filtered);
            });
        });
    };

    return (
        <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
                <CardHeader>
                    <CardTitle>Protection Settings</CardTitle>
                </CardHeader>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div className="flex flex-col">
                            <span className="text-slate-200 font-semibold text-sm">Real-time Email Scanning</span>
                            <span className="text-slate-500 text-xs">Analyze messages in Gmail and Outlook for phishing threats.</span>
                        </div>
                        <button
                            onClick={handleToggleEmail}
                            className={clsx(
                                "w-12 h-6 rounded-full transition-colors relative",
                                settings.emailScanningEnabled ? "bg-indigo-600" : "bg-slate-700"
                            )}>
                            <div className={clsx(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                settings.emailScanningEnabled ? "left-7" : "left-1"
                            )} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div className="flex flex-col">
                            <span className="text-slate-200 font-semibold text-sm">Visual Threat Highlighting</span>
                            <span className="text-slate-500 text-xs">Highlight suspicious phrases directly on the page with explanatory tooltips.</span>
                        </div>
                        <button
                            onClick={() => {
                                const updated = { ...settings, highlightingEnabled: !settings.highlightingEnabled };
                                setSettings(updated);
                                chrome.storage.local.set({ settings: updated });
                            }}
                            className={clsx(
                                "w-12 h-6 rounded-full transition-colors relative",
                                settings.highlightingEnabled || settings.highlightingEnabled === undefined ? "bg-indigo-600" : "bg-slate-700"
                            )}>
                            <div className={clsx(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                settings.highlightingEnabled || settings.highlightingEnabled === undefined ? "left-7" : "left-1"
                            )} />
                        </button>
                    </div>

                    <div className="space-y-4 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-200 font-semibold text-sm">AI Second Opinion</span>
                                    <Badge variant="info" className="text-[9px] py-0 px-1">PRO</Badge>
                                </div>
                                <span className="text-slate-500 text-[11px] leading-tight mt-1 max-w-[300px]">
                                    Use Gemini AI to cross-validate detections and reduce false alerts. No page body or passwords are sent.
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    const updated = { ...settings, aiEnabled: !settings.aiEnabled };
                                    setSettings(updated);
                                    chrome.storage.local.set({ settings: updated });
                                }}
                                className={clsx(
                                    "w-12 h-6 rounded-full transition-colors relative",
                                    settings.aiEnabled ? "bg-indigo-600" : "bg-slate-700"
                                )}>
                                <div className={clsx(
                                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                    settings.aiEnabled ? "left-7" : "left-1"
                                )} />
                            </button>
                        </div>

                        {settings.aiEnabled && (
                            <div className="space-y-3 pt-2 border-t border-slate-700/30">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Gemini API Key</label>
                                    <div className="relative group">
                                        <input
                                            type="password"
                                            value={settings.aiApiKey || ''}
                                            onChange={(e) => {
                                                const updated = { ...settings, aiApiKey: e.target.value };
                                                setSettings(updated);
                                                chrome.storage.local.set({ settings: updated });
                                            }}
                                            placeholder="Enter your API key..."
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors pr-20"
                                        />
                                        <button
                                            onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                                            className="absolute right-1 top-1 text-[9px] font-bold bg-slate-800 text-slate-400 h-6 px-2 rounded-md hover:bg-slate-700 hover:text-white transition-colors">
                                            GET KEY ↗
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-1 block italic text-center">Your key is stored locally and never shared.</span>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Daily Call Ceiling</label>
                                        <span className="text-[9px] text-slate-600">Max AI validations per day</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={settings.aiDailyCeiling || 50}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            const updated = { ...settings, aiDailyCeiling: val };
                                            setSettings(updated);
                                            chrome.storage.local.set({ settings: updated });
                                        }}
                                        className="w-16 bg-slate-900/50 border border-slate-700 rounded-lg py-1 px-2 text-sm text-slate-300 text-center"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div className="flex flex-col">
                            <span className="text-slate-200 font-semibold text-sm">Repair Local Storage</span>
                            <span className="text-slate-500 text-xs">If your scan counter is stuck or logs are empty, use this to nuclear-reset statistics.</span>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20"
                            onClick={() => {
                                if (confirm('This will reset your scan counter and activity logs. Settings and whitelist will be kept. Proceed?')) {
                                    chrome.runtime.sendMessage({ type: MessageTypes.RESET_STATS }, (response) => {
                                        if (response?.success) window.location.reload();
                                    });
                                }
                            }}
                        >
                            <RefreshCw size={14} className="mr-2" />
                            Repair System
                        </Button>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Whitelisted Domains</CardTitle>
                </CardHeader>
                <div className="p-4 space-y-2">
                    {whitelist.length === 0 ? (
                        <p className="text-slate-500 text-sm py-4 text-center italic">No trusted domains added yet.</p>
                    ) : (
                        whitelist.map(domain => (
                            <div key={domain} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-800/50">
                                <span className="text-slate-200 font-medium">{domain}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                    onClick={() => handleRemove(domain)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card className="bg-indigo-500/5 border-indigo-500/10">
                <CardHeader>
                    <CardTitle className="text-indigo-300">Help Improve Scam Alert</CardTitle>
                </CardHeader>
                <div className="p-4">
                    <p className="text-slate-400 text-sm mb-4">
                        Spotted a scam we missed? Or did we flag a safe site? Your feedback helps us protect the entire community.
                    </p>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open('https://github.com/dgarcia891/Scam-Alert/issues/new?title=False+Positive+Report')}
                        >
                            Report False Positive
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-400"
                            onClick={() => window.open('https://github.com/dgarcia891/Scam-Alert/issues/new?title=New+Scam+Report')}
                        >
                            Report Missed Scam
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>
);
