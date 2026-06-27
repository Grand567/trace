/**
 * Download raster map tiles for offline use.
 *
 * Saves tiles to public/tiles/{z}/{x}/{y}.png (served as /tiles/... in the app).
 * The app never calls OSM servers at runtime — only this dev script does.
 *
 * Usage:
 *   npm run tiles:download
 *   npm run tiles:download -- --force
 *   npm run tiles:download -- --min-zoom 14 --max-zoom 17
 *
 * OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
 * Use a valid User-Agent, keep zoom/area small, and bundle tiles offline.
 */

import { createHash } from 'node:crypto'
import { mkdir, access, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'tiles')

// OSM requires a clear, valid User-Agent identifying the app + contact.
const USER_AGENT =
  'Mozilla/5.0 (compatible; travel-assistant/1.0; +https://github.com/Grand567/trace)'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

// Known "tile usage policy" placeholder returned when OSM blocks a request.
const BLOCKED_TILE_HASH = 'b02c44252dac5a5e820ecef1e9bf9200e9407c042df668a466a1aa81a9eccca7a'

const DEFAULT_BOUNDS = {
  north: 27.7065,
  south: 27.7025,
  west: 85.3045,
  east: 85.3095,
}

const DEFAULT_MIN_ZOOM = 14
const DEFAULT_MAX_ZOOM = 17
const REQUEST_DELAY_MS = 600
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

function parseArgs(argv) {
  const options = {
    bounds: { ...DEFAULT_BOUNDS },
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    force: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--force') options.force = true
    else if (arg === '--min-zoom') options.minZoom = Number(argv[++i])
    else if (arg === '--max-zoom') options.maxZoom = Number(argv[++i])
    else if (arg === '--north') options.bounds.north = Number(argv[++i])
    else if (arg === '--south') options.bounds.south = Number(argv[++i])
    else if (arg === '--west') options.bounds.west = Number(argv[++i])
    else if (arg === '--east') options.bounds.east = Number(argv[++i])
  }

  if (options.minZoom > options.maxZoom) {
    throw new Error('min-zoom must be <= max-zoom')
  }

  return options
}

function lonToTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom)
}

function latToTileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom,
  )
}

function tileRangeForBounds(bounds, zoom) {
  const xMin = lonToTileX(bounds.west, zoom)
  const xMax = lonToTileX(bounds.east, zoom)
  const yMin = latToTileY(bounds.north, zoom)
  const yMax = latToTileY(bounds.south, zoom)

  return { xMin, xMax, yMin, yMax }
}

function listTiles(bounds, minZoom, maxZoom) {
  const tiles = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const { xMin, xMax, yMin, yMax } = tileRangeForBounds(bounds, z)
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y })
      }
    }
  }

  return tiles
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlockedTile(buffer) {
  if (buffer.length < 5000) {
    return true
  }

  const hash = createHash('sha256').update(buffer).digest('hex')
  return hash === BLOCKED_TILE_HASH
}

async function needsDownload(outPath, force) {
  if (force || !(await fileExists(outPath))) {
    return true
  }

  const existing = await readFile(outPath)
  return isBlockedTile(existing)
}

async function downloadTile(z, x, y, force) {
  const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)
  const outPath = join(OUT_DIR, String(z), String(x), `${y}.png`)

  if (!(await needsDownload(outPath, force))) {
    return 'skipped'
  }

  await mkdir(dirname(outPath), { recursive: true })

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      })

      if (response.status === 404) {
        return 'missing'
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())

      if (isBlockedTile(buffer)) {
        throw new Error('OSM returned tile usage policy block image — slow down or fix User-Agent')
      }

      await writeFile(outPath, buffer)
      return 'downloaded'
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`z=${z} x=${x} y=${y}: ${error.message}`)
      }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  return 'failed'
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const tiles = listTiles(options.bounds, options.minZoom, options.maxZoom)

  console.log('Downloading map tiles for offline bundle')
  console.log('  bounds:', options.bounds)
  console.log(`  zoom: ${options.minZoom}–${options.maxZoom}`)
  console.log(`  tiles: ${tiles.length}`)
  console.log(`  output: ${OUT_DIR}`)
  console.log(`  force: ${options.force}`)

  const results = { downloaded: 0, skipped: 0, missing: 0, failed: 0 }

  for (let i = 0; i < tiles.length; i++) {
    const { z, x, y } = tiles[i]
    let status
    try {
      status = await downloadTile(z, x, y, options.force)
    } catch (err) {
      process.stdout.write(`\n  ⚠ skipping z=${z} x=${x} y=${y}: ${err.message}\n`)
      status = 'failed'
    }
    results[status]++
    process.stdout.write(
      `\r${i + 1}/${tiles.length} (new: ${results.downloaded}, skip: ${results.skipped}, bad/missing: ${results.missing + results.failed})`,
    )
    await sleep(REQUEST_DELAY_MS)
  }

  process.stdout.write('\n')
  console.log('Done:', results)

  if (results.failed > 0) {
    process.exit(1)
  }
}

main().catch(async (error) => {
  console.error('\n' + error.message)
  console.error('Tip: run again with --force after a few minutes, or reduce zoom range.')
  process.exit(1)
})
