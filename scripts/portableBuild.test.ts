import { describe, expect, it } from 'vitest'
import { inlinePortableHtml } from './portableBuild'

describe('portable HTML inlining', () => {
  it('inlines exact entry and stylesheet references while preserving literal replacements', () => {
    const result = inlinePortableHtml(
      '<script type="module" crossorigin src="./entry.js"></script><link rel="stylesheet" href="./entry.css">',
      new Map([
        ['entry.js', { kind: 'script', content: 'console.log("$&", "__VITE_PRELOAD__")' }],
        ['entry.css', { kind: 'style', content: '@charset "UTF-8";body { color: red; }' }],
      ]),
    )
    expect(result.html).toBe('<script type="module" crossorigin>console.log("$&", void 0)</script><style>body { color: red; }</style>')
    expect([...result.inlined]).toEqual(['entry.js', 'entry.css'])
  })

  it('escapes HTML raw-text terminators and comment starts in embedded content', () => {
    const result = inlinePortableHtml(
      '<script src="entry.js"></script><link href="entry.css" rel="stylesheet">',
      new Map([
        ['entry.js', { kind: 'script', content: 'console.log("</SCRIPT>", "<!--")' }],
        ['entry.css', { kind: 'style', content: 'a::after { content: "</STYLE>"; }' }],
      ]),
    )
    expect(result.html).toContain('"\\x3C/SCRIPT>"')
    expect(result.html).toContain('"\\x3C!--"')
    expect(result.html).toContain('"\\3C /STYLE>"')
  })

  it('leaves workers, remote scripts and non-stylesheet links untouched', () => {
    const html = '<script src="https://example.com/entry.js"></script><link rel="preload" href="entry.css">'
    const result = inlinePortableHtml(html, new Map([
      ['entry.js', { kind: 'script', content: 'app()' }],
      ['worker.js', { kind: 'script', content: 'worker()' }],
      ['entry.css', { kind: 'style', content: 'body {}' }],
    ]))
    expect(result.html).toBe(html)
    expect(result.inlined.size).toBe(0)
  })
})
