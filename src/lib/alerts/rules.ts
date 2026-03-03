import type { AlertRuleResult } from '@/types';

interface CarrierSubstitutionInput {
  loadId: string;
  previousCarrierId: string | null;
  currentCarrierId: string | null;
  loadStatus: string;
}

/** Rule 1: Carrier on load changed after acceptance. */
export function checkCarrierSubstitution(input: CarrierSubstitutionInput): AlertRuleResult {
  const acceptedStatuses = ['accepted', 'in_transit'];
  const triggered =
    acceptedStatuses.includes(input.loadStatus) &&
    input.previousCarrierId !== null &&
    input.currentCarrierId !== null &&
    input.previousCarrierId !== input.currentCarrierId;

  return {
    triggered,
    alertType: 'carrier_substitution',
    severity: 'critical',
    title: 'Carrier Substitution Detected',
    message: 'Carrier was changed on load ' + input.loadId + ' after it was already ' + input.loadStatus + '. Previous carrier: ' + input.previousCarrierId + ', New carrier: ' + input.currentCarrierId,
    metadata: {
      loadId: input.loadId,
      previousCarrierId: input.previousCarrierId,
      currentCarrierId: input.currentCarrierId,
      loadStatus: input.loadStatus,
    },
  };
}

interface DomainMismatchInput {
  carrierEmail: string | null;
  fmcsaEmail: string | null;
  carrierId: string;
}

/** Rule 2: Carrier email domain does not match FMCSA record. */
export function checkDomainMismatch(input: DomainMismatchInput): AlertRuleResult {
  let triggered = false;

  if (input.carrierEmail && input.fmcsaEmail) {
    const carrierDomain = input.carrierEmail.split('@')[1]?.toLowerCase();
    const fmcsaDomain = input.fmcsaEmail.split('@')[1]?.toLowerCase();
    triggered = carrierDomain !== fmcsaDomain;
  }

  return {
    triggered,
    alertType: 'domain_mismatch',
    severity: 'high',
    title: 'Email Domain Mismatch',
    message: 'Carrier ' + input.carrierId + ' email domain does not match FMCSA records. Carrier: ' + input.carrierEmail + ', FMCSA: ' + input.fmcsaEmail,
    metadata: {
      carrierId: input.carrierId,
      carrierEmail: input.carrierEmail,
      fmcsaEmail: input.fmcsaEmail,
    },
  };
}

interface OffLocationInput {
  verificationLat: number;
  verificationLng: number;
  originLat: number;
  originLng: number;
  loadId: string;
  maxMiles?: number;
}

/** Rule 3: GPS location is more than 5 miles from load origin. */
export function checkOffLocationPickup(input: OffLocationInput): AlertRuleResult {
  const maxMiles = input.maxMiles ?? 5;
  const R = 3958.8;
  const dLat = ((input.originLat - input.verificationLat) * Math.PI) / 180;
  const dLng = ((input.originLng - input.verificationLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((input.verificationLat * Math.PI) / 180) *
      Math.cos((input.originLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return {
    triggered: distance > maxMiles,
    alertType: 'off_location_pickup',
    severity: 'high',
    title: 'Off-Location Pickup Detected',
    message: 'Pickup verification for load ' + input.loadId + ' is ' + distance.toFixed(1) + ' miles from the expected origin (max ' + maxMiles + ' miles)',
    metadata: {
      loadId: input.loadId,
      distance: Math.round(distance * 10) / 10,
      maxMiles,
      verificationLat: input.verificationLat,
      verificationLng: input.verificationLng,
      originLat: input.originLat,
      originLng: input.originLng,
    },
  };
}

interface FailedVerificationInput {
  loadId: string;
  attempts: number;
  maxAttempts?: number;
}

/** Rule 4: OTP verification failed 3 or more times. */
export function checkFailedVerification(input: FailedVerificationInput): AlertRuleResult {
  const maxAttempts = input.maxAttempts ?? 3;

  return {
    triggered: input.attempts >= maxAttempts,
    alertType: 'failed_verification',
    severity: 'critical',
    title: 'Multiple Failed Verification Attempts',
    message: 'Load ' + input.loadId + ' has ' + input.attempts + ' failed OTP verification attempts (threshold: ' + maxAttempts + ')',
    metadata: {
      loadId: input.loadId,
      attempts: input.attempts,
      maxAttempts,
    },
  };
}

interface DocumentExpirationInput {
  carrierId: string;
  documentId: string;
  documentType: string;
  expiresAt: Date;
  warningDays?: number;
}

/** Rule 5: Documents expire within 30 days. */
export function checkDocumentExpiration(input: DocumentExpirationInput): AlertRuleResult {
  const warningDays = input.warningDays ?? 30;
  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (input.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const triggered = daysUntilExpiry <= warningDays && daysUntilExpiry >= 0;
  const severity: 'low' | 'medium' | 'high' | 'critical' = daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium';

  return {
    triggered,
    alertType: 'document_expiration',
    severity,
    title: 'Document Expiring Soon',
    message: input.documentType + ' for carrier ' + input.carrierId + ' expires in ' + daysUntilExpiry + ' days',
    metadata: {
      carrierId: input.carrierId,
      documentId: input.documentId,
      documentType: input.documentType,
      expiresAt: input.expiresAt.toISOString(),
      daysUntilExpiry,
    },
  };
}

interface FmcsaStatusChangeInput {
  carrierId: string;
  dotNumber: string;
  previousStatus: string;
  currentStatus: string;
}

/** Rule 6: FMCSA status changed on re-check. */
export function checkFmcsaStatusChange(input: FmcsaStatusChangeInput): AlertRuleResult {
  const triggered =
    input.previousStatus !== input.currentStatus &&
    input.previousStatus !== '' &&
    input.currentStatus !== '';

  const isDowngrade =
    input.currentStatus === 'NOT_AUTHORIZED' ||
    input.currentStatus === 'OUT_OF_SERVICE';

  return {
    triggered,
    alertType: 'fmcsa_status_change',
    severity: isDowngrade ? 'critical' : 'high',
    title: 'FMCSA Status Changed',
    message: 'Carrier ' + input.carrierId + ' (DOT# ' + input.dotNumber + ') FMCSA status changed from "' + input.previousStatus + '" to "' + input.currentStatus + '"',
    metadata: {
      carrierId: input.carrierId,
      dotNumber: input.dotNumber,
      previousStatus: input.previousStatus,
      currentStatus: input.currentStatus,
    },
  };
}
