export function getDb(): Promise<any>;
export function handleApiMiddleware(req: any, res: any, next?: any): Promise<void>;
export const ADMIN_EMAILS: string[];
export function isAdminEmail(email?: string | null): boolean;
