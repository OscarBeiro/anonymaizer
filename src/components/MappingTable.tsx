import type { MappingItem } from '../core/types';

interface MappingTableProps {
  mappings: MappingItem[];
  anonymizedText: string;
  onToggle: (id: string) => void;
}

export const MappingTable = ({ mappings, anonymizedText, onToggle }: MappingTableProps) => (
  <section className="panel">
    <h2>2. Review &amp; copy</h2>
    <textarea className="panel-textarea" readOnly value={anonymizedText} />
    <button
      type="button"
      className="copy-button"
      disabled={!anonymizedText}
      onClick={() => navigator.clipboard.writeText(anonymizedText)}
    >
      Copy sanitized text
    </button>

    {mappings.length > 0 && (
      <table className="mapping-table">
        <thead>
          <tr>
            <th>On</th>
            <th>Placeholder</th>
            <th>Category</th>
            <th>Original</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m) => (
            <tr key={m.id} className={m.enabled ? undefined : 'mapping-row-disabled'}>
              <td>
                <input type="checkbox" checked={m.enabled} onChange={() => onToggle(m.id)} />
              </td>
              <td>{m.placeholder}</td>
              <td>{m.category}</td>
              <td>{m.originalText}</td>
              <td>{m.confidence.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
);
