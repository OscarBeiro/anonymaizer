import { useState } from 'react';
import { countByCategory } from '../core/stats';
import { PLACEHOLDER_PATTERN } from '../core/export/textExport';
import type { MappingItem, MappingSession } from '../core/types';
import type { OutputMode } from '../lib/session';
import { MAX_MONEY_PERCENT, type MoneyRange, type PseudonymLang } from '../core/pseudonymize';
import { SaveAsControl } from './SaveAsControl';

// S3: a component rather than a helper so QuickResult can share it.
export const HighlightedText = ({ text }: { text: string }) => (
  <>
    {text.split(PLACEHOLDER_PATTERN).map((segment, i) =>
      i % 2 === 1 ? (
        <mark className="sanitized-placeholder" key={i}>
          {segment}
        </mark>
      ) : (
        segment
      ),
    )}
  </>
);

interface SanitizedTextPanelProps {
  anonymizedText: string;
  session: MappingSession;
  outputMode: OutputMode;
  onOutputModeChange: (mode: OutputMode) => void;
  moneyRange: MoneyRange;
  onMoneyRangeChange: (range: MoneyRange) => void;
  pseudonymLang: PseudonymLang;
  onPseudonymLangChange: (lang: PseudonymLang) => void;
}

// An emptied field is stored as NaN; normalizeMoneyRange gives it the default when rendering.
const percentInput = (label: string, value: number, onChange: (v: number) => void) => (
  <label>
    {label}
    <input
      type="number"
      min={0}
      max={MAX_MONEY_PERCENT}
      step={1}
      value={Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
    />
  </label>
);

export const SanitizedTextPanel = ({
  anonymizedText,
  session,
  outputMode,
  onOutputModeChange,
  moneyRange,
  onMoneyRangeChange,
  pseudonymLang,
  onPseudonymLangChange,
}: SanitizedTextPanelProps) => (
  <section className="panel">
    <h2>Sanitized text</h2>
    <fieldset className="output-mode">
      <legend>Output</legend>
      {(['placeholders', 'realistic'] as const).map((mode) => (
        <label key={mode}>
          <input
            type="radio"
            name="output-mode"
            checked={outputMode === mode}
            onChange={() => onOutputModeChange(mode)}
          />
          {mode === 'placeholders' ? 'Placeholders' : 'Realistic'}
        </label>
      ))}
    </fieldset>
    {outputMode === 'realistic' && (
      <p className="output-mode-warning" role="note">
        Realistic output swaps in fake names, companies and amounts, and those cannot be restored in step 3. Use
        Placeholders for text you will send to an AI and restore afterwards.
      </p>
    )}
    <label className="pseudonym-lang">
      Fake names in{' '}
      <select value={pseudonymLang} onChange={(e) => onPseudonymLangChange(e.target.value as PseudonymLang)}>
        <option value="es">Spanish</option>
        <option value="en">English</option>
      </select>
    </label>
    <div className="money-range">
      <span>Amounts vary by ±</span>
      {percentInput('from', moneyRange.min, (min) => onMoneyRangeChange({ ...moneyRange, min }))}
      {percentInput('to', moneyRange.max, (max) => onMoneyRangeChange({ ...moneyRange, max }))}
      <span>%</span>
      {outputMode !== 'realistic' && <em> (applies to Realistic output)</em>}
    </div>
    <div className="panel-textarea sanitized-highlight"><HighlightedText text={anonymizedText} /></div>
    <div className="panel-actions">
      <button
        type="button"
        className="copy-button"
        disabled={!anonymizedText}
        onClick={() => navigator.clipboard.writeText(anonymizedText)}
      >
        Copy sanitized text
      </button>
      <SaveAsControl text={anonymizedText} session={session} side="sanitized" />
    </div>
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

interface StatisticsPanelProps {
  mappings: MappingItem[];
}

export const StatisticsPanel = ({ mappings }: StatisticsPanelProps) => {
  // Only enabled mappings actually end up anonymized in the sanitized text —
  // a toggled-off false positive isn't a real anonymization and shouldn't
  // inflate the count.
  const counts = countByCategory(mappings.filter((m) => m.enabled));

  return (
    <section className="panel">
      <h2>Statistics</h2>
      {counts.length === 0 ? (
        <p className="empty-hint">Nothing detected yet.</p>
      ) : (
        <div className="stats-grid">
          {counts.map(({ category, count }) => (
            <div className="stat-card" key={category}>
              <span className="stat-count">{count}</span>
              <span className="stat-category">{category}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
