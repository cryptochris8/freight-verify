import { auth, currentUser } from '@clerk/nextjs/server';
import { cache } from 'react';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class ForbiddenError extends Error {
  constructor(message = 'Admin access required') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

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

/**
 * Checks if the current user has the admin role in their org.
 * Returns the org context if admin, throws ForbiddenError otherwise.
 */
export async function requireAdmin() {
  const { userId, orgId: clerkOrgId, orgRole } = await auth();
  if (!userId || !clerkOrgId) throw new Error('Unauthorized');

  if (orgRole !== 'org:admin') {
    throw new ForbiddenError();
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org) throw new Error('Organization not found');

  return { userId, clerkOrgId, orgId: org.id };
}

// ── API Route Auth Wrapper ────────────────────────────────────────

export interface AuthContext {
  userId: string;
  orgId: string;
  org: typeof organizations.$inferSelect;
}

/**
 * Wraps an API route handler with Clerk auth + org resolution.
 * Eliminates the repeated boilerplate of checking auth, looking up
 * the org, and returning 401/404 in every route handler.
 *
 * Usage:
 *   export const GET = withAuth(async (request, context) => {
 *     const { userId, orgId, org } = context;
 *     // ... handler logic
 *   });
 */
export function withAuth(
  handler: (request: Request, context: AuthContext) => Promise<NextResponse>
) {
  return async (request: Request) => {
    try {
      const { userId, orgId: clerkOrgId } = await auth();
      if (!userId || !clerkOrgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId))
        .limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      return await handler(request, { userId, orgId: org.id, org });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
  };
}

/**
 * Like withAuth but also requires the admin role.
 */
export function withAdminAuth(
  handler: (request: Request, context: AuthContext) => Promise<NextResponse>
) {
  return async (request: Request) => {
    try {
      const { userId, orgId: clerkOrgId, orgRole } = await auth();
      if (!userId || !clerkOrgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (orgRole !== 'org:admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId))
        .limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      return await handler(request, { userId, orgId: org.id, org });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
  };
}
