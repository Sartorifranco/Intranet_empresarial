/**
 * Reemplaza resabios del rojo de marca legacy por utilidades BacarNet (azul #1E3A5F).
 *
 *   node scripts/migrate-brand-colors.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const REPLACEMENTS = [
  ['bg-red-50 dark:bg-red-950/40/40', 'bg-brand-tint'],
  ['bg-red-50/60 dark:bg-red-950/20', 'bg-brand-tint/60'],
  ['bg-red-50/50 dark:bg-red-950/20', 'bg-brand-tint/50'],
  ['bg-red-50 dark:bg-red-950/40', 'bg-brand-tint'],
  ['bg-red-50 dark:bg-red-950/30', 'bg-brand-tint'],
  ['hover:bg-red-50 dark:hover:bg-red-950/40', 'hover:bg-brand-tint'],
  ['hover:bg-red-50 dark:hover:bg-red-950/30', 'hover:bg-brand-tint'],
  ['dark:group-hover:bg-red-950/40', 'dark:group-hover:bg-brand-tint'],
  ['group-hover:bg-red-50', 'group-hover:bg-brand-tint'],
  ['hover:bg-red-50 hover:text-brand-primary', 'hover:bg-brand-tint hover:text-brand-primary'],
  ['hover:bg-red-50 dark:bg-red-950/40', 'hover:bg-brand-tint'],
  ['ring-1 ring-red-100', 'ring-1 ring-brand-primary/15'],
  ['ring-red-100', 'ring-brand-primary/15'],
  ['focus:ring-red-900/20', 'focus:ring-brand-primary/20'],
  ['focus:ring-red-900/10', 'focus:ring-brand-primary/10'],
  ['focus:ring-4 focus:ring-red-900/10', 'focus:ring-4 focus:ring-brand-primary/10'],
  ['dark:focus:ring-red-900/20', 'dark:focus:ring-brand-primary/20'],
  ['hover:text-red-950', 'hover:opacity-90'],
  ['hover:border-red-900/30 hover:bg-neutral-50 hover:text-red-900', 'hover:border-brand-primary/30 hover:bg-neutral-50 hover:text-brand-primary'],
  ['dark:hover:border-red-500/40 dark:hover:bg-zinc-700 dark:hover:text-red-400', 'dark:hover:border-brand-primary/40 dark:hover:bg-zinc-700 dark:hover:text-brand-primary'],
  ['hover:border-red-900/30 hover:text-red-900', 'hover:border-brand-primary/30 hover:text-brand-primary'],
  ['hover:border-red-200 dark:hover:border-red-900/50', 'hover:border-brand-primary/25 dark:hover:border-brand-primary/40'],
  ['hover:border-red-200 dark:border-red-900/50', 'hover:border-brand-primary/25 dark:border-brand-primary/40'],
  ['hover:shadow-red-50', ''],
  ['bg-red-900 text-lg font-bold text-white', 'bg-brand-primary text-lg font-bold text-white'],
  ['rounded-xl bg-red-900 text-white', 'rounded-xl bg-brand-primary text-white'],
  ['rounded-full bg-red-900 text-white', 'rounded-full bg-brand-primary text-white'],
  ['bg-red-900 text-white', 'bg-brand-primary text-white'],
  ['inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900/20 dark:text-red-400', 'inline-flex rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-primary'],
  ['hover:bg-red-800', 'hover:bg-brand-primary-hover'],
  ['hover:bg-red-950', 'hover:bg-brand-primary-hover'],
  ['text-red-800', 'text-brand-primary'],
  ['accent-red-900', 'accent-brand'],
  ['focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-900/40', 'input-dark-focus focus:outline-none'],
  ['focus:border-red-900 focus:ring-4 focus:ring-red-900/10', 'input-brand-focus focus:ring-4 focus:ring-brand-primary/10'],
  ['dark:focus:border-red-800 dark:focus:ring-red-900/20', 'dark:focus:border-brand-primary dark:focus:ring-brand-primary/20'],
  ['bg-red-950/40 text-red-400', 'bg-brand-tint text-brand-primary'],
  ['? \'bg-red-900 text-white\'', '? \'bg-brand-primary text-white\''],
  ['bg-red-700 hover:bg-red-800', 'btn-danger'],
  ['hover:bg-red-50', 'hover:bg-brand-tint'],
  ['hover:bg-red-50 hover:text-red-700', 'hover-danger'],
  ['hover:bg-red-50 hover:text-red-600', 'hover:bg-brand-tint hover:text-brand-primary'],
  ['hover:bg-red-50 hover:text-red-900', 'hover:bg-brand-tint hover:text-brand-primary'],
  ['text-red-500 transition-colors hover:bg-red-50 hover:text-red-700', 'text-danger transition-colors hover-danger'],
  ['text-red-500 hover:bg-red-50 hover:text-red-700', 'text-danger hover-danger'],
  ['border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40', 'alert-error'],
  ['border border-red-200 bg-red-50 px-4 py-3', 'alert-error px-4 py-3'],
  ['rounded-lg border border-red-200 bg-red-50 px-4 py-3', 'rounded-lg alert-error px-4 py-3'],
  ['rounded-xl border border-red-200 bg-red-50 px-4 py-6', 'rounded-xl alert-error px-4 py-6'],
  ['rounded-2xl border border-red-200 bg-red-50 px-6 py-12', 'rounded-2xl alert-error px-6 py-12'],
  ['border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30', 'alert-error'],
  ['border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300', 'alert-error'],
  ['border border-red-200 bg-red-50 px-3 py-2', 'alert-error px-3 py-2'],
  ['rounded-lg border border-red-200 bg-red-50 px-3 py-2', 'rounded-lg alert-error px-3 py-2'],
  ['border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40/40', 'alert-error'],
  ['bg-red-50 dark:bg-red-950/40 text-brand-primary', 'bg-brand-tint text-brand-primary'],
  ['bg-red-50 dark:bg-red-950/40', 'bg-brand-tint'],
  ['bg-red-50 px-2.5', 'bg-brand-tint px-2.5'],
  ['dark:bg-red-950/40', 'dark:bg-brand-tint'],
  ['dark:bg-red-950/30', 'dark:bg-brand-tint'],
  ['dark:bg-red-950/20', 'dark:bg-brand-tint'],
  ['bg-red-50/50 dark:bg-red-950/20', 'bg-brand-tint/50'],
  ['border-red-100', 'border-brand-primary/15'],
  ['hover:border-red-200', 'hover:border-brand-primary/25'],
  ['dark:hover:border-red-900/50', 'dark:hover:border-brand-primary/40'],
  ['dark:hover:border-red-500/40 dark:hover:text-red-300', 'dark:hover:border-brand-primary/40 dark:hover:text-brand-primary'],
  ['group-hover:ring-red-100', 'group-hover:ring-brand-primary/15'],
  ['focus:ring-red-900/20', 'focus:ring-brand-primary/20'],
  ['focus:border-red-900', 'focus:border-brand-primary'],
  ['dark:focus:border-red-800', 'dark:focus:border-brand-primary'],
  ['hover:text-red-900', 'hover:text-brand-primary'],
  ['dark:hover:text-red-300', 'dark:hover:text-brand-primary'],
  ['dark:hover:text-red-400', 'dark:hover:text-brand-primary'],
  ['text-red-900 hover:underline dark:text-red-400', 'text-brand-primary hover:underline'],
  ['inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-900 px-3', 'inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-3'],
  ['bg-red-600 opacity-50', 'bg-brand-primary opacity-50'],
  ['bg-red-700 animate-pulse dark:bg-red-500', 'bg-brand-primary animate-pulse'],
  ['bg-red-700 hover:bg-brand-primary-hover', 'btn-danger'],
  ['bg-red-700', 'bg-brand-primary'],
  ['hover:text-red-600', 'hover:text-brand-primary'],
  ['hover:text-red-700 dark:hover:text-red-400', 'hover:text-danger'],
  ['dark:hover:text-red-500', 'dark:hover:text-brand-primary'],
  ['text-red-700 dark:text-red-300', 'text-danger'],
  ['text-red-600 dark:text-red-400', 'text-danger'],
  ['text-red-600', 'text-danger'],
  ['text-red-500', 'text-danger'],
  ['hover:text-red-700', 'hover:text-danger'],
  ['bg-red-50', 'bg-brand-tint'],
  ['dark:border-red-900/50 dark:bg-brand-tint dark:text-red-300', ''],
  ['dark:border-red-900/50 dark:bg-brand-tint', ''],
  ['dark:border-red-900/70 dark:bg-brand-tint dark:text-red-300', ''],
  ['dark:border-red-900 dark:bg-brand-tint dark:text-red-200', ''],
  ['border border-red-200 dark:border-red-900/50 bg-brand-tint', 'alert-error'],
  ['text-red-900 dark:text-red-400', 'text-brand-primary'],
  ['text-red-900 dark:bg-brand-tint dark:text-red-300', 'text-brand-primary dark:bg-brand-tint'],
  ['border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300', 'alert-error px-4 py-3 text-sm'],
  ['pdf: \'text-red-600 dark:text-red-400\'', 'pdf: \'text-brand-primary\''],
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path, files)
    } else if (['.tsx', '.ts', '.css'].includes(extname(name))) {
      files.push(path)
    }
  }
  return files
}

let totalChanges = 0
for (const file of walk(ROOT)) {
  let content = readFileSync(file, 'utf8')
  let changed = false
  for (const [from, to] of REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    writeFileSync(file, content, 'utf8')
    totalChanges += 1
    console.log('updated', file.replace(/\\/g, '/'))
  }
}

console.log(`\n${totalChanges} archivo(s) actualizados.`)
