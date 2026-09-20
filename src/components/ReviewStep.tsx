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

type ReviewSubStep = 'rules' | 'placeholders' | 'sanitized';

const SUB_STEPS: { id: ReviewSubStep; label: string }[] = [
  { id: 'rules', label: '2.1 Rules' },
  { id: 'placeholders', label: '2.2 Placeholders' },
  { id: 'sanitized', label: '2.3 Sanitized text' },
];

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
        {SUB_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === subStep ? 'review-sub-nav-button review-sub-nav-active' : 'review-sub-nav-button'}
            onClick={() => setSubStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {subStep === 'rules' && <RulesEditor rules={dictionaryRules} onChange={onRulesChange} />}

      {subStep === 'placeholders' && (
        <MappingList mappings={mappings} onToggle={onToggle} onSplit={onSplit} onMerge={onMerge} />
      )}

      {subStep === 'sanitized' && <SanitizedTextPanel anonymizedText={anonymizedText} />}
    </div>
  );
};
