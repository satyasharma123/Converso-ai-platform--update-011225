import React, { useState } from 'react';

interface IntentBadgeProps {
  primaryIntent: string;
  secondaryIntents?: string[];
  confidenceScore: number;
  detectedKeywords?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  showDetails?: boolean;
}

const INTENT_CONFIG = {
  pricing_inquiry: {
    label: 'Pricing',
    color: '#10B981', // Green
    bgColor: '#D1FAE5',
    icon: '💰',
    priority: 'high',
  },
  demo_request: {
    label: 'Demo',
    color: '#3B82F6', // Blue
    bgColor: '#DBEAFE',
    icon: '🎯',
    priority: 'high',
  },
  meeting_request: {
    label: 'Meeting',
    color: '#8B5CF6', // Purple
    bgColor: '#EDE9FE',
    icon: '📅',
    priority: 'high',
  },
  interested: {
    label: 'Interested',
    color: '#F59E0B', // Orange
    bgColor: '#FEF3C7',
    icon: '✨',
    priority: 'medium',
  },
  follow_up: {
    label: 'Follow-up',
    color: '#6B7280', // Gray
    bgColor: '#F3F4F6',
    icon: '🔄',
    priority: 'medium',
  },
  support_question: {
    label: 'Support',
    color: '#6366F1', // Indigo
    bgColor: '#E0E7FF',
    icon: '❓',
    priority: 'low',
  },
  not_interested: {
    label: 'Not Interested',
    color: '#EF4444', // Red
    bgColor: '#FEE2E2',
    icon: '❌',
    priority: 'low',
  },
  other: {
    label: 'Other',
    color: '#9CA3AF', // Gray
    bgColor: '#F9FAFB',
    icon: '📧',
    priority: 'low',
  },
};

export const IntentBadge: React.FC<IntentBadgeProps> = ({
  primaryIntent,
  secondaryIntents = [],
  confidenceScore,
  detectedKeywords = [],
  sentiment,
  showDetails = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const config = INTENT_CONFIG[primaryIntent as keyof typeof INTENT_CONFIG] || INTENT_CONFIG.other;
  const confidencePercent = Math.round(confidenceScore * 100);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Badge */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer hover:shadow-md"
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          border: `1px solid ${config.color}20`,
        }}
      >
        <span className="text-sm">{config.icon}</span>
        <span>{config.label}</span>
        {showDetails && (
          <span className="text-[10px] opacity-70 ml-1">
            {confidencePercent}%
          </span>
        )}
      </div>

      {/* Tooltip on Hover */}
      {isHovered && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-64 p-3 bg-white rounded-lg shadow-xl border border-gray-200 text-sm"
          style={{ pointerEvents: 'none' }}
        >
          <div className="space-y-2">
            {/* Intent Info */}
            <div>
              <div className="font-semibold text-gray-900 mb-1">
                {config.icon} {config.label}
              </div>
              <div className="text-xs text-gray-600">
                Confidence: {confidencePercent}%
              </div>
            </div>

            {/* Detected Keywords */}
            {detectedKeywords.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">
                  Keywords:
                </div>
                <div className="flex flex-wrap gap-1">
                  {detectedKeywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sentiment */}
            {sentiment && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">Sentiment:</span>
                <span
                  className={`font-medium ${
                    sentiment === 'positive'
                      ? 'text-green-600'
                      : sentiment === 'negative'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {sentiment}
                </span>
              </div>
            )}

            {/* Secondary Intents */}
            {secondaryIntents.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-600">
                  Also detected: {secondaryIntents.join(', ')}
                </div>
              </div>
            )}

            {/* AI Indicator */}
            <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-500">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 7H7v6h6V7z" />
                <path
                  fillRule="evenodd"
                  d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z"
                  clipRule="evenodd"
                />
              </svg>
              AI-detected
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

