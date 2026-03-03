import type { AlertRuleResult } from '@/types';
import {
  checkCarrierSubstitution,
  checkDomainMismatch,
  checkOffLocationPickup,
  checkFailedVerification,
  checkDocumentExpiration,
  checkFmcsaStatusChange,
} from './rules';

export interface AlertEngineContext {
  loadId?: string;
  previousCarrierId?: string | null;
  currentCarrierId?: string | null;
  loadStatus?: string;
  carrierEmail?: string | null;
  fmcsaEmail?: string | null;
  carrierId?: string;
  verificationLat?: number;
  verificationLng?: number;
  originLat?: number;
  originLng?: number;
  otpAttempts?: number;
  documentId?: string;
  documentType?: string;
  expiresAt?: Date;
  dotNumber?: string;
  previousFmcsaStatus?: string;
  currentFmcsaStatus?: string;
}

/**
 * Runs all applicable alert rules against the provided context
 * and returns any triggered alerts.
 */
export function runAlertRules(context: AlertEngineContext): AlertRuleResult[] {
  const results: AlertRuleResult[] = [];

  // Rule 1: Carrier substitution
  if (context.loadId && context.loadStatus && context.previousCarrierId !== undefined && context.currentCarrierId !== undefined) {
    const result = checkCarrierSubstitution({
      loadId: context.loadId,
      previousCarrierId: context.previousCarrierId ?? null,
      currentCarrierId: context.currentCarrierId ?? null,
      loadStatus: context.loadStatus,
    });
    if (result.triggered) results.push(result);
  }

  // Rule 2: Domain mismatch
  if (context.carrierId && context.carrierEmail !== undefined && context.fmcsaEmail !== undefined) {
    const result = checkDomainMismatch({
      carrierEmail: context.carrierEmail ?? null,
      fmcsaEmail: context.fmcsaEmail ?? null,
      carrierId: context.carrierId,
    });
    if (result.triggered) results.push(result);
  }

  // Rule 3: Off-location pickup
  if (
    context.loadId &&
    context.verificationLat !== undefined &&
    context.verificationLng !== undefined &&
    context.originLat !== undefined &&
    context.originLng !== undefined
  ) {
    const result = checkOffLocationPickup({
      verificationLat: context.verificationLat,
      verificationLng: context.verificationLng,
      originLat: context.originLat,
      originLng: context.originLng,
      loadId: context.loadId,
    });
    if (result.triggered) results.push(result);
  }

  // Rule 4: Failed verification
  if (context.loadId && context.otpAttempts !== undefined) {
    const result = checkFailedVerification({
      loadId: context.loadId,
      attempts: context.otpAttempts,
    });
    if (result.triggered) results.push(result);
  }

  // Rule 5: Document expiration
  if (context.carrierId && context.documentId && context.documentType && context.expiresAt) {
    const result = checkDocumentExpiration({
      carrierId: context.carrierId,
      documentId: context.documentId,
      documentType: context.documentType,
      expiresAt: context.expiresAt,
    });
    if (result.triggered) results.push(result);
  }

  // Rule 6: FMCSA status change
  if (context.carrierId && context.dotNumber && context.previousFmcsaStatus && context.currentFmcsaStatus) {
    const result = checkFmcsaStatusChange({
      carrierId: context.carrierId,
      dotNumber: context.dotNumber,
      previousStatus: context.previousFmcsaStatus,
      currentStatus: context.currentFmcsaStatus,
    });
    if (result.triggered) results.push(result);
  }

  return results;
}
