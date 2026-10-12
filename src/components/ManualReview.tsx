import { useRef, useState } from 'react';
interface Props { text: string; onRedact: (start: number, end: number, all: boolean) => void; onUndo: () => void; canUndo: boolean }
export function ManualReview({ text, onRedact, onUndo, canUndo }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<[number, number]>([0, 0]);
  const selected = text.slice(selection[0], selection[1]);
  return <section className="panel" aria-label="Review original occurrences">
    <h2>Review original occurrences</h2>
    <label>Original extracted text <textarea ref={input} className="panel-textarea" readOnly value={text} onSelect={() => {
      if (input.current) setSelection([input.current.selectionStart, input.current.selectionEnd]);
    }} /></label>
    <p>Selected: {selected || 'Select text with the mouse or Shift and arrow keys.'}</p>
    <button type="button" disabled={!selected} onClick={() => onRedact(...selection, false)}>Redact selected occurrence</button>
    <button type="button" disabled={!selected} onClick={() => onRedact(...selection, true)}>Redact all matching occurrences</button>
    <button type="button" disabled={!canUndo} onClick={onUndo}>Undo last manual review</button>
    <p>Manual redactions apply to this document. Reusable dictionary rules are a separate setting.</p>
  </section>;
}
