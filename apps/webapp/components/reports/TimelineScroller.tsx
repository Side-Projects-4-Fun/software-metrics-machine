'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ReportDateWindow } from './reports-store';

interface TimelineScrollerProps {
  windows: (ReportDateWindow | null)[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function formatWindowLabel(window: ReportDateWindow | null): string {
  if (!window) { return 'Default'; }
  if (window.label) { return window.label; }
  return `${window.startDate} – ${window.endDate}`;
}

function formatShortDate(iso: string): string {
  if (!iso) { return ''; }
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function TimelineScroller({
  windows,
  activeIndex,
  onSelect,
}: TimelineScrollerProps) {
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const button = buttonRefs.current.get(activeIndex);
    button?.focus();
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' && activeIndex < windows.length - 1) {
        e.preventDefault();
        onSelect(activeIndex + 1);
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        e.preventDefault();
        onSelect(activeIndex - 1);
      }
    },
    [activeIndex, windows.length, onSelect],
  );

  return (
    <div className="overflow-x-auto pb-2" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2 min-w-max">
        {windows.map((window, index) => {
          const isActive = index === activeIndex;
          const label = formatWindowLabel(window);
          const dateRange =
            window && (window.startDate || window.endDate)
              ? `${formatShortDate(window.startDate)} – ${formatShortDate(window.endDate)}`
              : '';

          return (
            <button
              key={index}
              type="button"
              ref={(el) => {
                if (el) {
                  buttonRefs.current.set(index, el);
                } else {
                  buttonRefs.current.delete(index);
                }
              }}
              onClick={() => onSelect(index)}
              className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <span>{label}</span>
              {dateRange && (
                <span
                  className={`mt-0.5 text-xs ${
                    isActive ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {dateRange}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
