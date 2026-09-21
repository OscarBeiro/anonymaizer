import { useEffect, useRef, useState } from 'react';
import './App.css';
import { IngestStep } from './components/IngestStep';
import { NerToggle } from './components/NerToggle';
import { ReversalPanel } from './components/ReversalPanel';
import { ReviewStep } from './components/ReviewStep';
import { StepNav } from './components/StepNav';
import { anonymize, anonymizeWithNer } from './core/anonymize';
import { applyEnabledMappings } from './core/apply';
import type { CustomDictionaryRule, DocumentFormat, MappingItem, MappingSession } from './core/types';
import './lib/parsers';
import { NerClient, type NerStatus } from './lib/nerClient';
import { deleteModelCache } from './workers/nerModelCache';
import {
  loadDictionaryRules,
  loadSession,
  loadStep,
  newSessionId,
  saveDictionaryRules,
  saveSession,
  saveStep,
  type WizardStep,
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
  const [step, setStep] = useState<WizardStep>(() => loadStep());
  // Non-blocking parser warnings for the document currently imported
  // (dropped images, an unreadable sheet). Deliberately not persisted with
  // the session — they describe one import action, not the mapping.
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // P7d: opt-in only, never loaded or run automatically. A ref (not state)
  // for the client itself — it owns a real Worker, which must survive
  // re-renders and be created exactly once.
  const nerClientRef = useRef<NerClient | null>(null);
  const [nerEnabled, setNerEnabled] = useState(false);
  const [nerStatus, setNerStatus] = useState<NerStatus>({ state: 'idle' });

  useEffect(() => saveSession(session), [session]);
  useEffect(() => saveDictionaryRules(dictionaryRules), [dictionaryRules]);
  useEffect(() => saveStep(step), [step]);
  useEffect(() => () => nerClientRef.current?.terminate(), []);

  const runAnonymize = (rawMarkdown: string, rules: CustomDictionaryRule[]) => {
    const { mappings, anonymizedText } = anonymize(rawMarkdown, rules);
    setSession((prev) => ({ ...prev, rawMarkdown, mappings, anonymizedMarkdown: anonymizedText }));
  };

  const handleFileImport = (
    rawMarkdown: string,
    format: DocumentFormat,
    fileName: string,
    warnings: string[],
  ) => {
    setImportWarnings(warnings);
    const { mappings, anonymizedText } = anonymize(rawMarkdown, dictionaryRules);
    setSession((prev) => ({
      ...prev,
      rawMarkdown,
      mappings,
      anonymizedMarkdown: anonymizedText,
      inputType: 'FILE',
      fileName,
      originalFormat: format,
    }));
  };

  const runNerScan = async (rawMarkdown: string, rules: CustomDictionaryRule[]) => {
    nerClientRef.current ??= new NerClient();
    try {
      const entities = await nerClientRef.current.runNer(rawMarkdown, setNerStatus);
      const { mappings, anonymizedText } = anonymizeWithNer(rawMarkdown, rules, entities);
      setSession((prev) => ({ ...prev, rawMarkdown, mappings, anonymizedMarkdown: anonymizedText }));
    } catch {
      // nerStatus is already set to the error by the client's onStatus
      // callback — the M1/P7a-c mapping stays in place, nothing to undo.
    }
  };

  const handlePasteChange = (rawMarkdown: string) => {
    // Editing the text by hand makes the imported document's warnings stale.
    setImportWarnings([]);
    // Once the model is loaded and opted into, every edit re-scans with it
    // automatically — no separate "Re-scan" button to remember to press.
    // Before that (not enabled, or still downloading) this falls back to
    // the instant M1/P7a-c regex heuristics.
    if (nerEnabled && nerStatus.state === 'ready') {
      void runNerScan(rawMarkdown, dictionaryRules);
    } else {
      runAnonymize(rawMarkdown, dictionaryRules);
    }
  };

  const handleNerToggle = (checked: boolean) => {
    setNerEnabled(checked);
    if (checked) {
      void runNerScan(session.rawMarkdown, dictionaryRules);
    } else {
      // Falls back to the instant M1/P7a-c heuristics — the model stays
      // loaded (in the worker and in IndexedDB) for a fast re-enable.
      runAnonymize(session.rawMarkdown, dictionaryRules);
    }
  };

  // Distinct from handleNerToggle(false): turning off just stops using the
  // model this session but keeps it cached for an instant re-enable. This
  // actually frees the ~104MB — the worker (holding the loaded model in
  // memory) is torn down and the IndexedDB cache cleared, so the next
  // enable is a full re-download.
  const handleDeleteModel = () => {
    nerClientRef.current?.terminate();
    nerClientRef.current = null;
    setNerEnabled(false);
    setNerStatus({ state: 'idle' });
    runAnonymize(session.rawMarkdown, dictionaryRules);
    void deleteModelCache();
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
        placeholder: `[[${target.category}_${String(counter++).padStart(3, '0')}]]`,
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
    if (nerEnabled && nerStatus.state === 'ready') {
      void runNerScan(session.rawMarkdown, rules);
    } else {
      runAnonymize(session.rawMarkdown, rules);
    }
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
      <aside className="app-sidebar">
        <header className="app-header">
          <h1>
            AnonymAIzer
            <span className="app-version">v{__APP_VERSION__}</span>
          </h1>
          <p>Sanitize text before sending it to an AI, restore it after. Nothing leaves your browser.</p>
        </header>

        <StepNav
          step={step}
          canReview={session.rawMarkdown.length > 0}
          canRestore={session.mappings.length > 0}
          onSelect={setStep}
        />
      </aside>

      <main className="app-main">
        {step === 'ingest' && (
          <IngestStep
            rawMarkdown={session.rawMarkdown}
            warnings={importWarnings}
            onChange={handlePasteChange}
            onCreateRule={handleCreateRule}
            onFileImport={handleFileImport}
          />
        )}

        {step === 'review' && (
          <>
            <NerToggle
              enabled={nerEnabled}
              status={nerStatus}
              onToggle={handleNerToggle}
              onDeleteModel={handleDeleteModel}
            />
            <ReviewStep
              anonymizedText={session.anonymizedMarkdown}
              mappings={session.mappings}
              dictionaryRules={dictionaryRules}
              onToggle={handleToggle}
              onSplit={handleSplit}
              onMerge={handleMerge}
              onRulesChange={updateRules}
            />
          </>
        )}

        {step === 'restore' && <ReversalPanel mappings={session.mappings} />}
      </main>
    </div>
  );
}

export default App;
