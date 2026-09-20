import { type ReactNode, useState } from 'react';
import type { MappingItem } from '../core/types';

const PLACEHOLDER_PATTERN = /(\[\[[A-Z][A-Z0-9_]*\]\])/g;

const renderHighlighted = (text: string): ReactNode[] =>
  text.split(PLACEHOLDER_PATTERN).map((segment, i) =>
    i % 2 === 1 ? (
      <mark className="sanitized-placeholder" key={i}>
        {segment}
      </mark>
    ) : (
      segment
    ),
  );

interface SanitizedTextPanelProps {
  anonymizedText: string;
}

export const SanitizedTextPanel = ({ anonymizedText }: SanitizedTextPanelProps) => (
  <section className="panel">
    <h2>Sanitized text</h2>
    <div className="panel-textarea sanitized-highlight">{renderHighlighted(anonymizedText)}</div>
    <button
      type="button"
      className="copy-button"
      disabled={!anonymizedText}
      onClick={() => navigator.clipboard.writeText(anonymizedText)}
    >
      Copy sanitized text
    </button>
  </section>
);

interface MappingListProps {
  mappings: MappingItem[];
  onToggle: (id: string) => void;
  onSplit: (id: string) => void;
  onMerge: (ids: string[]) => void;
}

export const MappingList = ({ mappings, onToggle, onSplit, onMerge }: MappingListProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCategories = new Set(
    mappings.filter((m) => selected.has(m.id)).map((m) => m.category),
  );
  const canMerge = selected.size >= 2 && selectedCategories.size === 1;

  const handleMerge = () => {
    onMerge([...selected]);
    setSelected(new Set());
  };

  return (
    <section className="panel">
      <h2>Placeholders</h2>
      {mappings.length === 0 ? (
        <p className="empty-hint">Nothing detected yet.</p>
      ) : (
        <>
          <button type="button" className="merge-button" disabled={!canMerge} onClick={handleMerge}>
            Merge selected ({selected.size})
          </button>
          <div className="mapping-table-wrapper">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>On</th>
                <th>Merge?</th>
                <th>Placeholder</th>
                <th>Category</th>
                <th>Original</th>
                <th>Confidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className={m.enabled ? undefined : 'mapping-row-disabled'}>
                  <td>
                    <input type="checkbox" checked={m.enabled} onChange={() => onToggle(m.id)} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleSelected(m.id)}
                      aria-label={`Select ${m.placeholder} to merge`}
                    />
                  </td>
                  <td>{m.placeholder}</td>
                  <td>{m.category}</td>
                  <td>
                    {m.originalText}
                    {m.variants.length > 1 && (
                      <div className="mapping-variants">
                        also matches: {m.variants.slice(1).join(', ')}
                      </div>
                    )}
                  </td>
                  <td>{m.confidence.toFixed(1)}</td>
                  <td>
                    {m.variants.length > 1 && (
                      <button
                        type="button"
                        className="split-button"
                        onClick={() => onSplit(m.id)}
                        title="Split back into one placeholder per spelling"
                      >
                        Split
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
};
