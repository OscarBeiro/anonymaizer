// Zips the XML parts from src/core/export/xlsxExport.ts into .xlsx bytes;
// jszip stays out of core (hard rule 4). Imported lazily, like the parsers,
// so it stays out of the main chunk.
export const zipXlsxParts = async (parts: Record<string, string>): Promise<ArrayBuffer> => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const [path, xml] of Object.entries(parts)) zip.file(path, xml);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
};
