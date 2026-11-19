import type { Plugin } from 'vite'

export interface PortableAsset {
  kind: 'script' | 'style'
  content: string
}

// Only inline exact bundle references emitted by Vite; no glob matching is needed.
export const inlinePortableHtml = (html: string, assets: Map<string, PortableAsset>) => {
  const inlined = new Set<string>()
  const lookup = (url: string) => assets.get(url.replace(/^\.\//, ''))
  html = html.replace(/<script\b([^>]*?)\s+src="([^"]+)"([^>]*)><\/script>/g,
    (tag, before: string, url: string, after: string) => {
      const asset = lookup(url)
      if (asset?.kind !== 'script') return tag
      inlined.add(url.replace(/^\.\//, ''))
      const code = asset.content
        .replace(/"?__VITE_PRELOAD__"?/g, 'void 0')
        .replace(/<(?=\/script\b|!--)/gi, '\\x3C')
      return `<script${before}${after}>${code.trim()}</script>`
    })
  html = html.replace(/<link\b([^>]*?)\s+href="([^"]+)"([^>]*)>/g,
    (tag, before: string, url: string, after: string) => {
      const asset = lookup(url)
      if (asset?.kind !== 'style' || !/\brel="stylesheet"/.test(before + after)) return tag
      inlined.add(url.replace(/^\.\//, ''))
      const css = asset.content.replace(/@charset\s+"UTF-8";/gi, '')
        .replace(/<(?=\/style\b)/gi, '\\3C ')
      return `<style>${css.trim()}</style>`
    })
  return { html, inlined }
}

// The portable file is opened from file:// (or copied to any server), so it has
// no response headers and, until this, no Content-Security-Policy at all: the
// hosted build's `img-src 'self'` (vite.config.ts, headersFile) did not apply,
// and anything rendered from an AI reply could load a remote resource.
// A <meta> policy travels with the file. It names only the directives for
// content that loads on render — nothing here restricts scripts or workers,
// whose file:// behaviour differs between browsers and is not worth a blank
// page. `file:` lets a sibling favicon load when opened from disk.
export const PORTABLE_CSP = [
  "img-src 'self' data: blob: file:",
  "media-src 'none'",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

export const withPortableCsp = (html: string): string =>
  html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PORTABLE_CSP}" />`)

export const portableBuild = (): Plugin => ({
  name: 'anonymaizer-portable-build',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const assets = new Map<string, PortableAsset>()
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') {
        assets.set(file.fileName, { kind: 'script', content: file.code })
      } else if (file.fileName.endsWith('.css')) {
        assets.set(file.fileName, { kind: 'style', content: String(file.source) })
      }
    }
    const inlined = new Set<string>()
    for (const file of Object.values(bundle)) {
      if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue
      const result = inlinePortableHtml(String(file.source), assets)
      file.source = withPortableCsp(result.html)
      result.inlined.forEach((name) => inlined.add(name))
    }
    for (const name of inlined) delete bundle[name]
    // A split app chunk would make file:// imports fail. Workers are emitted
    // by a separate build and remain separate, as before.
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') this.error(`Portable build left an external script: ${file.fileName}`)
    }
  },
})
