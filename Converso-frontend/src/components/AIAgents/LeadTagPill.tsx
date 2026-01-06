import React from 'react';

interface LeadTagPillProps {
  tag: 'meeting_requested' | 'info_requested' | 'lead';
  isManual?: boolean;
  onRemove?: () => void;
}

const TAG_CONFIG = {
  meeting_requested: {
    label: 'Meeting Requested',
    color: '#10B981',
    bgColor: '#D1FAE5',
  },
  info_requested: {
    label: 'Info Requested',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  lead: {
    label: 'Lead',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
  },
};

export const LeadTagPill: React.FC<LeadTagPillProps> = ({
  tag,
  isManual = false,
  onRemove,
}) => {
  const config = TAG_CONFIG[tag];

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
    >
      <span>{config.label}</span>
      
      {/* AI/Manual Indicator */}
      <span className="text-[9px] opacity-60" title={isManual ? 'Manually tagged' : 'AI-tagged'}>
        {isManual ? '✋' : '🤖'}
      </span>

      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label="Remove tag"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

