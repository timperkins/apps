'use client';

import { ReactNode } from 'react';
import Frog from './Frog';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps<T = string> {
  tabs: readonly Tab[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  children?: ReactNode;
}

export default function TabGroup<T = string>({
  tabs,
  activeTab,
  onTabChange,
  children,
}: TabsProps<T>) {
  return (
    <div className="flex flex-col pt-xs pb-sm h-full">
      <div className="flex gap-lg mb-sm items-end" role="tablist" aria-label="Tab navigation">
        <Frog className="w-xl h-xl shrink-0" />
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id as T)}
            className={`py-xs text-center font-bold text-md transition-colors cursor-pointer relative ${
              activeTab === tab.id
                ? 'text-white after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[var(--spacing-xxs)] after:bg-secondary after:rounded-[10px]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="flex-1"
        >
          {children}
        </div>
      )}
    </div>
  );
}
