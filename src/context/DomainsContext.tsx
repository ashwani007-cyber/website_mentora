import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { cached, invalidate } from '../lib/requestCache';
import type { DomainItem, DomainsContextType } from '../types/domain';

const DomainsContext = createContext<DomainsContextType | undefined>(undefined);

const BROADCAST_CHANNEL_NAME = 'mentora_domains_realtime';
const DOMAINS_EVENT_NAME = 'mentora_domains_updated';

// Fallback canonical domains if offline or pre-migration
const FALLBACK_DOMAINS: DomainItem[] = [
  { id: 'dom-1', name: 'Finance & Taxation', slug: 'finance-taxation', color: '#10B981', sort_order: 1, is_active: true },
  { id: 'dom-2', name: 'HR & Talent', slug: 'hr-talent', color: '#8B5CF6', sort_order: 2, is_active: true },
  { id: 'dom-3', name: 'Tech & Digital', slug: 'tech-digital', color: '#0EA5E9', sort_order: 3, is_active: true },
  { id: 'dom-4', name: 'Legal & Compliance', slug: 'legal-compliance', color: '#F59E0B', sort_order: 4, is_active: true },
  { id: 'dom-5', name: 'Marketing Strategy', slug: 'marketing-strategy', color: '#F43F5E', sort_order: 5, is_active: true },
  { id: 'dom-6', name: 'Operations & Logistics', slug: 'operations-logistics', color: '#14B8A6', sort_order: 6, is_active: true },
  { id: 'dom-7', name: 'School Mathematics', slug: 'school-mathematics', color: '#6366F1', sort_order: 7, is_active: true },
  { id: 'dom-8', name: 'Teaching & Academia', slug: 'teaching-academia', color: '#3B82F6', sort_order: 8, is_active: true },
];

export const DomainsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [domains, setDomains] = useState<DomainItem[]>(FALLBACK_DOMAINS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomainState] = useState<string>('All');

  // Multi-tab broadcast channel
  const broadcastChannel = useMemo(() => {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        return new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const setSelectedDomain = useCallback((name: string) => {
    setSelectedDomainState(name);
    try {
      sessionStorage.setItem('mentora_selected_domain', name);
    } catch {}
  }, []);

  // Fetch live expert counts per domain
  const fetchDomainCounts = useCallback(async (currentDomains: DomainItem[]): Promise<DomainItem[]> => {
    try {
      let experts: any[] | null = null;
      let { data, error: expErr } = await supabase
        .from('experts')
        .select('id, field, domain_id');

      experts = data as any;
      if (expErr && expErr.message?.includes('domain_id')) {
        const res = await supabase.from('experts').select('id, field');
        experts = res.data as any;
        expErr = null;
      }

      if (!expErr && Array.isArray(experts)) {
        const counts: Record<string, number> = {};
        experts.forEach((exp) => {
          currentDomains.forEach((dom) => {
            if (
              (exp.domain_id && exp.domain_id === dom.id) ||
              (exp.field && exp.field.trim().toLowerCase() === dom.name.trim().toLowerCase())
            ) {
              counts[dom.id] = (counts[dom.id] || 0) + 1;
            }
          });
        });

        return currentDomains.map((d) => ({
          ...d,
          expert_count: counts[d.id] || 0
        }));
      }
    } catch {
      // Fallback: try fetching from api/experts
      try {
        const res = await fetch('/api/experts');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const counts: Record<string, number> = {};
            list.forEach((exp: any) => {
              currentDomains.forEach((dom) => {
                if (
                  (exp.domain_id && exp.domain_id === dom.id) ||
                  (exp.field && exp.field.trim().toLowerCase() === dom.name.trim().toLowerCase())
                ) {
                  counts[dom.id] = (counts[dom.id] || 0) + 1;
                }
              });
            });
            return currentDomains.map((d) => ({
              ...d,
              expert_count: counts[d.id] || 0
            }));
          }
        }
      } catch {}
    }
    return currentDomains;
  }, []);

  // Primary loader for active domains.
  // EGRESS FIX: results are cached for 60 s (many components and the client dashboard call
  // this repeatedly). Pass `force = true` when we KNOW something changed (realtime event,
  // another tab broadcast, or after this tab saved a domain).
  const refreshDomains = useCallback(async (force: boolean = false) => {
    if (force) invalidate('domains:');
    try {
      const enriched = await cached('domains:enriched', 60_000, async () => {
      let loaded: DomainItem[] = [];

      // 1. Try direct Supabase query (only the columns the UI uses)
      try {
        const { data, error: sbErr } = await supabase
          .from('domains')
          .select('id, name, slug, color, sort_order, is_active, created_at')
          .order('sort_order', { ascending: true });

        if (!sbErr && Array.isArray(data) && data.length > 0) {
          loaded = data.filter((d) => d.is_active !== false);
        }
      } catch {}

      // 2. If direct query returned empty, try backend /api/domains
      if (loaded.length === 0) {
        try {
          const res = await fetch('/api/domains');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              loaded = data.filter((d: DomainItem) => d.is_active !== false);
            }
          }
        } catch {}
      }

      // 3. Fallback to default if everything else is empty
      if (loaded.length === 0) {
        loaded = FALLBACK_DOMAINS;
      }

      // 4. Attach live expert counts
      return fetchDomainCounts(loaded);
      });
      setDomains(enriched);
      setError(null);

      // Verify selectedDomain: if current selection was deleted, reset to 'All'
      setSelectedDomainState((prev) => {
        if (prev !== 'All' && !enriched.some((d) => d.name.toLowerCase() === prev.toLowerCase())) {
          return 'All';
        }
        return prev;
      });

      // Synchronize to localStorage for legacy compatibility
      try {
        localStorage.setItem('app_expertise_fields', JSON.stringify(enriched.map((d) => d.name)));
      } catch {}
    } catch (err: any) {
      console.error('[DOMAINS CONTEXT] Refresh error:', err);
      setError(err?.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, [fetchDomainCounts]);

  // Initial load
  useEffect(() => {
    refreshDomains();
  }, [refreshDomains]);

  // Multi-tab sync (no Supabase Realtime here).
  // CONNECTION-LIMIT FIX: this provider wraps the WHOLE app, so its Supabase Realtime channel made
  // EVERY visitor — including anonymous landing-page visitors and bots — hold an open realtime
  // connection (the Free Plan allows 200 at the same time). Domains change only when an admin
  // edits them, so instead:
  //  - tabs in the same browser are told instantly via BroadcastChannel below,
  //  - everyone else sees the change on their next page load / 60 s cached refresh.
  // (An older version also listened to the WHOLE experts table here; that was removed too.)
  useEffect(() => {
    // Listen on browser BroadcastChannel for 0ms cross-tab sync
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'DOMAINS_CHANGED') {
          refreshDomains(true);
        }
      };
    }

    // Window event listener
    const handleWindowEvent = () => refreshDomains(true);
    window.addEventListener(DOMAINS_EVENT_NAME, handleWindowEvent);

    return () => {
      window.removeEventListener(DOMAINS_EVENT_NAME, handleWindowEvent);
    };
  }, [broadcastChannel, refreshDomains]);

  // Notify other tabs & components of changes
  const notifyChange = useCallback(() => {
    refreshDomains(true); // we just saved — skip the cache so the change shows immediately
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'DOMAINS_CHANGED', timestamp: Date.now() });
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DOMAINS_EVENT_NAME));
    }
  }, [broadcastChannel, refreshDomains]);

  // Add Domain
  const addDomain = useCallback(
    async (name: string, color = '#F59E0B') => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: 'Expertise field / domain name cannot be empty' };
      }

      const exists = domains.some((d) => d.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return { success: false, error: `Domain "${trimmed}" already exists` };
      }

      try {
        // Try backend API first (uses admin privileges and updates both Supabase and db.json)
        const res = await fetch('/api/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, color })
        });

        if (res.ok) {
          const data = await res.json();
          notifyChange();
          return { success: true, message: `Domain "${trimmed}" added successfully`, domain: data.domain || data };
        }

        // Direct Supabase fallback
        const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data, error: sbErr } = await supabase
          .from('domains')
          .insert({
            name: trimmed,
            slug,
            color,
            sort_order: domains.length + 1,
            is_active: true
          })
          .select()
          .single();

        if (sbErr) throw sbErr;

        notifyChange();
        return { success: true, message: `Domain "${trimmed}" added successfully`, domain: data };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to add domain' };
      }
    },
    [domains, notifyChange]
  );

  // Rename Domain
  const renameDomain = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        return { success: false, error: 'Domain name cannot be empty' };
      }

      const duplicate = domains.some(
        (d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: `Another domain named "${trimmed}" already exists` };
      }

      const target = domains.find((d) => d.id === id);

      try {
        // Try backend API first
        const res = await fetch(`/api/domains/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });

        if (res.ok) {
          const data = await res.json();
          // If selectedDomain was the old name, update it
          if (target && selectedDomain.toLowerCase() === target.name.toLowerCase()) {
            setSelectedDomain(trimmed);
          }
          notifyChange();
          return { success: true, message: `Domain renamed to "${trimmed}"`, domain: data.domain || data };
        }

        // Direct Supabase fallback
        const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data, error: sbErr } = await supabase
          .from('domains')
          .update({ name: trimmed, slug })
          .eq('id', id)
          .select()
          .single();

        if (sbErr) throw sbErr;

        // Propagate name change to tagged experts in Supabase
        await supabase
          .from('experts')
          .update({ field: trimmed, updated_at: new Date().toISOString() })
          .eq('domain_id', id);

        if (target) {
          await supabase
            .from('experts')
            .update({ field: trimmed, updated_at: new Date().toISOString() })
            .ilike('field', target.name);
        }

        if (target && selectedDomain.toLowerCase() === target.name.toLowerCase()) {
          setSelectedDomain(trimmed);
        }

        notifyChange();
        return { success: true, message: `Domain renamed to "${trimmed}"`, domain: data };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to rename domain' };
      }
    },
    [domains, selectedDomain, setSelectedDomain, notifyChange]
  );

  // Delete Domain
  const deleteDomain = useCallback(
    async (id: string, reassignToDomainId?: string) => {
      const target = domains.find((d) => d.id === id);
      if (!target) {
        return { success: false, error: 'Domain not found' };
      }

      try {
        const res = await fetch(`/api/domains/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reassignDomainId: reassignToDomainId })
        });

        if (res.ok) {
          if (selectedDomain.toLowerCase() === target.name.toLowerCase()) {
            setSelectedDomain('All');
          }
          notifyChange();
          return { success: true, message: `Domain "${target.name}" deleted successfully` };
        }

        // Fallback: direct Supabase deletion if no experts tagged
        if (target.expert_count && target.expert_count > 0 && !reassignToDomainId) {
          return {
            success: false,
            error: `Cannot delete: ${target.expert_count} expert(s) are tagged. Please reassign them.`
          };
        }

        if (reassignToDomainId) {
          const dest = domains.find((d) => d.id === reassignToDomainId);
          if (dest) {
            await supabase
              .from('experts')
              .update({ domain_id: dest.id, field: dest.name, updated_at: new Date().toISOString() })
              .eq('domain_id', id);

            await supabase
              .from('experts')
              .update({ domain_id: dest.id, field: dest.name, updated_at: new Date().toISOString() })
              .ilike('field', target.name);
          }
        }

        const { error: delErr } = await supabase.from('domains').delete().eq('id', id);
        if (delErr) throw delErr;

        if (selectedDomain.toLowerCase() === target.name.toLowerCase()) {
          setSelectedDomain('All');
        }

        notifyChange();
        return { success: true, message: `Domain "${target.name}" deleted successfully` };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to delete domain' };
      }
    },
    [domains, selectedDomain, setSelectedDomain, notifyChange]
  );

  // Reset Defaults
  const resetDefaults = useCallback(async () => {
    try {
      const res = await fetch('/api/domains/reset', { method: 'POST' });
      if (res.ok) {
        notifyChange();
        return { success: true, message: 'Restored default 8 canonical domains' };
      }

      // Direct fallback
      for (const def of FALLBACK_DOMAINS) {
        await supabase
          .from('domains')
          .upsert({
            name: def.name,
            slug: def.slug,
            color: def.color,
            sort_order: def.sort_order,
            is_active: true
          }, { onConflict: 'name' });
      }

      notifyChange();
      return { success: true, message: 'Restored default 8 canonical domains' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset domains' };
    }
  }, [notifyChange]);

  const getDomainById = useCallback(
    (id: string) => domains.find((d) => d.id === id),
    [domains]
  );

  const getDomainName = useCallback(
    (expertOrId?: any): string => {
      if (!expertOrId) return 'General Advisory';
      if (typeof expertOrId === 'string') {
        const foundById = domains.find((d) => d.id === expertOrId);
        if (foundById) return foundById.name;
        const foundByName = domains.find(
          (d) =>
            d.name.toLowerCase() === expertOrId.toLowerCase() ||
            d.slug.toLowerCase() === expertOrId.toLowerCase()
        );
        if (foundByName) return foundByName.name;
        return expertOrId;
      }
      if (expertOrId.domain_id) {
        const found = domains.find((d) => d.id === expertOrId.domain_id);
        if (found) return found.name;
      }
      if (expertOrId.field) {
        const found = domains.find(
          (d) =>
            d.name.toLowerCase() === expertOrId.field.toLowerCase() ||
            d.slug.toLowerCase() === expertOrId.field.toLowerCase()
        );
        if (found) return found.name;
        return expertOrId.field;
      }
      if (expertOrId.domain) {
        const found = domains.find(
          (d) =>
            d.name.toLowerCase() === expertOrId.domain.toLowerCase() ||
            d.slug.toLowerCase() === expertOrId.domain.toLowerCase()
        );
        if (found) return found.name;
        return expertOrId.domain;
      }
      return 'General Advisory';
    },
    [domains]
  );

  const value = useMemo<DomainsContextType>(
    () => ({
      domains,
      loading,
      error,
      selectedDomain,
      setSelectedDomain,
      addDomain,
      renameDomain,
      deleteDomain,
      resetDefaults,
      getDomainById,
      getDomainName,
      refreshDomains
    }),
    [
      domains,
      loading,
      error,
      selectedDomain,
      setSelectedDomain,
      addDomain,
      renameDomain,
      deleteDomain,
      resetDefaults,
      getDomainById,
      getDomainName,
      refreshDomains
    ]
  );

  return <DomainsContext.Provider value={value}>{children}</DomainsContext.Provider>;
};

export const useDomains = (): DomainsContextType => {
  const context = useContext(DomainsContext);
  if (!context) {
    throw new Error('useDomains must be used within a DomainsProvider');
  }
  return context;
};
