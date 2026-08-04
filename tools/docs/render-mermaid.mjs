import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(toolDirectory, '../..')
const outputRoot = path.join(root, 'build', 'docs', 'mermaid')
const mmdc = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc')
const config = path.join(toolDirectory, 'mermaid-puppeteer-config.json')
const files = await glob('docs/**/*.md', { cwd: root, absolute: true, ignore: ['docs/.obsidian/**'] })
const diagrams = []

for (const file of files.sort()) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/)
  let open = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!open) {
      const match = line.match(/^\s*(`{3,}|~{3,})mermaid\s*$/i)
      if (match) open = { marker: match[1][0], length: match[1].length, line: index + 1, body: [] }
      continue
    }
    const close = line.match(/^\s*(`{3,}|~{3,})\s*$/)
    if (close && close[1][0] === open.marker && close[1].length >= open.length) {
      diagrams.push({ file, line: open.line, source: open.body.join('\n') })
      open = null
    } else {
      open.body.push(line)
    }
  }
  if (open) throw new Error(`${path.relative(root, file)}:${open.line} unclosed Mermaid fence`)
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
const manifest = []

for (const [index, diagram] of diagrams.entries()) {
  const relative = path.relative(root, diagram.file).split(path.sep).join('/')
  const slug = relative.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9]+/g, '-')
  const base = `${String(index + 1).padStart(2, '0')}-${slug}`
  const input = path.join(outputRoot, `${base}.mmd`)
  const output = path.join(outputRoot, `${base}.svg`)
  await writeFile(input, `${diagram.source}\n`)
  const result = spawnSync(mmdc, ['-p', config, '-i', input, '-o', output, '-b', 'transparent'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${relative}:${diagram.line} Mermaid render failed`)
  }
  const outputStats = await stat(output)
  if (outputStats.size === 0) throw new Error(`${relative}:${diagram.line} rendered an empty SVG`)
  manifest.push({
    source: relative,
    line: diagram.line,
    output: path.relative(root, output).split(path.sep).join('/'),
    checksum: createHash('sha256').update(diagram.source).digest('hex'),
  })
}

await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Rendered ${manifest.length} Mermaid diagrams into ${path.relative(root, outputRoot)}.`)
