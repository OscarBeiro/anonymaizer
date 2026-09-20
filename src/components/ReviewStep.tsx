import { useState } from 'react';
import type { CustomDictionaryRule, MappingItem } from '../core/types';
import { MappingList, SanitizedTextPanel } from './MappingPanels';
import { RulesEditor } from './RulesEditor';

interface ReviewStepProps {
  anonymizedText: string;
  mappings: MappingItem[];
  dictionaryRules: CustomDictionaryRule[];
  onToggle: (id: string) => void;
  onSplit: (id: string) => void;
  onMerge: (ids: string[]) => void;
  onRulesChange: (rules: CustomDictionaryRule[]) => void;
}

type ReviewSubStep = 'rules' | 'sanitized';

export const ReviewStep = ({
  anonymizedText,
  mappings,
  dictionaryRules,
  onToggle,
  onSplit,
  onMerge,
  onRulesChange,
}: ReviewStepProps) => {
  const [subStep, setSubStep] = useState<ReviewSubStep>('rules');

  return (
    <div className="review-step">
      <nav className="review-sub-nav">
        <button
          type="button"
          className={subStep === 'rules' ? 'review-sub-nav-button review-sub-nav-active' : 'review-sub-nav-button'}
          onClick={() => setSubStep('rules')}
        >
          2.1 Rules
        </button>
        <button
          type="button"
          className={subStep === 'sanitized' ? 'review-sub-nav-button review-sub-nav-active' : 'review-sub-nav-button'}
          onClick={() => setSubStep('sanitized')}
        >
          2.2 Sanitized text
        </button>
      </nav>

      {subStep === 'rules' && <RulesEditor rules={dictionaryRules} onChange={onRulesChange} />}

      {subStep === 'sanitized' && (
        <div className="split">
          <SanitizedTextPanel anonymizedText={anonymizedText} />
          <div className="review-right">
            <MappingList mappings={mappings} onToggle={onToggle} onSplit={onSplit} onMerge={onMerge} />
          </div>
        </div>
      )}
    </div>
  );
};
