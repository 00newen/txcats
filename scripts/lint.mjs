import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const files = process.argv.slice(2)

if (files.length === 0) {
  console.error('No files provided to lint.')
  process.exit(1)
}

const violations = []

for (const file of files) {
  const source = readFileSync(resolve(file), 'utf8')
  const importMatches = source.matchAll(/(?:from\s+|import\()['"]([^'"]+)['"]/g)
  for (const match of importMatches) {
    if (match[1].startsWith('@/src/')) {
      violations.push(`${file}: use the path aliases under "@/..." instead of "${match[1]}"`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}
