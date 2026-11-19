import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Same list as COLUMNS.EXPERT_WITH_DOCUMENTS in server/egressHelpers.js (kept here because this
// helper runs outside the request handlers).
const EXPERT_WITH_DOCUMENTS_COLUMNS =
  'id, user_id, name, field, domain_id, years_of_experience, base_rate, admin_markup, rate, project_rate, rating, total_sessions, verified, initials, title, phone, email, bio, skills, documents, created_at, updated_at'

async function findSupabaseExpert(sbClient: any, expertId?: string | null, email?: string | null): Promise<any> {
  const cleanEmail = (email || '').toLowerCase().trim()
  const filter = getExpertFilter(expertId, cleanEmail)
  if (!filter) return null
  // Single-expert lookup used before updates — needs documents to merge changes safely.
  const { data, error } = await sbClient.from('experts').select(EXPERT_WITH_DOCUMENTS_COLUMNS).or(filter).limit(5)
  if (error) {
    throw error
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

// One shared server-side Supabase client for every dev API route (see server/supabaseClient.js).
// Keys come from .env — never hard-code the service_role key in source code.
// Shared egress-safe helpers (slim reads, wallet RPCs, avatar upload) — same code as server.js.
const getEgressHelpers = async (): Promise<any> =>
  await import(pathToFileURL(path.resolve(__dirname, "server/egressHelpers.js")).href)

const getSharedSupabase = async (): Promise<any> =>
  (await import(pathToFileURL(path.resolve(__dirname, "server/supabaseClient.js")).href)).supabase

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

    if (url.split('?')[0].startsWith('/uploaded_docs/')) {
      res.statusCode = 404
      res.end()
      return
    }

    // After any write request finishes, clear the short server-side read cache so the next
    // read returns the freshly saved data.
    if (url.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
      res.on('finish', () => { getEgressHelpers().then((h: any) => h.clearMemo()).catch(() => {}) })
    }

    if (['/api/health', '/api/experts/markup'].includes(url.split('?')[0])) {
      const { handleWorkflowDiagnostics } = await import(pathToFileURL(path.resolve(__dirname, 'server/workflowDiagnostics.js')).href)
      return handleWorkflowDiagnostics(req, res, next)
    }

    // Endpoint: /api/uploads/avatar — compressed profile photo → public "avatars" bucket.
    // Only the returned URL is stored in the database (never the image itself).
    if (url.startsWith('/api/uploads/avatar') && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => { body += chunk })
      req.on('end', async () => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const { ownerId, fileData, contentType } = JSON.parse(body || '{}')
          const publicUrl = await (await getEgressHelpers()).uploadAvatarFromDataUrl({ ownerId, fileData, contentType })
          res.end(JSON.stringify({ success: true, url: publicUrl }))
        } catch (err: any) {
          res.statusCode = err.status || 500
          res.end(JSON.stringify({ success: false, error: err.message || 'Upload failed' }))
        }
      })
      return
    }

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
      const { isAuthorizedAdmin } = await import(pathToFileURL(path.resolve(__dirname, 'server/session.js')).href)
      const isAuthAdmin = await isAuthorizedAdmin(req)

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
        // EGRESS FIX: only unverified experts, without base64 file data, cached 10 s.
        const supaAll = await (await getEgressHelpers()).fetchUnverifiedExpertsSlim()
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
          const { isAuthorizedAdmin } = await import(pathToFileURL(path.resolve(__dirname, 'server/session.js')).href)
          const isAuthAdmin = await isAuthorizedAdmin(req)

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
          const { isAuthorizedAdmin } = await import(pathToFileURL(path.resolve(__dirname, 'server/session.js')).href)
          const isAuthAdmin = await isAuthorizedAdmin(req)

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
          const { isAuthorizedAdmin } = await import(pathToFileURL(path.resolve(__dirname, 'server/session.js')).href)
          const isAuthAdmin = await isAuthorizedAdmin(req)

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

    // Endpoint: /api/experts/list — same as production (server.js): slim expert list, cached 60 s
    // on the server, with a CDN cache header. ?fresh=… right after a save skips the cache.
    if (url.startsWith('/api/experts/list') && req.method === 'GET') {
      try {
        const fresh = new URL(url, 'http://localhost').searchParams.has('fresh')
        const h = await getEgressHelpers()
        const experts = await h.fetchExpertsListCached({ force: fresh })
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', fresh ? 'no-store' : h.EXPERTS_LIST_CACHE_HEADER)
        res.end(JSON.stringify(experts || []))
      } catch (err: any) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: err.message }))
      }
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
      const { handleAvailability } = await import(pathToFileURL(path.resolve(__dirname, 'server/availabilityHandler.js')).href)
      return handleAvailability(req, res, next)
    }

    if (url.startsWith('/api/bookings')) {
      const { handleConsultation } = await import(pathToFileURL(path.resolve(__dirname, 'server/consultationHandler.js')).href)
      return handleConsultation(req, res, next)
    }

    if (url.startsWith('/api/wallet')) {
      const { handleWallet } = await import(pathToFileURL(path.resolve(__dirname, 'server/walletHandler.js')).href)
      return handleWallet(req, res, next)
    }

    if (url.startsWith('/api/reviews')) {
      const { handleConsultationReview } = await import(pathToFileURL(path.resolve(__dirname, 'server/consultationReviewHandler.js')).href)
      return handleConsultationReview(req, res, next)
    }

    if (url.startsWith('/api/project-reviews') || url.startsWith('/api/platform-settings')) {
      const { handleProjectReview } = await import(pathToFileURL(path.resolve(__dirname, 'server/projectReviewHandler.js')).href)
      return handleProjectReview(req, res, next)
    }

    // Endpoint: /api/documents and /api/expert-documents (Supabase Storage & DB Workflow)
    if (url.startsWith('/api/documents') || url.startsWith('/api/expert-documents')) {
      const getSupabaseAdmin = async () => {
        // Re-use the ONE shared server client (no per-request clients, no hard-coded keys)
        return getSharedSupabase()
      }

      const parsedUrl = new URL(req.url || '', 'http://localhost:5173')

      const { authorizeCredentialAccess, handleCredentialRead } = await import(pathToFileURL(path.resolve(__dirname, 'server/documentAccess.js')).href)
      if (req.method === 'GET' && ['/api/documents', '/api/documents/signed-url', '/api/expert-documents/signed-url'].includes(parsedUrl.pathname)) {
        return handleCredentialRead(req, res, next)
      }

      // 2. GET /api/expert-documents
      if (req.method === 'GET' && parsedUrl.pathname === '/api/expert-documents') {
        let expertId = parsedUrl.searchParams.get('expertId') || ''
        if (!expertId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'expertId is required' }))
          return
        }

        try {
          expertId = (await authorizeCredentialAccess(req, expertId)).id
        } catch (error: any) {
          res.statusCode = error.status || 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: error.message }))
          return
        }

        let docsList: any[] = []
        try {
          const sb = await getSupabaseAdmin()
          const { data, error } = await sb
            .from('expert_documents')
            .select((await getEgressHelpers()).COLUMNS.EXPERT_DOCUMENT)
            .eq('expert_id', expertId)
            .limit(20)
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
            let fileBuffer = fullBuffer

            const contentType = req.headers['content-type'] || ''
            if (contentType.includes('application/json')) {
              try {
                const jsonBody = JSON.parse(fullBuffer.toString('utf-8') || '{}')
                expertId = jsonBody.expertId || expertId
                docType = jsonBody.docType || jsonBody.documentType || docType
                fileName = jsonBody.fileName || fileName
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

            expertId = (await authorizeCredentialAccess(req, expertId)).id
            if (!['work_experience_cert', 'offer_relieving_letter', 'executive_cv'].includes(docType) ||
              fileBuffer.subarray(0, 5).toString() !== '%PDF-' || fileBuffer.length > 10 * 1024 * 1024) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Select a credential slot and a valid PDF of 10 MB or less' }))
              return
            }
            const timestamp = crypto.randomUUID()
            const sanitizedName = (fileName || `${docType}.pdf`)
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .replace(/\.pdf$/i, '')
            const cleanFileName = `${sanitizedName}.pdf`
            const storagePath = `${expertId}/${docType}/${timestamp}_${cleanFileName}`

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

            const { data: dbData, error: dbError } = await sb.from('expert_documents')
              .upsert(docRecord, { onConflict: 'expert_id,doc_type' }).select().single()
            if (dbError) {
              if (/^[0-9]{2}[0-9A-Z]{3}$/.test(dbError.code || '')) await sb.storage.from('expert-documents').remove([storagePath])
              throw dbError
            }
            Object.assign(docRecord, dbData)

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
            res.statusCode = err.status || 500
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
            const { docType } = payload
            const expertId = (await authorizeCredentialAccess(req, payload.expertId)).id
            const sb = await getSupabaseAdmin()
            const { data: document, error: readError } = await sb.from('expert_documents').select('file_path')
              .eq('expert_id', expertId).eq('doc_type', docType).maybeSingle()
            if (readError) throw readError
            const filePath = document?.file_path

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
            res.statusCode = err.status || 500
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
            const { isAuthorizedAdmin } = await import(pathToFileURL(path.resolve(__dirname, 'server/session.js')).href)
            if (!await isAuthorizedAdmin(req)) throw Object.assign(new Error('Administrator access required'), { status: 403 })
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
            res.statusCode = err.status || 500
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
            const { expert_id, doc_type, file_path, file_name, file_size } = JSON.parse(body || '{}')
            const expert = await authorizeCredentialAccess(req, expert_id)
            if (!['work_experience_cert', 'offer_relieving_letter', 'executive_cv'].includes(doc_type) ||
              typeof file_path !== 'string' || !file_path.startsWith(`${expert.id}/${doc_type}/`)) {
              throw Object.assign(new Error('Document reference does not match the credential slot'), { status: 400 })
            }
            const sb = await getSupabaseAdmin()
            const docRecord = { expert_id: expert.id, doc_type, file_path, file_name, file_size, status: 'pending', admin_remark: null }
            const { error: writeError } = await sb.from('expert_documents').upsert(docRecord, { onConflict: 'expert_id,doc_type' })
            if (writeError) throw writeError

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
            res.statusCode = err.status || 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
        })
        return
      }

    }

    // Endpoint: /api/notifications (Full CRUD & Multi-Channel Broadcast Persistence)
    if (url.startsWith('/api/notifications')) {
      const { handleNotifications } = await import(pathToFileURL(path.resolve(__dirname, 'server/notificationHandler.js')).href)
      return handleNotifications(req, res, next)
    }

    if (url.startsWith('/api/blogs') || url.startsWith('/api/admin/blogs')) {
      const { handleBlogs } = await import(pathToFileURL(path.resolve(__dirname, 'server/blogHandler.js')).href)
      return handleBlogs(req, res, next)
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

function publicAssets(): Plugin {
  let publicDir: string | false
  let outDir: string
  return {
    name: 'copy-public-assets',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      if (!publicDir || !fs.existsSync(publicDir)) return
      for (const file of fs.readdirSync(publicDir)) {
        if (file === 'uploaded_docs') continue
        fs.cpSync(path.join(publicDir, file), path.join(outDir, file), { recursive: true })
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sharedDbPlugin(), publicAssets()],
  build: { copyPublicDir: false },
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/db.json*', '**/server_docs/**', '**/uploaded_docs/**'] },
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

