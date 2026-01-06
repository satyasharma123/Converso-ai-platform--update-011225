import React, { useState } from 'react';
import { LeadTagPill } from './LeadTagPill';

interface LeadTagSelectorProps {
  conversationId: string;
  workspaceId: string;
  currentTags: string[];
  isManuallyTagged: boolean;
  onTagsUpdate: (tags: string[]) => void;
}

const AVAILABLE_TAGS = [
  { value: 'meeting_requested', label: 'Meeting Requested' },
  { value: 'info_requested', label: 'Info Requested' },
  { value: 'lead', label: 'Lead' },
];

export const LeadTagSelector: React.FC<LeadTagSelectorProps> = ({
  conversationId,
  workspaceId,
  currentTags,
  isManuallyTagged,
  onTagsUpdate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = async (tag: string) => {
    if (currentTags.includes(tag)) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/apply-manual-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          tags: [...currentTags, tag],
        }),
      });

      if (response.ok) {
        onTagsUpdate([...currentTags, tag]);
        setIsOpen(false);
      } else {
        console.error('Failed to add tag');
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    setIsLoading(true);
    try {
      const newTags = currentTags.filter((t) => t !== tagToRemove);
      
      const response = await fetch('/api/agents/apply-manual-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          tags: newTags.length > 0 ? newTags : null,
        }),
      });

      if (response.ok) {
        onTagsUpdate(newTags);
      } else {
        console.error('Failed to remove tag');
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Current Tags */}
      <div className="flex flex-wrap items-center gap-2">
        {currentTags.map((tag) => (
          <LeadTagPill
            key={tag}
            tag={tag as any}
            isManual={isManuallyTagged}
            onRemove={() => handleRemoveTag(tag)}
          />
        ))}

        {/* Add Tag Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          disabled={isLoading}
        >
          + Add Tag
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
          {AVAILABLE_TAGS.map((tag) => {
            const isSelected = currentTags.includes(tag.value);
            
            return (
              <button
                key={tag.value}
                onClick={() => handleAddTag(tag.value)}
                disabled={isSelected || isLoading}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                  isSelected ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{tag.label}</span>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}

          {/* Close button */}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

