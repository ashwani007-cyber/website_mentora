import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class AsyncLock {
  private queue: Array<() => void> = []
  private locked = false

  acquire(): Promise<() => void> {
    return new Promise(resolve => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift()!
          next()
        } else {
          this.locked = false
        }
      }
      if (this.locked) {
        this.queue.push(() => resolve(release))
      } else {
        this.locked = true
        resolve(release)
      }
    })
  }
}
const bookingLock = new AsyncLock()
const projectReviewLock = new AsyncLock()


function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null
  const clean = timeStr.trim()
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const minutes = parseInt(match12[2], 10)
    const ampm = match12[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const hours = parseInt(match24[1], 10)
    const minutes = parseInt(match24[2], 10)
    return hours * 60 + minutes
  }
  return null
}

function getTodayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSlotInPast(dateStr: string, startTimeStr: string): boolean {
  const today = getTodayString()
  if (dateStr < today) return true
  if (dateStr > today) return false
  const startMin = parseTimeToMinutes(startTimeStr)
  if (startMin === null) return false
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  return startMin <= currentMin
}

function sharedDbPlugin(): Plugin {
  const DB_PATH = path.resolve(__dirname, 'db.json')

  const readDb = () => {
    try {
      if (fs.existsSync(DB_PATH)) {
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
        if (!Array.isArray(db.availabilities)) db.availabilities = []
        if (!Array.isArray(db.projectReviews)) db.projectReviews = []
        if (!Array.isArray(db.notifications)) db.notifications = []
        if (!Array.isArray(db.pricingAuditLogs)) db.pricingAuditLogs = []
        if (!Array.isArray(db.blogs)) db.blogs = []
        if (!Array.isArray(db.blogCategories)) db.blogCategories = []
        if (db.blogs.length === 0) {
          try {
            const seedPath = path.resolve(__dirname, 'src/data/seedBlogs.json')
            if (fs.existsSync(seedPath)) {
              const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
              if (Array.isArray(seed.articles) && seed.articles.length > 0) {
                db.blogs = seed.articles
              }
              if (Array.isArray(seed.categories) && seed.categories.length > 0) {
                db.blogCategories = seed.categories
              }
            }
          } catch {}
        }
        const nowIso = new Date().toISOString()
        if (!db.platformCharge) {
          if (db.projectReviewConfig) {
            db.platformCharge = {
              feeType: db.projectReviewConfig.feeType || 'fixed',
              feeValue: Number(db.projectReviewConfig.feeValue) ?? 200,
              currency: db.projectReviewConfig.currency || 'INR',
              updatedAt: db.projectReviewConfig.updatedAt || nowIso,
              updatedBy: db.projectReviewConfig.updatedBy || 'admin-governance'
            }
          } else {
            db.platformCharge = { feeType: 'fixed', feeValue: 200, currency: 'INR', updatedAt: nowIso, updatedBy: 'admin-governance' }
          }
        }
        if (!db.projectReviewConfig) {
          db.projectReviewConfig = { ...db.platformCharge }
        }
        return db
      }
    } catch (e) {
      console.error('[sharedDbPlugin] read error:', e)
    }
    return { experts: [], users: [], pendingVerifications: [], deletedExperts: [], kv: {}, availabilities: [], projectReviews: [], notifications: [] }

  }

  const writeDb = (data: any) => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.error('[sharedDbPlugin] write error:', e)
    }
  }

  const handleMiddleware = (req: any, res: any, next: any) => {
    const url = req.url || ''

    // Endpoint: /api/auth (MongoDB Authenticated Sessions & Admin Flow)
    if (url.startsWith('/api/auth')) {
      (async () => {
        try {
          const handlerPath = pathToFileURL(path.resolve(__dirname, 'server/mongoHandler.js')).href
          const mod = await import(`${handlerPath}?t=${Date.now()}`)
          await mod.handleApiMiddleware(req, res, next)
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })()
      return
    }

    // Endpoint: /api/db (GET all, POST update)
    if (url.startsWith('/api/db')) {
      if (req.method === 'GET') {
        const db = readDb()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(db))
        return
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const current = readDb()
            const updated = {
              ...current,
              ...payload,
              kv: { ...(current.kv || {}), ...(payload.kv || {}) }
            }
            writeDb(updated)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, db: updated }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }
    }

    // Endpoint: /api/kv (Key-Value real-time sync for session requests, bookings, reviews)
    if (url.startsWith('/api/kv')) {
      if (req.method === 'GET') {
        const parsedUrl = new URL(req.url, 'http://localhost:5173')
        const key = parsedUrl.searchParams.get('key')
        const current = readDb()
        const kv = current.kv || {}
        res.setHeader('Content-Type', 'application/json')
        if (key) {
          res.end(JSON.stringify({ success: true, key, value: kv[key] ?? null }))
        } else {
          res.end(JSON.stringify({ success: true, kv }))
        }
        return
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const current = readDb()
            const kv = current.kv || {}
            if (payload.key) {
              kv[payload.key] = payload.value
            }
            if (payload.updates && typeof payload.updates === 'object') {
              Object.assign(kv, payload.updates)
            }
            current.kv = kv
            writeDb(current)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, kv }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }
    }

    // Endpoint: /api/availability (CRUD, Batch, and Concurrency-Safe Booking)
    if (url.startsWith('/api/availability')) {
      const parsedUrl = new URL(req.url, 'http://localhost:5173')
      const pathname = parsedUrl.pathname

      // GET /api/availability (supports expertId, date, status query params)
      if (req.method === 'GET' && pathname === '/api/availability') {
        const expertId = parsedUrl.searchParams.get('expertId')
        const date = parsedUrl.searchParams.get('date')
        const status = parsedUrl.searchParams.get('status')
        const current = readDb()
        let list: any[] = current.availabilities || []

        if (expertId) {
          list = list.filter(a => a.expertId === expertId)
        }
        if (date) {
          list = list.filter(a => a.availabilityDate === date)
        }
        if (status) {
          list = list.filter(a => a.status === status)
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, availabilities: list }))
        return
      }

      // POST /api/availability/batch
      if (req.method === 'POST' && pathname === '/api/availability/batch') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const { expertId, availabilityDate, slots, requesterRole, requesterId } = payload

            if (!expertId || !availabilityDate || !Array.isArray(slots)) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'expertId, availabilityDate, and slots array are required' }))
              return
            }

            // Permissions
            if (requesterRole === 'client') {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Clients are not permitted to manage availability' }))
              return
            }
            if (requesterRole === 'expert' && requesterId && requesterId !== expertId) {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Experts can only manage their own availability' }))
              return
            }

            // Reject past dates
            const todayStr = getTodayString()
            if (availabilityDate < todayStr) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Cannot configure availability for past dates' }))
              return
            }

            const current = readDb()
            const existingList: any[] = current.availabilities || []
            const newAvailabilities: any[] = []
            const nowIso = new Date().toISOString()

            for (const s of slots) {
              const startMin = parseTimeToMinutes(s.startTime)
              const endMin = parseTimeToMinutes(s.endTime)
              if (startMin === null || endMin === null) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: `Invalid time format: "${s.startTime}" - "${s.endTime}"` }))
                return
              }
              if (startMin >= endMin) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: `Start time (${s.startTime}) must be strictly before end time (${s.endTime})` }))
                return
              }
              if (isSlotInPast(availabilityDate, s.startTime)) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: `Cannot create time slot that has already passed today (${s.startTime})` }))
                return
              }

              // Check duplicates against existing and newly added in batch
              const isDuplicate = existingList.some(ex => 
                ex.expertId === expertId &&
                ex.availabilityDate === availabilityDate &&
                ex.startTime === s.startTime &&
                ex.endTime === s.endTime
              ) || newAvailabilities.some(na => 
                na.startTime === s.startTime && na.endTime === s.endTime
              )

              if (isDuplicate) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: `Duplicate time slot already exists: ${s.startTime} - ${s.endTime}` }))
                return
              }

              const newSlot = {
                id: `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                expertId,
                availabilityDate,
                startTime: s.startTime,
                endTime: s.endTime,
                status: s.status || 'AVAILABLE',
                bookingId: null,
                clientId: null,
                clientName: null,
                createdAt: nowIso,
                updatedAt: nowIso
              }
              newAvailabilities.push(newSlot)
              existingList.push(newSlot)
            }

            current.availabilities = existingList
            writeDb(current)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, availabilities: newAvailabilities }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/availability/book (Atomic Double-Booking Protection)
      if (req.method === 'POST' && pathname === '/api/availability/book') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          const release = await bookingLock.acquire()
          try {
            const payload = JSON.parse(body || '{}')
            const { slotId, bookingId, clientId, clientName, expertId, date } = payload

            if (!slotId) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'slotId is required for booking' }))
              return
            }

            const current = readDb()
            const list: any[] = current.availabilities || []
            const slot = list.find(a => a.id === slotId)

            if (!slot) {
              res.statusCode = 404
              res.end(JSON.stringify({ success: false, error: 'Availability slot not found' }))
              return
            }

            if (expertId && slot.expertId !== expertId) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Availability slot does not belong to the specified expert' }))
              return
            }

            if (date && slot.availabilityDate !== date) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Availability slot date does not match the booking date' }))
              return
            }

            // Critical status check: must be AVAILABLE
            if (slot.status !== 'AVAILABLE') {
              res.statusCode = 409
              res.end(JSON.stringify({
                success: false,
                error: `Availability slot is no longer available (current status: ${slot.status})`
              }))
              return
            }

            // Atomic status transition: AVAILABLE -> BOOKED
            slot.status = 'BOOKED'
            slot.bookingId = bookingId || `book-${Date.now()}`
            slot.clientId = clientId || null
            slot.clientName = clientName || 'Client'
            slot.updatedAt = new Date().toISOString()

            writeDb(current)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, availability: slot }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          } finally {
            release()
          }
        })
        return
      }

      // POST /api/availability (single slot creation)
      if (req.method === 'POST' && pathname === '/api/availability') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const { expertId, availabilityDate, startTime, endTime, status, requesterRole, requesterId } = payload

            if (!expertId || !availabilityDate || !startTime || !endTime) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'expertId, availabilityDate, startTime, and endTime are required' }))
              return
            }

            // Permissions
            if (requesterRole === 'client') {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Clients are not permitted to manage availability' }))
              return
            }
            if (requesterRole === 'expert' && requesterId && requesterId !== expertId) {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Experts can only manage their own availability' }))
              return
            }

            // Reject past dates
            const todayStr = getTodayString()
            if (availabilityDate < todayStr) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Cannot configure availability for past dates' }))
              return
            }

            const startMin = parseTimeToMinutes(startTime)
            const endMin = parseTimeToMinutes(endTime)
            if (startMin === null || endMin === null) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Invalid time format' }))
              return
            }
            if (startMin >= endMin) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Start time must be strictly before end time' }))
              return
            }
            if (isSlotInPast(availabilityDate, startTime)) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Cannot create time slot that has already passed today' }))
              return
            }

            const current = readDb()
            const list: any[] = current.availabilities || []
            const isDuplicate = list.some(ex => 
              ex.expertId === expertId &&
              ex.availabilityDate === availabilityDate &&
              ex.startTime === startTime &&
              ex.endTime === endTime
            )
            if (isDuplicate) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Duplicate time slot already exists for this expert and date' }))
              return
            }

            const nowIso = new Date().toISOString()
            const newSlot = {
              id: payload.id || `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              expertId,
              availabilityDate,
              startTime,
              endTime,
              status: status || 'AVAILABLE',
              bookingId: null,
              clientId: null,
              clientName: null,
              createdAt: nowIso,
              updatedAt: nowIso
            }

            list.push(newSlot)
            current.availabilities = list
            writeDb(current)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, availability: newSlot }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // PUT /api/availability/:id
      if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/availability/')) {
        const id = pathname.replace('/api/availability/', '')
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const current = readDb()
            const list: any[] = current.availabilities || []
            const idx = list.findIndex(a => a.id === id)

            if (idx === -1) {
              res.statusCode = 404
              res.end(JSON.stringify({ success: false, error: 'Availability slot not found' }))
              return
            }

            const existing = list[idx]

            // Permissions
            if (payload.requesterRole === 'client') {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Clients cannot modify availability' }))
              return
            }
            if (payload.requesterRole === 'expert' && payload.requesterId && payload.requesterId !== existing.expertId) {
              res.statusCode = 403
              res.end(JSON.stringify({ success: false, error: 'Experts can only modify their own availability' }))
              return
            }

            const newStart = payload.startTime || existing.startTime
            const newEnd = payload.endTime || existing.endTime
            const newDate = payload.availabilityDate || existing.availabilityDate

            const startMin = parseTimeToMinutes(newStart)
            const endMin = parseTimeToMinutes(newEnd)
            if (startMin !== null && endMin !== null && startMin >= endMin) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Start time must be strictly before end time' }))
              return
            }

            if (newDate < getTodayString()) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Cannot set availability date to a past date' }))
              return
            }

            const updatedSlot = {
              ...existing,
              ...payload,
              id: existing.id,
              expertId: existing.expertId,
              updatedAt: new Date().toISOString()
            }

            list[idx] = updatedSlot
            current.availabilities = list
            writeDb(current)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, availability: updatedSlot }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // DELETE /api/availability/:id
      if (req.method === 'DELETE' && pathname.startsWith('/api/availability/')) {
        const id = pathname.replace('/api/availability/', '')
        const current = readDb()
        const list: any[] = current.availabilities || []
        const idx = list.findIndex(a => a.id === id)

        if (idx === -1) {
          res.statusCode = 404
          res.end(JSON.stringify({ success: false, error: 'Availability slot not found' }))
          return
        }

        const slot = list[idx]
        if (slot.status === 'BOOKED' && req.headers['x-admin-override'] !== 'true') {
          res.statusCode = 400
          res.end(JSON.stringify({ success: false, error: 'Cannot delete a booked availability slot directly' }))
          return
        }

        list.splice(idx, 1)
        current.availabilities = list
        writeDb(current)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true }))
        return
      }
    }

    // Endpoint: /api/project-reviews and /api/platform-settings (Dedicated Project Review & Platform Settings APIs)
    if (url.startsWith('/api/project-reviews') || url.startsWith('/api/platform-settings')) {
      const parsedUrl = new URL(req.url, 'http://localhost:5173')
      const pathname = parsedUrl.pathname

      // GET /api/project-reviews or /api/platform-settings
      if (req.method === 'GET') {
        // GET /api/platform-settings (Authoritative Platform Charge)
        if (pathname === '/api/platform-settings') {
          const current = readDb()
          const cfg = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: true,
            config: cfg,
            platformCharge: cfg
          }))
          return
        }

        // GET /api/project-reviews/pricing
        if (pathname === '/api/project-reviews/pricing') {
          const current = readDb()
          const expertId = parsedUrl.searchParams.get('expertId')
          const all = parsedUrl.searchParams.get('all') === 'true'
          const role = parsedUrl.searchParams.get('role')

          if (expertId) {
            const exp = (current.experts || []).find((e: any) =>
              e.id === expertId ||
              (e.email && e.email.toLowerCase() === expertId.toLowerCase()) ||
              (e.name && e.name.toLowerCase() === expertId.toLowerCase())
            )
            if (!exp) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Expert not found' }))
              return
            }
            const activePrice = typeof exp.projectRate === 'number'
              ? Math.min(2000, Math.max(0, exp.projectRate))
              : Math.min(2000, Math.max(0, exp.rate ? exp.rate * 3 : 1000))

            const feeConfig = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
            let platformFee = 0
            if (feeConfig.feeType === 'fixed') {
              platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200)
            } else {
              platformFee = Math.round(activePrice * ((Number(feeConfig.feeValue) || 15) / 100))
            }
            const clientPrice = activePrice + platformFee

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              expertId: exp.id,
              expertName: exp.name,
              projectRate: activePrice,
              platformFee,
              platformCharge: platformFee,
              platformFeeConfig: feeConfig,
              platformChargeConfig: feeConfig,
              clientPrice,
              minPrice: 0,
              maxPrice: 2000
            }))
            return
          }

          if (all || role === 'admin') {
            const feeConfig = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
            const expertsList = (current.experts || []).map((e: any) => {
              const pRate = typeof e.projectRate === 'number'
                ? Math.min(2000, Math.max(0, e.projectRate))
                : Math.min(2000, Math.max(0, e.rate ? e.rate * 3 : 1000))
              let pFee = 0
              if (feeConfig.feeType === 'fixed') {
                pFee = Math.max(0, Number(feeConfig.feeValue) ?? 200)
              } else {
                pFee = Math.round(pRate * ((Number(feeConfig.feeValue) || 15) / 100))
              }
              return {
                id: e.id,
                name: e.name,
                field: e.field,
                rate: e.rate,
                baseRate: e.baseRate,
                projectRate: pRate,
                platformFee: pFee,
                platformCharge: pFee,
                clientPrice: pRate + pFee,
                updatedAt: e.projectRateUpdatedAt || e.updatedAt || '2026-09-30T00:00:00.000Z'
              }
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              experts: expertsList,
              platformFeeConfig: feeConfig,
              platformCharge: feeConfig,
              minPrice: 0,
              maxPrice: 2000
            }))
            return
          }

          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'expertId or all=true query parameter is required' }))
          return
        }

        // GET /api/project-reviews/platform-fee (Admin Only)
        if (pathname === '/api/project-reviews/platform-fee') {
          const role = parsedUrl.searchParams.get('role')
          if (role !== 'admin') {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required for platform fee configuration' }))
            return
          }
          const current = readDb()
          const cfg = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: true,
            config: cfg,
            platformCharge: cfg
          }))
          return
        }

        const id = parsedUrl.searchParams.get('id')
        const clientId = parsedUrl.searchParams.get('clientId')
        const clientEmail = parsedUrl.searchParams.get('clientEmail')?.toLowerCase().trim()
        const clientName = parsedUrl.searchParams.get('clientName')?.toLowerCase().trim()
        const expertId = parsedUrl.searchParams.get('expertId')
        const expertEmail = parsedUrl.searchParams.get('expertEmail')?.toLowerCase().trim()
        const expertName = parsedUrl.searchParams.get('expertName')?.toLowerCase().trim()
        const status = parsedUrl.searchParams.get('status')
        const role = parsedUrl.searchParams.get('role')
        const includeArchived = parsedUrl.searchParams.get('includeArchived') === 'true'

        const current = readDb()
        let list: any[] = current.projectReviews || []

        if (id) {
          const item = list.find(r => r.projectReviewId === id)
          if (!item) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Project Review not found' }))
            return
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, projectReview: item }))
          return
        }

        // Resilient Client Filtering: match by clientId, clientEmail, or clientName
        if (clientId || clientEmail || clientName) {
          list = list.filter(r => {
            if (clientId && r.clientId === clientId) return true
            if (clientEmail && r.clientEmail && r.clientEmail.toLowerCase().trim() === clientEmail) return true
            if (clientName && r.clientName && r.clientName.toLowerCase().trim() === clientName) return true
            return false
          })
        }

        // Resilient Expert Filtering: match by expertId, expertEmail, or expertName
        if (expertId || expertEmail || expertName) {
          list = list.filter(r => {
            if (expertId && r.expertId === expertId) return true
            if (expertEmail && r.expertEmail && r.expertEmail.toLowerCase().trim() === expertEmail) return true
            if (expertName && r.expertName && r.expertName.toLowerCase().trim() === expertName) return true
            return false
          })
        }

        if (status) {
          list = list.filter(r => r.status === status)
        }

        if (!includeArchived) {
          if (role === 'client') {
            list = list.filter(r => !r.clientArchived)
          } else if (role === 'expert') {
            list = list.filter(r => !r.expertArchived)
          }
        }

        // Sort by updatedAt descending
        list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, projectReviews: list }))
        return
      }

      // POST and PUT requests for Project Review workflow & Platform Settings
      if (req.method === 'POST' || req.method === 'PUT') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          const release = await projectReviewLock.acquire()
          try {
            const payload = JSON.parse(body || '{}')
            const current = readDb()
            if (!Array.isArray(current.projectReviews)) current.projectReviews = []
            const nowIso = new Date().toISOString()

            // 0a. POST /api/project-reviews/pricing
            if (pathname === '/api/project-reviews/pricing') {
              const { expertId, projectRate, price: altPrice, role, userId, userEmail } = payload
              const targetPrice = projectRate !== undefined ? projectRate : altPrice

              // 1. Role validation: Client cannot modify prices
              if (role === 'client') {
                res.statusCode = 403
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Unauthorized: Clients cannot modify Project Review prices' }))
                return
              }

              // 2. Validate value presence and numeric type
              if (targetPrice === undefined || targetPrice === null || typeof targetPrice !== 'number' || isNaN(targetPrice) || !isFinite(targetPrice)) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Project Review price must be a valid number' }))
                return
              }

              // 3. Strict range check: 0 to 2000
              if (targetPrice < 0 || targetPrice > 2000) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Project Review price must be between ₹0 and ₹2,000.' }))
                return
              }

              if (!expertId) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'expertId is required' }))
                return
              }

              // 4. Role authorization: Expert can only modify their own price
              if (role === 'expert') {
                if (userId && expertId && userId !== expertId) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' }))
                  return
                }
              } else if (role !== 'admin') {
                res.statusCode = 403
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Unauthorized role' }))
                return
              }

              // Find target expert
              const targetExp = (current.experts || []).find((e: any) =>
                e.id === expertId ||
                (e.email && e.email.toLowerCase() === expertId.toLowerCase()) ||
                (e.name && e.name.toLowerCase() === expertId.toLowerCase())
              )

              if (!targetExp) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Expert not found' }))
                return
              }

              if (role === 'expert') {
                if (userId && userId !== targetExp.id && userId !== expertId) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' }))
                  return
                }
                if (userEmail && targetExp.email && userEmail.toLowerCase().trim() !== targetExp.email.toLowerCase().trim()) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Experts can only modify their own Project Review price' }))
                  return
                }
              }

              // 5. Persist price change
              const previousRate = typeof targetExp.projectRate === 'number'
                ? targetExp.projectRate
                : (targetExp.rate ? Math.min(2000, targetExp.rate * 3) : 1000)

              targetExp.projectRate = Math.round(targetPrice)

              // Record in audit log
              if (!Array.isArray(current.pricingAuditLogs)) current.pricingAuditLogs = []
              current.pricingAuditLogs.unshift({
                id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                changeType: 'expert_price',
                targetExpertId: targetExp.id,
                targetExpertName: targetExp.name,
                previousValue: previousRate,
                newValue: targetExp.projectRate,
                oldValue: previousRate,
                newValueNum: targetExp.projectRate,
                changedByRole: role,
                changedById: userId || (role === 'admin' ? 'admin' : targetExp.id),
                changedBy: userId || (role === 'admin' ? 'admin' : targetExp.id),
                changedAt: nowIso,
                context: 'project_review',
                timestamp: nowIso
              })

              const feeConfig = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
              let platformFee = 0
              if (feeConfig.feeType === 'fixed') {
                platformFee = Math.max(0, Number(feeConfig.feeValue) ?? 200)
              } else {
                platformFee = Math.round(targetExp.projectRate * ((Number(feeConfig.feeValue) || 15) / 100))
              }
              const clientPrice = targetExp.projectRate + platformFee

              targetExp.projectRateUpdatedAt = nowIso

              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                expertId: targetExp.id,
                expertName: targetExp.name,
                projectRate: targetExp.projectRate,
                platformFee,
                platformCharge: platformFee,
                clientPrice,
                message: 'Project Review price updated successfully'
              }))
              return
            }

            // 0b. POST or PUT /api/project-reviews/platform-fee or /api/platform-settings
            if (pathname === '/api/project-reviews/platform-fee' || pathname === '/api/platform-settings') {
              const { feeType, feeValue, role, userId } = payload
              if (role !== 'admin') {
                res.statusCode = 403
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required for platform fee configuration' }))
                return
              }

              if (!feeType || (feeType !== 'percentage' && feeType !== 'fixed')) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'feeType must be percentage or fixed' }))
                return
              }

              if (typeof feeValue !== 'number' || isNaN(feeValue) || !isFinite(feeValue) || feeValue < 0) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'feeValue must be a non-negative number' }))
                return
              }

              if (feeType === 'percentage' && feeValue > 100) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Percentage fee cannot exceed 100%' }))
                return
              }

              const previousConfig = { ...(current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }) }
              const updatedConfig = {
                feeType,
                feeValue: Number(feeValue),
                currency: 'INR',
                updatedAt: nowIso,
                updatedBy: userId || 'admin-governance'
              }
              current.platformCharge = updatedConfig
              current.projectReviewConfig = updatedConfig

              if (!Array.isArray(current.pricingAuditLogs)) current.pricingAuditLogs = []
              current.pricingAuditLogs.unshift({
                id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                changeType: 'platform_fee',
                category: 'platform_charge',
                previousValue: previousConfig,
                newValue: updatedConfig,
                oldValue: previousConfig.feeValue,
                newValueNum: Number(feeValue),
                changedBy: userId || 'admin-governance',
                changedByRole: 'admin',
                changedById: userId || 'admin-governance',
                changedAt: nowIso,
                context: 'project_review',
                timestamp: nowIso
              })

              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                message: '✓ Platform charge updated successfully',
                config: current.platformCharge,
                platformCharge: current.platformCharge
              }))
              return
            }

            // 1. POST /api/project-reviews/request (Initiate Project Review)
            if (pathname === '/api/project-reviews/request') {
              const {
                clientId,
                clientName,
                clientEmail,
                expertId,
                expertName,
                expertEmail,
                expectedScope,
                reviewType,
                requestNotes
              } = payload

              if (!clientId || !clientEmail || !expertId) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'clientId, clientEmail, and expertId are required' }))
                return
              }

              const normClientEmail = clientEmail.toLowerCase().trim()
              const normExpertEmail = (expertEmail || '').toLowerCase().trim()

              // Duplicate Prevention: Check active or pending request for this client + expert
              const existingActive = current.projectReviews.find((r: any) =>
                (r.clientId === clientId || (r.clientEmail && r.clientEmail.toLowerCase() === normClientEmail)) &&
                (r.expertId === expertId || (r.expertEmail && r.expertEmail.toLowerCase() === normExpertEmail)) &&
                ['PendingExpertAcceptance', 'Accepted', 'ProjectSubmitted', 'InReview', 'MeetingRequested', 'MeetingScheduled'].includes(r.status)
              )

              if (existingActive) {
                res.statusCode = 409
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  success: false,
                  error: 'An active or pending Project Review already exists with this expert',
                  projectReview: existingActive
                }))
                return
              }

              // Dynamic authoritative price calculation from expert record
              const expertsList: any[] = current.experts || []
              const exp = expertsList.find((e: any) =>
                (expertId && e.id === expertId) ||
                (normExpertEmail && e.email && e.email.toLowerCase() === normExpertEmail) ||
                (expertName && e.name && e.name.toLowerCase() === expertName.toLowerCase().trim())
              )
              const authoritativeExpertId = exp?.id || expertId || 'exp-1'
              const authoritativeExpertName = exp?.name || expertName || 'Expert'
              const authoritativeExpertEmail = (exp?.email ? exp.email.toLowerCase().trim() : normExpertEmail)

              const rawPrice = typeof exp?.projectRate === 'number'
                ? exp.projectRate
                : (exp ? Math.min(2000, exp.rate * 3) : 1000)
              const expertCharge = Math.min(2000, Math.max(0, Math.round(rawPrice)))

              // Applicable Project Review Platform Fee configuration
              const feeConfig = current.platformCharge || current.projectReviewConfig || { feeType: 'fixed', feeValue: 200, currency: 'INR' }
              let platformFee = 0
              if (feeConfig.feeType === 'fixed') {
                const fixedVal = Number(feeConfig.feeValue) ?? 200
                platformFee = Math.max(0, Math.round(fixedVal))
              } else {
                const pct = Number(feeConfig.feeValue) || 15
                platformFee = Math.round(expertCharge * (pct / 100))
              }
              const finalClientPrice = expertCharge + platformFee
              const expertEarning = expertCharge

              // Deduct escrow amount immediately from Client Wallet
              if (!current.kv) current.kv = {}
              const clientWalletKey = `client_wallet_${normClientEmail}`
              let currentWalletBal = Number(current.kv[clientWalletKey])
              if (isNaN(currentWalletBal) || current.kv[clientWalletKey] === undefined) {
                currentWalletBal = typeof payload.clientWalletBalance === 'number' ? payload.clientWalletBalance : 10000
              }
              const newWalletBal = Math.max(0, currentWalletBal - finalClientPrice)
              current.kv[clientWalletKey] = String(newWalletBal)

              const projectReviewId = `pr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
              const clientWalletTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

              const newReview = {
                projectReviewId,
                clientId,
                clientName: clientName || 'Client',
                clientEmail: normClientEmail,
                expertId: authoritativeExpertId,
                expertName: authoritativeExpertName,
                expertEmail: authoritativeExpertEmail,
                packageId: 'project_review',
                packageName: 'Dedicated Project Review',
                price: finalClientPrice,
                paidAmount: finalClientPrice,
                expertCharge,
                platformFee,
                platformCharge: platformFee,
                platformChargeType: feeConfig.feeType,
                expertEarning,
                paymentMethod: 'wallet',
                clientWalletTxId,
                status: 'PendingExpertAcceptance',
                paymentStatus: 'PaymentSuccessful',
                expertEarningStatus: 'EarningPending',
                requestNotes: requestNotes || '',
                expectedScope: expectedScope || 'Comprehensive Project Audit & 2 Strategic Calls',
                reviewType: reviewType || 'Technical & Architecture Review',
                submission: null,
                chat: [
                  {
                    id: `msg-${Date.now()}-sys`,
                    projectReviewId,
                    senderId: 'system',
                    senderRole: 'system',
                    senderName: 'System',
                    content: `Project Review request initiated for ₹${finalClientPrice.toLocaleString('en-IN')}. Escrow payment of ₹${finalClientPrice.toLocaleString('en-IN')} confirmed from Client Wallet (Tx: ${clientWalletTxId}). Awaiting Expert decision.`,
                    timestamp: nowIso,
                    read: true
                  }
                ],
                proposedTimes: [],
                meetings: [],
                completedMeetingCount: 0,
                clientArchived: false,
                expertArchived: false,
                activityTimeline: [
                  {
                    activityId: `act-${Date.now()}`,
                    projectReviewId,
                    userId: clientId,
                    userName: clientName || 'Client',
                    role: 'client',
                    eventType: 'request_created',
                    description: `Client requested Project Review with ${authoritativeExpertName} (₹${finalClientPrice.toLocaleString('en-IN')})`,
                    newStatus: 'PendingExpertAcceptance',
                    timestamp: nowIso
                  },
                  {
                    activityId: `act-${Date.now()}-pay`,
                    projectReviewId,
                    userId: clientId,
                    userName: clientName || 'Client',
                    role: 'client',
                    eventType: 'payment_confirmed',
                    description: `Payment of ₹${finalClientPrice.toLocaleString('en-IN')} deducted from Client Wallet and held in escrow (Tx: ${clientWalletTxId}).`,
                    newStatus: 'PaymentSuccessful',
                    timestamp: nowIso
                  }
                ],
                createdAt: nowIso,
                updatedAt: nowIso
              }

              current.projectReviews.unshift(newReview)
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: newReview, clientWalletBalance: newWalletBal }))
              return
            }

            // Extract review ID from subpaths: /api/project-reviews/:id/...
            const match = pathname.match(/^\/api\/project-reviews\/([^\/]+)(?:\/(.*))?$/)
            if (!match) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Invalid Project Review endpoint' }))
              return
            }

            const reviewId = match[1]
            const subAction = match[2] || ''

            const reviewIdx = current.projectReviews.findIndex((r: any) => r.projectReviewId === reviewId)
            if (reviewIdx === -1) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Project Review not found' }))
              return
            }

            const review = current.projectReviews[reviewIdx]

            // 2. POST /api/project-reviews/:id/respond (Accept or Decline)
            if (subAction === 'respond') {
              const { action, reason, responderId, responderRole } = payload
              if (action !== 'accept' && action !== 'decline') {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'action must be "accept" or "decline"' }))
                return
              }

              // Defensive initialization — records migrated from BookingModal may lack these arrays
              if (!Array.isArray(review.activityTimeline)) review.activityTimeline = []
              if (!Array.isArray(review.chat)) review.chat = []
              if (!Array.isArray(review.auditLog)) review.auditLog = []

              if (action === 'decline') {
                review.status = 'Declined'

                let refundAmount = 0
                let clientRefundBal = 0
                if (review.paymentStatus === 'PaymentSuccessful') {
                  if (!current.kv) current.kv = {}
                  const clientWalletKey = `client_wallet_${(review.clientEmail || '').toLowerCase().trim()}`
                  const currentWalletBal = Number(current.kv[clientWalletKey] || 0)
                  refundAmount = review.price
                  clientRefundBal = currentWalletBal + refundAmount
                  current.kv[clientWalletKey] = String(clientRefundBal)
                  review.paymentStatus = 'Refunded'
                  review.refundTxId = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

                  review.activityTimeline.push({
                    activityId: `act-${Date.now()}-ref`,
                    projectReviewId: review.projectReviewId,
                    userId: 'system',
                    userName: 'Financial Escrow',
                    role: 'system',
                    eventType: 'refund_processed',
                    description: `Escrow refund of ₹${refundAmount.toLocaleString('en-IN')} credited back to Client Wallet (Tx: ${review.refundTxId}) following expert decline.`,
                    previousStatus: 'PaymentSuccessful',
                    newStatus: 'Refunded',
                    timestamp: nowIso
                  })
                }

                review.activityTimeline.push({
                  activityId: `act-${Date.now()}`,
                  projectReviewId: review.projectReviewId,
                  userId: responderId || review.expertId,
                  userName: review.expertName,
                  role: responderRole || 'expert',
                  eventType: 'request_declined',
                  description: `Expert declined the Project Review request${reason ? ': ' + reason : ''}.`,
                  previousStatus: 'PendingExpertAcceptance',
                  newStatus: 'Declined',
                  timestamp: nowIso
                })
                review.chat.push({
                  id: `msg-${Date.now()}-declined`,
                  projectReviewId: review.projectReviewId,
                  senderId: 'system',
                  senderRole: 'system',
                  senderName: 'System',
                  content: `Expert declined this Project Review request${reason ? ' (' + reason + ')' : ''}.${refundAmount > 0 ? ` Full escrow refund of ₹${refundAmount.toLocaleString('en-IN')} has been returned to your wallet.` : ''}`,
                  timestamp: nowIso,
                  read: true
                })
              } else if (action === 'accept') {
                review.status = 'Accepted'
                review.activityTimeline.push({
                  activityId: `act-${Date.now()}`,
                  projectReviewId: review.projectReviewId,
                  userId: responderId || review.expertId,
                  userName: review.expertName,
                  role: responderRole || 'expert',
                  eventType: 'request_accepted',
                  description: 'Expert accepted the Project Review request. Dedicated Workspace activated.',
                  previousStatus: 'PendingExpertAcceptance',
                  newStatus: 'Accepted',
                  timestamp: nowIso
                })
                review.chat.push({
                  id: `msg-${Date.now()}-accepted`,
                  projectReviewId: review.projectReviewId,
                  senderId: 'system',
                  senderRole: 'system',
                  senderName: 'System',
                  content: 'Project Review accepted! The dedicated workspace, document submission, and private chat are now live.',
                  timestamp: nowIso,
                  read: true
                })
              }

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 3. POST /api/project-reviews/:id/pay (Confirm payment / deduct wallet)
            if (subAction === 'pay') {
              if (review.paymentStatus === 'PaymentSuccessful') {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, message: 'Already paid', projectReview: review }))
                return
              }

              const clientWalletKey = `client_wallet_${(review.clientEmail || '').toLowerCase()}`
              const currentWalletBal = Number(current.kv?.[clientWalletKey] || 0)

              if (payload.paymentMethod === 'wallet' && currentWalletBal < review.price) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  success: false,
                  error: `Insufficient wallet balance (₹${currentWalletBal.toLocaleString('en-IN')}). Required: ₹${review.price.toLocaleString('en-IN')}`
                }))
                return
              }

              if (payload.paymentMethod === 'wallet') {
                if (!current.kv) current.kv = {}
                current.kv[clientWalletKey] = String(currentWalletBal - review.price)
              }

              review.paymentStatus = 'PaymentSuccessful'
              review.clientWalletTxId = payload.transactionId || `tx-${Date.now()}`
              review.activityTimeline.push({
                activityId: `act-${Date.now()}-paid`,
                projectReviewId: review.projectReviewId,
                userId: review.clientId,
                userName: review.clientName,
                role: 'client',
                eventType: 'payment_confirmed',
                description: `Payment of ₹${review.price.toLocaleString('en-IN')} confirmed via ${payload.paymentMethod || 'Wallet'}.`,
                previousStatus: 'PaymentPending',
                newStatus: 'PaymentSuccessful',
                timestamp: nowIso
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 4. POST /api/project-reviews/:id/submit-project (Client upload / submission)
            if (subAction === 'submit-project') {
              const { description, questions, repositoryUrl, demoUrl, files } = payload

              const currentVersion = (review.submission?.version || 0) + 1
              review.submission = {
                submissionId: `sub-${Date.now()}`,
                files: Array.isArray(files) ? files : (review.submission?.files || []),
                repositoryUrl: repositoryUrl || '',
                demoUrl: demoUrl || '',
                description: description || '',
                questions: questions || '',
                submittedAt: nowIso,
                version: currentVersion
              }

              review.status = 'ProjectSubmitted'
              review.activityTimeline.push({
                activityId: `act-${Date.now()}`,
                projectReviewId: review.projectReviewId,
                userId: review.clientId,
                userName: review.clientName,
                role: 'client',
                eventType: 'submission_received',
                description: `Client submitted project materials (v${currentVersion}): ${description?.slice(0, 60) || 'Project uploaded'}`,
                previousStatus: 'Accepted',
                newStatus: 'ProjectSubmitted',
                timestamp: nowIso
              })

              review.chat.push({
                id: `msg-${Date.now()}-submission`,
                projectReviewId: review.projectReviewId,
                senderId: review.clientId,
                senderRole: 'client',
                senderName: review.clientName,
                content: `📁 New Project Submission (v${currentVersion}) uploaded for review.${repositoryUrl ? ' Repository: ' + repositoryUrl : ''}`,
                timestamp: nowIso,
                read: false
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 5. POST /api/project-reviews/:id/chat (Send private message)
            if (subAction === 'chat') {
              const { senderId, senderRole, senderName, content, attachmentUrl, attachmentName } = payload

              if (!content && !attachmentUrl) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Message content or attachment is required' }))
                return
              }

              const newMsg = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                projectReviewId: review.projectReviewId,
                senderId: senderId || 'user',
                senderRole: senderRole || 'client',
                senderName: senderName || 'User',
                content: content || '',
                attachmentUrl: attachmentUrl || undefined,
                attachmentName: attachmentName || undefined,
                timestamp: nowIso,
                read: false
              }

              if (!Array.isArray(review.chat)) review.chat = []
              review.chat.push(newMsg)
              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, message: newMsg, projectReview: review }))
              return
            }

            // 6. POST /api/project-reviews/:id/propose-time (Propose consultation time)
            if (subAction === 'propose-time') {
              const { proposedBy, date, startTime, endTime, durationMinutes, reason } = payload

              if (!date || !startTime || !endTime) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'date, startTime, and endTime are required' }))
                return
              }

              const newProposal = {
                id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                proposedBy: proposedBy || 'client',
                date,
                startTime,
                endTime,
                durationMinutes: durationMinutes || 60,
                reason: reason || '',
                status: 'pending',
                createdAt: nowIso
              }

              if (!Array.isArray(review.proposedTimes)) review.proposedTimes = []
              review.proposedTimes.push(newProposal)

              if (review.status === 'ProjectSubmitted' || review.status === 'Accepted') {
                review.status = 'MeetingRequested'
              }

              review.activityTimeline.push({
                activityId: `act-${Date.now()}`,
                projectReviewId: review.projectReviewId,
                userId: proposedBy === 'expert' ? review.expertId : review.clientId,
                userName: proposedBy === 'expert' ? review.expertName : review.clientName,
                role: proposedBy || 'client',
                eventType: 'meeting_proposed',
                description: `${proposedBy === 'expert' ? 'Expert' : 'Client'} proposed meeting on ${date} (${startTime} - ${endTime})`,
                timestamp: nowIso
              })

              review.chat.push({
                id: `msg-${Date.now()}-prop`,
                projectReviewId: review.projectReviewId,
                senderId: proposedBy === 'expert' ? review.expertId : review.clientId,
                senderRole: proposedBy || 'client',
                senderName: proposedBy === 'expert' ? review.expertName : review.clientName,
                content: `📅 Meeting Proposed: ${date} at ${startTime} - ${endTime}${reason ? ' (' + reason + ')' : ''}. Awaiting confirmation.`,
                timestamp: nowIso,
                read: false
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 7. POST /api/project-reviews/:id/respond-time (Accept / Decline proposal)
            if (subAction === 'respond-time') {
              const { proposedTimeId, action, responderRole } = payload

              if (!Array.isArray(review.proposedTimes)) review.proposedTimes = []
              const prop = review.proposedTimes.find((p: any) => p.id === proposedTimeId)

              if (!prop) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Proposed time slot not found' }))
                return
              }

              if (action === 'accept') {
                // Strict 2 completed meetings check
                if ((review.completedMeetingCount || 0) >= 2) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Maximum 2 completed meetings limit already reached for this Project Review' }))
                  return
                }

                prop.status = 'accepted'
                if (!Array.isArray(review.meetings)) review.meetings = []

                const meetingNumber = review.meetings.filter((m: any) => m.meetingStatus !== 'Cancelled').length + 1
                const newMeeting = {
                  meetingId: `prm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  projectReviewId: review.projectReviewId,
                  meetingNumber,
                  clientId: review.clientId,
                  clientName: review.clientName,
                  expertId: review.expertId,
                  expertName: review.expertName,
                  date: prop.date,
                  startTime: prop.startTime,
                  endTime: prop.endTime,
                  googleMeetLink: '',
                  meetingStatus: 'Scheduled',
                  createdAt: nowIso
                }

                review.meetings.push(newMeeting)
                review.status = 'MeetingScheduled'

                review.activityTimeline.push({
                  activityId: `act-${Date.now()}`,
                  projectReviewId: review.projectReviewId,
                  userId: responderRole === 'expert' ? review.expertId : review.clientId,
                  userName: responderRole === 'expert' ? review.expertName : review.clientName,
                  role: responderRole || 'expert',
                  eventType: 'meeting_scheduled',
                  description: `Meeting #${meetingNumber} scheduled for ${prop.date} (${prop.startTime} - ${prop.endTime})`,
                  previousStatus: 'MeetingRequested',
                  newStatus: 'MeetingScheduled',
                  timestamp: nowIso
                })

                review.chat.push({
                  id: `msg-${Date.now()}-sched`,
                  projectReviewId: review.projectReviewId,
                  senderId: 'system',
                  senderRole: 'system',
                  senderName: 'System',
                  content: `✅ Meeting #${meetingNumber} confirmed for ${prop.date} at ${prop.startTime} - ${prop.endTime}. Awaiting Google Meet link generation.`,
                  timestamp: nowIso,
                  read: true
                })
              } else if (action === 'decline') {
                prop.status = 'declined'
                review.activityTimeline.push({
                  activityId: `act-${Date.now()}`,
                  projectReviewId: review.projectReviewId,
                  userId: responderRole === 'expert' ? review.expertId : review.clientId,
                  userName: responderRole === 'expert' ? review.expertName : review.clientName,
                  role: responderRole || 'expert',
                  eventType: 'meeting_proposal_declined',
                  description: `Proposed time for ${prop.date} was declined`,
                  timestamp: nowIso
                })
              }

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 8. POST /api/project-reviews/:id/send-meet-link (Attach & Send Google Meet link)
            if (subAction === 'send-meet-link') {
              const { meetingId, googleMeetLink } = payload

              if (!googleMeetLink || typeof googleMeetLink !== 'string' || !googleMeetLink.trim()) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'A valid Google Meet link is required' }))
                return
              }

              if (!Array.isArray(review.meetings)) review.meetings = []
              const meeting = review.meetings.find((m: any) => m.meetingId === meetingId)

              if (!meeting) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Meeting not found' }))
                return
              }

              const cleanLink = googleMeetLink.trim()
              meeting.googleMeetLink = cleanLink
              meeting.meetingStatus = 'Upcoming'

              review.activityTimeline.push({
                activityId: `act-${Date.now()}`,
                projectReviewId: review.projectReviewId,
                userId: review.expertId,
                userName: review.expertName,
                role: 'expert',
                eventType: 'meet_link_sent',
                description: `Google Meet link added for Meeting #${meeting.meetingNumber}: ${cleanLink}`,
                timestamp: nowIso
              })

              review.chat.push({
                id: `msg-${Date.now()}-meet`,
                projectReviewId: review.projectReviewId,
                senderId: review.expertId,
                senderRole: 'expert',
                senderName: review.expertName,
                content: `📹 Google Meet link ready for Meeting #${meeting.meetingNumber}: ${cleanLink}\nJoin on ${meeting.date} at ${meeting.startTime}.`,
                timestamp: nowIso,
                read: false
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review, meeting }))
              return
            }

            // 9. POST /api/project-reviews/:id/complete-meeting (Mark meeting completed)
            if (subAction === 'complete-meeting') {
              const { meetingId } = payload

              if (!Array.isArray(review.meetings)) review.meetings = []
              const meeting = review.meetings.find((m: any) => m.meetingId === meetingId)

              if (!meeting) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Meeting not found' }))
                return
              }

              if (meeting.meetingStatus !== 'Completed') {
                meeting.meetingStatus = 'Completed'
                meeting.completedAt = nowIso

                // Strict limit increment
                const completedSoFar = review.meetings.filter((m: any) => m.meetingStatus === 'Completed').length
                review.completedMeetingCount = Math.min(2, completedSoFar)

                review.activityTimeline.push({
                  activityId: `act-${Date.now()}`,
                  projectReviewId: review.projectReviewId,
                  userId: review.expertId,
                  userName: review.expertName,
                  role: 'expert',
                  eventType: 'meeting_completed',
                  description: `Meeting #${meeting.meetingNumber} completed. Meetings used: ${review.completedMeetingCount} / 2`,
                  timestamp: nowIso
                })

                review.chat.push({
                  id: `msg-${Date.now()}-completed`,
                  projectReviewId: review.projectReviewId,
                  senderId: 'system',
                  senderRole: 'system',
                  senderName: 'System',
                  content: `🏁 Meeting #${meeting.meetingNumber} marked Completed. Total Completed Meetings: ${review.completedMeetingCount} of 2.`,
                  timestamp: nowIso,
                  read: true
                })
              }

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review, meeting }))
              return
            }

            // 10. POST /api/project-reviews/:id/complete-review (Expert finishes audit & releases payout)
            if (subAction === 'complete-review') {
              const { summary, recommendations, strengths, issues } = payload

              review.status = 'Completed'
              review.reviewFeedback = {
                summary: summary || 'Comprehensive Project Review successfully finalized.',
                recommendations: Array.isArray(recommendations) ? recommendations : (recommendations ? [recommendations] : []),
                strengths: strengths || '',
                issues: issues || '',
                completedAt: nowIso
              }

              // Idempotent Expert Earning Credit
              if (review.expertEarningStatus !== 'EarningReleased') {
                const expWalletKey = `expert_wallet_${(review.expertEmail || '').toLowerCase()}`
                if (!current.kv) current.kv = {}
                const currentExpBal = Number(current.kv[expWalletKey] || 0)
                current.kv[expWalletKey] = String(currentExpBal + review.expertEarning)
                review.expertEarningStatus = 'EarningReleased'
                review.expertWalletTxId = `payout-${Date.now()}`

                review.activityTimeline.push({
                  activityId: `act-${Date.now()}-payout`,
                  projectReviewId: review.projectReviewId,
                  userId: review.expertId,
                  userName: review.expertName,
                  role: 'system',
                  eventType: 'earning_released',
                  description: `Project Review Completed. Expert Earning of ₹${review.expertEarning.toLocaleString('en-IN')} released to Expert Wallet.`,
                  previousStatus: 'EarningPending',
                  newStatus: 'EarningReleased',
                  timestamp: nowIso
                })
              }

              review.activityTimeline.push({
                activityId: `act-${Date.now()}`,
                projectReviewId: review.projectReviewId,
                userId: review.expertId,
                userName: review.expertName,
                role: 'expert',
                eventType: 'review_completed',
                description: 'Expert submitted final review findings and marked Project Review completed.',
                previousStatus: review.status,
                newStatus: 'Completed',
                timestamp: nowIso
              })

              review.chat.push({
                id: `msg-${Date.now()}-final`,
                projectReviewId: review.projectReviewId,
                senderId: 'system',
                senderRole: 'system',
                senderName: 'System',
                content: `🏆 Project Review Completed! Final review audit report and recommendations have been published.`,
                timestamp: nowIso,
                read: true
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            // 11. POST /api/project-reviews/:id/archive (Soft delete / archive for Client or Expert)
            if (subAction === 'archive') {
              const { role } = payload
              if (role === 'client') {
                review.clientArchived = true
              } else if (role === 'expert') {
                review.expertArchived = true
              }

              review.activityTimeline.push({
                activityId: `act-${Date.now()}`,
                projectReviewId: review.projectReviewId,
                userId: role === 'expert' ? review.expertId : review.clientId,
                userName: role === 'expert' ? review.expertName : review.clientName,
                role: role || 'client',
                eventType: 'history_archived',
                description: `Project Review archived from ${role || 'user'} history view. Financial and audit records preserved.`,
                timestamp: nowIso
              })

              review.updatedAt = nowIso
              current.projectReviews[reviewIdx] = review
              writeDb(current)

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, projectReview: review }))
              return
            }

            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: `Unknown Project Review action: "${subAction}"` }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          } finally {
            release()
          }
        })
        return
      }
    }


    // Endpoint: /api/documents (Upload, Retrieve, and Stream Documents)
    if (url.startsWith('/api/documents')) {
      const UPLOAD_DIR = path.resolve(__dirname, 'public', 'uploaded_docs')
      const SERVER_DIR = path.resolve(__dirname, 'server_docs')
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
      if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true })

      const getDocumentMimeType = (fileTitleOrPath: string): string => {
        const ext = path.extname(fileTitleOrPath).toLowerCase()
        if (ext === '.png') return 'image/png'
        if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
        if (ext === '.webp') return 'image/webp'
        if (ext === '.svg') return 'image/svg+xml'
        if (ext === '.gif') return 'image/gif'
        if (ext === '.pdf') return 'application/pdf'
        if (ext === '.doc') return 'application/msword'
        if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        return 'application/octet-stream'
      }

      if (req.method === 'GET') {
        const parsedUrl = new URL(req.url, 'http://localhost:5173')
        const key = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('name') || parsedUrl.searchParams.get('id') || ''
        const raw = parsedUrl.searchParams.get('raw') === 'true'
        if (!key) {
          const files = fs.readdirSync(UPLOAD_DIR)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, files }))
          return
        }

        const cleanKey = key.toLowerCase().trim()
        const findFile = (dir: string) => {
          if (!fs.existsSync(dir)) return null
          const files = fs.readdirSync(dir)
          let found = files.find(f => f === key || f.toLowerCase().trim() === cleanKey)
          if (found) return path.join(dir, found)
          const strippedKey = cleanKey.replace(/^doc-/, '').replace(/^file-/, '')
          found = files.find(f => {
            const fLow = f.toLowerCase()
            return fLow === strippedKey || fLow.startsWith(strippedKey + '.') || fLow.includes(strippedKey) || strippedKey.includes(fLow)
          })
          if (found) return path.join(dir, found)
          return null
        }

        const filePath = findFile(UPLOAD_DIR) || findFile(SERVER_DIR)
        if (filePath && fs.existsSync(filePath)) {
          const mimeType = getDocumentMimeType(filePath)
          if (raw) {
            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
            const stream = fs.createReadStream(filePath)
            stream.pipe(res)
            return
          }
          const buf = fs.readFileSync(filePath)
          const base64 = buf.toString('base64')
          const dataUrl = `data:${mimeType};base64,${base64}`
          const relativeUrl = `/uploaded_docs/${encodeURIComponent(path.basename(filePath))}`
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, fileName: path.basename(filePath), fileData: dataUrl, url: relativeUrl, mimeType }))
          return
        }

        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: 'File not found' }))
        return
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const fileName = payload.fileName || payload.name || `doc_${Date.now()}.pdf`
            const fileData = payload.fileData || payload.data || ''

            if (fileData) {
              let buffer: Buffer
              if (fileData.startsWith('data:')) {
                const base64Data = fileData.split(',')[1] || ''
                buffer = Buffer.from(base64Data, 'base64')
              } else {
                buffer = Buffer.from(fileData, 'base64')
              }

              const safeName = path.basename(fileName)
              fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buffer)
              fs.writeFileSync(path.join(SERVER_DIR, safeName), buffer)

              if (payload.id) {
                const ext = path.extname(safeName) || '.pdf'
                const aliasName = `${path.basename(payload.id)}${ext}`
                fs.writeFileSync(path.join(UPLOAD_DIR, aliasName), buffer)
              }

              const relativeUrl = `/uploaded_docs/${encodeURIComponent(safeName)}`
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, fileName: safeName, url: relativeUrl }))
              return
            }

            res.statusCode = 400
            res.end(JSON.stringify({ success: false, error: 'Missing fileData' }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }
    }

    // Endpoint: /api/notifications (Full CRUD & Multi-Channel Broadcast Persistence)
    if (url.startsWith('/api/notifications')) {
      const parsedUrl = new URL(url, 'http://localhost')
      const pathname = parsedUrl.pathname

      // GET /api/notifications
      if (req.method === 'GET' && pathname === '/api/notifications') {
        const db = readDb()
        const role = (parsedUrl.searchParams.get('role') || '').toLowerCase().trim()
        const recipientId = (parsedUrl.searchParams.get('recipientId') || '').toLowerCase().trim()
        const unreadOnly = parsedUrl.searchParams.get('unreadOnly') === 'true'

        let list = [...(db.notifications || [])]

        if (role === 'landing' || (!role && !recipientId)) {
          // Public Landing Page: ONLY public platform announcements or landing broadcasts
          list = list.filter((n: any) => {
            const isBroadcast = !n.recipientId || n.recipientId === 'all';
            return (n.target === 'landing' || n.target === 'all') && isBroadcast;
          })
        } else if (role === 'expert') {
          list = list.filter((n: any) => {
            const isBroadcast = !n.recipientId || n.recipientId === 'expert-user' || n.recipientId === 'expert' || n.recipientId === 'all';
            if ((n.target === 'all' || n.target === 'expert') && isBroadcast) return true;
            if (recipientId && n.recipientId) {
              const targetRec = n.recipientId.toLowerCase().trim();
              if (targetRec === recipientId || targetRec.includes(recipientId) || recipientId.includes(targetRec)) {
                return true;
              }
            }
            return false;
          })
        } else if (role === 'client') {
          list = list.filter((n: any) => {
            const isBroadcast = !n.recipientId || n.recipientId === 'client-user' || n.recipientId === 'client' || n.recipientId === 'all';
            if ((n.target === 'all' || n.target === 'client') && isBroadcast) return true;
            if (recipientId && n.recipientId) {
              const targetRec = n.recipientId.toLowerCase().trim();
              if (targetRec === recipientId || targetRec.includes(recipientId) || recipientId.includes(targetRec)) {
                return true;
              }
            }
            return false;
          })
        } else if (role === 'admin') {
          // Admin Governance: see all platform notifications
        }

        if (unreadOnly) {
          list = list.filter((n: any) => !n.read)
        }

        list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, notifications: list, count: list.length }))
        return
      }

      // POST /api/notifications (Create / Dispatch broadcast or individual alert)
      if (req.method === 'POST' && pathname === '/api/notifications') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!payload.title || !payload.title.trim() || !payload.message || !payload.message.trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Both Title and Message are required for notification dispatch.' }))
              return
            }

            const db = readDb()
            const notifId = payload.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
            const target = payload.target || 'all'
            const defaultActionLink = target === 'client' ? 'client' : target === 'expert' ? 'expert' : target === 'admin' ? 'owner' : 'landing'

            const newNotif = {
              id: notifId,
              senderId: payload.senderId || 'admin',
              target: target,
              audienceType: payload.audienceType || target,
              recipientId: payload.recipientId || undefined,
              recipientName: payload.recipientName || undefined,
              recipientType: target,
              type: payload.type || 'announcement',
              title: payload.title.trim(),
              message: payload.message.trim(),
              timestamp: 'Just now',
              createdAt: new Date().toISOString(),
              read: false,
              status: 'delivered',
              actionLink: payload.actionLink || defaultActionLink,
              channel: payload.channel || 'in_app',
              channels: payload.channels || ['in_app', 'email', 'push'],
              eventId: payload.eventId || `evt-${Date.now()}`,
              eventName: payload.eventName || 'platform_broadcast',
              relatedEntityId: payload.relatedEntityId || undefined,
              metadata: payload.metadata || {}
            }

            db.notifications = [newNotif, ...(db.notifications || [])]
            if (!db.kv) db.kv = {}
            db.kv['app_platform_notifications'] = db.notifications
            writeDb(db)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, notification: newNotif }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/notifications/mark-read
      if (req.method === 'POST' && pathname === '/api/notifications/mark-read') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body || '{}')
            const db = readDb()
            let found = false
            db.notifications = (db.notifications || []).map((n: any) => {
              if (n.id === id) {
                found = true
                return { ...n, read: true, readAt: new Date().toISOString(), status: 'read' }
              }
              return n
            })
            if (found) {
              if (!db.kv) db.kv = {}
              db.kv['app_platform_notifications'] = db.notifications
              writeDb(db)
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, id, read: true }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/notifications/mark-all-read
      if (req.method === 'POST' && pathname === '/api/notifications/mark-all-read') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const { role, recipientId } = JSON.parse(body || '{}')
            const normRole = (role || '').toLowerCase().trim()
            const normRec = (recipientId || '').toLowerCase().trim()
            const db = readDb()
            let updatedCount = 0

            db.notifications = (db.notifications || []).map((n: any) => {
              let match = false
              if (normRole === 'landing' || (!normRole && !normRec)) {
                if (n.target === 'landing' || n.target === 'all') match = true
              } else if (normRole === 'admin') {
                match = true
              } else if (normRole === 'expert' && (n.target === 'expert' || n.target === 'all')) {
                if (!n.recipientId || n.recipientId === 'expert-user' || (normRec && n.recipientId.toLowerCase().includes(normRec))) match = true
              } else if (normRole === 'client' && (n.target === 'client' || n.target === 'all')) {
                if (!n.recipientId || n.recipientId === 'client-user' || (normRec && n.recipientId.toLowerCase().includes(normRec))) match = true
              }
              if (match && !n.read) {
                updatedCount++
                return { ...n, read: true, readAt: new Date().toISOString(), status: 'read' }
              }
              return n
            })

            if (updatedCount > 0) {
              if (!db.kv) db.kv = {}
              db.kv['app_platform_notifications'] = db.notifications
              writeDb(db)
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, updatedCount }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/notifications/clear
      if (req.method === 'POST' && pathname === '/api/notifications/clear') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const { role, recipientId } = JSON.parse(body || '{}')
            const normRole = (role || '').toLowerCase().trim()
            const normRec = (recipientId || '').toLowerCase().trim()
            const db = readDb()
            const initialLen = (db.notifications || []).length

            db.notifications = (db.notifications || []).filter((n: any) => {
              if (normRole === 'landing' || (!normRole && !normRec)) {
                return !(n.target === 'landing' || n.target === 'all')
              } else if (normRole === 'admin') {
                return false
              } else if (normRole === 'expert' && (n.target === 'expert' || n.target === 'all')) {
                if (!n.recipientId || n.recipientId === 'expert-user' || (normRec && n.recipientId.toLowerCase().includes(normRec))) return false
              } else if (normRole === 'client' && (n.target === 'client' || n.target === 'all')) {
                if (!n.recipientId || n.recipientId === 'client-user' || (normRec && n.recipientId.toLowerCase().includes(normRec))) return false
              }
              return true
            })

            const removedCount = initialLen - db.notifications.length
            if (!db.kv) db.kv = {}
            db.kv['app_platform_notifications'] = db.notifications
            writeDb(db)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, removedCount }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }
    }

    // ==============================================================
    // BLOGS & ARTICLES CMS REST APIS (PUBLIC & ADMIN)
    // ==============================================================
    if (url.startsWith('/api/blogs') || url.startsWith('/api/admin/blogs')) {
      const parsedUrl = new URL(url, 'http://localhost')
      const pathname = parsedUrl.pathname
      const queryRole = parsedUrl.searchParams.get('role')

      const checkAdminAuth = (bodyRole?: string): boolean => {
        const headerRole = req.headers['x-admin-role'] || req.headers['x-user-role']
        const authHeader = req.headers['authorization'] || ''
        if (queryRole === 'admin' || bodyRole === 'admin' || headerRole === 'admin') return true
        if (typeof authHeader === 'string' && authHeader.toLowerCase().includes('admin')) return true
        return false
      }

      // Public: GET /api/blogs/categories
      if (pathname === '/api/blogs/categories' && req.method === 'GET') {
        const db = readDb()
        const categories = Array.isArray(db.blogCategories) ? db.blogCategories : []
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, categories }))
        return
      }

      // Public: GET /api/blogs (List published articles with filtering)
      if (pathname === '/api/blogs' && req.method === 'GET') {
        const db = readDb()
        const all = Array.isArray(db.blogs) ? db.blogs : []
        const categoryFilter = parsedUrl.searchParams.get('category')
        const searchQuery = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim()
        const typeFilter = parsedUrl.searchParams.get('type')
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '0', 10)

        // Strict: only published articles publicly
        let published = all.filter((a: any) => a.status === 'published')

        if (categoryFilter && categoryFilter.toLowerCase() !== 'all') {
          published = published.filter((a: any) =>
            (a.category || '').toLowerCase() === categoryFilter.toLowerCase()
          )
        }

        if (typeFilter && (typeFilter === 'blog' || typeFilter === 'article')) {
          published = published.filter((a: any) => (a.type || 'article') === typeFilter)
        }

        if (searchQuery) {
          published = published.filter((a: any) => {
            const inTitle = (a.title || '').toLowerCase().includes(searchQuery)
            const inSummary = (a.excerpt || a.summary || '').toLowerCase().includes(searchQuery)
            const inAuthor = (a.author?.name || a.authorName || '').toLowerCase().includes(searchQuery)
            const inSlug = (a.slug || '').toLowerCase().includes(searchQuery)
            const inKeywords = Array.isArray(a.keywords) && a.keywords.some((k: string) => k.toLowerCase().includes(searchQuery))
            return inTitle || inSummary || inAuthor || inSlug || inKeywords
          })
        }

        // Sort: featured first, then displayOrder ascending, then publishedAt/createdAt descending
        published.sort((x: any, y: any) => {
          if (x.featured && !y.featured) return -1
          if (!x.featured && y.featured) return 1
          if (typeof x.displayOrder === 'number' && typeof y.displayOrder === 'number') {
            if (x.displayOrder !== y.displayOrder) return x.displayOrder - y.displayOrder
          }
          const dateX = new Date(x.publishedAt || x.createdAt || 0).getTime()
          const dateY = new Date(y.publishedAt || y.createdAt || 0).getTime()
          return dateY - dateX
        })

        const total = published.length
        const results = limit > 0 ? published.slice(0, limit) : published

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          success: true,
          articles: results,
          total,
          categories: db.blogCategories || []
        }))
        return
      }

      // Public: GET /api/blogs/:slug (Single published article with related items)
      if (pathname.startsWith('/api/blogs/') && !pathname.startsWith('/api/blogs/categories') && req.method === 'GET') {
        const slug = pathname.replace('/api/blogs/', '').replace(/\/+$/, '').toLowerCase().trim()
        const db = readDb()
        const all = Array.isArray(db.blogs) ? db.blogs : []
        const isPreview = parsedUrl.searchParams.get('preview') === 'true' && checkAdminAuth()

        const article = all.find((a: any) => (a.slug || '').toLowerCase().trim() === slug)

        if (!article || (!isPreview && article.status !== 'published')) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Article not found' }))
          return
        }

        // Related articles calculation
        const publishedOthers = all.filter((a: any) => a.status === 'published' && a.id !== article.id)
        const sameCategory = publishedOthers.filter((a: any) => (a.category || '').toLowerCase() === (article.category || '').toLowerCase())
        let relatedArticles: any[] = []
        if (sameCategory.length >= 3) {
          relatedArticles = sameCategory.slice(0, 3)
        } else {
          const diffCategory = publishedOthers.filter((a: any) => (a.category || '').toLowerCase() !== (article.category || '').toLowerCase())
          relatedArticles = [...sameCategory, ...diffCategory].slice(0, 3)
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, article, relatedArticles }))
        return
      }

      // Admin: GET /api/admin/blogs/stats
      if (pathname === '/api/admin/blogs/stats' && req.method === 'GET') {
        if (!checkAdminAuth()) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
          return
        }
        const db = readDb()
        const blogs = Array.isArray(db.blogs) ? db.blogs : []
        const categories = Array.isArray(db.blogCategories) ? db.blogCategories : []

        const stats = {
          total: blogs.length,
          published: blogs.filter((b: any) => b.status === 'published').length,
          drafts: blogs.filter((b: any) => b.status === 'draft').length,
          featured: blogs.filter((b: any) => b.featured).length,
          categories: categories.length
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, stats }))
        return
      }

      // Admin: Categories Management GET /api/admin/blogs/categories
      if (pathname === '/api/admin/blogs/categories' && req.method === 'GET') {
        if (!checkAdminAuth()) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
          return
        }
        const db = readDb()
        const categories = (db.blogCategories || []).map((cat: any) => {
          const count = (db.blogs || []).filter((b: any) => (b.category || '').toLowerCase() === (cat.name || '').toLowerCase()).length
          return { ...cat, articleCount: count }
        })
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, categories }))
        return
      }

      // Admin: Categories Management POST /api/admin/blogs/categories
      if (pathname === '/api/admin/blogs/categories' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const name = (payload.name || '').trim()
            if (!name) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Category name is required' }))
              return
            }

            const db = readDb()
            if (!Array.isArray(db.blogCategories)) db.blogCategories = []

            const existing = db.blogCategories.find((c: any) => c.name.toLowerCase() === name.toLowerCase())
            if (existing) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Category with this name already exists' }))
              return
            }

            const slug = (payload.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
            const newCategory = {
              id: payload.id || `cat-${Date.now()}`,
              name,
              slug,
              description: payload.description || `${name} insights and articles`,
              articleCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }

            db.blogCategories.push(newCategory)
            writeDb(db)

            res.statusCode = 201
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, category: newCategory, message: 'Category created successfully.' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // Admin: Categories Management DELETE /api/admin/blogs/categories/:id
      if (pathname.startsWith('/api/admin/blogs/categories/') && req.method === 'DELETE') {
        const catIdOrSlug = pathname.replace('/api/admin/blogs/categories/', '').trim()
        if (!checkAdminAuth()) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
          return
        }

        const db = readDb()
        const cat = (db.blogCategories || []).find((c: any) => c.id === catIdOrSlug || c.slug === catIdOrSlug)
        if (!cat) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Category not found' }))
          return
        }

        const force = parsedUrl.searchParams.get('force') === 'true'
        const inUse = (db.blogs || []).filter((b: any) => (b.category || '').toLowerCase() === cat.name.toLowerCase())
        if (inUse.length > 0 && !force) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            error: `Cannot delete category: "${cat.name}" is used by ${inUse.length} article(s). Please reassign or delete those articles first.`
          }))
          return
        }

        db.blogCategories = db.blogCategories.filter((c: any) => c.id !== cat.id)
        writeDb(db)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, message: 'Category deleted successfully.' }))
        return
      }

      // Admin: GET /api/admin/blogs (All articles including drafts, search & stats)
      if (pathname === '/api/admin/blogs' && req.method === 'GET') {
        if (!checkAdminAuth()) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
          return
        }

        const db = readDb()
        let articles = Array.isArray(db.blogs) ? [...db.blogs] : []
        const categories = Array.isArray(db.blogCategories) ? db.blogCategories : []

        const stats = {
          total: articles.length,
          published: articles.filter((b: any) => b.status === 'published').length,
          drafts: articles.filter((b: any) => b.status === 'draft').length,
          featured: articles.filter((b: any) => b.featured).length,
          categories: categories.length
        }

        const statusFilter = parsedUrl.searchParams.get('status')
        const categoryFilter = parsedUrl.searchParams.get('category')
        const typeFilter = parsedUrl.searchParams.get('type')
        const featuredFilter = parsedUrl.searchParams.get('featured')
        const searchQuery = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim()

        if (statusFilter && statusFilter !== 'all') {
          articles = articles.filter((a: any) => a.status === statusFilter)
        }
        if (categoryFilter && categoryFilter.toLowerCase() !== 'all') {
          articles = articles.filter((a: any) => (a.category || '').toLowerCase() === categoryFilter.toLowerCase())
        }
        if (typeFilter && (typeFilter === 'blog' || typeFilter === 'article')) {
          articles = articles.filter((a: any) => (a.type || 'article') === typeFilter)
        }
        if (featuredFilter === 'true') {
          articles = articles.filter((a: any) => !!a.featured)
        } else if (featuredFilter === 'false') {
          articles = articles.filter((a: any) => !a.featured)
        }
        if (searchQuery) {
          articles = articles.filter((a: any) => {
            const inTitle = (a.title || '').toLowerCase().includes(searchQuery)
            const inSummary = (a.excerpt || a.summary || '').toLowerCase().includes(searchQuery)
            const inAuthor = (a.author?.name || a.authorName || '').toLowerCase().includes(searchQuery)
            const inSlug = (a.slug || '').toLowerCase().includes(searchQuery)
            return inTitle || inSummary || inAuthor || inSlug
          })
        }

        // Sort: featured first, then displayOrder ascending, then updatedAt/createdAt descending
        articles.sort((x: any, y: any) => {
          if (x.featured && !y.featured) return -1
          if (!x.featured && y.featured) return 1
          if (typeof x.displayOrder === 'number' && typeof y.displayOrder === 'number') {
            if (x.displayOrder !== y.displayOrder) return x.displayOrder - y.displayOrder
          }
          const dateX = new Date(x.updatedAt || x.createdAt || 0).getTime()
          const dateY = new Date(y.updatedAt || y.createdAt || 0).getTime()
          return dateY - dateX
        })

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, articles, stats, categories }))
        return
      }

      // Admin: POST /api/admin/blogs/reorder
      if (pathname === '/api/admin/blogs/reorder' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const { order } = payload
            if (!Array.isArray(order)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Order array required' }))
              return
            }

            const db = readDb()
            if (!Array.isArray(db.blogs)) db.blogs = []

            order.forEach((item: { id: string; displayOrder: number }) => {
              const art = db.blogs.find((b: any) => b.id === item.id)
              if (art) {
                art.displayOrder = item.displayOrder
                art.updatedAt = new Date().toISOString()
              }
            })

            writeDb(db)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, message: 'Article order updated successfully.' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // Admin: POST /api/admin/blogs (Create new article)
      if (pathname === '/api/admin/blogs' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const title = (payload.title || '').trim()
            if (!title) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Title is required.' }))
              return
            }

            let slug = (payload.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim()
            if (!slug) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Valid slug is required.' }))
              return
            }

            const category = (payload.category || '').trim()
            if (!category) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Category is required.' }))
              return
            }

            const content = (payload.content || '').trim()
            const sections = Array.isArray(payload.sections) ? payload.sections : []
            const excerpt = (payload.excerpt || payload.summary || '').trim()
            if (!content && sections.length === 0 && !excerpt) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Article content cannot be empty.' }))
              return
            }

            const db = readDb()
            if (!Array.isArray(db.blogs)) db.blogs = []

            // Validate slug uniqueness
            const existingSlug = db.blogs.find((b: any) => (b.slug || '').toLowerCase() === slug.toLowerCase())
            if (existingSlug) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Slug already exists. Please choose a unique slug.' }))
              return
            }

            const isFeatured = !!payload.featured
            if (isFeatured) {
              // Enforce: only ONE primary featured article active at a time
              db.blogs.forEach((b: any) => { b.featured = false })
            }

            const nowIso = new Date().toISOString()
            const status = payload.status === 'published' ? 'published' : 'draft'
            const publishedAt = status === 'published' ? (payload.publishedAt || nowIso) : (payload.publishedAt || undefined)

            const authorObj = payload.author && typeof payload.author === 'object' ? payload.author : {
              name: payload.authorName || 'Mentora Editorial Team',
              role: payload.authorRole || 'Knowledge Exchange Council',
              avatar: payload.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
            }

            const newArticle = {
              id: payload.id || `blog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              type: payload.type === 'blog' ? 'blog' : 'article',
              title,
              slug,
              excerpt: excerpt || content.slice(0, 180),
              summary: excerpt || content.slice(0, 180),
              content: content || (sections.map((s: any) => s.text || '').join('\n\n')),
              sections: sections.length > 0 ? sections : [{ type: 'paragraph', text: content }],
              category,
              author: authorObj,
              authorName: authorObj.name,
              authorRole: authorObj.role,
              coverImage: payload.coverImage || payload.image || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
              image: payload.coverImage || payload.image || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
              readTime: payload.readTime || '5 min read',
              status,
              featured: isFeatured,
              displayOrder: typeof payload.displayOrder === 'number' ? payload.displayOrder : (db.blogs.length + 1),
              publishedAt,
              date: payload.date || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
              createdAt: nowIso,
              updatedAt: nowIso,
              keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
              keyTakeaways: Array.isArray(payload.keyTakeaways) ? payload.keyTakeaways : []
            }

            db.blogs.unshift(newArticle)
            if (!db.kv) db.kv = {}
            db.kv['app_blogs'] = db.blogs
            writeDb(db)

            res.statusCode = 201
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              article: newArticle,
              message: status === 'published' ? 'Article published successfully.' : 'Draft saved successfully.'
            }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // Admin: Actions on specific blog: Publish, Unpublish, Feature
      // POST /api/admin/blogs/:id/publish
      if (pathname.includes('/publish') && req.method === 'POST') {
        const id = pathname.replace('/api/admin/blogs/', '').replace('/publish', '').trim()
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const db = readDb()
            const article = (db.blogs || []).find((b: any) => b.id === id)
            if (!article) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Article not found' }))
              return
            }

            article.status = 'published'
            if (!article.publishedAt) article.publishedAt = new Date().toISOString()
            article.updatedAt = new Date().toISOString()

            writeDb(db)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, article, message: 'Article published successfully.' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/admin/blogs/:id/unpublish
      if (pathname.includes('/unpublish') && req.method === 'POST') {
        const id = pathname.replace('/api/admin/blogs/', '').replace('/unpublish', '').trim()
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const db = readDb()
            const article = (db.blogs || []).find((b: any) => b.id === id)
            if (!article) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Article not found' }))
              return
            }

            article.status = 'draft'
            article.updatedAt = new Date().toISOString()

            writeDb(db)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, article, message: 'Article unpublished successfully.' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // POST /api/admin/blogs/:id/feature
      if (pathname.includes('/feature') && req.method === 'POST') {
        const id = pathname.replace('/api/admin/blogs/', '').replace('/feature', '').trim()
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const db = readDb()
            const article = (db.blogs || []).find((b: any) => b.id === id)
            if (!article) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Article not found' }))
              return
            }

            const targetFeatured = payload.featured !== undefined ? !!payload.featured : !article.featured

            if (targetFeatured) {
              // Unset featured on all other articles
              db.blogs.forEach((b: any) => { b.featured = false })
              article.featured = true
            } else {
              article.featured = false
            }

            article.updatedAt = new Date().toISOString()
            writeDb(db)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              article,
              message: targetFeatured ? 'Article set as primary featured.' : 'Article removed from featured.'
            }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // Admin: PUT /api/admin/blogs/:id (Update existing article)
      if (pathname.startsWith('/api/admin/blogs/') && (req.method === 'PUT' || req.method === 'PATCH')) {
        const id = pathname.replace('/api/admin/blogs/', '').trim()
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            if (!checkAdminAuth(payload.role)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
              return
            }

            const db = readDb()
            if (!Array.isArray(db.blogs)) db.blogs = []

            const articleIdx = db.blogs.findIndex((b: any) => b.id === id)
            if (articleIdx === -1) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Article not found' }))
              return
            }

            const existing = db.blogs[articleIdx]

            // Slug uniqueness check if changed
            if (payload.slug && payload.slug.toLowerCase().trim() !== existing.slug.toLowerCase().trim()) {
              const duplicate = db.blogs.find((b: any) => b.id !== id && b.slug.toLowerCase().trim() === payload.slug.toLowerCase().trim())
              if (duplicate) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Slug already exists. Please choose a unique slug.' }))
                return
              }
            }

            // Featured synchronization
            if (payload.featured === true && !existing.featured) {
              db.blogs.forEach((b: any) => { b.featured = false })
            }

            const nowIso = new Date().toISOString()
            const updatedAuthor = payload.author || (payload.authorName ? {
              name: payload.authorName,
              role: payload.authorRole || existing.author?.role || '',
              avatar: payload.authorAvatar || existing.author?.avatar
            } : existing.author)

            const updatedStatus = payload.status || existing.status
            const publishedAt = updatedStatus === 'published'
              ? (payload.publishedAt || existing.publishedAt || nowIso)
              : (payload.publishedAt !== undefined ? payload.publishedAt : existing.publishedAt)

            const updatedArticle = {
              ...existing,
              ...payload,
              id: existing.id,
              title: payload.title !== undefined ? payload.title.trim() : existing.title,
              slug: payload.slug !== undefined ? payload.slug.trim() : existing.slug,
              category: payload.category !== undefined ? payload.category.trim() : existing.category,
              type: payload.type || existing.type || 'article',
              excerpt: payload.excerpt !== undefined ? payload.excerpt : (payload.summary !== undefined ? payload.summary : existing.excerpt),
              summary: payload.summary !== undefined ? payload.summary : (payload.excerpt !== undefined ? payload.excerpt : existing.summary),
              content: payload.content !== undefined ? payload.content : existing.content,
              sections: payload.sections !== undefined ? payload.sections : existing.sections,
              author: updatedAuthor,
              authorName: updatedAuthor.name,
              authorRole: updatedAuthor.role,
              coverImage: payload.coverImage || payload.image || existing.coverImage,
              image: payload.coverImage || payload.image || existing.image,
              readTime: payload.readTime !== undefined ? payload.readTime : existing.readTime,
              status: updatedStatus,
              featured: payload.featured !== undefined ? !!payload.featured : existing.featured,
              displayOrder: typeof payload.displayOrder === 'number' ? payload.displayOrder : existing.displayOrder,
              publishedAt,
              updatedAt: nowIso
            }

            db.blogs[articleIdx] = updatedArticle
            writeDb(db)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, article: updatedArticle, message: 'Article updated successfully.' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // Admin: DELETE /api/admin/blogs/:id (Delete article)
      if (pathname.startsWith('/api/admin/blogs/') && req.method === 'DELETE') {
        const id = pathname.replace('/api/admin/blogs/', '').trim()
        if (!checkAdminAuth()) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }))
          return
        }

        const db = readDb()
        if (!Array.isArray(db.blogs)) db.blogs = []

        const article = db.blogs.find((b: any) => b.id === id)
        if (!article) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Article not found' }))
          return
        }

        db.blogs = db.blogs.filter((b: any) => b.id !== id)
        writeDb(db)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, message: 'Article deleted successfully.' }))
        return
      }
    }

    next()
  }

  return {
    name: 'shared-db-plugin',
    handleHotUpdate({ file }) {
      if (file.endsWith('db.json') || file.includes('scratch') || file.includes('server_docs') || file.includes('.log')) {
        return []
      }
    },
    configureServer(server) {
      server.middlewares.use(handleMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleMiddleware)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sharedDbPlugin()],
  server: {
    watch: {
      ignored: [
        '**/db.json',
        '**/db.json/**',
        '**/scratch/**',
        '**/server_docs/**',
        '**/dist/**',
        '**/*.log'
      ]
    }
  }
})

