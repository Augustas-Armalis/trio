// After `vite build` (single-file): derive the artifact fragment from dist/index.html.
// The Claude Artifact tool wraps a page fragment (title, style, markup, script) in its own skeleton.
import { readFile, writeFile } from 'node:fs/promises'

const html = await readFile('dist/index.html', 'utf8')
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
const fonts = html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/)?.[0] ?? ''
if (!styles || !scripts) throw new Error('single-file build is missing inline style or script')
const safe = scripts.replace(/<\/script/gi, '<\\/script')
const fragment = `<title>Trio</title>\n${fonts}\n<style>${styles}</style>\n<div id="root"></div>\n<script type="module">${safe}</script>\n`
await writeFile('dist/artifact.html', fragment)
console.log(`artifact fragment ${(fragment.length / 1024).toFixed(0)}KB, single file ${(html.length / 1024).toFixed(0)}KB`)
