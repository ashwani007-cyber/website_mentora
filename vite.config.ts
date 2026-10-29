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

// UUID validation & safe PostgREST filters for Supabase
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim())
}

function getExpertFilter(expertId?: string | null, cleanEmail?: string | null): string {
  const parts: string[] = []
  if (expertId) {
    parts.push(`id.eq.${expertId}`)
    if (isUuid(expertId)) {
      parts.push(`user_id.eq.${expertId}`)
    }
  }
  if (cleanEmail) {
    parts.push(`email.ilike.${cleanEmail}`)
  }
  return parts.join(',')
}

async function findSupabaseExpert(sbClient: any, expertId?: string | null, email?: string | null): Promise<any> {
  const cleanEmail = (email || '').toLowerCase().trim()
  const filter = getExpertFilter(expertId, cleanEmail)
  if (!filter) return null
  const { data, error } = await sbClient.from('experts').select('*').or(filter)
  if (error) {
    throw error
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null
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

  const handleMiddleware = async (req: any, res: any, next: any) => {
    const url = req.url || ''

    // Endpoint: /api/auth (MongoDB Authenticated Sessions & Admin Flow)
    if (url.startsWith('/api/auth')) {
      (async () => {
        try {
          const handlerPath = pathToFileURL(path.resolve(__dirname, 'server/authHandler.js')).href
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

    // Endpoint: /api/domains (Domains Taxonomy Manager)
    if (url.startsWith('/api/domains')) {
      (async () => {
        try {
          const handlerPath = pathToFileURL(path.resolve(__dirname, 'server/domainHandler.js')).href
          const mod = await import(`${handlerPath}?t=${Date.now()}`)
          await mod.handleDomainApiMiddleware(req, res, next)
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

    // Endpoint: /api/admin/pending-verifications (Only Unverified Experts Waiting for Audit)
    if (url.startsWith('/api/admin/pending-verifications') && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || ''
      const adminToken = (req.headers['x-admin-token'] || req.headers['admin_token'] || '') as string
      const adminId = (req.headers['x-admin-id'] || '') as string
      const role = (req.headers['x-user-role'] || '') as string
      const isAuthAdmin = adminId === 'admin' || role === 'admin' || adminToken === 'admin-session-token' || (typeof adminToken === 'string' && adminToken.length > 5) || (authHeader.startsWith('Bearer ') && authHeader.length > 10)

      if (!isAuthAdmin) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required' }))
        return
      }

      const parsedUrl = new URL(url, 'http://localhost')
      const statusFilter = parsedUrl.searchParams.get('status')
      const db = readDb()

      let supaList: any[] = []
      try {
        const { supabase: sClient } = await import(pathToFileURL(path.resolve(__dirname, 'server/supabaseClient.js')).href)
        const { data: supaAll } = await sClient.from('experts').select('*')
        if (Array.isArray(supaAll)) supaList = supaAll
      } catch {}

      const dbExperts = Array.isArray(db.experts) ? db.experts : []
      const dbPending = Array.isArray(db.pendingVerifications) ? db.pendingVerifications : []

      const allCandidates: any[] = []
      const seenMap = new Set<string>()

      const addCandidate = (e: any) => {
        if (!e) return
        if (e.verified === true || e.verificationStatus === 'approved' || e.status === 'Approved') return
        const key = `${e.id || ''}::${(e.email || '').toLowerCase()}`
        if (seenMap.has(key)) return
        seenMap.add(key)
        allCandidates.push(e)
      }

      supaList.forEach(addCandidate)
      dbExperts.forEach(addCandidate)
      dbPending.forEach(addCandidate)

      const resultList = allCandidates.map((exp: any) => {
        const dbDocs = (db?.expertDocuments && (db.expertDocuments[exp.id] || db.expertDocuments[exp.user_id])) || {}
        const expDocs = exp.documents || {}
        const items = expDocs.items || {}

        const workCert = dbDocs.work_experience_cert || expDocs.work_experience_cert || items.work_experience_cert || items.expCert || (typeof expDocs.expCert === 'object' ? expDocs.expCert : (expDocs.expCert ? { file_name: expDocs.expCert, fileName: expDocs.expCert } : null))
        const offerLetter = dbDocs.offer_relieving_letter || expDocs.offer_relieving_letter || items.offer_relieving_letter || items.offerLetter || (typeof expDocs.offerLetter === 'object' ? expDocs.offerLetter : (expDocs.offerLetter ? { file_name: expDocs.offerLetter, fileName: expDocs.offerLetter } : null))
        const execCv = dbDocs.executive_cv || expDocs.executive_cv || items.executive_cv || items.resume || (typeof expDocs.resume === 'object' ? expDocs.resume : (expDocs.resume ? { file_name: expDocs.resume, fileName: expDocs.resume } : null))

        const docCount = (workCert ? 1 : 0) + (offerLetter ? 1 : 0) + (execCv ? 1 : 0)
        const kycStatus = expDocs.kyc_status || exp.kyc_status
        const verStatus = exp.verificationStatus || expDocs.verificationStatus || exp.status

        let computedStatus = 'Registered / Documents Pending'
        let finalVerStatus = 'pending_docs'

        if (verStatus === 'rejected' || exp.status === 'Rejected' || kycStatus === 'Rejected' || exp.rejected === true) {
          computedStatus = 'Rejected'
          finalVerStatus = 'rejected'
        } else if (verStatus === 'pending_resubmitted' || exp.status === 'Pending Review (Re-submitted)' || kycStatus === 'Pending Review (Re-submitted)') {
          computedStatus = 'Pending Review (Re-submitted)'
          finalVerStatus = 'pending_resubmitted'
        } else if (docCount === 3 || exp.status === 'Pending Review' || kycStatus === 'Pending Review') {
          computedStatus = 'Pending Review'
          finalVerStatus = 'pending'
        }

        return {
          id: exp.id,
          expertId: exp.id,
          user_id: exp.user_id || null,
          name: exp.name || exp.full_name || 'Senior Professional',
          email: exp.email || '',
          phone: exp.phone || '',
          field: exp.field || 'Strategic Leadership',
          company: exp.company || expDocs.company || 'Enterprise Firm',
          years: exp.years ?? exp.years_of_experience ?? 0,
          baseRate: exp.baseRate ?? exp.base_rate ?? 600,
          projectRate: exp.projectRate ?? exp.project_rate ?? 1000,
          bio: exp.bio || '',
          verified: false,
          status: computedStatus,
          verificationStatus: finalVerStatus,
          rejectionReason: exp.rejectionReason || expDocs.rejectionReason || null,
          submittedAt: exp.created_at || exp.submittedAt || new Date().toISOString(),
          documents: {
            work_experience_cert: workCert || null,
            offer_relieving_letter: offerLetter || null,
            executive_cv: execCv || null,
            expCert: workCert?.file_name || workCert?.fileName || (typeof expDocs.expCert === 'string' ? expDocs.expCert : null),
            offerLetter: offerLetter?.file_name || offerLetter?.fileName || (typeof expDocs.offerLetter === 'string' ? expDocs.offerLetter : null),
            resume: execCv?.file_name || execCv?.fileName || (typeof expDocs.resume === 'string' ? expDocs.resume : null),
            items: {
              work_experience_cert: workCert || null,
              offer_relieving_letter: offerLetter || null,
              executive_cv: execCv || null
            }
          }
        }
      })

      let filtered = resultList
      if (statusFilter && statusFilter !== 'all') {
        filtered = resultList.filter((item: any) => {
          if (statusFilter === 'rejected') return item.status === 'Rejected'
          if (statusFilter === 'pending') return item.status === 'Pending Review' || item.status === 'Pending Review (Re-submitted)'
          if (statusFilter === 'missing_docs') return item.status === 'Registered / Documents Pending'
          return item.status.toLowerCase() === statusFilter.toLowerCase()
        })
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(filtered))
      return
    }

    // Endpoint: /api/admin/approve-expert or /api/admin/approve-document (Admin Verifies Expert)
    if ((url.startsWith('/api/admin/approve-expert') || url.startsWith('/api/admin/approve-document')) && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => { body += chunk })
      req.on('end', async () => {
        try {
          const authHeader = req.headers['authorization'] || ''
          const adminToken = (req.headers['x-admin-token'] || req.headers['admin_token'] || '') as string
          const adminId = (req.headers['x-admin-id'] || '') as string
          const role = (req.headers['x-user-role'] || '') as string
          const isAuthAdmin = adminId === 'admin' || role === 'admin' || adminToken === 'admin-session-token' || (typeof adminToken === 'string' && adminToken.length > 5) || (authHeader.startsWith('Bearer ') && authHeader.length > 10)

          if (!isAuthAdmin) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required' }))
            return
          }

          const payload = JSON.parse(body || '{}')
          const expertId = payload.expertId
          const cleanEmail = (payload.email || '').toLowerCase().trim()

          const { supabase: sClient } = await import(pathToFileURL(path.resolve(__dirname, 'server/supabaseClient.js')).href)
          const matchedRow = await findSupabaseExpert(sClient, expertId, cleanEmail)
          if (!matchedRow) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: `Expert "${expertId || cleanEmail}" not found in Supabase` }))
            return
          }

          const targetExpertId = matchedRow.id
          const targetUserId = matchedRow.user_id

          const updatedDocs = {
            ...(matchedRow.documents || {}),
            kyc_status: 'Verified',
            status: 'Approved',
            verificationStatus: 'approved',
            rejectionReason: null,
            reviewedAt: new Date().toISOString(),
            reviewedBy: payload.adminId || 'admin'
          }

          const { data: updatedRows, error: updateErr } = await sClient.from('experts').update({
            verified: true,
            documents: updatedDocs,
            updated_at: new Date().toISOString()
          }).eq('id', targetExpertId).select()

          if (updateErr) {
            throw new Error(`Supabase approve failed: ${updateErr.message}`)
          }
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error('Supabase approve affected 0 rows')
          }

          const userFilters: string[] = []
          if (targetUserId && isUuid(targetUserId)) {
            userFilters.push(`id.eq.${targetUserId}`)
          } else if (expertId && isUuid(expertId)) {
            userFilters.push(`id.eq.${expertId}`)
          }
          if (cleanEmail) {
            userFilters.push(`email.ilike.${cleanEmail}`)
          }
          if (userFilters.length > 0) {
            try {
              await sClient.from('users').update({
                is_verified: true,
                updated_at: new Date().toISOString()
              }).or(userFilters.join(','))
            } catch {}
          }

          const notifMsg = 'Your documents have been audited and your account has been verified by Admin. Your profile is now live and you are ready to take work.'
          try {
            await sClient.from('notifications').insert({
              user_id: targetUserId || targetExpertId,
              title: 'Credentials Approved & Profile Verified!',
              message: notifMsg,
              type: 'verification',
              is_read: false,
              created_at: new Date().toISOString()
            })
          } catch {}

          const ch = sClient.channel('admin-kyc-desk')
          await ch.send({
            type: 'broadcast',
            event: 'expert_status_changed',
            payload: {
              expertId: targetExpertId,
              email: cleanEmail,
              status: 'approved',
              verified: true,
              timestamp: new Date().toISOString()
            }
          }).catch(() => {})

          // Update db.json only after Supabase succeeds
          const current = readDb()
          if (Array.isArray(current.experts)) {
            current.experts = current.experts.map((e: any) => {
              if (e.id === expertId || e.id === targetExpertId || (cleanEmail && e.email?.toLowerCase() === cleanEmail)) {
                const curDocs = e.documents || {}
                return {
                  ...e,
                  verified: true,
                  verificationStatus: 'approved',
                  status: 'Approved',
                  rejected: false,
                  rejectionReason: null,
                  documents: {
                    ...curDocs,
                    kyc_status: 'Verified',
                    status: 'Approved',
                    verificationStatus: 'approved',
                    rejectionReason: null
                  }
                }
              }
              return e
            })
          }

          if (Array.isArray(current.users)) {
            current.users = current.users.map((u: any) => {
              if (u.id === expertId || u.id === targetUserId || (cleanEmail && u.email?.toLowerCase() === cleanEmail)) {
                return { ...u, verified: true, is_verified: true, verificationStatus: 'approved', rejected: false }
              }
              return u
            })
          }

          if (Array.isArray(current.pendingVerifications)) {
            current.pendingVerifications = current.pendingVerifications.filter((p: any) => 
              p.id !== expertId && p.id !== targetExpertId && (!cleanEmail || p.email?.toLowerCase() !== cleanEmail)
            )
          }

          if (!Array.isArray(current.notifications)) current.notifications = []
          current.notifications.push({
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            recipientId: cleanEmail || targetExpertId,
            user_id: targetUserId || targetExpertId,
            target: 'expert',
            type: 'verification',
            title: 'Credentials Approved & Profile Verified!',
            message: notifMsg,
            is_read: false,
            read: false,
            actionLink: 'expert',
            createdAt: new Date().toISOString()
          })

          writeDb(current)

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, message: 'Expert verified and approved successfully', status: 'Approved' }))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })
      return
    }

    // Endpoint: /api/admin/reject-expert or /api/admin/reject-document
    if ((url.startsWith('/api/admin/reject-expert') || url.startsWith('/api/admin/reject-document')) && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => { body += chunk })
      req.on('end', async () => {
        try {
          const authHeader = req.headers['authorization'] || ''
          const adminToken = (req.headers['x-admin-token'] || req.headers['admin_token'] || '') as string
          const adminId = (req.headers['x-admin-id'] || '') as string
          const role = (req.headers['x-user-role'] || '') as string
          const isAuthAdmin = adminId === 'admin' || role === 'admin' || adminToken === 'admin-session-token' || (typeof adminToken === 'string' && adminToken.length > 5) || (authHeader.startsWith('Bearer ') && authHeader.length > 10)

          if (!isAuthAdmin) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required' }))
            return
          }

          const payload = JSON.parse(body || '{}')
          const expertId = payload.expertId
          const cleanEmail = (payload.email || '').toLowerCase().trim()
          const cleanReason = (payload.reason && payload.reason.trim()) || 'Your submission has been rejected because the uploaded documents were not valid. Please upload valid documents and re-apply.'

          const { supabase: sClient } = await import(pathToFileURL(path.resolve(__dirname, 'server/supabaseClient.js')).href)
          const matchedRow = await findSupabaseExpert(sClient, expertId, cleanEmail)
          if (!matchedRow) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: `Expert "${expertId || cleanEmail}" not found in Supabase` }))
            return
          }

          const targetExpertId = matchedRow.id
          const targetUserId = matchedRow.user_id

          const updatedDocs = {
            ...(matchedRow.documents || {}),
            kyc_status: 'Rejected',
            status: 'Rejected',
            verificationStatus: 'rejected',
            rejectionReason: cleanReason,
            reviewedAt: new Date().toISOString(),
            reviewedBy: payload.adminId || 'admin'
          }

          const { data: updatedRows, error: updateErr } = await sClient.from('experts').update({
            verified: false,
            documents: updatedDocs,
            updated_at: new Date().toISOString()
          }).eq('id', targetExpertId).select()

          if (updateErr) {
            throw new Error(`Supabase reject failed: ${updateErr.message}`)
          }
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error('Supabase reject affected 0 rows')
          }

          const userFilters: string[] = []
          if (targetUserId && isUuid(targetUserId)) {
            userFilters.push(`id.eq.${targetUserId}`)
          } else if (expertId && isUuid(expertId)) {
            userFilters.push(`id.eq.${expertId}`)
          }
          if (cleanEmail) {
            userFilters.push(`email.ilike.${cleanEmail}`)
          }
          if (userFilters.length > 0) {
            try {
              await sClient.from('users').update({
                is_verified: false,
                updated_at: new Date().toISOString()
              }).or(userFilters.join(','))
            } catch {}
          }

          const notifMsg = 'Your submission has been rejected because the uploaded documents were not valid. Please upload valid documents and re-apply.'
          try {
            await sClient.from('notifications').insert({
              user_id: targetUserId || targetExpertId,
              title: 'Document Verification Notice',
              message: notifMsg,
              type: 'verification',
              is_read: false,
              created_at: new Date().toISOString()
            })
          } catch {}

          const ch = sClient.channel('admin-kyc-desk')
          await ch.send({
            type: 'broadcast',
            event: 'expert_status_changed',
            payload: {
              expertId: targetExpertId,
              email: cleanEmail,
              status: 'rejected',
              rejectionReason: cleanReason,
              timestamp: new Date().toISOString()
            }
          }).catch(() => {})

          // Update db.json only after Supabase succeeds
          const current = readDb()
          if (Array.isArray(current.experts)) {
            current.experts = current.experts.map((e: any) => {
              if (e.id === expertId || e.id === targetExpertId || (cleanEmail && e.email?.toLowerCase() === cleanEmail)) {
                const curDocs = e.documents || {}
                return {
                  ...e,
                  verified: false,
                  verificationStatus: 'rejected',
                  status: 'Rejected',
                  rejected: true,
                  rejectionReason: cleanReason,
                  documents: {
                    ...curDocs,
                    kyc_status: 'Rejected',
                    status: 'Rejected',
                    verificationStatus: 'rejected',
                    rejectionReason: cleanReason
                  }
                }
              }
              return e
            })
          }

          if (Array.isArray(current.pendingVerifications)) {
            current.pendingVerifications = current.pendingVerifications.map((p: any) => {
              if (p.id === expertId || p.id === targetExpertId || (cleanEmail && p.email?.toLowerCase() === cleanEmail)) {
                return {
                  ...p,
                  status: 'Rejected',
                  verificationStatus: 'rejected',
                  rejectionReason: cleanReason
                }
              }
              return p
            })
          }

          if (!Array.isArray(current.notifications)) current.notifications = []
          current.notifications.push({
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            recipientId: cleanEmail || targetExpertId,
            user_id: targetUserId || targetExpertId,
            target: 'expert',
            type: 'verification',
            title: 'Document Verification Notice',
            message: notifMsg,
            is_read: false,
            read: false,
            rejectionReason: cleanReason,
            actionLink: 'expert',
            createdAt: new Date().toISOString()
          })

          writeDb(current)

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, message: 'Expert submission rejected', status: 'Rejected', rejectionReason: cleanReason }))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })
      return
    }

    // Endpoint: /api/admin/remove-expert or /api/admin/delete-expert (Permanent Deletion)
    if ((url.startsWith('/api/admin/remove-expert') || url.startsWith('/api/admin/delete-expert')) && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => { body += chunk })
      req.on('end', async () => {
        try {
          const authHeader = req.headers['authorization'] || ''
          const adminToken = (req.headers['x-admin-token'] || req.headers['admin_token'] || '') as string
          const adminId = (req.headers['x-admin-id'] || '') as string
          const role = (req.headers['x-user-role'] || '') as string
          const isAuthAdmin = adminId === 'admin' || role === 'admin' || adminToken === 'admin-session-token' || (typeof adminToken === 'string' && adminToken.length > 5) || (authHeader.startsWith('Bearer ') && authHeader.length > 10)

          if (!isAuthAdmin) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin privileges required' }))
            return
          }

          const payload = JSON.parse(body || '{}')
          const expertId = payload.expertId || payload.id
          const cleanEmail = (payload.email || '').toLowerCase().trim()

          const { supabase: sClient } = await import(pathToFileURL(path.resolve(__dirname, 'server/supabaseClient.js')).href)
          const matchedRow = await findSupabaseExpert(sClient, expertId, cleanEmail)
          if (!matchedRow) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: `Expert "${expertId || cleanEmail}" not found in Supabase` }))
            return
          }

          const targetExpertId = matchedRow.id
          const targetUserId = matchedRow.user_id
          const targetEmail = (matchedRow.email || cleanEmail).toLowerCase().trim()

          // Remove files from storage
          const directPaths = new Set<string>()
          const folderNames = new Set<string>([targetExpertId, expertId, targetUserId].filter(Boolean))

          if (matchedRow.documents && typeof matchedRow.documents === 'object') {
            const items = matchedRow.documents.items || {}
            for (const item of Object.values(items) as any[]) {
              if (item && typeof item === 'object') {
                const p = item.filePath || item.file_path
                if (typeof p === 'string' && p.trim()) {
                  directPaths.add(p.trim())
                  const folderPart = p.trim().split('/')[0]
                  if (folderPart) folderNames.add(folderPart)
                }
                if (item.expert_id) folderNames.add(item.expert_id)
              }
            }
          }

          if (directPaths.size > 0) {
            try {
              await sClient.storage.from('expert-documents').remove(Array.from(directPaths))
            } catch {}
          }

          for (const folder of folderNames) {
            try {
              const { data: subItems } = await sClient.storage.from('expert-documents').list(folder)
              if (Array.isArray(subItems) && subItems.length > 0) {
                const rootPaths = subItems.filter((f: any) => f.name).map((f: any) => `${folder}/${f.name}`)
                if (rootPaths.length > 0) {
                  await sClient.storage.from('expert-documents').remove(rootPaths)
                }
              }
              for (const sub of ['work_experience_cert', 'offer_relieving_letter', 'executive_cv']) {
                const { data: files } = await sClient.storage.from('expert-documents').list(`${folder}/${sub}`)
                if (Array.isArray(files) && files.length > 0) {
                  const pathsToRemove = files.filter((f: any) => f.name).map((f: any) => `${folder}/${sub}/${f.name}`)
                  if (pathsToRemove.length > 0) {
                    await sClient.storage.from('expert-documents').remove(pathsToRemove)
                  }
                }
              }
            } catch {}
          }

          // Delete from expert_documents table if present (expert_id is text)
          try {
            const docFilters = [`expert_id.eq.${targetExpertId}`]
            if (expertId && expertId !== targetExpertId) docFilters.push(`expert_id.eq.${expertId}`)
            if (targetUserId) docFilters.push(`expert_id.eq.${targetUserId}`)
            await sClient.from('expert_documents').delete().or(docFilters.join(','))
          } catch {}

          // Delete from expert_availability (expert_id is text)
          try {
            const availFilters = [`expert_id.eq.${targetExpertId}`]
            if (expertId && expertId !== targetExpertId) availFilters.push(`expert_id.eq.${expertId}`)
            await sClient.from('expert_availability').delete().or(availFilters.join(','))
          } catch {}

          // Delete expert record from Supabase 'experts' table
          const { data: deletedRows, error: delErr } = await sClient
            .from('experts')
            .delete()
            .eq('id', targetExpertId)
            .select()

          if (delErr) {
            throw new Error(`Supabase delete failed: ${delErr.message}`)
          }
          if (!deletedRows || deletedRows.length === 0) {
            throw new Error('Supabase delete affected 0 rows')
          }

          // Delete user and auth user safely
          if (targetUserId && isUuid(targetUserId)) {
            try {
              await sClient.from('users').delete().eq('id', targetUserId)
            } catch {}
            try {
              await sClient.auth.admin.deleteUser(targetUserId)
            } catch {}
          } else if (targetEmail) {
            try {
              await sClient.from('users').delete().ilike('email', targetEmail)
            } catch {}
            try {
              const { data: { users } } = await sClient.auth.admin.listUsers()
              const authUser = (users || []).find((u: any) => targetEmail && u.email?.toLowerCase() === targetEmail.toLowerCase())
              if (authUser?.id) {
                await sClient.auth.admin.deleteUser(authUser.id)
              }
            } catch {}
          }

          // Delete notifications
          const notifTargets = [targetExpertId, expertId, targetUserId, targetEmail].filter(Boolean)
          const notifFilters = notifTargets.map(t => `user_id.eq.${t}`).join(',')
          if (notifFilters) {
            try {
              await sClient.from('notifications').delete().or(notifFilters)
            } catch {}
          }

          const ch = sClient.channel('admin-kyc-desk')
          await ch.send({
            type: 'broadcast',
            event: 'expert_deleted',
            payload: {
              expertId: targetExpertId,
              email: targetEmail,
              timestamp: new Date().toISOString()
            }
          }).catch(() => {})

          // Update db.json only after Supabase succeeds
          const current = readDb()
          if (Array.isArray(current.experts)) {
            current.experts = current.experts.filter((e: any) =>
              e.id !== expertId && e.id !== targetExpertId && (!targetEmail || e.email?.toLowerCase() !== targetEmail.toLowerCase())
            )
          }
          if (Array.isArray(current.pendingVerifications)) {
            current.pendingVerifications = current.pendingVerifications.filter((p: any) =>
              p.id !== expertId && p.id !== targetExpertId && (!targetEmail || p.email?.toLowerCase() !== targetEmail.toLowerCase())
            )
          }
          if (Array.isArray(current.users)) {
            current.users = current.users.filter((u: any) =>
              u.id !== expertId && u.id !== targetUserId && (!targetEmail || u.email?.toLowerCase() !== targetEmail.toLowerCase())
            )
          }
          if (current.expertDocuments) {
            delete current.expertDocuments[expertId]
            delete current.expertDocuments[targetExpertId]
            if (targetUserId) delete current.expertDocuments[targetUserId]
          }
          if (Array.isArray(current.availabilities)) {
            current.availabilities = current.availabilities.filter((a: any) => a.expertId !== expertId && a.expertId !== targetExpertId)
          }

          writeDb(current)

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, message: 'Profile permanently deleted' }))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })
      return
    }

    // Endpoint: /api/experts
    if (url === '/api/experts' || url.startsWith('/api/experts?')) {
      if (req.method === 'GET') {
        const db = readDb()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(db.experts || []))
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

      // POST /api/availability/release (Undo lock on failed booking)
      if (req.method === 'POST' && pathname === '/api/availability/release') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}')
            const { slotId, bookingId } = payload
            if (!slotId) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'slotId is required' }))
              return
            }

            const current = readDb()
            const list: any[] = current.availabilities || []
            const slot = list.find((a: any) => a.id === slotId)
            if (slot) {
              slot.status = 'AVAILABLE'
              slot.bookingId = null
              slot.clientId = null
              slot.clientName = null
              slot.updatedAt = new Date().toISOString()
              writeDb(current)
            }

            try {
              const { createClient } = await import('@supabase/supabase-js')
              const sbUrl = process.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co'
              const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM5NjU2NCwiZXhwIjoyMTA3OTcyNTY0fQ.WGi0P4ENT5nhKPmp4zQN5VgmZ1twXLb4INXTSu1jxdw'
              const sb = createClient(sbUrl, sbKey)
              let q = sb.from('expert_availability').update({
                status: 'AVAILABLE',
                booking_id: null,
                client_id: null,
                client_name: null,
                updated_at: new Date().toISOString()
              }).eq('id', slotId)
              if (bookingId) q = q.eq('booking_id', bookingId)
              await q
            } catch {}

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, availability: slot || { id: slotId, status: 'AVAILABLE' } }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: err.message }))
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
            const existsWithId = payload.id && list.some(a => a.id === payload.id)
            const newSlot = {
              id: (payload.id && !existsWithId) ? payload.id : `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    // Endpoint: /api/bookings (Protected Consultation Bookings API via Service Role)
    if (url.startsWith('/api/bookings')) {
      const parsedUrl = new URL(req.url, 'http://localhost:5173')
      const pathname = parsedUrl.pathname

      const getSbAdmin = async () => {
        const { createClient } = await import('@supabase/supabase-js')
        const sbUrl = process.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co'
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM5NjU2NCwiZXhwIjoyMTA3OTcyNTY0fQ.WGi0P4ENT5nhKPmp4zQN5VgmZ1twXLb4INXTSu1jxdw'
        return createClient(sbUrl, sbKey)
      }

      // GET /api/bookings
      if (req.method === 'GET' && pathname === '/api/bookings') {
        try {
          const clientId = parsedUrl.searchParams.get('clientId') || parsedUrl.searchParams.get('client_id') || ''
          const clientEmail = (parsedUrl.searchParams.get('clientEmail') || parsedUrl.searchParams.get('client_email') || '').toLowerCase().trim()
          const expertId = parsedUrl.searchParams.get('expertId') || parsedUrl.searchParams.get('expert_id') || ''
          const expertEmail = (parsedUrl.searchParams.get('expertEmail') || parsedUrl.searchParams.get('expert_email') || '').toLowerCase().trim()
          const status = parsedUrl.searchParams.get('status') || ''

          const sb = await getSbAdmin()
          let query = sb.from('bookings').select('*')

          if (clientId && clientEmail) {
            query = query.or(`client_id.eq.${clientId},client_email.ilike.${clientEmail}`)
          } else if (clientId) {
            query = query.eq('client_id', clientId)
          } else if (clientEmail) {
            query = query.ilike('client_email', clientEmail)
          }

          if (expertId && expertEmail) {
            query = query.or(`expert_id.eq.${expertId},expert_email.ilike.${expertEmail}`)
          } else if (expertId) {
            query = query.eq('expert_id', expertId)
          } else if (expertEmail) {
            query = query.ilike('expert_email', expertEmail)
          }

          if (status) {
            query = query.ilike('status', `%${status}%`)
          }

          query = query.order('created_at', { ascending: false })
          const { data: bookings, error } = await query
          if (error) throw error

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, data: bookings || [] }))
          return
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
          return
        }
      }

      // POST /api/bookings
      if (req.method === 'POST' && pathname === '/api/bookings') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const bookingData = JSON.parse(body || '{}')
            const userId = req.headers['x-user-id'] || bookingData.callerId || bookingData.clientId || ''
            const userRole = (req.headers['x-user-role'] || bookingData.callerRole || bookingData.role || '').toLowerCase().trim()
            const authHeader = req.headers['authorization'] || ''
            const adminToken = req.headers['x-admin-token'] || req.headers['admin_token'] || ''
            const isAdmin = userRole === 'admin' || (typeof authHeader === 'string' && authHeader.length > 10) || (typeof adminToken === 'string' && adminToken.length > 5)

            // Security Check 1: User identity required
            if (!isAdmin && !userId) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthenticated: User identity is required to create a booking' }))
              return
            }

            // Security Check 2: A client cannot insert with another client's id
            if (!isAdmin && userId && bookingData.client_id && String(userId) !== String(bookingData.client_id)) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You cannot book on behalf of another client' }))
              return
            }

            // Security Check 3: A client cannot set status 'accepted' on creation
            if (!isAdmin && bookingData.status && ['accepted', 'Confirmed', 'Live', 'completed'].includes(bookingData.status)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: "Forbidden: New client consultations cannot be created with 'accepted' status" }))
              return
            }
            bookingData.status = 'pending'

            // FIX 3: NOT NULL check
            if (!bookingData.topic || !bookingData.scheduled_date || !bookingData.scheduled_time || !bookingData.client_id || !bookingData.expert_id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Missing required field: topic, scheduled_date, scheduled_time, client_id, and expert_id are required' }))
              return
            }

            const sb = await getSbAdmin()

            // FIX 6: Double-booking protection
            const { data: existingActive } = await sb
              .from('bookings')
              .select('id, status')
              .eq('expert_id', bookingData.expert_id)
              .eq('scheduled_date', bookingData.scheduled_date)
              .eq('scheduled_time', bookingData.scheduled_time)
              .in('status', ['pending', 'accepted', 'Pending Expert Acceptance', 'Confirmed', 'Live'])

            if (existingActive && existingActive.length > 0) {
              res.statusCode = 409
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: false,
                code: '23505',
                error: 'This slot was just booked, please choose another time'
              }))
              return
            }

            const { data: booking, error } = await sb
              .from('bookings')
              .insert(bookingData)
              .select()
              .single()

            if (error) {
              if (error.code === '23505' || String(error.message).includes('23505') || String(error.message).includes('unique constraint') || String(error.message).includes('idx_bookings_no_double_booking')) {
                res.statusCode = 409
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  success: false,
                  code: '23505',
                  error: 'This slot was just booked, please choose another time'
                }))
                return
              }
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: error.message }))
              return
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, booking }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // PATCH /api/bookings/:id
      if (req.method === 'PATCH' && pathname.startsWith('/api/bookings/')) {
        const id = pathname.replace('/api/bookings/', '').trim()
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const updatePayload = JSON.parse(body || '{}')
            const userId = req.headers['x-user-id'] || updatePayload.callerId || ''
            const userEmail = (req.headers['x-user-email'] || updatePayload.callerEmail || '').toLowerCase().trim()
            const userRole = (req.headers['x-user-role'] || updatePayload.callerRole || updatePayload.role || '').toLowerCase().trim()
            const authHeader = req.headers['authorization'] || ''
            const adminToken = req.headers['x-admin-token'] || req.headers['admin_token'] || ''
            const isAdmin = userRole === 'admin' || (typeof authHeader === 'string' && authHeader.length > 10) || (typeof adminToken === 'string' && adminToken.length > 5)

            if (!isAdmin && !userId && !userEmail) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Unauthenticated: User identity is required to update booking' }))
              return
            }

            const sb = await getSbAdmin()
            const { data: existing, error: fetchErr } = await sb
              .from('bookings')
              .select('*')
              .eq('id', id)
              .maybeSingle()

            if (fetchErr || !existing) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Booking not found' }))
              return
            }

            if (!isAdmin) {
              const isAssignedExpert = (userId && String(existing.expert_id) === String(userId)) ||
                (userEmail && existing.expert_email && String(existing.expert_email).toLowerCase() === userEmail)

              const isOwningClient = (userId && String(existing.client_id) === String(userId)) ||
                (userEmail && existing.client_email && String(existing.client_email).toLowerCase() === userEmail)

              if (userRole === 'expert' || isAssignedExpert) {
                if (!isAssignedExpert) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Forbidden: Experts can only update their own assigned consultations' }))
                  return
                }
              } else if (userRole === 'client' || isOwningClient) {
                if (!isOwningClient) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: "Forbidden: You cannot update another user's booking" }))
                  return
                }
                if (updatePayload.status && ['accepted', 'completed', 'Confirmed', 'Live'].includes(updatePayload.status)) {
                  res.statusCode = 403
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: 'Forbidden: Clients cannot accept consultations' }))
                  return
                }
              } else {
                res.statusCode = 403
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Forbidden: Unauthorized to update this consultation' }))
                return
              }
            }

            const updateData = {
              ...updatePayload,
              updated_at: new Date().toISOString()
            }

            const { data: booking, error } = await sb
              .from('bookings')
              .update(updateData)
              .eq('id', id)
              .select()
              .maybeSingle()

            if (error) throw error
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, booking }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // DELETE /api/bookings/:id
      if (req.method === 'DELETE' && pathname.startsWith('/api/bookings/')) {
        const id = pathname.replace('/api/bookings/', '').trim()
        const userId = req.headers['x-user-id'] || ''
        const userEmail = (req.headers['x-user-email'] || '').toLowerCase().trim()
        const userRole = (req.headers['x-user-role'] || '').toLowerCase().trim()
        const authHeader = req.headers['authorization'] || ''
        const adminToken = req.headers['x-admin-token'] || req.headers['admin_token'] || ''
        const isAdmin = userRole === 'admin' || (typeof authHeader === 'string' && authHeader.length > 10) || (typeof adminToken === 'string' && adminToken.length > 5)

        if (!isAdmin && !userId && !userEmail) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Unauthenticated: User identity is required to delete booking' }))
          return
        }

        try {
          const sb = await getSbAdmin()
          if (!isAdmin) {
            const { data: existing } = await sb.from('bookings').select('*').eq('id', id).maybeSingle()
            if (!existing) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Booking not found' }))
              return
            }
            const isOwningClient = (userId && String(existing.client_id) === String(userId)) ||
              (userEmail && existing.client_email && String(existing.client_email).toLowerCase() === userEmail)
            if (!isOwningClient) {
              res.statusCode = 403
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Forbidden: Only admin or the booking client can delete this consultation' }))
              return
            }
          }

          const { error } = await sb.from('bookings').delete().eq('id', id)
          if (error) throw error
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, message: 'Booking deleted successfully' }))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
        return
      }
    }

    // Endpoint: /api/wallet (Authoritative Client Wallet Balance & Transactions)
    if (url.startsWith('/api/wallet')) {
      const parsedUrl = new URL(req.url, 'http://localhost:5173')
      const pathname = parsedUrl.pathname

      const getSbAdmin = async () => {
        const { createClient } = await import('@supabase/supabase-js')
        const sbUrl = process.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co'
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM5NjU2NCwiZXhwIjoyMTA3OTcyNTY0fQ.WGi0P4ENT5nhKPmp4zQN5VgmZ1twXLb4INXTSu1jxdw'
        return createClient(sbUrl, sbKey)
      }

      if (req.method === 'GET' && pathname === '/api/wallet') {
        const userId = parsedUrl.searchParams.get('userId') || ''
        const userEmail = (parsedUrl.searchParams.get('userEmail') || '').toLowerCase().trim()

        try {
          const sb = await getSbAdmin()
          let query = sb.from('wallet_transactions').select('*')
          if (userEmail && userId && userEmail !== userId) {
            query = query.or(`user_email.ilike.${userEmail},user_id.eq.${userId}`)
          } else if (userEmail) {
            query = query.ilike('user_email', userEmail)
          } else if (userId) {
            query = query.eq('user_id', userId)
          }
          query = query.order('created_at', { ascending: false })

          const { data, error } = await query
          if (error) throw error

          let balance = 0
          if (Array.isArray(data) && data.length > 0) {
            data.forEach((tx: any) => {
              const amt = Number(tx.amount) || 0
              if ((tx.status || 'SUCCESS').toUpperCase() === 'SUCCESS') {
                if (tx.type === 'CREDIT') balance += amt
                else if (tx.type === 'DEBIT') balance -= amt
              }
            })
            balance = Math.max(0, balance)
          } else {
            const db = readDb()
            const kv = db.kv || {}
            const kvBal = Number(kv[`client_wallet_${userEmail}`])
            if (!isNaN(kvBal) && kvBal > 0) {
              balance = kvBal
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, balance, transactions: data || [] }))
          return
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: err.message }))
          return
        }
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}')
            const userId = payload.userId || payload.userEmail || ''
            const userEmail = (payload.userEmail || '').toLowerCase().trim()
            const userRole = payload.userRole || 'client'
            const amount = Number(payload.amount) || 0
            const type = pathname.includes('/deduct') ? 'DEBIT' : 'CREDIT'
            const description = payload.description || (type === 'CREDIT' ? 'Wallet Top-up' : 'Consultation Booking Payment')

            if (amount <= 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Amount must be greater than 0' }))
              return
            }

            const sb = await getSbAdmin()
            const txRecord = {
              id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              user_id: userId,
              user_email: userEmail,
              user_role: userRole,
              amount,
              type,
              status: 'SUCCESS',
              description,
              related_booking_id: payload.relatedBookingId || null,
              related_project_review_id: payload.relatedProjectReviewId || null
            }

            const { data: inserted, error } = await sb.from('wallet_transactions').insert(txRecord).select().single()
            if (error) throw error

            const { data: allTx } = await sb.from('wallet_transactions').select('*').ilike('user_email', userEmail)
            let newBal = 0
            if (Array.isArray(allTx)) {
              allTx.forEach((tx: any) => {
                const a = Number(tx.amount) || 0
                if ((tx.status || 'SUCCESS').toUpperCase() === 'SUCCESS') {
                  if (tx.type === 'CREDIT') newBal += a
                  else if (tx.type === 'DEBIT') newBal -= a
                }
              })
              newBal = Math.max(0, newBal)
            }

            const db = readDb()
            if (!db.kv) db.kv = {}
            db.kv[`client_wallet_${userEmail}`] = String(newBal)
            writeDb(db)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, balance: newBal, transaction: inserted }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
            return
          }
        })
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


    // Endpoint: /api/documents and /api/expert-documents (Supabase Storage & DB Workflow)
    if (url.startsWith('/api/documents') || url.startsWith('/api/expert-documents')) {
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

      const getSupabaseAdmin = async () => {
        const { createClient } = await import('@supabase/supabase-js')
        const sbUrl = process.env.VITE_SUPABASE_URL || 'https://oitxwcspkelduxbuczux.supabase.co'
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdHh3Y3Nwa2VsZHV4YnVjenV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjM5NjU2NCwiZXhwIjoyMTA3OTcyNTY0fQ.WGi0P4ENT5nhKPmp4zQN5VgmZ1twXLb4INXTSu1jxdw'
        return createClient(sbUrl, sbKey)
      }

      const parsedUrl = new URL(req.url || '', 'http://localhost:5173')

      // 1. GET /api/documents/signed-url or /api/expert-documents/signed-url
      if (req.method === 'GET' && (parsedUrl.pathname === '/api/documents/signed-url' || parsedUrl.pathname === '/api/expert-documents/signed-url')) {
        const filePath = parsedUrl.searchParams.get('filePath')
        if (!filePath) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'filePath is required' }))
          return
        }
        try {
          const sb = await getSupabaseAdmin()
          const { data, error } = await sb.storage.from('expert-documents').createSignedUrl(filePath, 3600)
          if (!error && data?.signedUrl) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, signedUrl: data.signedUrl }))
            return
          }
        } catch {}
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, signedUrl: `/uploaded_docs/${encodeURIComponent(path.basename(filePath))}` }))
        return
      }

      // 2. GET /api/expert-documents
      if (req.method === 'GET' && parsedUrl.pathname === '/api/expert-documents') {
        const expertId = parsedUrl.searchParams.get('expertId')
        if (!expertId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'expertId is required' }))
          return
        }

        let docsList: any[] = []
        try {
          const sb = await getSupabaseAdmin()
          const { data, error } = await sb
            .from('expert_documents')
            .select('*')
            .eq('expert_id', expertId)
          if (!error && Array.isArray(data) && data.length > 0) {
            docsList = data
          }
        } catch {}

        if (docsList.length === 0) {
          const db = readDb()
          const fromDb = db.expertDocuments?.[expertId]
          if (fromDb) {
            docsList = Object.values(fromDb)
          }
        }

        if (docsList.length === 0) {
          try {
            const sb = await getSupabaseAdmin()
            const { data: exp } = await sb.from('experts').select('documents').or(getExpertFilter(expertId)).maybeSingle()
            const items = exp?.documents?.items || {}
            const typeMap: Record<string, string> = {
              expCert: 'work_experience_cert',
              offerLetter: 'offer_relieving_letter',
              resume: 'executive_cv'
            }
            Object.entries(items).forEach(([legacyKey, item]: [string, any]) => {
              if (item && (item.filePath || item.fileName)) {
                const dt = typeMap[legacyKey] || legacyKey
                docsList.push({
                  id: item.id || `doc-${expertId}-${dt}`,
                  expert_id: expertId,
                  doc_type: dt,
                  file_path: item.filePath || `${expertId}/${dt}/${item.fileName}`,
                  file_name: item.fileName || `${dt}.pdf`,
                  file_size: typeof item.fileSize === 'number' ? item.fileSize : 500000,
                  mime_type: 'application/pdf',
                  status: (item.status || 'pending').toLowerCase() === 'verified' ? 'verified' : (item.status || 'pending').toLowerCase() === 'rejected' ? 'rejected' : 'pending',
                  admin_remark: item.adminRemark || item.rejectionReason || null,
                  uploaded_at: item.uploadedAt || new Date().toISOString(),
                  updated_at: item.updatedAt || new Date().toISOString()
                })
              }
            })
          } catch {}
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, documents: docsList }))
        return
      }

      // 3. POST /api/expert-documents/upload or /api/documents/upload
      if (req.method === 'POST' && (parsedUrl.pathname === '/api/expert-documents/upload' || parsedUrl.pathname === '/api/documents/upload')) {
        const chunks: Buffer[] = []
        req.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        req.on('end', async () => {
          try {
            const fullBuffer = Buffer.concat(chunks)
            const sb = await getSupabaseAdmin()

            let expertId = (req.headers['x-expert-id'] as string) || ''
            let docType = (req.headers['x-doc-type'] as string) || ''
            let fileName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name'] as string) : ''
            let oldFilePath = req.headers['x-old-file-path'] ? decodeURIComponent(req.headers['x-old-file-path'] as string) : ''
            let fileBuffer = fullBuffer

            const contentType = req.headers['content-type'] || ''
            if (contentType.includes('application/json')) {
              try {
                const jsonBody = JSON.parse(fullBuffer.toString('utf-8') || '{}')
                expertId = jsonBody.expertId || expertId
                docType = jsonBody.docType || jsonBody.documentType || docType
                fileName = jsonBody.fileName || fileName
                oldFilePath = jsonBody.oldFilePath || oldFilePath
                if (jsonBody.fileData) {
                  const base64Data = jsonBody.fileData.includes('base64,') ? jsonBody.fileData.split('base64,')[1] : jsonBody.fileData
                  fileBuffer = Buffer.from(base64Data, 'base64')
                }
              } catch {}
            }

            if (!expertId || !docType || fileBuffer.length === 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'expertId, docType, and valid PDF file data are required' }))
              return
            }

            const timestamp = Date.now()
            const sanitizedName = (fileName || `${docType}.pdf`)
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .replace(/\.pdf$/i, '')
            const cleanFileName = `${sanitizedName}.pdf`
            const storagePath = `${expertId}/${docType}/${timestamp}_${cleanFileName}`

            // Remove old file if replacing
            if (oldFilePath && oldFilePath !== storagePath) {
              try {
                await sb.storage.from('expert-documents').remove([oldFilePath])
              } catch (rmErr) {
                console.warn('[STORAGE] Note removing old file:', rmErr)
              }
            }

            // Upload to Supabase Storage private bucket: expert-documents
            console.log(`[STORAGE SERVICE] Uploading ${storagePath} (${fileBuffer.length} bytes)...`)
            const { error: uploadErr } = await sb.storage
              .from('expert-documents')
              .upload(storagePath, fileBuffer, {
                upsert: true,
                contentType: 'application/pdf'
              })

            if (uploadErr) {
              console.error('[STORAGE SERVICE] Supabase upload error:', uploadErr)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: uploadErr.message }))
              return
            }

            // Generate signed URL
            const { data: signedData } = await sb.storage
              .from('expert-documents')
              .createSignedUrl(storagePath, 3600)

            // Upsert into expert_documents table
            const docRecord: any = {
              id: crypto.randomUUID(),
              expert_id: expertId,
              doc_type: docType,
              file_path: storagePath,
              file_name: fileName || `${docType}.pdf`,
              file_size: fileBuffer.length,
              mime_type: 'application/pdf',
              status: 'pending',
              admin_remark: null,
              uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }

            try {
              const { data: dbData } = await sb
                .from('expert_documents')
                .upsert(docRecord, { onConflict: 'expert_id,doc_type' })
                .select()
                .single()
              if (dbData) Object.assign(docRecord, dbData)
            } catch (dbErr) {
              console.warn('[DB SERVICE] expert_documents upsert note:', dbErr)
            }

            // Update db.json
            let isReSubmission = false
            let newKycStatus = 'Pending Review'
            let newVerStatus = 'pending'

            try {
              const db = readDb()
              if (!db.expertDocuments) db.expertDocuments = {}
              if (!db.expertDocuments[expertId]) db.expertDocuments[expertId] = {}
              db.expertDocuments[expertId][docType] = docRecord

              const existingExp = (db.experts || []).find((e: any) => e.id === expertId || e.user_id === expertId)
              if (existingExp && (existingExp.status === 'Rejected' || existingExp.verificationStatus === 'rejected' || existingExp.rejected)) {
                isReSubmission = true
              }

              newKycStatus = isReSubmission ? 'Pending Review (Re-submitted)' : 'Pending Review'
              newVerStatus = isReSubmission ? 'pending_resubmitted' : 'pending'

              if (Array.isArray(db.experts)) {
                const exp = db.experts.find((e: any) => e.id === expertId || e.user_id === expertId)
                if (exp) {
                  if (!exp.documents) exp.documents = { items: {} }
                  if (!exp.documents.items) exp.documents.items = {}
                  const legacyKey = docType === 'work_experience_cert' ? 'expCert' : docType === 'offer_relieving_letter' ? 'offerLetter' : 'resume'
                  exp.documents.items[legacyKey] = {
                    id: docRecord.id,
                    type: legacyKey,
                    title: docRecord.file_name,
                    status: 'pending',
                    expertId,
                    fileName: docRecord.file_name,
                    fileSize: `${(fileBuffer.length / (1024 * 1024)).toFixed(1)} MB`,
                    filePath: storagePath,
                    uploadedAt: new Date().toISOString()
                  }
                  exp.documents[legacyKey] = docRecord.file_name
                  exp.documents[docType] = docRecord
                  exp.documents.items[docType] = docRecord
                  exp.documents.kyc_status = newKycStatus
                  exp.documents.status = newKycStatus
                  exp.documents.verificationStatus = newVerStatus
                  exp.documents.rejectionReason = null
                  exp.verified = false
                  exp.rejected = false
                  exp.status = newKycStatus
                  exp.verificationStatus = newVerStatus
                  exp.rejectionReason = null
                }
              }

              if (Array.isArray(db.pendingVerifications)) {
                db.pendingVerifications = db.pendingVerifications.map((p: any) => {
                  if (p.id === expertId || p.expertId === expertId) {
                    return {
                      ...p,
                      status: newKycStatus,
                      verificationStatus: newVerStatus,
                      rejectionReason: null
                    }
                  }
                  return p
                })
              }

              writeDb(db)
            } catch (jsonErr) {
              console.warn('[DB_JSON] note:', jsonErr)
            }

            // Update Supabase experts table JSON documents
            try {
              const { data: expRow } = await sb.from('experts').select('id, documents, verificationStatus, status').or(getExpertFilter(expertId)).maybeSingle()
              if (expRow) {
                const curDocs = expRow.documents || {}
                if (!curDocs.items) curDocs.items = {}
                const legacyKey = docType === 'work_experience_cert' ? 'expCert' : docType === 'offer_relieving_letter' ? 'offerLetter' : 'resume'
                curDocs.items[legacyKey] = {
                  id: docRecord.id,
                  type: legacyKey,
                  title: docRecord.file_name,
                  status: 'pending',
                  expertId,
                  fileName: docRecord.file_name,
                  fileSize: fileBuffer.length,
                  filePath: storagePath,
                  uploadedAt: new Date().toISOString()
                }
                curDocs[legacyKey] = docRecord.file_name
                curDocs[docType] = docRecord
                curDocs.items[docType] = docRecord
                curDocs.kyc_status = newKycStatus
                curDocs.status = newKycStatus
                curDocs.verificationStatus = newVerStatus
                curDocs.rejectionReason = null

                await sb.from('experts').update({
                  documents: curDocs,
                  verified: false,
                  updated_at: new Date().toISOString()
                }).eq('id', expRow.id)
              }
            } catch (expErr) {
              console.warn('[SUPABASE] experts update note:', expErr)
            }

            // Broadcast realtime event to Admin queue
            try {
              const ch = sb.channel('admin-kyc-desk')
              await ch.send({
                type: 'broadcast',
                event: 'document_uploaded',
                payload: {
                  expertId,
                  docType,
                  document: docRecord,
                  fileName: docRecord.file_name,
                  status: newKycStatus,
                  timestamp: new Date().toISOString()
                }
              })
            } catch {}

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              document: docRecord,
              status: newKycStatus,
              signedUrl: signedData?.signedUrl || null
            }))
          } catch (err: any) {
            console.error('[STORAGE SERVICE] Upload exception:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // 4. POST /api/expert-documents/delete
      if (req.method === 'POST' && parsedUrl.pathname === '/api/expert-documents/delete') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}')
            const { expertId, docType, filePath } = payload
            const sb = await getSupabaseAdmin()

            if (filePath) {
              await sb.storage.from('expert-documents').remove([filePath]).catch(() => {})
            }

            try {
              await sb.from('expert_documents').delete().match({ expert_id: expertId, doc_type: docType })
            } catch {}

            try {
              const db = readDb()
              if (db.expertDocuments?.[expertId]?.[docType]) {
                delete db.expertDocuments[expertId][docType]
              }
              if (Array.isArray(db.experts)) {
                db.experts = db.experts.map((e: any) => {
                  if (e.id === expertId || e.user_id === expertId) {
                    const curDocs = e.documents || {}
                    const curItems = curDocs.items || {}
                    delete curDocs[docType]
                    delete curItems[docType]
                    const legacyKey = docType === 'work_experience_cert' ? 'expCert' : docType === 'offer_relieving_letter' ? 'offerLetter' : 'resume'
                    delete curDocs[legacyKey]
                    delete curItems[legacyKey]
                    return {
                      ...e,
                      status: 'Registered / Documents Pending',
                      verificationStatus: 'pending_docs',
                      documents: {
                        ...curDocs,
                        kyc_status: 'Registered / Documents Pending',
                        status: 'Registered / Documents Pending',
                        verificationStatus: 'pending_docs',
                        items: curItems
                      }
                    }
                  }
                  return e
                })
              }
              writeDb(db)
            } catch {}

            try {
              const { data: expRow } = await sb.from('experts').select('id, documents').or(getExpertFilter(expertId)).maybeSingle()
              if (expRow) {
                const curDocs = expRow.documents || {}
                const curItems = curDocs.items || {}
                delete curDocs[docType]
                delete curItems[docType]
                const legacyKey = docType === 'work_experience_cert' ? 'expCert' : docType === 'offer_relieving_letter' ? 'offerLetter' : 'resume'
                delete curDocs[legacyKey]
                delete curItems[legacyKey]
                await sb.from('experts').update({
                  documents: {
                    ...curDocs,
                    kyc_status: 'Registered / Documents Pending',
                    status: 'Registered / Documents Pending',
                    verificationStatus: 'pending_docs',
                    items: curItems
                  },
                  updated_at: new Date().toISOString()
                }).eq('id', expRow.id)
              }
            } catch {}

            try {
              const ch = sb.channel('admin-kyc-desk')
              await ch.send({
                type: 'broadcast',
                event: 'document_deleted',
                payload: {
                  expertId,
                  docType,
                  status: 'Registered / Documents Pending',
                  timestamp: new Date().toISOString()
                }
              })
            } catch {}

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, message: 'Document deleted successfully' }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // 5. POST /api/expert-documents/update-status
      if (req.method === 'POST' && parsedUrl.pathname === '/api/expert-documents/update-status') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}')
            const { docId, expertId, docType, status, adminRemark } = payload
            const sb = await getSupabaseAdmin()

            let updatedDoc: any = null
            try {
              const { data } = await sb
                .from('expert_documents')
                .update({ status, admin_remark: adminRemark || null, updated_at: new Date().toISOString() })
                .eq('id', docId)
                .select()
                .single()
              if (data) updatedDoc = data
            } catch {}

            // Update db.json
            try {
              const db = readDb()
              if (expertId && docType && db.expertDocuments?.[expertId]?.[docType]) {
                db.expertDocuments[expertId][docType].status = status
                db.expertDocuments[expertId][docType].admin_remark = adminRemark || null
                db.expertDocuments[expertId][docType].updated_at = new Date().toISOString()
                updatedDoc = db.expertDocuments[expertId][docType]
                writeDb(db)
              }
            } catch {}

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, document: updatedDoc }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // 6. POST /api/expert-documents/sync-record
      if (req.method === 'POST' && parsedUrl.pathname === '/api/expert-documents/sync-record') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', async () => {
          try {
            const docRecord = JSON.parse(body || '{}')
            const sb = await getSupabaseAdmin()
            try {
              await sb.from('expert_documents').upsert(docRecord, { onConflict: 'expert_id,doc_type' })
            } catch {}

            try {
              const db = readDb()
              if (!db.expertDocuments) db.expertDocuments = {}
              if (!db.expertDocuments[docRecord.expert_id]) db.expertDocuments[docRecord.expert_id] = {}
              db.expertDocuments[docRecord.expert_id][docRecord.doc_type] = docRecord
              writeDb(db)
            } catch {}

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, document: docRecord }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

      // 7. Legacy GET file fallback
      if (req.method === 'GET') {
        const key = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('name') || parsedUrl.searchParams.get('id') || ''
        const raw = parsedUrl.searchParams.get('raw') === 'true'
        if (!key) {
          const files = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []
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

