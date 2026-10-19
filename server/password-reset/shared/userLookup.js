import { getDb, isAdminEmail, ADMIN_EMAILS } from '../../mongoHandler.js';

/**
 * Look up an existing user by email across all account types.
 * Returns { found: boolean, user?: object, accountType?: string, collection?: string }
 */
export async function findUserByEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  const db = await getDb();
  
  // 1. Check if this is the admin email
  if (isAdminEmail(cleanEmail)) {
    const adminCol = db.collection('admin_credentials');
    const adminRecord = await adminCol.findOne({
      $or: [
        { email: { $in: ADMIN_EMAILS } },
        { email: cleanEmail }
      ]
    });
    if (adminRecord) {
      return { found: true, user: adminRecord, accountType: 'admin', collection: 'admin_credentials' };
    }
    // Even if no admin_credentials record yet, admin email is recognized
    return { found: true, user: { email: cleanEmail, role: 'admin' }, accountType: 'admin', collection: 'admin_credentials' };
  }
  
  // 2. Check users collection (clients and experts)
  const usersCol = db.collection('users');
  const user = await usersCol.findOne({ email: cleanEmail });
  if (user) {
    const accountType = user.role === 'expert' ? 'expert' : user.role === 'admin' ? 'admin' : 'client';
    const collection = user.role === 'admin' ? 'admin_credentials' : 'users';
    return { found: true, user, accountType, collection };
  }
  
  return { found: false };
}

/**
 * Update the password for an existing user.
 * Uses the correct collection based on account type.
 */
export async function updateUserPassword(email, hashedPassword, accountType) {
  const cleanEmail = email.trim().toLowerCase();
  const db = await getDb();
  const nowIso = new Date().toISOString();
  
  if (accountType === 'admin' || isAdminEmail(cleanEmail)) {
    // Update admin_credentials
    const adminCol = db.collection('admin_credentials');
    await adminCol.updateOne(
      {
        $or: [
          { email: { $in: ADMIN_EMAILS } },
          { email: cleanEmail }
        ]
      },
      {
        $set: {
          email: cleanEmail,
          password: hashedPassword,
          role: 'admin',
          initialized: true,
          adminPasswordInitialized: true,
          isPasswordInitialized: true,
          currentToken: null, // Invalidate existing sessions
          passwordChangedAt: nowIso,
          updatedAt: nowIso
        }
      },
      { upsert: true }
    );
    
    // Also sync to users collection if the admin has a record there
    await db.collection('users').updateOne(
      {
        $or: [
          { email: { $in: ADMIN_EMAILS } },
          { email: cleanEmail }
        ]
      },
      {
        $set: {
          password: hashedPassword,
          role: 'admin',
          initialized: true,
          adminPasswordInitialized: true,
          isPasswordInitialized: true,
          updatedAt: nowIso
        }
      }
    );
  } else {
    // Update users collection (client or expert)
    await db.collection('users').updateOne(
      { email: cleanEmail },
      { $set: { password: hashedPassword, updatedAt: nowIso } }
    );
  }
  
  console.log(\`[PasswordReset] Password updated for: \${cleanEmail} (\${accountType})\`);
}
