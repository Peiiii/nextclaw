import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
    id: string;
    label: string;
    count?: number;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (id: string) => void;
    className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
    return (
        <div className={cn('flex items-center gap-8 border-b border-gray-200 mb-8', className)}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'relative pb-4 text-[15px] font-semibold transition-all duration-fast flex items-center gap-2',
                            isActive
                                ? 'text-primary'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="text-[11px] font-medium text-gray-400">{tab.count.toLocaleString()}</span>
                        )}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in slide-in-from-left-2 duration-300" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
