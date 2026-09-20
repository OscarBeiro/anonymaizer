import { useEffect, useState } from 'react';
import './App.css';
import { MappingTable } from './components/MappingTable';
import { PastePanel } from './components/PastePanel';
import { ReversalPanel } from './components/ReversalPanel';
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

  const handleCreateRule = (selectedText: string) => {
    const trimmed = selectedText.trim();
    if (!trimmed) return;
    const rules: CustomDictionaryRule[] = [
      ...dictionaryRules,
      { id: `rule_${Date.now()}`, termOrPattern: trimmed, replacementType: 'FIXED', isRegex: false },
    ];
    setDictionaryRules(rules);
    runAnonymize(session.rawMarkdown, rules);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AnonymAIzer</h1>
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
        />
        <ReversalPanel mappings={session.mappings} />
      </main>
    </div>
  );
}

export default App;
