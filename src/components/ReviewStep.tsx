import { useState } from 'react';
import type { CustomDictionaryRule, MappingItem } from '../core/types';
import { MappingList, SanitizedTextPanel } from './MappingPanels';
import { RulesDrawer } from './RulesDrawer';

interface ReviewStepProps {
  anonymizedText: string;
  mappings: MappingItem[];
  dictionaryRules: CustomDictionaryRule[];
  onToggle: (id: string) => void;
  onSplit: (id: string) => void;
  onMerge: (ids: string[]) => void;
  onRulesChange: (rules: CustomDictionaryRule[]) => void;
}

export const ReviewStep = ({
  anonymizedText,
  mappings,
  dictionaryRules,
  onToggle,
  onSplit,
  onMerge,
  onRulesChange,
}: ReviewStepProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="split">
      <SanitizedTextPanel anonymizedText={anonymizedText} />
      <div className="review-right">
        <button type="button" className="edit-rules-button" onClick={() => setDrawerOpen(true)}>
          Edit rules
        </button>
        <MappingList mappings={mappings} onToggle={onToggle} onSplit={onSplit} onMerge={onMerge} />
      </div>
      <RulesDrawer
        open={drawerOpen}
        rules={dictionaryRules}
        onChange={onRulesChange}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};
