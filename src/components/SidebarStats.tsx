import { summarizeMappings } from '../core/stats';
import type { MappingSession } from '../core/types';

interface SidebarStatsProps {
  session: MappingSession;
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

// Live summary under the step nav; the detailed view stays in Review → Statistics.
export const SidebarStats = ({ session }: SidebarStatsProps) => {
  if (session.mappings.length === 0) return null;
  const { enabled, disabled, byCategory } = summarizeMappings(session.mappings);

  return (
    <section className="sidebar-stats" aria-label="Session summary">
      {session.inputType === 'FILE' && session.fileName && (
        <p className="sidebar-stats-file" title={session.fileName}>
          <span className="sidebar-stats-format">{FORMAT_LABELS[session.originalFormat]}</span> {session.fileName}
        </p>
      )}
      <p className="sidebar-stats-total">
        <strong>{enabled}</strong> masked
      </p>
      {disabled > 0 && (
        <p className="sidebar-stats-total sidebar-stats-muted">
          <strong>{disabled}</strong> unticked
        </p>
      )}
      {byCategory.length > 0 && (
        <ul className="sidebar-stats-list">
          {byCategory.map(({ category, count }) => (
            <li key={category}>
              <span className="sidebar-stats-category">{category}</span>
              <span className="sidebar-stats-count">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
