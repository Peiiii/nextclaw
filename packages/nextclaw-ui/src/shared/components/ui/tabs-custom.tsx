import React from 'react';
import { cn } from '@/shared/lib/utils';
import { formatNumber } from '@/shared/lib/i18n';

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
        <div className={cn('flex items-center gap-6 border-b border-gray-200/60 mb-6', className)}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'relative pb-3 text-[14px] font-medium transition-all duration-fast flex items-center gap-1.5',
                            isActive
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-900'
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={cn(
                                'text-[11px] font-medium',
                                isActive ? 'text-gray-500' : 'text-gray-500'
                            )}>{formatNumber(tab.count)}</span>
                        )}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
