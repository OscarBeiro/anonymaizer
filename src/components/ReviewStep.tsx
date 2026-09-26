import type { CustomDictionaryRule, MappingItem, MappingSession } from '../core/types';
import { MappingList, SanitizedTextPanel, StatisticsPanel } from './MappingPanels';
import { RulesEditor } from './RulesEditor';
import { CategoryToggles } from './CategoryToggles';
import type { CategorySettings } from '../core/categories';
import { REVIEW_SUB_STEPS, type ReviewSubStep } from '../lib/wizard';
import type { OutputMode } from '../lib/session';

interface ReviewStepProps {
  session: MappingSession;
  anonymizedText: string;
  outputMode: OutputMode;
  onOutputModeChange: (mode: OutputMode) => void;
  mappings: MappingItem[];
  dictionaryRules: CustomDictionaryRule[];
  onToggle: (id: string) => void;
  onSplit: (id: string) => void;
  onMerge: (ids: string[]) => void;
  onRulesChange: (rules: CustomDictionaryRule[]) => void;
  categorySettings: CategorySettings;
  onCategorySettingsChange: (settings: CategorySettings) => void;
  // Lifted into App (W1) so the Back/Next footer can walk the sub-steps.
  subStep: ReviewSubStep;
  onSubStepChange: (subStep: ReviewSubStep) => void;
}

export const ReviewStep = ({
  session,
  anonymizedText,
  outputMode,
  onOutputModeChange,
  mappings,
  dictionaryRules,
  onToggle,
  onSplit,
  onMerge,
  onRulesChange,
  categorySettings,
  onCategorySettingsChange,
  subStep,
  onSubStepChange,
}: ReviewStepProps) => {

  return (
    <div className="review-step">
      <nav className="review-sub-nav">
        {REVIEW_SUB_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === subStep ? 'review-sub-nav-button review-sub-nav-active' : 'review-sub-nav-button'}
            onClick={() => onSubStepChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {subStep === 'rules' && <RulesEditor rules={dictionaryRules} onChange={onRulesChange} />}

      {subStep === 'placeholders' && (
        <>
          <CategoryToggles
            settings={categorySettings}
            rules={dictionaryRules}
            mappings={mappings}
            onChange={onCategorySettingsChange}
          />
          <MappingList mappings={mappings} onToggle={onToggle} onSplit={onSplit} onMerge={onMerge} />
        </>
      )}

      {subStep === 'sanitized' && (
        <SanitizedTextPanel
          anonymizedText={anonymizedText}
          session={session}
          outputMode={outputMode}
          onOutputModeChange={onOutputModeChange}
        />
      )}

      {subStep === 'statistics' && <StatisticsPanel mappings={mappings} />}
    </div>
  );
};
