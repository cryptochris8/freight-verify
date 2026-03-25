/**
 * Maps a load status string to a Badge variant.
 * Shared across dashboard, loads list, and load detail pages.
 */
export function getLoadStatusVariant(status: string) {
  switch (status) {
    case "completed": case "delivered": return "default" as const;
    case "in_transit": case "accepted": return "secondary" as const;
    case "draft": case "tendered": return "outline" as const;
    case "cancelled": return "destructive" as const;
    default: return "secondary" as const;
  }
}

/**
 * Maps a carrier status string to a Badge variant.
 * Shared across carriers list and carrier detail pages.
 */
export function getCarrierStatusVariant(status: string | null) {
  switch (status) {
    case "verified": return "default" as const;
    case "pending": return "secondary" as const;
    case "flagged": case "suspended": return "destructive" as const;
    case "expired": return "outline" as const;
    default: return "secondary" as const;
  }
}
