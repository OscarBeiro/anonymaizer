import { summarizeMappings } from '../core/stats';
import type { MappingSession } from '../core/types';

interface SidebarStatsProps {
  session: MappingSession;
  onOpen: () => void;
}

const FORMAT_LABELS: Record<MappingSession['originalFormat'], string> = {
  raw_text: 'Text',
  docx: 'DOCX',
  pdf: 'PDF',
  odt: 'ODT',
  csv: 'CSV',
  xlsx: 'XLSX',
  eml: 'EML',
  pptx: 'PPTX',
};

// Live summary under the step nav; clicking it opens 2.2 Placeholders; the detailed view stays in Review → Statistics.
export const SidebarStats = ({ session, onOpen }: SidebarStatsProps) => {
  if (session.mappings.length === 0) return null;
  const { enabled, disabled, byCategory } = summarizeMappings(session.mappings);

  return (
    <button type="button" className="sidebar-stats" title="Open 2.2 Placeholders" onClick={onOpen}>
      {session.inputType === 'FILE' && session.fileName && (
        <span className="sidebar-stats-file" title={session.fileName}>
          <span className="sidebar-stats-format">{FORMAT_LABELS[session.originalFormat]}</span> {session.fileName}
        </span>
      )}
      <span className="sidebar-stats-total">
        <strong>{enabled}</strong> masked
      </span>
      {disabled > 0 && (
        <span className="sidebar-stats-total sidebar-stats-muted">
          <strong>{disabled}</strong> unticked
        </span>
      )}
      {byCategory.length > 0 && (
        <span className="sidebar-stats-list">
          {byCategory.map(({ category, count }) => (
            <span className="sidebar-stats-row" key={category}>
              <span className="sidebar-stats-category">{category}</span>
              <span className="sidebar-stats-count">{count}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
};
