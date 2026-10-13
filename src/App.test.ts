// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { IngestStep } from './components/IngestStep';
import type { NerToggle } from './components/NerToggle';
import type { NerEntity } from './core/ner';

const state = vi.hoisted(() => ({
  ingest: null as ComponentProps<typeof IngestStep> | null,
  ner: null as ComponentProps<typeof NerToggle> | null,
  scans: [] as { text: string; resolve: (entities: NerEntity[]) => void }[],
}));
vi.mock('./lib/parsers', () => ({}));
vi.mock('./components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('./lib/theme', () => ({ applyTheme: vi.fn(), watchSystemTheme: () => () => {} }));
vi.mock('./components/IngestStep', () => ({ IngestStep: (props: ComponentProps<typeof IngestStep>) => { state.ingest = props; return null; } }));
vi.mock('./components/NerToggle', () => ({ NerToggle: (props: ComponentProps<typeof NerToggle>) => { state.ner = props; return null; } }));
vi.mock('./components/SettingsMenu', () => ({ SettingsMenu: ({ detection }: { detection: React.ReactNode }) => detection }));
vi.mock('./lib/nerClient', () => ({ NerClient: class {
  runNer(text: string) { return new Promise<NerEntity[]>((resolve) => state.scans.push({ text, resolve })); }
  terminate() {}
} }));
import App from './App';
import { saveSession } from './lib/session';
vi.mock('./lib/session', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lib/session')>(),
  saveSession: vi.fn(() => true),
}));
const loadSession = () => vi.mocked(saveSession).mock.calls.at(-1)![0];

let root: Root;
beforeEach(async () => {
  localStorage.clear();
  state.scans = [];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(App)));
});
afterEach(async () => { await act(async () => root.unmount()); });

it('sanitises again when the downloaded model returns entities', async () => {
  await act(async () => state.ingest!.onChange('Zorvax'));
  await act(async () => state.ner!.onToggle(true));
  expect(state.scans[0].text).toBe('Zorvax');
  await act(async () => state.scans[0].resolve([{ entityGroup: 'PER', text: 'Zorvax', start: 0, end: 6, score: 0.99 }]));
  expect(loadSession()!.anonymizedMarkdown).not.toContain('Zorvax');
});

it('rescans the latest file imported during download without restoring the old document', async () => {
  await act(async () => state.ingest!.onChange('Old text'));
  await act(async () => state.ner!.onToggle(true));
  await act(async () => state.ingest!.onFileImport('Zorvax', 'raw_text', 'new.txt', []));
  expect(state.scans).toHaveLength(1);
  await act(async () => state.scans[0].resolve([]));
  expect(state.scans[1].text).toBe('Zorvax');
  expect(loadSession()!.rawMarkdown).toBe('Zorvax');
  await act(async () => state.scans[1].resolve([{ entityGroup: 'PER', text: 'Zorvax', start: 0, end: 6, score: 0.99 }]));
  expect(loadSession()!.anonymizedMarkdown).not.toContain('Zorvax');
  expect(loadSession()!.fileName).toBe('new.txt');
});

it('keeps the newest edit and ignores an old result after turning the model off', async () => {
  await act(async () => state.ingest!.onChange('Zorvax'));
  await act(async () => state.ner!.onToggle(true));
  await act(async () => state.ingest!.onChange('Current text'));
  await act(async () => state.ner!.onToggle(false));
  await act(async () => state.scans[0].resolve([{ entityGroup: 'PER', text: 'Zorvax', start: 0, end: 6, score: 0.99 }]));
  expect(loadSession().rawMarkdown).toBe('Current text');
  expect(state.scans).toHaveLength(1);
  expect(loadSession().mappings.some((mapping) => mapping.originalText === 'Zorvax')).toBe(false);
});

it('automatically scans files imported after the model is ready', async () => {
  await act(async () => state.ingest!.onChange('Initial document'));
  await act(async () => state.ner!.onToggle(true));
  await act(async () => state.scans[0].resolve([]));
  await act(async () => state.ingest!.onFileImport('Zorvax', 'raw_text', 'later.txt', []));
  expect(state.scans[1].text).toBe('Zorvax');
  await act(async () => state.scans[1].resolve([{ entityGroup: 'PER', text: 'Zorvax', start: 0, end: 6, score: 0.99 }]));
  expect(loadSession().anonymizedMarkdown).toBe('[[NAME_001]]');
});
