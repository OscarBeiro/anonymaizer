import { useEffect, useState } from 'react';
import './App.css';
import { MappingTable } from './components/MappingTable';
import { PastePanel } from './components/PastePanel';
import { ReversalPanel } from './components/ReversalPanel';
import { RulesEditor } from './components/RulesEditor';
import { anonymize } from './core/anonymize';
import { applyEnabledMappings } from './core/apply';
import type { CustomDictionaryRule, MappingItem, MappingSession } from './core/types';
import {
  loadDictionaryRules,
  loadSession,
  newSessionId,
  saveDictionaryRules,
  saveSession,
} from './lib/session';

const emptySession = (): MappingSession => ({
  sessionId: newSessionId(),
  createdAt: new Date().toISOString(),
  inputType: 'PASTE',
  originalFormat: 'raw_text',
  mappings: [],
  rawMarkdown: '',
  anonymizedMarkdown: '',
});

function App() {
  const [session, setSession] = useState<MappingSession>(() => loadSession() ?? emptySession());
  const [dictionaryRules, setDictionaryRules] = useState<CustomDictionaryRule[]>(() => loadDictionaryRules());

  useEffect(() => saveSession(session), [session]);
  useEffect(() => saveDictionaryRules(dictionaryRules), [dictionaryRules]);

  const runAnonymize = (rawMarkdown: string, rules: CustomDictionaryRule[]) => {
    const { mappings, anonymizedText } = anonymize(rawMarkdown, rules);
    setSession((prev) => ({ ...prev, rawMarkdown, mappings, anonymizedMarkdown: anonymizedText }));
  };

  const handlePasteChange = (rawMarkdown: string) => {
    runAnonymize(rawMarkdown, dictionaryRules);
  };

  const handleToggle = (id: string) => {
    setSession((prev) => {
      const mappings: MappingItem[] = prev.mappings.map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m,
      );
      const anonymizedMarkdown = applyEnabledMappings(prev.rawMarkdown, mappings);
      return { ...prev, mappings, anonymizedMarkdown };
    });
  };

  // The next free counter for a category, so a manual split/merge mints an
  // id/placeholder that can't collide with one auto-detection already used.
  const nextCounter = (mappings: MappingItem[], category: string): number => {
    const used = mappings
      .filter((m) => m.category === category)
      .map((m) => Number(m.id.slice(m.id.lastIndexOf('_') + 1)))
      .filter((n) => !Number.isNaN(n));
    return (used.length ? Math.max(...used) : 0) + 1;
  };

  // P7c manual override: demotes a clustered NAME mapping back into one
  // mapping per surface spelling. Session-level only, same as handleToggle —
  // it doesn't feed back into the detector, so re-pasting the same text
  // re-clusters from scratch.
  const handleSplit = (id: string) => {
    setSession((prev) => {
      const target = prev.mappings.find((m) => m.id === id);
      if (!target || target.variants.length <= 1) return prev;

      const remaining = prev.mappings.filter((m) => m.id !== id);
      let counter = nextCounter(prev.mappings, target.category);
      const split: MappingItem[] = target.variants.map((variant) => ({
        id: `${target.category}_${counter}`,
        placeholder: `[${target.category}_${counter++}]`,
        originalText: variant,
        category: target.category,
        confidence: target.confidence,
        source: target.source,
        enabled: target.enabled,
        variants: [variant],
      }));

      const mappings = [...remaining, ...split];
      const anonymizedMarkdown = applyEnabledMappings(prev.rawMarkdown, mappings);
      return { ...prev, mappings, anonymizedMarkdown };
    });
  };

  // Mirror of handleSplit: folds two or more same-category mappings into one,
  // keeping every variant from every mapping merged. The longest variant
  // becomes canonical (originalText), matching entities.ts's own convention.
  const handleMerge = (ids: string[]) => {
    setSession((prev) => {
      const targets = prev.mappings.filter((m) => ids.includes(m.id));
      if (targets.length < 2) return prev;
      if (targets.some((t) => t.category !== targets[0].category)) return prev;

      const remaining = prev.mappings.filter((m) => !ids.includes(m.id));
      const variants = [...new Set(targets.flatMap((t) => t.variants))].sort(
        (a, b) => b.length - a.length,
      );
      const first = targets[0];
      const merged: MappingItem = { ...first, originalText: variants[0], variants };

      const mappings = [...remaining, merged];
      const anonymizedMarkdown = applyEnabledMappings(prev.rawMarkdown, mappings);
      return { ...prev, mappings, anonymizedMarkdown };
    });
  };

  const updateRules = (rules: CustomDictionaryRule[]) => {
    setDictionaryRules(rules);
    runAnonymize(session.rawMarkdown, rules);
  };

  const handleCreateRule = (selectedText: string) => {
    const trimmed = selectedText.trim();
    if (!trimmed) return;
    updateRules([
      ...dictionaryRules,
      { id: `rule_${Date.now()}`, termOrPattern: trimmed, replacementType: 'FIXED', isRegex: false },
    ]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          AnonymAIzer <span className="app-version">v{__APP_VERSION__}</span>
        </h1>
        <p>Sanitize text before sending it to an AI, restore it after. Nothing leaves your browser.</p>
      </header>

      <main className="app-panels">
        <PastePanel
          rawMarkdown={session.rawMarkdown}
          onChange={handlePasteChange}
          onCreateRule={handleCreateRule}
        />
        <MappingTable
          mappings={session.mappings}
          anonymizedText={session.anonymizedMarkdown}
          onToggle={handleToggle}
          onSplit={handleSplit}
          onMerge={handleMerge}
        />
        <ReversalPanel mappings={session.mappings} />
      </main>

      <RulesEditor rules={dictionaryRules} onChange={updateRules} />
    </div>
  );
}

export default App;
