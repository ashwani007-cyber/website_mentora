export interface DomainItem {
  id: string;
  name: string;
  slug: string;
  color?: string;
  sort_order?: number;
  is_active: boolean;
  created_at?: string;
  expert_count?: number;
}

export interface DomainsContextType {
  domains: DomainItem[];
  loading: boolean;
  error: string | null;
  selectedDomain: string;
  setSelectedDomain: (name: string) => void;
  addDomain: (name: string, color?: string) => Promise<{ success: boolean; message?: string; error?: string; domain?: DomainItem }>;
  renameDomain: (id: string, newName: string) => Promise<{ success: boolean; message?: string; error?: string; domain?: DomainItem }>;
  deleteDomain: (id: string, reassignToDomainId?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetDefaults: () => Promise<{ success: boolean; message?: string; error?: string }>;
  getDomainById: (id: string) => DomainItem | undefined;
  getDomainName: (expertOrId?: any) => string;
  refreshDomains: () => Promise<void>;
}
