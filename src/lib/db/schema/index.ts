import { pgTable, uuid, text, varchar, numeric, integer, boolean, timestamp, inet, jsonb, pgEnum, bigserial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const carrierStatusEnum = pgEnum('carrier_status', ['pending', 'verified', 'flagged', 'suspended', 'expired']);
export const docTypeEnum = pgEnum('doc_type', ['insurance_cert', 'operating_authority', 'w9', 'other']);
export const checkTypeEnum = pgEnum('check_type', ['fmcsa_lookup', 'insurance_verify', 'document_review', 'manual']);
export const verificationStatusEnum = pgEnum('verification_status_enum', ['passed', 'failed', 'pending', 'expired']);
export const loadStatusEnum = pgEnum('load_status', ['draft', 'tendered', 'accepted', 'in_transit', 'delivered', 'completed', 'cancelled']);
export const pickupVerificationStatusEnum = pgEnum('pickup_verification_status', ['pending', 'verified', 'failed', 'expired']);
export const actorTypeEnum = pgEnum('actor_type', ['user', 'carrier', 'driver', 'system']);
export const alertSeverityEnum = pgEnum('alert_severity', ['low', 'medium', 'high', 'critical']);
export const alertStatusEnum = pgEnum('alert_status', ['open', 'acknowledged', 'resolved']);

export const loadDocTypeEnum = pgEnum('load_doc_type', ['bol', 'rate_confirmation', 'pod', 'other']);
export const messageAuthorTypeEnum = pgEnum('message_author_type', ['user', 'carrier', 'system']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').unique().notNull(),
  name: text('name').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  plan: text('plan').default('starter'),
  verifiedLoadsLimit: integer('verified_loads_limit').default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const carriers = pgTable('carriers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  dotNumber: varchar('dot_number', { length: 10 }).notNull(),
  mcNumber: varchar('mc_number', { length: 10 }),
  legalName: text('legal_name'),
  dbaName: text('dba_name'),
  address: jsonb('address'),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  status: carrierStatusEnum('status').default('pending'),
  fmcsaSnapshot: jsonb('fmcsa_snapshot'),
  fmcsaLastCheck: timestamp('fmcsa_last_check', { withTimezone: true }),
  safetyRating: varchar('safety_rating', { length: 20 }),
  insuranceOnFile: boolean('insurance_on_file'),
  fleetSize: integer('fleet_size'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const carrierDocuments = pgTable('carrier_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierId: uuid('carrier_id').references(() => carriers.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  docType: docTypeEnum('doc_type').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  uploadedBy: uuid('uploaded_by'),
  verified: boolean('verified').default(false),
  verifiedBy: uuid('verified_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const carrierVerifications = pgTable('carrier_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierId: uuid('carrier_id').references(() => carriers.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  checkType: checkTypeEnum('check_type').notNull(),
  status: verificationStatusEnum('status').default('pending'),
  details: jsonb('details'),
  performedBy: uuid('performed_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const loads = pgTable('loads', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  referenceNumber: varchar('reference_number', { length: 50 }),
  carrierId: uuid('carrier_id').references(() => carriers.id),
  status: loadStatusEnum('status').default('draft'),
  originName: text('origin_name'),
  originAddress: text('origin_address'),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
  destinationName: text('destination_name'),
  destinationAddress: text('destination_address'),
  destinationLat: numeric('destination_lat', { precision: 10, scale: 7 }),
  destinationLng: numeric('destination_lng', { precision: 10, scale: 7 }),
  pickupDate: timestamp('pickup_date', { withTimezone: true }),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }),
  commodity: text('commodity'),
  weightLbs: integer('weight_lbs'),
  specialInstructions: text('special_instructions'),
  rateCents: integer('rate_cents'),
  tenderToken: varchar('tender_token', { length: 64 }),
  tenderExpiresAt: timestamp('tender_expires_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const pickupVerifications = pgTable('pickup_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadId: uuid('load_id').references(() => loads.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  otpHash: varchar('otp_hash', { length: 255 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  otpAttempts: integer('otp_attempts').default(0),
  driverName: text('driver_name'),
  driverPhone: varchar('driver_phone', { length: 20 }),
  truckNumber: text('truck_number'),
  trailerNumber: text('trailer_number'),
  verificationStatus: pickupVerificationStatusEnum('verification_status').default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by'),
  photoUrls: text('photo_urls').array(),
  geoLat: numeric('geo_lat', { precision: 10, scale: 7 }),
  geoLng: numeric('geo_lng', { precision: 10, scale: 7 }),
  geoTimestamp: timestamp('geo_timestamp', { withTimezone: true }),
  geoAccuracy: numeric('geo_accuracy', { precision: 8, scale: 2 }),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const loadEvents = pgTable('load_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  loadId: uuid('load_id').references(() => loads.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  actorId: uuid('actor_id'),
  actorType: actorTypeEnum('actor_type'),
  description: text('description'),
  metadata: jsonb('metadata'),
  geoLat: numeric('geo_lat', { precision: 10, scale: 7 }),
  geoLng: numeric('geo_lng', { precision: 10, scale: 7 }),
  ipAddress: inet('ip_address'),
  prevHash: varchar('prev_hash', { length: 64 }),
  eventHash: varchar('event_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  loadId: uuid('load_id').references(() => loads.id),
  carrierId: uuid('carrier_id').references(() => carriers.id),
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: alertStatusEnum('status').default('open'),
  acknowledgedBy: uuid('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgeNote: text('acknowledge_note'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orgId: uuid('org_id'),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  action: varchar('action', { length: 50 }),
  actorId: uuid('actor_id'),
  actorType: actorTypeEnum('actor_type'),
  metadata: jsonb('metadata'),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});


export const loadDocuments = pgTable('load_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadId: uuid('load_id').references(() => loads.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  docType: loadDocTypeEnum('doc_type').notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const loadMessages = pgTable('load_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadId: uuid('load_id').references(() => loads.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  authorId: uuid('author_id'),
  authorName: text('author_name'),
  authorType: messageAuthorTypeEnum('author_type').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  carriers: many(carriers),
  loads: many(loads),
  alerts: many(alerts),
}));

export const carriersRelations = relations(carriers, ({ one, many }) => ({
  organization: one(organizations, { fields: [carriers.orgId], references: [organizations.id] }),
  documents: many(carrierDocuments),
  verifications: many(carrierVerifications),
  loads: many(loads),
  alerts: many(alerts),
}));

export const carrierDocumentsRelations = relations(carrierDocuments, ({ one }) => ({
  carrier: one(carriers, { fields: [carrierDocuments.carrierId], references: [carriers.id] }),
  organization: one(organizations, { fields: [carrierDocuments.orgId], references: [organizations.id] }),
}));

export const carrierVerificationsRelations = relations(carrierVerifications, ({ one }) => ({
  carrier: one(carriers, { fields: [carrierVerifications.carrierId], references: [carriers.id] }),
  organization: one(organizations, { fields: [carrierVerifications.orgId], references: [organizations.id] }),
}));

export const loadsRelations = relations(loads, ({ one, many }) => ({
  organization: one(organizations, { fields: [loads.orgId], references: [organizations.id] }),
  carrier: one(carriers, { fields: [loads.carrierId], references: [carriers.id] }),
  pickupVerifications: many(pickupVerifications),
  events: many(loadEvents),
  alerts: many(alerts),
  documents: many(loadDocuments),
  messages: many(loadMessages),
}));

export const pickupVerificationsRelations = relations(pickupVerifications, ({ one }) => ({
  load: one(loads, { fields: [pickupVerifications.loadId], references: [loads.id] }),
  organization: one(organizations, { fields: [pickupVerifications.orgId], references: [organizations.id] }),
}));

export const loadEventsRelations = relations(loadEvents, ({ one }) => ({
  load: one(loads, { fields: [loadEvents.loadId], references: [loads.id] }),
  organization: one(organizations, { fields: [loadEvents.orgId], references: [organizations.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  organization: one(organizations, { fields: [alerts.orgId], references: [organizations.id] }),
  load: one(loads, { fields: [alerts.loadId], references: [loads.id] }),
  carrier: one(carriers, { fields: [alerts.carrierId], references: [carriers.id] }),
}));

export const loadDocumentsRelations = relations(loadDocuments, ({ one }) => ({
  load: one(loads, { fields: [loadDocuments.loadId], references: [loads.id] }),
  organization: one(organizations, { fields: [loadDocuments.orgId], references: [organizations.id] }),
}));

export const loadMessagesRelations = relations(loadMessages, ({ one }) => ({
  load: one(loads, { fields: [loadMessages.loadId], references: [loads.id] }),
  organization: one(organizations, { fields: [loadMessages.orgId], references: [organizations.id] }),
}));

// Phase 5: Subscriptions table for Stripe billing
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing', 'active', 'past_due', 'canceled', 'unpaid']);
export const planTierEnum = pgEnum('plan_tier', ['starter', 'professional', 'business']);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeCustomerId: text('stripe_customer_id'),
  stripePriceId: text('stripe_price_id'),
  planTier: planTierEnum('plan_tier').default('starter').notNull(),
  status: subscriptionStatusEnum('status').default('trialing').notNull(),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, { fields: [subscriptions.orgId], references: [organizations.id] }),
}));

// Phase 5: Onboarding progress tracking
export const onboardingProgress = pgTable('onboarding_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull().unique(),
  userId: text('user_id').notNull(),
  completedSteps: jsonb('completed_steps').$type<string[]>().default([]),
  isComplete: boolean('is_complete').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const onboardingProgressRelations = relations(onboardingProgress, ({ one }) => ({
  organization: one(organizations, { fields: [onboardingProgress.orgId], references: [organizations.id] }),
}));
