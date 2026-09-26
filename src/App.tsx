import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { IngestStep } from './components/IngestStep';
import { NerToggle } from './components/NerToggle';
import { ReversalPanel } from './components/ReversalPanel';
import { ReviewStep } from './components/ReviewStep';
import { StepFooter } from './components/StepFooter';
import { SidebarStats } from './components/SidebarStats';
import { StepNav } from './components/StepNav';
import { anonymize, anonymizeWithNer } from './core/anonymize';
import { toggleableCategories, type CategorySettings } from './core/categories';
import { applyEnabledMappings } from './core/apply';
import { renderPseudonymized } from './core/pseudonymize';
import type { CustomDictionaryRule, DocumentFormat, MappingItem, MappingSession } from './core/types';
import './lib/parsers';
import { NerClient, type NerStatus } from './lib/nerClient';
import { deleteModelCache } from './workers/nerModelCache';
import { reverseText } from './core/reverse';
import type { CopyAction } from './components/StepFooter';
import type { RestoreSubStep, ReviewSubStep, WizardGate, WizardPosition } from './lib/wizard';
import {
  loadCategorySettings,
  loadDictionaryRules,
  loadOutputMode,
  loadSession,
  loadStep,
  newSessionId,
  saveCategorySettings,
  saveDictionaryRules,
  saveOutputMode,
  saveSession,
  saveStep,
  type OutputMode,
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
  const [categorySettings, setCategorySettings] = useState<CategorySettings>(() =>
    loadCategorySettings(toggleableCategories(loadDictionaryRules())),
  );
  const [step, setStep] = useState<WizardStep>(() => loadStep());
  const [reviewSubStep, setReviewSubStep] = useState<ReviewSubStep>('rules');
  const [restoreSubStep, setRestoreSubStep] = useState<RestoreSubStep>('response');
  const [aiResponse, setAiResponse] = useState('');
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
  useEffect(() => saveCategorySettings(categorySettings), [categorySettings]);
  useEffect(() => saveStep(step), [step]);
  const [outputMode, setOutputMode] = useState<OutputMode>(() => loadOutputMode());
  useEffect(() => saveOutputMode(outputMode), [outputMode]);
  // P13: the realistic rendering is derived, never stored — the session and
  // its placeholder text stay the source of truth for step 3.
  const realisticText = useMemo(
    () => (outputMode === 'realistic' ? renderPseudonymized(session) : ''),
    [outputMode, session],
  );
  const sanitizedText = outputMode === 'realistic' ? realisticText : session.anonymizedMarkdown;
  useEffect(() => () => nerClientRef.current?.terminate(), []);

  const runAnonymize = (rawMarkdown: string, rules: CustomDictionaryRule[], settings = categorySettings) => {
    const { mappings, anonymizedText } = anonymize(rawMarkdown, rules, settings);
    setSession((prev) => ({ ...prev, rawMarkdown, mappings, anonymizedMarkdown: anonymizedText }));
  };

  const handleFileImport = (
    rawMarkdown: string,
    format: DocumentFormat,
    fileName: string,
    warnings: string[],
  ) => {
    setImportWarnings(warnings);
    const { mappings, anonymizedText } = anonymize(rawMarkdown, dictionaryRules, categorySettings);
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

  const runNerScan = async (rawMarkdown: string, rules: CustomDictionaryRule[], settings = categorySettings) => {
    nerClientRef.current ??= new NerClient();
    try {
      const entities = await nerClientRef.current.runNer(rawMarkdown, setNerStatus);
      const { mappings, anonymizedText } = anonymizeWithNer(rawMarkdown, rules, entities, settings);
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

  // P11: changing a category toggle re-runs detection for the current document.
  const updateCategorySettings = (settings: CategorySettings) => {
    setCategorySettings(settings);
    if (nerEnabled && nerStatus.state === 'ready') {
      void runNerScan(session.rawMarkdown, dictionaryRules, settings);
    } else {
      runAnonymize(session.rawMarkdown, dictionaryRules, settings);
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

  const gate: WizardGate = {
    hasText: session.rawMarkdown.length > 0,
    hasMappings: session.mappings.length > 0,
    hasAiResponse: aiResponse.length > 0,
  };
  const position: WizardPosition =
    step === 'review' ? { step, subStep: reviewSubStep } : step === 'restore' ? { step, subStep: restoreSubStep } : { step };
  const navigate = (to: WizardPosition): void => {
    setStep(to.step);
    if (to.step === 'review' && to.subStep) setReviewSubStep(to.subStep as ReviewSubStep);
    if (to.step === 'restore' && to.subStep) setRestoreSubStep(to.subStep as RestoreSubStep);
  };
  // The end of the round trip. It clears the document, its mappings and the AI
  // response; custom rules and the cached NER model are kept, since they belong
  // to the user, not to one document. Asks first: the mappings are the only
  // way to restore an AI response, and they're gone once this runs.
  const startOver = (): void => {
    const ok = window.confirm(
      'Start again with a new document?\n\n' +
        'This clears the current text, its placeholders and the AI response. ' +
        'Without the placeholders, an AI response for this document can no longer be restored.\n\n' +
        'Your custom rules are kept.',
    );
    if (!ok) return;
    setSession(emptySession());
    setAiResponse('');
    setImportWarnings([]);
    setReviewSubStep('rules');
    setRestoreSubStep('response');
    setStep('ingest');
  };
  const restored = aiResponse ? reverseText(aiResponse, session.mappings) : '';
  const copyAction: CopyAction | undefined =
    position.subStep === 'sanitized'
      ? { label: 'Copy sanitized text', text: sanitizedText, doneMessage: 'Copied — your text is ready to send to the AI.' }
      : position.subStep === 'restored'
        ? { label: 'Copy restored text', text: restored, doneMessage: 'Copied — your restored text is on the clipboard.' }
        : undefined;

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

        <StepNav step={step} gate={gate} onSelect={setStep} />
        <SidebarStats
          session={session}
          onOpen={() => {
            setStep('review');
            setReviewSubStep('placeholders');
          }}
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
              session={session}
              anonymizedText={sanitizedText}
              outputMode={outputMode}
              onOutputModeChange={setOutputMode}
              mappings={session.mappings}
              dictionaryRules={dictionaryRules}
              onToggle={handleToggle}
              onSplit={handleSplit}
              onMerge={handleMerge}
              onRulesChange={updateRules}
              categorySettings={categorySettings}
              onCategorySettingsChange={updateCategorySettings}
              subStep={reviewSubStep}
              onSubStepChange={setReviewSubStep}
            />
          </>
        )}

        {step === 'restore' && (
          <ReversalPanel
            session={session}
            aiResponse={aiResponse}
            restored={restored}
            onAiResponseChange={setAiResponse}
            subStep={restoreSubStep}
            onSubStepChange={setRestoreSubStep}
          />
        )}

        <StepFooter
          // Remount per position, so coming back to a copy tab asks to copy again.
          key={`${position.step}:${position.subStep ?? ''}`}
          position={position}
          gate={gate}
          onNavigate={navigate}
          copyAction={copyAction}
          onStartOver={startOver}
        />
      </main>
    </div>
  );
}

export default App;
