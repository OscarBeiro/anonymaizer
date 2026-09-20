import { useEffect } from 'react';
import { RulesEditor } from './RulesEditor';
import type { CustomDictionaryRule } from '../core/types';

interface RulesDrawerProps {
  open: boolean;
  rules: CustomDictionaryRule[];
  onChange: (rules: CustomDictionaryRule[]) => void;
  onClose: () => void;
}

export const RulesDrawer = ({ open, rules, onChange, onClose }: RulesDrawerProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <RulesEditor rules={rules} onChange={onChange} />
      </div>
    </div>
  );
};
