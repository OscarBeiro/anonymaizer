import { createContext, useContext } from 'react';
import type { ExportFile, TextExportKind } from '../core/export/textExport';
export interface PreparedOutput { file: ExportFile; exportId: string; assertCurrent: () => void }
export interface OutputService {
  prepare: (text: string, kind: TextExportKind) => PreparedOutput;
  delivered: (exportId: string) => void;
}
export const OutputContext = createContext<OutputService | null>(null);
export const useOutput = (): OutputService => {
  const service = useContext(OutputContext);
  if (!service) throw new Error('Output preparation is unavailable.');
  return service;
};
