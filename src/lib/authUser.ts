/** Require a logged-in Supabase user id for tenant-owned rows. */
export function requireAuthUserId(user: { id: string } | null | undefined): string {
  if (!user?.id) {
    throw new Error('You must be signed in to save this record.');
  }
  return user.id;
}
