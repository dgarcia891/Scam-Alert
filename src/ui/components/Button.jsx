import React from 'react';
import { cn } from './Card'; // Reuse cn utility

export const Button = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
    const variants = {
        primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
        danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20",
        ghost: "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
