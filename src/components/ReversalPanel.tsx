import { useState } from 'react';
import { reverseText } from '../core/reverse';
import type { MappingItem } from '../core/types';

interface ReversalPanelProps {
  mappings: MappingItem[];
}

export const ReversalPanel = ({ mappings }: ReversalPanelProps) => {
  const [aiResponse, setAiResponse] = useState('');
  const restored = aiResponse ? reverseText(aiResponse, mappings) : '';

  return (
    <section className="panel">
      <h2>3. Paste AI response &amp; restore</h2>
      <textarea
        className="panel-textarea"
        placeholder="Paste the AI's response here…"
        value={aiResponse}
        onChange={(e) => setAiResponse(e.target.value)}
      />
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
  );
};
