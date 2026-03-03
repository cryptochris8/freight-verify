const RECOMMENDATIONS: Record<string, string> = {
  carrier_substitution:
    "Contact the carrier to verify why a different carrier is being used. Check if the substitute carrier is also verified in your system.",
  domain_mismatch:
    "The carrier's email domain does not match their FMCSA-registered information. Verify the contact is legitimate before proceeding.",
  off_location_pickup:
    "The pickup verification occurred more than 5 miles from the expected location. Verify with the driver and dock staff that this is the correct pickup.",
  failed_verification:
    "The pickup OTP failed 3 times. This may indicate an unauthorized person attempting to pick up the load. Contact the carrier and shipper immediately.",
  document_expiration:
    "The carrier's insurance or operating authority document is expiring soon. Request updated documentation before assigning new loads.",
  fmcsa_status_change:
    "The carrier's FMCSA status has changed. Review the new status and determine if the carrier should remain active in your system.",
};

export function getRecommendation(alertType: string): string {
  return (
    RECOMMENDATIONS[alertType] ??
    "Review the alert details and take appropriate action."
  );
}
