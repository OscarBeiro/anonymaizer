import { LanguagePicker } from './components/LanguagePicker';
import { t, useLocale } from './i18n';
import { LanguageRegionSetup } from './components/LanguageRegionSetup';
import { langDetect } from './core/langDetect';
import { enableJurisdictionPresets, suggestProfile } from './core/profileSelection';
import type { DetectionProfile } from './core/packs/profile';
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
import DOMPurify from 'dompurify';
import { markdownToHtml, markdownToPlainText, type RestoreFormat } from './core/markdownRender';
import { applyTheme, watchSystemTheme } from './lib/theme';
import { anonymize, anonymizeWithNer } from './core/anonymize';
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
import { NerQueue } from './lib/nerQueue';
import { deleteModelCache } from './workers/nerModelCache';
import { reverseText } from './core/reverse';
import type { CopyAction } from './components/StepFooter';
import { FINE_TUNE_POSITION, type RestoreSubStep, type ReviewSubStep, type WizardGate, type WizardPosition } from './lib/wizard';
import { QuickResult } from './components/QuickResult';
import {
  clearLocalData,
  loadAppMode,
  loadPinnedProfile,
  savePinnedProfile,
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
  const locale = useLocale();
  const [pinnedProfile, setPinnedProfile] = useState<DetectionProfile | null>(loadPinnedProfile);
  const [documentProfile, setDocumentProfile] = useState<DetectionProfile | null>(() => session.detectionProfile ?? null);
  const [profileSaved, setProfileSaved] = useState(true);
  const languageDetection = useMemo(() => langDetect(session.rawMarkdown), [session.rawMarkdown]);
  const activeProfile = useMemo(() => documentProfile ?? suggestProfile(languageDetection, pinnedProfile, locale),
    [documentProfile, languageDetection, pinnedProfile, locale]);
  const profileSignature = JSON.stringify(activeProfile);
  const scannedProfile = useRef(session.detectionProfile ? JSON.stringify(session.detectionProfile) : null);
  const scanRevision = useRef(0);
  const profileForText = (text: string): DetectionProfile =>
    documentProfile ?? suggestProfile(langDetect(text), pinnedProfile, locale);
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

  // L1: false when the document is too large for localStorage; it then lives in memory only.
  const [sessionSaved, setSessionSaved] = useState(true);
  useEffect(() => {
    setSessionSaved(saveSession(session));
  }, [session]);
  useEffect(() => saveDictionaryRules(dictionaryRules), [dictionaryRules]);
  useEffect(() => saveCategorySettings(categorySettings), [categorySettings]);
  useEffect(() => saveStep(step), [step]);
  const [outputMode, setOutputMode] = useState<OutputMode>(() => loadOutputMode());
  useEffect(() => saveOutputMode(outputMode), [outputMode]);
  const [moneyRange, setMoneyRange] = useState<MoneyRange>(() => loadMoneyRange());
  useEffect(() => saveMoneyRange(moneyRange), [moneyRange]);
  const [pseudonymLang, setPseudonymLang] = useState<PseudonymLang>(() => loadPseudonymLang());
  useEffect(() => savePseudonymLang(pseudonymLang), [pseudonymLang]);
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
  useEffect(() => () => nerClientRef.current?.terminate(), []);

  // A new document replaces everything tied to the previous one: its mappings,
  // file metadata, session id (so realistic output reseeds) and AI response.
  // Custom rules and settings belong to the user and are kept.
  const resetForNewDocument = (): void => {
    scanRevision.current++;
    scannedProfile.current = null;
    setDocumentProfile(null);
    setSession(emptySession());
    setAiResponse('');
    setImportWarnings([]);
    setReviewSubStep('placeholders');
    setRestoreSubStep('response');
  };

  const runAnonymize = (rawMarkdown: string, rules: CustomDictionaryRule[], settings = categorySettings, profile = profileForText(rawMarkdown)) => {
    scanRevision.current++;
    scannedProfile.current = JSON.stringify(profile);
    const { mappings, anonymizedText } = anonymize(rawMarkdown, rules, settings, [], profile);
    setSession((prev) => ({ ...prev, rawMarkdown, mappings, anonymizedMarkdown: anonymizedText, detectionProfile: profile }));
  };

  const handleFileImport = (
    rawMarkdown: string,
    format: DocumentFormat,
    fileName: string,
    warnings: string[],
  ) => {
    resetForNewDocument();
    setImportWarnings(warnings);
    const profile = suggestProfile(langDetect(rawMarkdown), pinnedProfile, locale);
    scannedProfile.current = JSON.stringify(profile);
    const { mappings, anonymizedText } = anonymize(rawMarkdown, dictionaryRules, categorySettings, [], profile);
    setSession(() => ({
      ...emptySession(),
      rawMarkdown,
      mappings,
      anonymizedMarkdown: anonymizedText,
      inputType: 'FILE',
      fileName,
      originalFormat: format,
      detectionProfile: profile,
    }));
  };

  // P19: text or a file handed over by the landing's call to action. It
  // replaces the current document, like a paste or an import would.
  useEffect(() => {
    const handoff = takeHandoff();
    if (!handoff) return;
    if (handoff.kind === 'text') {
      handleNewDocumentText(handoff.text);
      setStep('ingest');
      return;
    }
    void handoff.file
      .arrayBuffer()
      .then((bytes) => parseDocument(handoff.file.name, bytes))
      .then((parsed) => {
        handleFileImport(parsed.markdown, parsed.format, handoff.file.name, parsed.warnings ?? []);
        setStep('ingest');
      })
      .catch((e: unknown) => {
        setStep('ingest');
        setImportWarnings([t('App.could_not_read', { p0: handoff.file.name, p1: e instanceof Error ? e.message : 'unknown error' })]);
      });
    // Mount only: a handoff is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Queue changes during loading/inference without restarting the model download.
  // Only the newest document/settings may publish results or status.
  const [nerQueue] = useState(() => new NerQueue<{
    rawMarkdown: string;
    rules: CustomDictionaryRule[];
    settings: CategorySettings;
    profile: DetectionProfile;
    revision: number;
  }>(async ({ rawMarkdown, rules, settings, profile, revision }, isCurrent) => {
    nerClientRef.current ??= new NerClient();
    try {
      const entities = await nerClientRef.current.runNer(rawMarkdown, (status) => {
        if (isCurrent() && revision === scanRevision.current) setNerStatus(status);
      });
      if (!isCurrent() || revision !== scanRevision.current) return;
      const { mappings, anonymizedText } = anonymizeWithNer(rawMarkdown, rules, entities, settings, [], profile);
      setSession((prev) => ({ ...prev, mappings, anonymizedMarkdown: anonymizedText, detectionProfile: profile }));
    } catch (error) {
      if (isCurrent() && revision === scanRevision.current) setNerStatus({ state: 'error', message: error instanceof Error ? error.message : 'NER processing failed.' });
    }
  }));

  const handlePasteChange = (rawMarkdown: string, newDocument = false) => {
    // Editing the text by hand makes the imported document's warnings stale.
    setImportWarnings([]);
    const profile = newDocument ? suggestProfile(langDetect(rawMarkdown), pinnedProfile, locale) : profileForText(rawMarkdown);
    runAnonymize(rawMarkdown, dictionaryRules, categorySettings, profile);
  };

  // A paste that replaces the document (see PastePanel) or text from the
  // landing: start clean, then detect as usual.
  const handleNewDocumentText = (rawMarkdown: string) => {
    resetForNewDocument();
    handlePasteChange(rawMarkdown, true);
  };

  // Changes to pins or the locale fallback may change the automatic profile.
  // Document edits already scanned by their handlers are skipped here.
  useEffect(() => {
    if (!session.rawMarkdown || scannedProfile.current === profileSignature) return;
    runAnonymize(session.rawMarkdown, dictionaryRules, categorySettings, activeProfile);
  }, [profileSignature, session.rawMarkdown, activeProfile, nerEnabled, dictionaryRules, categorySettings]);

  useEffect(() => {
    if (nerEnabled && session.rawMarkdown) {
      nerQueue.submit({ rawMarkdown: session.rawMarkdown, rules: dictionaryRules, settings: categorySettings,
        profile: activeProfile, revision: scanRevision.current });
    }
    return () => nerQueue.invalidate();
  }, [nerEnabled, session.sessionId, session.rawMarkdown, dictionaryRules, categorySettings, activeProfile, nerQueue]);

  const updateProfile = (profile: DetectionProfile) => {
    const settings = enableJurisdictionPresets(categorySettings, activeProfile, profile);
    setDocumentProfile(profile);
    setCategorySettings(settings);
    runAnonymize(session.rawMarkdown, dictionaryRules, settings, profile);
  };

  const pinProfile = () => {
    setPinnedProfile(activeProfile);
    setDocumentProfile(activeProfile);
    setProfileSaved(savePinnedProfile(activeProfile));
  };

  const clearProfilePins = () => {
    setPinnedProfile(null);
    setDocumentProfile(null);
    setProfileSaved(savePinnedProfile(null));
  };

  const handleNerToggle = (checked: boolean) => {
    // L3: NER is slow on a book-length text; the user may still turn it on.
    if (checked && isLongForNer(session.rawMarkdown) && !window.confirm(nerLongDocumentMessage(session.rawMarkdown.length))) {
      return;
    }
    setNerEnabled(checked);
    if (!checked) {
      nerQueue.invalidate();
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
    nerQueue.invalidate();
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
    runAnonymize(session.rawMarkdown, rules);
  };

  // P11: changing a category toggle re-runs detection for the current document.
  const updateCategorySettings = (settings: CategorySettings) => {
    setCategorySettings(settings);
    runAnonymize(session.rawMarkdown, dictionaryRules, settings);
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
      t('App.clear_all_local_data') +
        t('App.this_removes_the_current_document_its_placeholders') +
        t('App.and_the_downloaded_ai_model_from_this'),
    );
    if (!ok) return;
    nerQueue.invalidate();
    nerClientRef.current?.terminate();
    nerClientRef.current = null;
    clearLocalData();
    void deleteModelCache().finally(() => window.location.reload());
  };

  const startOver = (): void => {
    const ok = window.confirm(
      t('App.start_again_with_a_new_document') +
        t('App.this_clears_the_current_text_its_placeholders') +
        t('App.without_the_placeholders_an_ai_response_for') +
        t('App.your_custom_rules_are_kept'),
    );
    if (!ok) return;
    resetForNewDocument();
    setStep('ingest');
    setViewMode(defaultMode);
  };
  const restored = aiResponse ? reverseText(aiResponse, session.mappings) : '';
  // The AI reply is Markdown. The Markdown view renders it (sanitized here,
  // once: both innerHTML and the clipboard's text/html use it); the HTML view
  // shows the same sanitized HTML as source.
  const restoredHtml = useMemo(
    () => (restored && restoreFormat !== 'plain' ? DOMPurify.sanitize(markdownToHtml(restored)) : ''),
    [restored, restoreFormat],
  );
  const restoredPlain = useMemo(
    () => (restored && restoreFormat === 'plain' ? markdownToPlainText(restored) : ''),
    [restored, restoreFormat],
  );
  const restoredView = restoreFormat === 'plain' ? restoredPlain : restoredHtml;
  const copyAction: CopyAction | undefined =
    position.subStep === 'sanitized'
      ? { label: t('App.copy_sanitized_text'), text: sanitizedText, doneMessage: t('App.copied_your_text_is_ready_to_send') }
      : position.subStep === 'restored'
        ? {
            label: t('App.copy_restored_text'),
            text: restoreFormat === 'plain' ? restoredPlain : restoreFormat === 'html' ? restoredHtml : restored,
            // Markdown: rich text for Word/Docs/email, the Markdown source for plain editors.
            html: restoreFormat === 'markdown' ? restoredHtml : undefined,
            doneMessage: t('App.copied_your_restored_text_is_on_the'),
          }
        : undefined;

  const languageSetup = <LanguageRegionSetup detection={languageDetection} profile={activeProfile}
    pinned={pinnedProfile} onChange={updateProfile} onPin={pinProfile} onClearPins={clearProfilePins}
    onUseSuggestions={() => setDocumentProfile(null)} />;

  return (
    <div className="app-shell">
      <header className="app-header">
        {/* The portable build has no landing to go back to. */}
        {__PORTABLE__ ? (
          <span className="app-mark" aria-hidden="true">A</span>
        ) : (
          <a className="app-mark" aria-label={t('App.anonymaizer_home')} {...linkProps('/')}>A</a>
        )}
        <div className="app-title">
          <h1>
            <BrandName />
            <BetaBadge />
            <span className="app-version">v{__APP_VERSION__}</span>
          </h1>
          <p className="app-tagline">{t('App.sanitize_text_before_sending_it_to_an')}</p>
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
              {t('App.quick_view')}</button>
          )}
          <LanguagePicker />
          <ThemeToggle theme={theme} onChange={setTheme} />
          <button type="button" className="settings-button" aria-haspopup="dialog" onClick={() => openSettings()}>
            {t('App.settings')}</button>
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
          {!sessionSaved && (
            <p className="session-unsaved" role="alert">
              {t('App.this_document_is_too_large_to_survive')}</p>
          )}
          {!profileSaved && <p className="session-unsaved" role="alert">{t('LanguageRegion.not_saved')}</p>}

          {step === 'ingest' && (
            <IngestStep
              rawMarkdown={session.rawMarkdown}
              warnings={importWarnings}
              onChange={handlePasteChange}
              onNewDocument={handleNewDocumentText}
              onCreateRule={handleCreateRule}
              onFileImport={handleFileImport}
              defaultMode={defaultMode}
              onRun={runInMode}
              setup={languageSetup}
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

          {step === 'restore' && (
            <ReversalPanel
              session={session}
              aiResponse={aiResponse}
              restored={restored}
              restoredView={restoredView}
              restoreFormat={restoreFormat}
              onRestoreFormatChange={setRestoreFormat}
              onAiResponseChange={setAiResponse}
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
            {languageSetup}
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
        <span>{t('App.runs_entirely_in_your_browser_no_text')}</span>
        <nav className="app-footer-links" aria-label={t('App.legal')}>
          <SiteLinks />
          <Copyright />
        </nav>
      </footer>
    </div>
  );
}

export default App;
