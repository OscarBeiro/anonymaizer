import type { MappingItem, MappingSession } from '../core/types';
import { MappingList, SanitizedTextPanel, StatisticsPanel } from './MappingPanels';
import { REVIEW_SUB_STEPS, type ReviewSubStep } from '../lib/wizard';
import type { OutputMode } from '../lib/session';
import type { MoneyRange } from '../core/pseudonymize';

interface ReviewStepProps {
  session: MappingSession;
  anonymizedText: string;
  outputMode: OutputMode;
  onOutputModeChange: (mode: OutputMode) => void;
  moneyRange: MoneyRange;
  onMoneyRangeChange: (range: MoneyRange) => void;
  mappings: MappingItem[];
  onToggle: (id: string) => void;
  onSplit: (id: string) => void;
  onMerge: (ids: string[]) => void;
  categoriesOff: number;
  // P18: the toggles live in the settings menu; 2.1 keeps a way in.
  onOpenDetectionSettings: () => void;
  // Lifted into App (W1) so the Back/Next footer can walk the sub-steps.
  subStep: ReviewSubStep;
  onSubStepChange: (subStep: ReviewSubStep) => void;
}

export const ReviewStep = ({
  session,
  anonymizedText,
  outputMode,
  onOutputModeChange,
  moneyRange,
  onMoneyRangeChange,
  mappings,
  onToggle,
  onSplit,
  onMerge,
  categoriesOff: offCount,
  onOpenDetectionSettings,
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

      {subStep === 'placeholders' && (
        <>
          <p className="detection-settings-link">
            {offCount > 0 && <>{offCount} {offCount === 1 ? 'category' : 'categories'} off · </>}
            <button type="button" className="link-button" onClick={onOpenDetectionSettings}>
              Detection settings and custom rules
            </button>
          </p>
          <MappingList mappings={mappings} onToggle={onToggle} onSplit={onSplit} onMerge={onMerge} />
        </>
      )}

      {subStep === 'sanitized' && (
        <SanitizedTextPanel
          anonymizedText={anonymizedText}
          session={session}
          outputMode={outputMode}
          onOutputModeChange={onOutputModeChange}
          moneyRange={moneyRange}
          onMoneyRangeChange={onMoneyRangeChange}
        />
      )}

      {subStep === 'statistics' && <StatisticsPanel mappings={mappings} />}
    </div>
  );
};
