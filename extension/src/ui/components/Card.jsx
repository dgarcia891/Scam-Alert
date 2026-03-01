import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const Card = ({ children, className, ...props }) => {
    return (
        <div
            className={cn(
                "bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl",
                "hover:border-slate-600 transition-colors duration-300",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className }) => (
    <div className={cn("mb-4 flex items-center justify-between", className)}>
        {children}
    </div>
);

export const CardTitle = ({ children, className }) => (
    <h3 className={cn("text-lg font-semibold text-white tracking-tight", className)}>
        {children}
    </h3>
);
