import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import GithubSlugger from 'github-slugger'
import YAML from 'yaml'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(toolDirectory, '../..')
const docsRoot = path.join(root, 'docs')
const errors = []
let mermaidCount = 0

const markdownFiles = await collectMarkdownFiles(docsRoot)
const markdownByKey = new Map()

for (const file of markdownFiles) {
  const relative = path.relative(docsRoot, file).split(path.sep).join('/')
  const withoutExtension = relative.replace(/\.md$/i, '')
  markdownByKey.set(withoutExtension, file)
  markdownByKey.set(relative, file)
}

const parsedFiles = new Map()
for (const file of markdownFiles) {
  const content = await readFile(file, 'utf8')
  parsedFiles.set(file, parseMarkdown(file, content))
}

for (const [file, parsed] of parsedFiles) {
  validateFrontmatter(file, parsed)
  validateWikilinks(file, parsed)
}

await validateAdrIndex()
validateSchemaContracts()

if (errors.length > 0) {
  console.error(`Documentation check failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Documentation check passed: ${markdownFiles.length} files, ${mermaidCount} Mermaid blocks, 0 broken internal links.`)

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === '.obsidian') continue
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(candidate))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(candidate)
  }
  return files.sort()
}

function parseMarkdown(file, content) {
  const lines = content.split(/\r?\n/)
  let frontmatter
  let bodyStart = 0
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1)
    if (end === -1) {
      report(file, 1, 'frontmatter is not closed')
    } else {
      try {
        frontmatter = YAML.parse(lines.slice(1, end).join('\n'))
      } catch (error) {
        report(file, 1, `invalid YAML frontmatter: ${error.message}`)
      }
      bodyStart = end + 1
    }
  }

  const headings = new Set()
  const slugger = new GithubSlugger()
  const visibleLines = []
  let fence = null
  let fenceStart = 0
  let mermaidBody = []
  let inlineCodeRemoved

  for (let index = bodyStart; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})([^`]*)$/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (!fence) {
        fence = { marker, length: fenceMatch[1].length, language: fenceMatch[2].trim().toLowerCase() }
        fenceStart = index + 1
        mermaidBody = []
      } else if (marker === fence.marker && fenceMatch[1].length >= fence.length) {
        if (fence.language === 'mermaid') {
          mermaidCount += 1
          if (mermaidBody.join('\n').trim() === '') report(file, fenceStart, 'Mermaid block is empty')
        }
        fence = null
      } else if (fence.language === 'mermaid') {
        mermaidBody.push(line)
      }
      visibleLines.push('')
      continue
    }

    if (fence) {
      if (fence.language === 'mermaid') mermaidBody.push(line)
      visibleLines.push('')
      continue
    }

    inlineCodeRemoved = line.replace(/`[^`]*`/g, '')
    visibleLines.push(inlineCodeRemoved)
    const heading = inlineCodeRemoved.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    if (heading) headings.add(slugger.slug(stripHeadingMarkup(heading[1])))
  }

  if (fence) report(file, fenceStart, `unclosed ${fence.language || 'code'} fence`)

  return { content, lines, visibleContent: visibleLines.join('\n'), headings, frontmatter }
}

function validateFrontmatter(file, parsed) {
  if (!parsed.frontmatter) {
    if (path.basename(file) !== 'docs.md') report(file, 1, 'missing YAML frontmatter')
    return
  }

  if (!parsed.frontmatter.artifact_type && !parsed.frontmatter.aliases) {
    report(file, 1, 'frontmatter needs artifact_type or aliases')
  }

  if (!file.includes(`${path.sep}adr${path.sep}`) || path.basename(file) === 'README.md') return

  const name = path.basename(file)
  const match = name.match(/^(\d{4})-[a-z0-9-]+\.md$/)
  if (!match) {
    report(file, 1, 'ADR filename must match NNNN-kebab-case.md')
    return
  }

  const allowedStatuses = new Set(['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REJECTED'])
  if (parsed.frontmatter.artifact_type !== 'adr') report(file, 1, 'ADR artifact_type must be adr')
  if (!allowedStatuses.has(parsed.frontmatter.status)) report(file, 1, 'ADR status is invalid')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.frontmatter.date ?? ''))) report(file, 1, 'ADR date must use YYYY-MM-DD')
  if (!Array.isArray(parsed.frontmatter.decision_ids) || parsed.frontmatter.decision_ids.length === 0) {
    report(file, 1, 'ADR decision_ids must be a non-empty list')
  }
  const expectedTitle = `# ADR-${match[1]}`
  if (!parsed.lines.some((line) => line.startsWith(expectedTitle))) report(file, 1, `ADR title must start with ${expectedTitle}`)
}

function validateWikilinks(sourceFile, parsed) {
  const linkPattern = /\[\[([^\]]+)\]\]/g
  let match
  while ((match = linkPattern.exec(parsed.visibleContent)) !== null) {
    const line = parsed.visibleContent.slice(0, match.index).split('\n').length
    const rawTarget = match[1].split('|', 1)[0].trim()
    if (!rawTarget) {
      report(sourceFile, line, 'empty wikilink target')
      continue
    }
    const [filePart, headingPart] = rawTarget.split('#', 2)
    const targetFile = resolveTarget(sourceFile, filePart)
    if (!targetFile) {
      report(sourceFile, line, `broken wikilink target: ${rawTarget}`)
      continue
    }
    if (headingPart) {
      const slugger = new GithubSlugger()
      const expectedAnchor = slugger.slug(stripHeadingMarkup(headingPart))
      const target = parsedFiles.get(targetFile)
      if (!target.headings.has(expectedAnchor)) report(sourceFile, line, `missing wikilink heading: ${rawTarget}`)
    }
  }
}

function resolveTarget(sourceFile, filePart) {
  if (!filePart) return sourceFile
  const sourceDirectory = path.dirname(sourceFile)
  const absolute = path.resolve(sourceDirectory, filePart)
  const relative = path.relative(docsRoot, absolute).split(path.sep).join('/').replace(/\.md$/i, '')
  return markdownByKey.get(relative) ?? markdownByKey.get(`${relative}.md`)
}

async function validateAdrIndex() {
  const index = await readFile(path.join(docsRoot, 'adr', 'README.md'), 'utf8')
  const adrFiles = markdownFiles.filter((file) => /\/adr\/\d{4}-/.test(file))
  for (const file of adrFiles) {
    const stem = path.basename(file, '.md')
    if (!index.includes(`[[${stem}|`)) report(path.join(docsRoot, 'adr', 'README.md'), 1, `ADR index is missing ${stem}`)
  }
}

function validateSchemaContracts() {
  const schemaDirectory = `${path.sep}schema${path.sep}`
  const contracts = [...parsedFiles.entries()].filter(([file, parsed]) =>
    file.includes(schemaDirectory) && parsed.frontmatter?.artifact_type === 'r1-schema-contract')
  const tableOwners = new Map()
  const requiredFragments = ['Owner / tranche / purpose', 'Trace']

  for (const [file, parsed] of contracts) {
    if (parsed.frontmatter.status !== 'ACCEPTED') report(file, 1, 'R1 schema contract status must be ACCEPTED')
    if (!Array.isArray(parsed.frontmatter.module_owners) || parsed.frontmatter.module_owners.length === 0) {
      report(file, 1, 'R1 schema contract needs non-empty module_owners')
    }
    for (const fragment of requiredFragments) {
      if (!parsed.content.includes(fragment)) report(file, 1, `R1 schema contract missing required fragment: ${fragment}`)
    }

    const tablePattern = /^#{2,3} `([a-z][a-z0-9_]*)`\s*$/gm
    let match
    while ((match = tablePattern.exec(parsed.visibleContent)) !== null) {
      const table = match[1]
      const previous = tableOwners.get(table)
      if (previous && previous !== file) {
        report(file, parsed.visibleContent.slice(0, match.index).split('\n').length, `table ${table} already owned by ${path.relative(root, previous)}`)
      } else {
        tableOwners.set(table, file)
      }
    }
  }

  if (contracts.length !== 5) report(path.join(docsRoot, 'schema', 'README.md'), 1, `expected 5 R1 schema contract files, found ${contracts.length}`)
}

function stripHeadingMarkup(value) {
  return value.replace(/\[([^\]]+)]\([^)]*\)/g, '$1').replace(/[*_~]/g, '').trim()
}

function report(file, line, message) {
  errors.push(`${path.relative(root, file).split(path.sep).join('/')}:${line} ${message}`)
}
