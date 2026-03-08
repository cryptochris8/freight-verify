import { auth, currentUser } from '@clerk/nextjs/server';
import { cache } from 'react';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

/**
 * Resolves Clerk's orgId string to the internal UUID.
 * Uses React cache() for per-request deduplication.
 */
export const resolveOrgId = cache(async () => {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!clerkOrgId) throw new Error('No organization selected');

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org) throw new Error('Organization not found');

  return { userId, clerkOrgId, orgId: org.id };
});
