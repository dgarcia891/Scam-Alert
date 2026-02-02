import React from 'react';
import { cn } from './Card';

export const Badge = ({ children, variant = 'default', className }) => {
    const variants = {
        default: "bg-slate-700/50 text-slate-300 border-slate-600",
        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        info: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
    };

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
};
