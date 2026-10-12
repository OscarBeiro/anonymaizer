import { t } from '../i18n';
import { useRef, useState } from 'react';
import { isValidRegexPattern, parseImportedRules, validateRuleInput } from '../core/ruleValidation';
import type { CustomDictionaryRule } from '../core/types';
import { downloadFile } from '../lib/download';

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

  const error = validateRuleInput(form, rules, editingId ?? undefined);
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

  const exportRules = () =>
    downloadFile('anonymaizer-dictionary-rules.json', JSON.stringify(rules, null, 2), 'application/json');

  const importRules = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const imported = parseImportedRules(text, rules).map((r) => ({ ...r, id: newRuleId() }));
      onChange([...rules, ...imported]);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : t('RulesEditor.import_failed'));
    }
  };

  return (
    <section className="panel">
      <h2>{t('RulesEditor.custom_dictionary_rules')}</h2>

      <div className="rule-form">
        <input
          type="text"
          placeholder={t('RulesEditor.term_or_regex_pattern')}
          value={form.termOrPattern}
          onChange={(e) => setForm({ ...form, termOrPattern: e.target.value })}
        />
        <select
          value={form.replacementType}
          onChange={(e) => setForm({ ...form, replacementType: e.target.value as 'FIXED' | 'CATEGORY' })}
        >
          <option value="FIXED">{t('RulesEditor.fixed_custom')}</option>
          <option value="CATEGORY">{t('RulesEditor.category')}</option>
        </select>
        {form.replacementType === 'CATEGORY' && (
          <input
            type="text"
            placeholder={t('RulesEditor.target_category_e_g_project_name')}
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
          {t('RulesEditor.regex')}</label>
        <button type="button" onClick={submit} disabled={!!error}>
          {editingId ? 'Save' : t('RulesEditor.add_rule')}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            {t('RulesEditor.cancel')}</button>
        )}
      </div>
      {regexInvalid && <p className="form-error">{t('RulesEditor.not_a_valid_regular_expression')}</p>}
      {!regexInvalid && error && form.termOrPattern && <p className="form-error">{error}</p>}

      {rules.length > 0 && (
        <div className="mapping-table-wrapper">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>{t('RulesEditor.term_pattern')}</th>
              <th>{t('RulesEditor.type')}</th>
              <th>{t('RulesEditor.category_2')}</th>
              <th>{t('RulesEditor.regex_2')}</th>
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
                    {t('RulesEditor.edit')}</button>
                  <button type="button" onClick={() => remove(rule.id)}>
                    {t('RulesEditor.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div className="rule-import-export">
        <button type="button" onClick={exportRules} disabled={rules.length === 0}>
          {t('RulesEditor.export_rules_json')}</button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {t('RulesEditor.import_rules_json')}</button>
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
