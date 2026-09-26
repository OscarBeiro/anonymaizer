import { COMPANY_ACRONYM, isCategoryOn, toggleableCategories, type CategorySettings } from '../core/categories';
import { countByCategory } from '../core/stats';
import type { CustomDictionaryRule, MappingItem } from '../core/types';

interface CategoryTogglesProps {
  settings: CategorySettings;
  rules: CustomDictionaryRule[];
  mappings: MappingItem[];
  onChange: (settings: CategorySettings) => void;
}

const LABELS: Record<string, string> = {
  [COMPANY_ACRONYM]: 'COMPANY (ALL-CAPS guesses)',
};

// P11: collapsible, closed by default — a user who never changes the
// defaults gains no click; one who does finds it above the table it governs.
export const CategoryToggles = ({ settings, rules, mappings, onChange }: CategoryTogglesProps) => {
  const counts = new Map(countByCategory(mappings).map((c) => [c.category, c.count]));
  const categories = toggleableCategories(rules);
  const offCount = categories.filter((c) => !isCategoryOn(settings, c)).length;

  return (
    <details className="category-toggles">
      <summary>
        Categories{offCount > 0 && <span className="category-toggles-off"> · {offCount} off</span>}
      </summary>
      <ul className="category-toggles-list">
        {categories.map((category) => (
          <li key={category}>
            <label>
              <input
                type="checkbox"
                checked={isCategoryOn(settings, category)}
                onChange={(e) => onChange({ ...settings, [category]: e.target.checked })}
              />
              <span className="category-toggles-name">{LABELS[category] ?? category}</span>
              {/* The acronym guesses are COMPANY mappings; they count there. */}
              {category !== COMPANY_ACRONYM && <span className="category-toggles-count">{counts.get(category) ?? 0}</span>}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="link-button" disabled={offCount === 0 && Object.keys(settings).length === 0} onClick={() => onChange({})}>
        Restore defaults
      </button>
    </details>
  );
};
