import { expect, it } from 'vitest';
import { structuredDocument } from './structuredDocument';
import type { MappingItem } from './types';
it('retains semantic headings, nested lists and rectangular tables without activating resources', () => {
  const result = structuredDocument('# Heading\n\n- parent\n  - child\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![image](https://secret.invalid)\n\n<script>x</script>');
  expect(result.html).toContain('<h1>Heading</h1>');
  expect(result.html.match(/<ul>/g)).toHaveLength(2);
  expect(result.html).toContain('<th>A</th>');
  expect(result.html).toContain('<td>2</td>');
  expect(result.html).not.toMatch(/<img|<script|href=|src=/);
  expect(result.markdown).not.toContain('https://secret.invalid');
  expect(result.warnings).toHaveLength(2);
});
it.each(['pipes | and [brackets]', '`code`\nnew line', '<img src="https://secret.invalid">', '![x](https://secret.invalid)', '$& [[NAME_001]]'])('inserts originals as literal text: %s', original => {
  const placeholder = `[[V1_${'A'.repeat(32)}_CUSTOM_1]]`;
  const m: MappingItem = { id: 'a', placeholder, originalText: original, variants: [original], category: 'CUSTOM', confidence: 1, enabled: true, source: 'manual' };
  const r = structuredDocument(`| Name |\n|---|\n| ${placeholder} |`, [m]);
  expect(r.plain).toContain(original);
  expect(r.html).not.toMatch(/<img|href=|src="/);
  expect(r.markdown).not.toContain('![x](');
});
