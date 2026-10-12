import { expect, it } from 'vitest';
import { ExpansionBudget } from './processingLimits';
it('enforces actual expanded sizes and entry counts independently of ZIP metadata', () => {
  expect(() => new ExpansionBudget(2001)).toThrow('entries');
  const b = new ExpansionBudget(100);
  expect(() => b.add(2000001)).toThrow('limits');
  const c = new ExpansionBudget(100);
  for (let i = 0; i < 10; i++) { c.beginEntry(); c.add(2000000); }
  c.beginEntry(); expect(() => c.add(1)).toThrow('limits');
});
