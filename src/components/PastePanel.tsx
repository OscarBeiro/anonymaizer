import { t } from '../i18n';
import { useRef, useState } from 'react';
import { convertHtmlToMarkdown } from '../lib/htmlToMarkdown';

interface PastePanelProps {
  rawMarkdown: string;
  onChange: (markdown: string) => void;
  onNewDocument: (markdown: string) => void;
  onCreateRule: (selectedText: string) => void;
}

export const PastePanel = ({ rawMarkdown, onChange, onNewDocument, onCreateRule }: PastePanelProps) => {
  const [selection, setSelection] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A paste into an empty box, or over the whole text, is a new document and
  // discards the previous one. A paste into part of an existing document asks:
  // replacing is the usual intent, inserting stays possible for small edits.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const html = e.clipboardData.getData('text/html');
    const pasted = html ? convertHtmlToMarkdown(html) : e.clipboardData.getData('text/plain');
    const replacesAll = !el.value.trim() || (el.selectionStart === 0 && el.selectionEnd === el.value.length);
    const replace =
      replacesAll ||
      window.confirm(
        t('PastePanel.replace_the_current_document_with_the_pasted') +
          'OK starts a new document: the current text, its placeholders and the AI response are cleared.\n' +
          t('PastePanel.cancel_inserts_the_pasted_text_into_the'),
      );
    e.preventDefault();
    if (replace) {
      onNewDocument(pasted);
      return;
    }
    onChange(el.value.slice(0, el.selectionStart) + pasted + el.value.slice(el.selectionEnd));
  };

  const handleSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd));
  };

  return (
    <section className="panel">
      <h2>{t('PastePanel.1_paste_text')}</h2>
      <textarea
        ref={textareaRef}
        className="panel-textarea"
        placeholder={t('PastePanel.paste_plain_text_or_rich_html_here')}
        value={rawMarkdown}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onSelect={handleSelect}
        onBlur={() => setSelection('')}
      />
      {selection.trim().length > 0 && (
        <button
          type="button"
          className="create-rule-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onCreateRule(selection)}
        >
          {t('PastePanel.create_dictionary_rule_from')}{selection.length > 30 ? `${selection.slice(0, 30)}…` : selection}"
        </button>
      )}
    </section>
  );
};
