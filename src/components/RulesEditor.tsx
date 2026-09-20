import { useRef, useState } from 'react';
import { isValidRegexPattern, parseImportedRules, validateRuleInput } from '../core/ruleValidation';
import type { CustomDictionaryRule } from '../core/types';

interface RulesEditorProps {
  rules: CustomDictionaryRule[];
  onChange: (rules: CustomDictionaryRule[]) => void;
}

interface RuleFormState {
  termOrPattern: string;
  replacementType: 'FIXED' | 'CATEGORY';
  targetCategory: string;
  isRegex: boolean;
}

const emptyForm = (): RuleFormState => ({
  termOrPattern: '',
  replacementType: 'FIXED',
  targetCategory: '',
  isRegex: false,
});

const newRuleId = (): string => `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const RulesEditor = ({ rules, onChange }: RulesEditorProps) => {
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const error = validateRuleInput(form);
  const regexInvalid = form.isRegex && !isValidRegexPattern(form.termOrPattern) && form.termOrPattern.length > 0;

  const startEdit = (rule: CustomDictionaryRule) => {
    setEditingId(rule.id);
    setForm({
      termOrPattern: rule.termOrPattern,
      replacementType: rule.replacementType,
      targetCategory: rule.targetCategory ?? '',
      isRegex: rule.isRegex,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const submit = () => {
    if (error) return;
    const rule: CustomDictionaryRule = {
      id: editingId ?? newRuleId(),
      termOrPattern: form.termOrPattern.trim(),
      replacementType: form.replacementType,
      targetCategory: form.replacementType === 'CATEGORY' ? form.targetCategory.trim() : undefined,
      isRegex: form.isRegex,
    };
    if (editingId) {
      onChange(rules.map((r) => (r.id === editingId ? rule : r)));
    } else {
      onChange([...rules, rule]);
    }
    cancelEdit();
  };

  const remove = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
    if (editingId === id) cancelEdit();
  };

  const exportRules = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anonymaizer-dictionary-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRules = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const imported = parseImportedRules(text).map((r) => ({ ...r, id: newRuleId() }));
      onChange([...rules, ...imported]);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.');
    }
  };

  return (
    <section className="panel">
      <h2>Custom dictionary rules</h2>

      <div className="rule-form">
        <input
          type="text"
          placeholder="Term or regex pattern"
          value={form.termOrPattern}
          onChange={(e) => setForm({ ...form, termOrPattern: e.target.value })}
        />
        <select
          value={form.replacementType}
          onChange={(e) => setForm({ ...form, replacementType: e.target.value as 'FIXED' | 'CATEGORY' })}
        >
          <option value="FIXED">FIXED (→ CUSTOM)</option>
          <option value="CATEGORY">CATEGORY</option>
        </select>
        {form.replacementType === 'CATEGORY' && (
          <input
            type="text"
            placeholder="Target category, e.g. PROJECT_NAME"
            value={form.targetCategory}
            onChange={(e) => setForm({ ...form, targetCategory: e.target.value })}
          />
        )}
        <label>
          <input
            type="checkbox"
            checked={form.isRegex}
            onChange={(e) => setForm({ ...form, isRegex: e.target.checked })}
          />
          Regex
        </label>
        <button type="button" onClick={submit} disabled={!!error}>
          {editingId ? 'Save' : 'Add rule'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </div>
      {regexInvalid && <p className="form-error">Not a valid regular expression.</p>}
      {!regexInvalid && error && form.termOrPattern && <p className="form-error">{error}</p>}

      {rules.length > 0 && (
        <div className="mapping-table-wrapper">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Term/pattern</th>
              <th>Type</th>
              <th>Category</th>
              <th>Regex</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.termOrPattern}</td>
                <td>{rule.replacementType}</td>
                <td>{rule.replacementType === 'CATEGORY' ? rule.targetCategory : 'CUSTOM'}</td>
                <td>{rule.isRegex ? 'yes' : 'no'}</td>
                <td>
                  <button type="button" onClick={() => startEdit(rule)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(rule.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div className="rule-import-export">
        <button type="button" onClick={exportRules} disabled={rules.length === 0}>
          Export rules (JSON)
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import rules (JSON)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importRules(file);
            e.target.value = '';
          }}
        />
      </div>
      {importError && <p className="form-error">{importError}</p>}
    </section>
  );
};
