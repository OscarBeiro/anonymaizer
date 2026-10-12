import { ParseControl } from './lib/parserControl';
import { ManualReview } from './components/ManualReview';
import { modelDownloadAllowed } from './lib/analytics';
import { RecoveryControls } from './components/RecoveryControls';
import { OutputContext, type OutputService } from './components/OutputContext';
import { DetectionClient } from './lib/detectionClient';
import { newScope } from './lib/restorationKey';
import { clearRetained, acceptGeneration, generation, remembered, setRemembered, legacyRetentionPresent } from './lib/retention';
import { identifyMappings, mintToken, outputFindings, revisionKey, type MappingSnapshot, type Revision } from './core/roundTrip';
import { structuredDocument } from './core/structuredDocument';
import { prepareArtifact } from './core/export/prepare';
import { restoreText } from './core/reverse';
import { BrandName } from './components/BrandName';
import { BetaBadge } from './components/BetaBadge';
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { IngestStep } from './components/IngestStep';
import { NerToggle } from './components/NerToggle';
import { isLongForNer, nerLongDocumentMessage } from './lib/nerLimits';
import { ReversalPanel } from './components/ReversalPanel';
import { ReviewStep } from './components/ReviewStep';
import { StepFooter } from './components/StepFooter';
import { SidebarStats } from './components/SidebarStats';
import { StepNav } from './components/StepNav';
import { ThemeToggle } from './components/ThemeToggle';
import { SettingsMenu, type SettingsSection } from './components/SettingsMenu';
import { CategoryToggles } from './components/CategoryToggles';
import { RulesEditor } from './components/RulesEditor';

import { type RestoreFormat } from './core/markdownRender';
import { applyTheme, watchSystemTheme } from './lib/theme';

import { isCategoryOn, toggleableCategories, type CategorySettings } from './core/categories';
import { applyEnabledMappings } from './core/apply';
import { renderPseudonymized, type MoneyRange, type PseudonymLang } from './core/pseudonymize';
import type { CustomDictionaryRule, DocumentFormat, MappingItem, MappingSession } from './core/types';
import './lib/parsers';
import { parseDocument } from './core/parsers';
import { takeHandoff } from './lib/handoff';
import { linkProps } from './lib/router';
import { SiteLinks } from './landing/SiteLinks';
import { Copyright } from './components/Copyright';
import { NerClient, type NerStatus } from './lib/nerClient';
import { deleteModelCache } from './workers/nerModelCache';

import type { CopyAction } from './components/StepFooter';
import { FINE_TUNE_POSITION, type RestoreSubStep, type ReviewSubStep, type WizardGate, type WizardPosition } from './lib/wizard';
import { QuickResult } from './components/QuickResult';
import {
  loadAppMode,
  loadCategorySettings,
  loadDictionaryRules,
  loadMoneyRange,
  loadPseudonymLang,
  loadOutputMode,
  loadSession,
  loadStep,
  loadTheme,
  loadRestoreFormat,
  saveRestoreFormat,
  newSessionId,
  saveAppMode,
  saveCategorySettings,
  saveDictionaryRules,
  saveMoneyRange,
  savePseudonymLang,
  saveOutputMode,
  saveSession,
  saveStep,
  saveTheme,
  type AppMode,
  type ThemePreference,
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
  const [reviewSubStep, setReviewSubStep] = useState<ReviewSubStep>('placeholders');
  const [restoreSubStep, setRestoreSubStep] = useState<RestoreSubStep>('response');
  const [aiResponse, setAiResponse] = useState('');
  // S1: defaultMode is the remembered choice (Quick/Detailed, Settings);
  // viewMode is what is on screen now — Fine-tune switches only the view.
  const [defaultMode, setDefaultMode] = useState<AppMode>(() => loadAppMode());
  useEffect(() => saveAppMode(defaultMode), [defaultMode]);
  const [viewMode, setViewMode] = useState<AppMode>(() => (step === 'restore' ? 'advanced' : defaultMode));
  const standard = viewMode === 'standard';
  // Parser warnings persist with the source extraction report.
  const [importWarnings, setImportWarnings] = useState<string[]>(() => session.coverage?.warnings ?? []);
  const [rememberDocument, setRememberDocument] = useState(() => remembered('document'));
  const [rememberRules, setRememberRules] = useState(() => remembered('rules'));
  const [migration, setMigration] = useState(() => legacyRetentionPresent() || loadDictionaryRules().length > 0 && !remembered('rules'));
  const [storageError, setStorageError] = useState('');
  const [snapshots, setSnapshots] = useState<MappingSnapshot[]>(() => session.snapshots ?? []);
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [tolerantRestore, setTolerantRestore] = useState(false);
  const [legacyRestore, setLegacyRestore] = useState(false);
  const revisionRef = useRef<Revision>(session.identity ?? { scope: session.mappings.find(m => m.placeholder.startsWith('[[V1_'))?.placeholder.slice(5, 37) ?? newScope(), documentId: session.sessionId, documentRevision: 0, policyRevision: 0, mappingRevision: 0 });
  const counterRef = useRef(Math.max(session.tokenCounter ?? 0, ...session.mappings.map(m => Number(m.placeholder.match(/_(\d+)\]\]$/)?.[1]) || 0)) + 1);
  const requestRef = useRef(0);
  const parseRef = useRef<ParseControl | null>(null);
  const detectionRef = useRef<DetectionClient | null>(null);
  const sessionRef = useRef(session); sessionRef.current = session;
  const [scan, setScan] = useState<'pending' | 'ready' | 'failed'>('ready');
  const [processingError, setProcessingError] = useState('');
  const [acknowledgedRevision, setAcknowledgedRevision] = useState('');
  const [undoMappings, setUndoMappings] = useState<MappingItem[] | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const outputModeRef = useRef<OutputMode>('placeholders');


  // P7d: opt-in only, never loaded or run automatically. A ref (not state)
  // for the client itself — it owns a real Worker, which must survive
  // re-renders and be created exactly once.
  const nerClientRef = useRef<NerClient | null>(null);
  const [nerEnabled, setNerEnabled] = useState(false);
  const [nerStatus, setNerStatus] = useState<NerStatus>({ state: 'idle' });

  // L1: false when the document is too large for localStorage; it then lives in memory only.
  const [sessionSaved, setSessionSaved] = useState(true);
  useEffect(() => {
    setSessionSaved(saveSession({ ...session, snapshots, identity: revisionRef.current, tokenCounter: counterRef.current }));
  }, [session, snapshots, rememberDocument]);
  useEffect(() => saveDictionaryRules(dictionaryRules), [dictionaryRules, rememberRules]);
  useEffect(() => saveCategorySettings(categorySettings), [categorySettings]);
  useEffect(() => saveStep(step), [step]);
  const [outputMode, setOutputMode] = useState<OutputMode>(() => loadOutputMode());
  outputModeRef.current = outputMode;

  const [moneyRange, setMoneyRange] = useState<MoneyRange>(() => loadMoneyRange());
  useEffect(() => saveMoneyRange(moneyRange), [moneyRange]);
  const [pseudonymLang, setPseudonymLang] = useState<PseudonymLang>(() => loadPseudonymLang());
  useEffect(() => savePseudonymLang(pseudonymLang), [pseudonymLang]);
  useEffect(() => { saveOutputMode(outputMode); setAcknowledgedRevision(''); }, [outputMode, moneyRange, pseudonymLang]);
  const [restoreFormat, setRestoreFormat] = useState<RestoreFormat>(() => loadRestoreFormat());
  useEffect(() => saveRestoreFormat(restoreFormat), [restoreFormat]);
  const [theme, setTheme] = useState<ThemePreference>(() => loadTheme());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();
  const openSettings = (section?: SettingsSection) => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };
  useEffect(() => {
    saveTheme(theme);
    applyTheme(theme);
    return watchSystemTheme(() => applyTheme(theme));
  }, [theme]);
  // P13: the realistic rendering is derived, never stored — the session and
  // its placeholder text stay the source of truth for step 3.
  const realisticText = useMemo(
    () => (outputMode === 'realistic' ? renderPseudonymized(session, moneyRange, pseudonymLang) : ''),
    [outputMode, session, moneyRange, pseudonymLang],
  );
  const sanitizedText = outputMode === 'realistic' ? realisticText : session.anonymizedMarkdown;
  useEffect(() => () => { nerClientRef.current?.terminate(); detectionRef.current?.cancel(); parseRef.current?.cancel(); }, []);
  const invalidate = () => {
    requestRef.current++; parseRef.current?.cancel();
    detectionRef.current?.cancel(); nerClientRef.current?.terminate();
    setAcknowledgedRevision(''); setDeliveryMessage('');
  };
  useEffect(() => {
    const clear = (event: StorageEvent) => {
      if (event.key === 'anonymaizer.storageGeneration' || !event.key) {
        invalidate(); setSession(emptySession()); setAiResponse(''); setSnapshots([]); setSelectedSnapshot('');
        setImportWarnings([]); setDictionaryRules([]); setRememberDocument(false); setRememberRules(false);
        setMigration(false); setStep('ingest'); setScan('ready'); acceptGeneration();
        setStorageError('Browser data was cleared in another tab.');
      } else if (event.key === 'anonymaizer.rememberDocument') setRememberDocument(event.newValue === 'true');
      else if (event.key === 'anonymaizer.rememberRules') setRememberRules(event.newValue === 'true');
    };
    window.addEventListener('storage', clear);
    return () => window.removeEventListener('storage', clear);
  }, []);


  // A new document replaces everything tied to the previous one: its mappings,
  // file metadata, session id (so realistic output reseeds) and AI response.
  // Custom rules and settings belong to the user and are kept.
  const resetForNewDocument = (): void => {
    invalidate();
    const fresh = emptySession();
    revisionRef.current = { scope: newScope(), documentId: fresh.sessionId, documentRevision: 0, policyRevision: 0, mappingRevision: 0 };
    counterRef.current = 1;
    setScan('ready'); setProcessingError(''); setSelectedSnapshot(''); setUndoMappings(null);
    setSession(fresh);
    setAiResponse('');
    setImportWarnings([]);
    setReviewSubStep('placeholders');
    setRestoreSubStep('response');
  };

  const commitDetection = (rawMarkdown: string, result: Awaited<ReturnType<DetectionClient['run']>>) => {
    setSession(prev => {
      const lost = prev.mappings.filter(m => m.source === 'manual' || !m.enabled).some(m =>
        !result.mappings.some(n => n.originalText === m.originalText && JSON.stringify(n.occurrences) === JSON.stringify(m.occurrences)));
      if (lost) setProcessingError('Some manual review decisions no longer match this revision. Review them again.');
      const identified = identifyMappings(rawMarkdown, result.mappings, prev.mappings, revisionRef.current.scope, counterRef.current);
      counterRef.current = identified.next;
      revisionRef.current.mappingRevision++;
      return { ...prev, rawMarkdown, mappings: identified.mappings, anonymizedMarkdown: identified.text };
    });
    setScan('ready');
  };
  const runAnonymize = async (rawMarkdown: string, rules: CustomDictionaryRule[], settings = categorySettings) => {
    invalidate(); setUndoMappings(null); const request = requestRef.current;
    revisionRef.current.documentRevision++; revisionRef.current.policyRevision++;
    setSession(prev => ({ ...prev, rawMarkdown })); setScan('pending'); setProcessingError('');
    detectionRef.current ??= new DetectionClient();
    try {
      const result = await detectionRef.current.run({ text: rawMarkdown, rules, settings, manualMappings: sessionRef.current.mappings.filter(m => m.source === 'manual') });
      if (request !== requestRef.current) return;
      commitDetection(rawMarkdown, result);
    } catch (e) {
      if (request !== requestRef.current) return;
      setScan('failed'); setProcessingError(e instanceof Error ? e.message : 'Detection failed.');
    }
  };
  const handleFileImport = (rawMarkdown: string, format: DocumentFormat, fileName: string, warnings: string[], coverage?: MappingSession['coverage']) => {
    resetForNewDocument(); setImportWarnings(warnings);
    setSession(prev => ({ ...prev, rawMarkdown, inputType: 'FILE', fileName, originalFormat: format,
      coverage: coverage ?? { format, processedUnits: 1, skippedUnits: 0, warnings, structuralWarnings: [], status: !rawMarkdown.trim() ? 'empty' : warnings.length ? 'review' : 'complete' } }));
    void runAnonymize(rawMarkdown, dictionaryRules, categorySettings);
  };

  // P19: text or a file handed over by the landing's call to action. It
  // replaces the current document, like a paste or an import would.
  useEffect(() => {
    const handoff = takeHandoff();
    if (!handoff) return;
    if (handoff.kind === 'text') {
      handleNewDocumentText(handoff.text);
      setStep('review');
      return;
    }
    invalidate();
    const handoffRequest = requestRef.current;
    const control = new ParseControl(); parseRef.current = control;
    void handoff.file
      .arrayBuffer()
      .then((bytes) => parseDocument(handoff.file.name, bytes, control))
      .then((parsed) => {
        if (handoffRequest !== requestRef.current) return;
        handleFileImport(parsed.markdown, parsed.format, handoff.file.name, parsed.warnings ?? [], parsed.coverage);
        setStep('review');
      })
      .catch((e: unknown) => {
        if (handoffRequest !== requestRef.current) return;
        setStep('ingest');
        setImportWarnings([`Could not read ${handoff.file.name}: ${e instanceof Error ? e.message : 'unknown error'}`]);
      });
    // Mount only: a handoff is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runNerScan = async (rawMarkdown: string, rules: CustomDictionaryRule[], settings = categorySettings) => {
    invalidate(); setUndoMappings(null); const request = requestRef.current;
    revisionRef.current.documentRevision++; revisionRef.current.policyRevision++;
    setSession(prev => ({ ...prev, rawMarkdown })); setScan('pending'); setProcessingError('');
    nerClientRef.current ??= new NerClient(); detectionRef.current ??= new DetectionClient();
    try {
      const entities = await nerClientRef.current.runNer(rawMarkdown, status => { if (request === requestRef.current) setNerStatus(status); });
      if (request !== requestRef.current) return;
      const result = await detectionRef.current.run({ text: rawMarkdown, rules, settings, entities, manualMappings: sessionRef.current.mappings.filter(m => m.source === 'manual') });
      if (request === requestRef.current) commitDetection(rawMarkdown, result);
    } catch (e) {
      if (request !== requestRef.current) return;
      setScan('failed'); setProcessingError(e instanceof Error ? e.message : 'NER failed.');
    }
  };

  const handlePasteChange = (rawMarkdown: string) => {
    // Editing the text by hand makes the imported document's warnings stale.
    // Source edits retain the extraction report: editing extracted text does not recover omitted content.
    // Once the model is loaded and opted into, every edit re-scans with it
    // automatically — no separate "Re-scan" button to remember to press.
    // Before that (not enabled, or still downloading) this falls back to
    // the instant M1/P7a-c regex heuristics.
    if (nerEnabled) {
      void runNerScan(rawMarkdown, dictionaryRules);
    } else {
      runAnonymize(rawMarkdown, dictionaryRules);
    }
  };

  // A paste that replaces the document (see PastePanel) or text from the
  // landing: start clean, then detect as usual.
  const handleNewDocumentText = (rawMarkdown: string) => {
    resetForNewDocument();
    handlePasteChange(rawMarkdown);
  };

  const handleNerToggle = (checked: boolean) => {
    if (checked && !modelDownloadAllowed()) { setNerStatus({ state: 'error', message: 'Model download is available only on the public HTTPS deployment. Local and portable copies remain offline.' }); return; }
    // L3: NER is slow on a book-length text; the user may still turn it on.
    if (checked && isLongForNer(session.rawMarkdown) && !window.confirm(nerLongDocumentMessage(session.rawMarkdown.length))) {
      return;
    }
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
    invalidate(); revisionRef.current.mappingRevision++;
    if (scan === 'pending') { setScan('failed'); setProcessingError('Processing cancelled by review. Retry detection before exporting.'); }
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
    invalidate(); revisionRef.current.mappingRevision++;
    if (scan === 'pending') { setScan('failed'); setProcessingError('Processing was cancelled by review. Retry detection.'); }
    setSession((prev) => {
      const target = prev.mappings.find((m) => m.id === id);
      if (!target || target.variants.length <= 1) return prev;

      const remaining = prev.mappings.filter((m) => m.id !== id);
      let counter = nextCounter(prev.mappings, target.category);
      const split: MappingItem[] = target.variants.map((variant) => ({
        id: `${target.category}_${counter++}`,
        placeholder: mintToken(revisionRef.current.scope, target.category, counterRef.current++),
        originalText: variant,
        category: target.category,
        confidence: target.confidence,
        source: target.source,
        enabled: target.enabled,
        variants: [variant],
        occurrences: target.occurrences?.filter(o => o.text === variant),
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
    invalidate(); revisionRef.current.mappingRevision++;
    if (scan === 'pending') { setScan('failed'); setProcessingError('Processing was cancelled by review. Retry detection.'); }
    setSession((prev) => {
      const targets = prev.mappings.filter((m) => ids.includes(m.id));
      if (targets.length < 2) return prev;
      if (targets.some((t) => t.category !== targets[0].category)) return prev;

      const remaining = prev.mappings.filter((m) => !ids.includes(m.id));
      const variants = [...new Set(targets.flatMap((t) => t.variants))].sort(
        (a, b) => b.length - a.length,
      );
      const first = targets[0];
      const merged: MappingItem = { ...first, originalText: variants[0], variants, placeholder: mintToken(revisionRef.current.scope, first.category, counterRef.current++), occurrences: targets.flatMap(t => t.occurrences ?? []) };

      const mappings = [...remaining, merged];
      const anonymizedMarkdown = applyEnabledMappings(prev.rawMarkdown, mappings);
      return { ...prev, mappings, anonymizedMarkdown };
    });
  };

  const updateRules = (rules: CustomDictionaryRule[]) => {
    setDictionaryRules(rules);
    if (nerEnabled) {
      void runNerScan(session.rawMarkdown, rules);
    } else {
      runAnonymize(session.rawMarkdown, rules);
    }
  };

  // P11: changing a category toggle re-runs detection for the current document.
  const updateCategorySettings = (settings: CategorySettings) => {
    setCategorySettings(settings);
    if (nerEnabled) {
      void runNerScan(session.rawMarkdown, dictionaryRules, settings);
    } else {
      runAnonymize(session.rawMarkdown, dictionaryRules, settings);
    }
  };

  const manualRedact = (start: number, end: number, all: boolean) => {
    if (scan !== 'ready') { setProcessingError('Wait for detection before manual review.'); return; }
    const raw = session.rawMarkdown; const originalText = raw.slice(start, end);
    if (!originalText) return;
    invalidate(); revisionRef.current.mappingRevision++; setUndoMappings(session.mappings);
    const occurrences: { start: number; end: number; text: string }[] = [];
    if (all) {
      let offset = 0;
      while ((offset = raw.indexOf(originalText, offset)) >= 0) { occurrences.push({ start: offset, end: offset + originalText.length, text: originalText }); offset += originalText.length; }
    } else occurrences.push({ start, end, text: originalText });
    const remaining = session.mappings.map(m => ({ ...m, occurrences: (m.occurrences ?? []).filter(o => !occurrences.some(n => n.start < o.end && o.start < n.end)) }));
    const counter = counterRef.current++;
    const manual: MappingItem = { id: `manual_${counter}`, placeholder: `[[V1_${revisionRef.current.scope}_CUSTOM_${counter}]]`, category: 'CUSTOM', originalText, variants: [originalText], confidence: 1, source: 'manual', enabled: true, occurrences };
    const mappings = [...remaining, manual];
    setSession(prev => ({ ...prev, mappings, anonymizedMarkdown: applyEnabledMappings(raw, mappings) }));
  };
  const undoManual = () => {
    if (!undoMappings) return; invalidate(); revisionRef.current.mappingRevision++;
    setSession(prev => ({ ...prev, mappings: undoMappings, anonymizedMarkdown: applyEnabledMappings(prev.rawMarkdown, undoMappings) }));
    setUndoMappings(null);
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
    hasMappings: session.mappings.length > 0 || snapshots.some(s => s.exportId === selectedSnapshot),
    hasAiResponse: aiResponse.length > 0,
  };
  const position: WizardPosition =
    step === 'review' ? { step, subStep: reviewSubStep } : step === 'restore' ? { step, subStep: restoreSubStep } : { step };
  const navigate = (to: WizardPosition): void => {
    setStep(to.step);
    if (to.step === 'review' && to.subStep) setReviewSubStep(to.subStep as ReviewSubStep);
    if (to.step === 'restore' && to.subStep) setRestoreSubStep(to.subStep as RestoreSubStep);
  };
  const runInMode = (mode: AppMode): void => {
    setDefaultMode(mode);
    setViewMode(mode);
    navigate({ step: 'review', subStep: 'placeholders' });
  };
  const fineTune = (): void => {
    setViewMode('advanced');
    navigate(FINE_TUNE_POSITION);
  };

  // The end of the round trip. It clears the document, its mappings and the AI
  // response; custom rules and the cached NER model are kept, since they belong
  // to the user, not to one document. Asks first: the mappings are the only
  // way to restore an AI response, and they're gone once this runs.
  // P18: wipe every anonymaizer.* key and the NER model cache, then reload.
  // No state changes in between, so no save effect writes a key back.
  const clearAllLocalData = (): void => {
    const ok = window.confirm(
      'Clear all local data?\n\n' +
        'This removes the current document, its placeholders, your custom rules, your settings ' +
        'and the downloaded AI model from this browser. It cannot be undone.',
    );
    if (!ok) return;
    nerClientRef.current?.terminate();
    nerClientRef.current = null;
    invalidate();
    setSession(emptySession()); setAiResponse(''); setSnapshots([]); setSelectedSnapshot(''); setDictionaryRules([]);
    setImportWarnings([]); setStep('ingest'); setScan('ready'); setRememberDocument(false); setRememberRules(false); setMigration(false);
    if (!clearRetained()) { setStorageError('Could not clear browser storage. Storage is blocked; deletion cannot be confirmed.'); return; }
    void deleteModelCache().then(() => setStorageError('Browser data cleared. Downloaded files are unaffected.'), () => setStorageError('Document data cleared; model-cache deletion failed.'));
  };

  const startOver = (): void => {
    const ok = window.confirm(
      'Start again with a new document?\n\n' +
        'This replaces the current document and AI response. Prepared snapshots remain available in this tab. ' +
        'Save a private restoration key to recover them after closing the browser.\n\n' +
        'Your custom rules are kept.',
    );
    if (!ok) return;
    resetForNewDocument();
    setStep('ingest');
    setViewMode(defaultMode);
  };
  const selected = snapshots.find(s => s.exportId === selectedSnapshot);
  const restoreMappings = selected?.mappings ?? (legacyRestore ? session.mappings : []);
  const restoreOptions = { tolerant: tolerantRestore, legacy: !selected && legacyRestore };
  const restoration = restoreText(aiResponse, restoreMappings, restoreOptions);
  const restoredDocument = structuredDocument(aiResponse, restoreMappings, restoreOptions);
  const restored = restoreFormat === 'plain' ? restoration.text : restoredDocument.markdown;
  const restoredHtml = restoredDocument.html;
  const restoredPlain = restoration.text;
  const restoredView = restoreFormat === 'plain' ? restoredPlain : restoredHtml;
  const currentRevisionKey = revisionKey(session, revisionRef.current) + JSON.stringify([outputMode, moneyRange, pseudonymLang]);
  const currentKeyRef = useRef(currentRevisionKey); currentKeyRef.current = currentRevisionKey;
  const findings = outputFindings(session, sanitizedText, { revision: currentRevisionKey, acknowledged: acknowledgedRevision === currentRevisionKey, scan,
    categoriesOff: toggleableCategories(dictionaryRules).filter(c => !isCategoryOn(categorySettings, c)).length });
  const outputService: OutputService = {
    prepare: (text, kind) => {
      if (scan !== 'ready') throw new Error('Wait for complete detection or retry processing.');
      const expected = outputModeRef.current === 'realistic' && !standard ? sanitizedText : session.anonymizedMarkdown;
      if (text !== expected) throw new Error('Output changed. Prepare the current result again.');
      const check = outputFindings(session, text, { revision: currentRevisionKey, acknowledged: acknowledgedRevision === currentRevisionKey, scan,
        categoriesOff: toggleableCategories(dictionaryRules).filter(c => !isCategoryOn(categorySettings, c)).length });
      if (check.blocked.length) throw new Error(check.blocked.join(' '));
      if (check.review.length && acknowledgedRevision !== currentRevisionKey) throw new Error('Review and acknowledge the current output findings before sharing.');
      const exportId = crypto.randomUUID();
      const prepared = prepareArtifact({ session, text, kind, revision: revisionRef.current, exportId, engineVersion: __APP_VERSION__, reversible: standard || outputMode === 'placeholders',
        review: { revision: currentRevisionKey, acknowledged: acknowledgedRevision === currentRevisionKey, scan, categoriesOff: toggleableCategories(dictionaryRules).filter(c => !isCategoryOn(categorySettings, c)).length } });
      const file = prepared.upload;
      if (prepared.privateSnapshot) {
        const snapshot = prepared.privateSnapshot;
        setSnapshots(prev => [...prev, snapshot]); setSelectedSnapshot(exportId);
      }
      setDeliveryMessage('Output prepared. Its private snapshot remains available even if delivery fails.');
      const captured = currentRevisionKey; const capturedGeneration = generation(); const capturedRequest = requestRef.current;
      return { file, exportId, assertCurrent: () => {
        if (currentKeyRef.current !== captured || requestRef.current !== capturedRequest || generation() !== capturedGeneration) throw new Error('Output changed during preparation. Retry with the current revision.');
      } };
    },
    delivered: () => setDeliveryMessage('Output handed to the browser. Check your clipboard or downloaded file; this does not prove it was saved.'),
  };
  const copyAction: CopyAction | undefined =
    position.subStep === 'sanitized'
      ? { sanitized: true, label: 'Copy sanitized text', text: sanitizedText, doneMessage: 'Copied — your text is ready to send to the AI.' }
      : position.subStep === 'restored'
        ? {
            label: 'Copy restored text',
            text: restoreFormat === 'plain' ? restoredPlain : restoreFormat === 'html' ? restoredHtml : restored,
            // Markdown: rich text for Word/Docs/email, the Markdown source for plain editors.
            html: restoreFormat === 'markdown' ? restoredHtml : undefined,
            doneMessage: 'Copied — your restored text is on the clipboard.',
          }
        : undefined;

  return (
    <OutputContext.Provider value={outputService}><div className="app-shell">
      <header className="app-header">
        {/* The portable build has no landing to go back to. */}
        {__PORTABLE__ ? (
          <span className="app-mark" aria-hidden="true">A</span>
        ) : (
          <a className="app-mark" aria-label="AnonymAIzer home" {...linkProps('/')}>A</a>
        )}
        <div className="app-title">
          <h1>
            <BrandName />
            <BetaBadge />
            <span className="app-version">v{__APP_VERSION__}</span>
          </h1>
          <p className="app-tagline">Sanitize text before sending it to an AI, restore it after. Nothing leaves your browser.</p>
        </div>
        {/* P18: the settings menu button mounts here. */}
        <div className="app-header-slot">
          {!standard && step !== 'ingest' && gate.hasText && (
            <button
              type="button"
              className="settings-button"
              onClick={() => {
                setViewMode('standard');
                navigate({ step: 'review' });
              }}
            >
              Quick view
            </button>
          )}
          <ThemeToggle theme={theme} onChange={setTheme} />
          <button type="button" className="settings-button" aria-haspopup="dialog" onClick={() => openSettings()}>
            ⚙ Settings
          </button>
        </div>
      </header>

      <div className="app">
        {!standard && (
          <aside className="app-sidebar">
            <StepNav step={step} gate={gate} onSelect={setStep} />
            <SidebarStats
              session={session}
              onOpen={() => {
                setStep('review');
                setReviewSubStep('placeholders');
              }}
            />
          </aside>
        )}

        <main className="app-main">
          <section className="panel" aria-label="Session privacy">
            <p>Sessions are ephemeral by default. Reversible placeholders provide pseudonymization; context can still identify people.</p>
            {migration && <p role="alert">A previous document was found in browser storage. You can save a private key before deleting it. Choose Remember on this device to retain it, or Keep only in memory to remove the stored copy.</p>}
            <label><input type="checkbox" checked={rememberDocument} onChange={e => {
              if (setRemembered('document', e.target.checked)) { setRememberDocument(e.target.checked); setMigration(false); }
              else setStorageError('Could not change document retention.');
            }} /> Remember on this device (plaintext browser storage)</label>
            <label><input type="checkbox" checked={rememberRules} onChange={e => {
              if (setRemembered('rules', e.target.checked)) setRememberRules(e.target.checked);
              else setStorageError('Could not change dictionary retention.');
            }} /> Retain custom dictionary separately</label>
            {migration && <button type="button" onClick={() => { if (setRemembered('document', false) && setRemembered('rules', false)) { setMigration(false); setRememberDocument(false); setRememberRules(false); } else setStorageError('Could not remove retained data.'); }}>Keep only in memory</button>}
            <p role="status">{storageError}</p>
          </section>
          <RecoveryControls snapshots={snapshots} selected={selectedSnapshot} onSelect={setSelectedSnapshot} onLoad={snapshot => {
            const existing = snapshots.find(s => s.exportId === snapshot.exportId);
            if (existing && JSON.stringify(existing) !== JSON.stringify(snapshot)) throw new Error('This export ID conflicts with an existing snapshot. The existing snapshot was preserved.');
            setSnapshots(prev => [...prev.filter(s => s.exportId !== snapshot.exportId), snapshot]); setSelectedSnapshot(snapshot.exportId);
            setViewMode('advanced'); navigate({ step: 'restore', subStep: 'response' });
          }} />
          {step !== 'ingest' && <section className="panel" aria-label="Output review">
            <p role="status">{scan === 'pending' ? 'Processing… output is blocked.' : processingError || 'Detection complete. Nothing detected does not mean nothing sensitive.'}</p>
            {scan !== 'ready' && <><button type="button" onClick={() => { invalidate(); setScan('failed'); setProcessingError('Processing cancelled. Retry before exporting.'); }}>Cancel processing</button>
              <button type="button" onClick={() => void (nerEnabled ? runNerScan(session.rawMarkdown, dictionaryRules) : runAnonymize(session.rawMarkdown, dictionaryRules))}>Retry detection</button></>}
            {session.coverage && <p>Extraction: {session.coverage.status} · {session.coverage.processedUnits} processed · {session.coverage.skippedUnits} skipped. Exports contain extracted text, not the original file.</p>}
            {[...findings.blocked, ...findings.review].map(f => <p key={f}>{f}</p>)}
            {findings.review.length > 0 && <label><input type="checkbox" checked={acknowledgedRevision === currentRevisionKey} onChange={e => setAcknowledgedRevision(e.target.checked ? currentRevisionKey : '')} /> I reviewed these findings for this output revision.</label>}
            <p role="status" aria-live="polite">{deliveryMessage}</p>
          </section>}

          {!sessionSaved && (
            <p className="session-unsaved" role="alert">
              This document is too large to survive a reload. Copy or save the result before closing or refreshing
              this tab.
            </p>
          )}

          {step === 'ingest' && (
            <IngestStep
              rawMarkdown={session.rawMarkdown}
              warnings={importWarnings}
              onChange={handlePasteChange}
              onNewDocument={handleNewDocumentText}
              onCreateRule={handleCreateRule}
              onFileImport={handleFileImport}
              onBeginImport={() => { invalidate(); setScan('pending'); parseRef.current = new ParseControl(); return requestRef.current; }}
              parseFile={(name, bytes) => parseDocument(name, bytes, parseRef.current ?? undefined)}
              onCancelImport={() => { invalidate(); setScan('failed'); setProcessingError('Import cancelled. Retry detection on the remaining text.'); }}
              onImportError={() => { setScan('failed'); setProcessingError('Import failed. Retry detection on the remaining text.'); }}
              isImportCurrent={id => id === requestRef.current}
              defaultMode={defaultMode}
              onRun={runInMode}
            />
          )}

          {standard && step === 'review' && (
            <QuickResult
              session={session}
              onFineTune={fineTune}
              onRestore={() => {
                setViewMode('advanced');
                navigate({ step: 'restore', subStep: 'response' });
              }}
              onNewDocument={startOver}
            />
          )}

          {!standard && step === 'review' && <ManualReview text={session.rawMarkdown} onRedact={manualRedact} onUndo={undoManual} canUndo={!!undoMappings} />}
          {!standard && step === 'review' && (
            <>
              <ReviewStep
                session={session}
                anonymizedText={sanitizedText}
                outputMode={outputMode}
                onOutputModeChange={setOutputMode}
                moneyRange={moneyRange}
                onMoneyRangeChange={setMoneyRange}
                pseudonymLang={pseudonymLang}
                onPseudonymLangChange={setPseudonymLang}
                mappings={session.mappings}
                onToggle={handleToggle}
                onSplit={handleSplit}
                onMerge={handleMerge}
                categoriesOff={toggleableCategories(dictionaryRules).filter((c) => !isCategoryOn(categorySettings, c)).length}
                onOpenDetectionSettings={() => openSettings('detection')}
                subStep={reviewSubStep}
                onSubStepChange={setReviewSubStep}
              />
            </>
          )}

          {step === 'restore' && <section className="panel" aria-label="Restoration report">
            <p>Revision: unverifiable. A pasted response cannot prove which export it came from. Restoration uses only your explicitly selected snapshot.</p>
            {!selected && <p>Select an export snapshot or load a private restoration key.</p>}
            <label><input type="checkbox" checked={tolerantRestore} onChange={e => setTolerantRestore(e.target.checked)} /> Preview tolerant bracket, case and spacing matching</label>
            <label><input type="checkbox" checked={legacyRestore} onChange={e => setLegacyRestore(e.target.checked)} /> Explicitly use this document’s legacy mappings</label>
            <p>{restoration.report.restoredOccurrences} restored occurrences · {restoration.report.unknownTokens.length} unknown tokens · {restoration.report.ambiguousCandidates.length} ambiguous candidates · {restoration.report.malformedCandidates.length} malformed candidates</p>
            {restoredDocument.warnings.map(w => <p key={w}>{w}</p>)}
          </section>}
          {step === 'restore' && (
            <ReversalPanel
              session={session}
              aiResponse={aiResponse}
              restored={restoration.text}
              restoredMarkdown={restoredDocument.markdown}
              restoredView={restoredView}
              restoreFormat={restoreFormat}
              onRestoreFormatChange={setRestoreFormat}
              onAiResponseChange={text => { if (text.length > 2_000_000) setProcessingError('Response exceeds the 2 million character limit.'); else setAiResponse(text); }}
              subStep={restoreSubStep}
              onSubStepChange={setRestoreSubStep}
            />
          )}

          {!standard && (
            <StepFooter
              // Remount per position, so coming back to a copy tab asks to copy again.
              key={`${position.step}:${position.subStep ?? ''}`}
              position={position}
              gate={gate}
              onNavigate={navigate}
              copyAction={copyAction}
              onStartOver={startOver}
            />
          )}
        </main>
      </div>

      <SettingsMenu
        open={settingsOpen}
        section={settingsSection}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        defaultMode={defaultMode}
        onDefaultModeChange={setDefaultMode}
        detection={
          <>
            <CategoryToggles
              settings={categorySettings}
              rules={dictionaryRules}
              mappings={session.mappings}
              onChange={updateCategorySettings}
              defaultOpen
            />
            <NerToggle
              enabled={nerEnabled}
              longDocument={isLongForNer(session.rawMarkdown)}
              status={nerStatus}
              onToggle={handleNerToggle}
              onDeleteModel={handleDeleteModel}
            />
          </>
        }
        dictionary={<RulesEditor rules={dictionaryRules} onChange={updateRules} />}
        legalLinks={<SiteLinks />}
        onClearLocalData={clearAllLocalData}
        onDeleteModel={handleDeleteModel}
      />

      <footer className="app-footer">
        <span>Runs entirely in your browser — no text is uploaded.</span>
        <nav className="app-footer-links" aria-label="Legal">
          <SiteLinks />
          <Copyright />
        </nav>
      </footer>
    </div></OutputContext.Provider>
  );
}

export default App;
