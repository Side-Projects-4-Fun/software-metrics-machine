import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface Contributor {
  login: string
  avatar_url: string
  html_url: string
  contributions: number
}

interface CacheEntry {
  data: Contributor[]
  fetchedAt: number
}

const CACHE_DIR = join(import.meta.dirname, 'node_modules', '.cache')
const CACHE_FILE = join(CACHE_DIR, 'contributors.json')
const CACHE_TTL_MS = 60 * 60 * 1000

function readCache(): Contributor[] | null {
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8')
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
      return entry.data
    }
  } catch {
    // no cache or expired
  }
  return null
}

function writeCache(contributors: Contributor[]): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }
    const entry: CacheEntry = { data: contributors, fetchedAt: Date.now() }
    writeFileSync(CACHE_FILE, JSON.stringify(entry))
  } catch {
    // non-fatal
  }
}

async function fetchContributors(): Promise<Contributor[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SMM-Docs-Build',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const response = await fetch(
    'https://api.github.com/repos/Side-Projects-4-Fun/software-metrics-machine/contributors',
    { headers },
  )

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`)
  }

  return response.json() as Promise<Contributor[]>
}

export default {
  async load() {
    const cached = readCache()
    if (cached) {
      return { contributors: cached }
    }

    try {
      const contributors = await fetchContributors()
      writeCache(contributors)
      return { contributors }
    } catch {
      return { contributors: [] }
    }
  },
}
