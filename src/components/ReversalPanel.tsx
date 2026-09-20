import { useState } from 'react';
import { reverseText } from '../core/reverse';
import type { MappingItem } from '../core/types';

interface ReversalPanelProps {
  mappings: MappingItem[];
}

type RestoreSubStep = 'response' | 'restored';

const SUB_STEPS: { id: RestoreSubStep; label: string }[] = [
  { id: 'response', label: '3.1 AI response' },
  { id: 'restored', label: '3.2 Restored text' },
];

export const ReversalPanel = ({ mappings }: ReversalPanelProps) => {
  const [aiResponse, setAiResponse] = useState('');
  const [subStep, setSubStep] = useState<RestoreSubStep>('response');
  const restored = aiResponse ? reverseText(aiResponse, mappings) : '';

  return (
    <div className="restore-step">
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

      {subStep === 'response' && (
        <section className="panel">
          <h2>AI response</h2>
          <textarea
            className="panel-textarea"
            placeholder="Paste the AI's response here…"
            value={aiResponse}
            onChange={(e) => setAiResponse(e.target.value)}
          />
          <button
            type="button"
            className="restore-next-button"
            disabled={!aiResponse}
            onClick={() => setSubStep('restored')}
          >
            Restore →
          </button>
        </section>
      )}

      {subStep === 'restored' && (
        <section className="panel">
          <h2>Restored text</h2>
          <textarea className="panel-textarea" readOnly value={restored} placeholder="Restored text appears here…" />
          <button
            type="button"
            className="copy-button"
            disabled={!restored}
            onClick={() => navigator.clipboard.writeText(restored)}
          >
            Copy restored text
          </button>
        </section>
      )}
    </div>
  );
};
