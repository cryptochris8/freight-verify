import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Gets the current authenticated user ID and org ID.
 * Throws if not authenticated.
 */
export async function getAuthContext() {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized: No user found');
  }

  return { userId, orgId: orgId ?? null };
}

/**
 * Gets the full current user profile from Clerk.
 */
export async function getCurrentUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error('Unauthorized: No user found');
  }
  return user;
}

/**
 * Requires that the user belongs to an organization.
 * Throws if no org is selected.
 */
export async function requireOrg() {
  const { userId, orgId } = await getAuthContext();

  if (!orgId) {
    throw new Error('No organization selected');
  }

  return { userId, orgId };
}
