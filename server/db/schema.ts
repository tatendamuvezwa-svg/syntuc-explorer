import { pgTable, text, integer, numeric, boolean, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

// 1. Users (Staff & Admin)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('reservations_coordinator'), // 'admin' | 'reservations_coordinator'
  isActive: boolean('is_active').notNull().default(true),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Operators
export const operators = pgTable('operators', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  location: text('location').notNull().default('Victoria Falls, Zimbabwe'),
  description: text('description'),
  verified: boolean('verified').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Properties (Lodges / Hotels / Sites)
export const properties = pgTable('properties', {
  id: text('id').primaryKey(),
  operatorId: text('operator_id').references(() => operators.id),
  name: text('name').notNull(),
  propertyType: text('property_type').notNull(), // 'Lodge' | 'Hotel' | 'Safari Camp' | 'Village'
  address: text('address'),
  checkInTime: text('check_in_time').default('14:00'),
  checkOutTime: text('check_out_time').default('10:00'),
  amenities: jsonb('amenities').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Categories
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'accommodation' | 'activity'
  displayOrder: integer('display_order').notNull().default(0),
});

// 5. Products
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  operatorId: text('operator_id').references(() => operators.id),
  propertyId: text('property_id').references(() => properties.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  productType: text('product_type').notNull(), // 'accommodation' | 'activity'
  categorySlug: text('category_slug').notNull(),
  shortDescription: text('short_description').notNull(),
  description: text('description').notNull(),
  location: text('location').notNull().default('Victoria Falls, Zimbabwe'),
  duration: text('duration'),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  priceBasis: text('price_basis').notNull().default('per_person'), // 'per_person' | 'per_room_night' | 'per_group'
  inclusions: jsonb('inclusions').$type<string[]>().default([]),
  exclusions: jsonb('exclusions').$type<string[]>().default([]),
  suitability: jsonb('suitability').$type<string[]>().default([]),
  isPublished: boolean('is_published').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  availabilityNote: text('availability_note').default('Subject to partner confirmation'),
  primaryMediaId: text('primary_media_id'),
  videoUrl: text('video_url'),
  evidenceStatus: text('evidence_status').notNull().default('ESTABLISHED'), // 'ESTABLISHED' | 'SUPPORTED' | 'UNCERTAIN'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Product Variants
export const productVariants = pgTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  description: text('description'),
  priceDelta: numeric('price_delta', { precision: 10, scale: 2 }).notNull().default('0.00'),
  duration: text('duration'),
  isActive: boolean('is_active').notNull().default(true),
});

// 7. Product Categories mapping
export const productCategories = pgTable('product_categories', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
});

// 8. Rooms (for Accommodation)
export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  propertyId: text('property_id').references(() => properties.id),
  name: text('name').notNull(),
  roomType: text('room_type').notNull(), // 'Standard' | 'Deluxe' | 'Suite' | 'Family' | 'Chalet'
  description: text('description').notNull(),
  capacityAdults: integer('capacity_adults').notNull().default(2),
  capacityChildren: integer('capacity_children').notNull().default(1),
  pricePerNight: numeric('price_per_night', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  amenities: jsonb('amenities').$type<string[]>().default([]),
  isAvailable: boolean('is_available').notNull().default(true),
});

// 9. Packages
export const packages = pgTable('packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  durationDays: integer('duration_days').notNull(),
  durationNights: integer('duration_nights').notNull(),
  pricePerPerson: numeric('price_per_person', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  highlights: jsonb('highlights').$type<string[]>().default([]),
  inclusions: jsonb('inclusions').$type<string[]>().default([]),
  exclusions: jsonb('exclusions').$type<string[]>().default([]),
  primaryImageUrl: text('primary_image_url').notNull(),
  videoUrl: text('video_url'),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Package Items
export const packageItems = pgTable('package_items', {
  id: text('id').primaryKey(),
  packageId: text('package_id').notNull().references(() => packages.id),
  productId: text('product_id').notNull().references(() => products.id),
  dayNumber: integer('day_number').notNull().default(1),
  orderIndex: integer('order_index').notNull().default(1),
  notes: text('notes'),
});

// 11. Media Assets
export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey(),
  ownerType: text('owner_type').notNull(), // 'product' | 'package' | 'property'
  ownerId: text('owner_id').notNull(),
  mediaType: text('media_type').notNull().default('IMAGE'), // 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  isPrimary: boolean('is_primary').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  caption: text('caption'),
  altText: text('alt_text'),
  sourceName: text('source_name').default('Syntuc Catalog'),
  sourceType: text('source_type').default('official_partner'),
  verificationState: text('verification_state').notNull().default('ESTABLISHED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Knowledge Sources (Traceability)
export const knowledgeSources = pgTable('knowledge_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sourceUrl: text('source_url'),
  sourceType: text('source_type').notNull(), // 'operator_contract' | 'zimparks_official' | 'on_site_inspection' | 'commercial_tariff'
  evidenceStatus: text('evidence_status').notNull().default('ESTABLISHED'), // 'ESTABLISHED' | 'SUPPORTED' | 'UNCERTAIN' | 'CONFLICTING' | 'LIVE_VERIFICATION_REQUIRED'
  notes: text('notes'),
  lastVerified: timestamp('last_verified').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. School Trip Tariffs (Commercial Frozen Rules)
export const schoolTripTariffs = pgTable('school_trip_tariffs', {
  id: text('id').primaryKey(),
  itemCategory: text('item_category').notNull(), // 'accommodation' | 'activity' | 'park_fee'
  itemName: text('item_name').notNull(),
  targetTier: text('target_tier'), // 'budget' | 'rainbow_hotel' | 'primary' | 'secondary' | 'teacher'
  rateAmount: numeric('rate_amount', { precision: 10, scale: 2 }).notNull(),
  rateBasis: text('rate_basis').notNull(), // 'per_child_per_night' | 'per_room_shared_2_children' | 'per_child' | 'per_adult'
  currency: text('currency').notNull().default('USD'),
  isBridgeIncentiveQualifying: boolean('is_bridge_incentive_qualifying').notNull().default(false),
  notes: text('notes'),
});

// 14. Guests
export const guests = pgTable('guests', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  country: text('country'),
  specialRequests: text('special_requests'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Guest Sessions
export const guestSessions = pgTable('guest_sessions', {
  id: text('id').primaryKey(), // Session token / UUID
  guestId: text('guest_id').references(() => guests.id),
  visitorId: text('visitor_id'), // Persistent visitor identifier
  sessionSecret: text('session_secret').notNull(), // Secret for HMAC validation
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Trip Plans
export const tripPlans = pgTable('trip_plans', {
  id: text('id').primaryKey(),
  guestSessionId: text('guest_session_id').notNull().references(() => guestSessions.id),
  title: text('title').notNull().default('My Victoria Falls Journey'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  adultsCount: integer('adults_count').notNull().default(2),
  childrenCount: integer('children_count').notNull().default(0),
  interests: jsonb('interests').$type<string[]>().default([]),
  intensity: text('intensity').default('moderate'), // 'relaxed' | 'moderate' | 'high_adventure'
  accommodationPreference: text('accommodation_preference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 17. Trip Items
export const tripItems = pgTable('trip_items', {
  id: text('id').primaryKey(),
  tripPlanId: text('trip_plan_id').notNull().references(() => tripPlans.id),
  productId: text('product_id').notNull().references(() => products.id),
  roomId: text('room_id').references(() => rooms.id),
  variantId: text('variant_id').references(() => productVariants.id),
  dayNumber: integer('day_number').notNull().default(1),
  scheduledDate: text('scheduled_date'),
  scheduledTime: text('scheduled_time'),
  guestCount: integer('guest_count').notNull().default(2),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Recommendations
export const recommendations = pgTable('recommendations', {
  id: text('id').primaryKey(),
  tripPlanId: text('trip_plan_id').references(() => tripPlans.id),
  productId: text('product_id').notNull().references(() => products.id),
  recommendationReason: text('recommendation_reason').notNull(),
  matchScore: integer('match_score').default(85),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Reservation Requests
export const reservationRequests = pgTable('reservation_requests', {
  id: text('id').primaryKey(),
  referenceNumber: text('reference_number').notNull().unique(), // e.g. SYN-VF-84920
  requestType: text('request_type').notNull().default('STANDARD'), // 'STANDARD' | 'SCHOOL_DELEGATION'
  guestId: text('guest_id').notNull().references(() => guests.id),
  guestSessionId: text('guest_session_id').notNull().references(() => guestSessions.id),
  tripPlanId: text('trip_plan_id').references(() => tripPlans.id),
  status: text('status').notNull().default('NEW'), // 'NEW' | 'REVIEWED' | 'PARTNER_CONTACTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED'
  startDate: text('start_date'),
  endDate: text('end_date'),
  adultsCount: integer('adults_count').notNull().default(2),
  childrenCount: integer('children_count').notNull().default(0),
  authoritativeTotal: numeric('authoritative_total', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  specialRequests: text('special_requests'),
  isBridgeIncentiveApplied: boolean('is_bridge_incentive_applied').notNull().default(false),
  schoolMetadata: jsonb('school_metadata'),
  assignedStaffId: text('assigned_staff_id').references(() => users.id),
  // Authoritative Attribution Snapshots (Persists across restarts & browser closure)
  visitorId: text('visitor_id'),
  firstTouchSource: text('first_touch_source'),
  firstTouchMedium: text('first_touch_medium'),
  firstTouchCampaign: text('first_touch_campaign'),
  firstTouchContent: text('first_touch_content'),
  firstTouchTerm: text('first_touch_term'),
  firstTouchReferrer: text('first_touch_referrer'),
  lastTouchSource: text('last_touch_source'),
  lastTouchMedium: text('last_touch_medium'),
  lastTouchCampaign: text('last_touch_campaign'),
  lastTouchContent: text('last_touch_content'),
  lastTouchTerm: text('last_touch_term'),
  lastTouchReferrer: text('last_touch_referrer'),
  attributionConfidence: text('attribution_confidence').default('UNKNOWN'), // 'UTM_EXACT' | 'REFERRER_ONLY' | 'DIRECT' | 'UNKNOWN'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Reservation Items (Historical Snapshots)
export const reservationItems = pgTable('reservation_items', {
  id: text('id').primaryKey(),
  reservationRequestId: text('reservation_request_id').notNull().references(() => reservationRequests.id),
  productId: text('product_id').notNull().references(() => products.id),
  roomId: text('room_id').references(() => rooms.id),
  variantId: text('variant_id').references(() => productVariants.id),
  // Historical snapshot fields (Never mutate when product changes later)
  snapshotProductName: text('snapshot_product_name').notNull(),
  snapshotOperatorName: text('snapshot_operator_name').notNull(),
  snapshotProductType: text('snapshot_product_type').notNull(),
  snapshotUnitPrice: numeric('snapshot_unit_price', { precision: 10, scale: 2 }).notNull(),
  snapshotPriceBasis: text('snapshot_price_basis').notNull(),
  snapshotCurrency: text('snapshot_currency').notNull().default('USD'),
  guestCount: integer('guest_count').notNull().default(1),
  nightsCount: integer('nights_count').default(1),
  calculatedSubtotal: numeric('calculated_subtotal', { precision: 10, scale: 2 }).notNull(),
  scheduledDate: text('scheduled_date'),
  scheduledTime: text('scheduled_time'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Leads
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  guestId: text('guest_id').notNull().references(() => guests.id),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'CONVERTED' | 'COLD' | 'ARCHIVED'
  leadSource: text('lead_source').notNull().default('syntuc_explorer_direct'),
  firstTouchTimestamp: timestamp('first_touch_timestamp').defaultNow().notNull(),
  lastTouchTimestamp: timestamp('last_touch_timestamp').defaultNow().notNull(),
  lastInteractionType: text('last_interaction_type').default('trip_created'),
  estimatedValue: numeric('estimated_value', { precision: 10, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Coordinator Notes
export const coordinatorNotes = pgTable('coordinator_notes', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(), // 'lead' | 'reservation' | 'guest'
  targetId: text('target_id').notNull(),
  authorStaffId: text('author_staff_id').notNull().references(() => users.id),
  authorName: text('author_name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 23. Interactions
export const interactions = pgTable('interactions', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').references(() => leads.id),
  guestId: text('guest_id').references(() => guests.id),
  staffId: text('staff_id').references(() => users.id),
  channel: text('channel').notNull().default('web_desk'), // 'web_desk' | 'email' | 'phone' | 'ai_chat'
  interactionType: text('interaction_type').notNull(), // 'inquiry' | 'quote_sent' | 'partner_confirmed' | 'note'
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. Guest Access Tokens (Secure reservation dashboard links)
export const guestAccessTokens = pgTable('guest_access_tokens', {
  id: text('id').primaryKey(), // Token UUID
  reservationRequestId: text('reservation_request_id').notNull().references(() => reservationRequests.id),
  guestId: text('guest_id').notNull().references(() => guests.id),
  tokenHash: text('token_hash').notNull().unique(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 25. Guest Messages
export const guestMessages = pgTable('guest_messages', {
  id: text('id').primaryKey(),
  guestSessionId: text('guest_session_id').references(() => guestSessions.id),
  reservationRequestId: text('reservation_request_id').references(() => reservationRequests.id),
  senderType: text('sender_type').notNull(), // 'guest' | 'coordinator' | 'assistant'
  senderName: text('sender_name').notNull(),
  messageText: text('message_text').notNull(),
  actionMetadata: jsonb('action_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 26. Product Revisions (Audit traceability)
export const productRevisions = pgTable('product_revisions', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  modifiedByStaffId: text('modified_by_staff_id').notNull().references(() => users.id),
  previousSnapshot: jsonb('previous_snapshot'),
  changeSummary: text('change_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 27. Package Revisions (Audit traceability)
export const packageRevisions = pgTable('package_revisions', {
  id: text('id').primaryKey(),
  packageId: text('package_id').notNull().references(() => packages.id),
  modifiedByStaffId: text('modified_by_staff_id').notNull().references(() => users.id),
  previousSnapshot: jsonb('previous_snapshot'),
  changeSummary: text('change_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 28. Analytics Visitors (Persistent Anonymous Device/Browser Identity)
export const analyticsVisitors = pgTable('analytics_visitors', {
  id: text('id').primaryKey(), // Internal unique ID
  visitorId: text('visitor_id').notNull().unique(), // e.g. vis_7f8a9b2c...
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  firstSource: text('first_source').notNull().default('direct'), // e.g. tiktok, facebook, instagram, google, whatsapp, direct
  firstMedium: text('first_medium'), // e.g. paid_social, cpc, referral, organic
  firstCampaign: text('first_campaign'), // e.g. helicopter_launch
  firstContent: text('first_content'), // e.g. helicopter_ad_01
  firstTerm: text('first_term'),
  firstReferrerUrl: text('first_referrer_url'),
  firstReferrerDomain: text('first_referrer_domain'),
  firstLandingPage: text('first_landing_page'),
  attributionConfidence: text('attribution_confidence').notNull().default('UNKNOWN'), // 'UTM_EXACT' | 'REFERRER_ONLY' | 'DIRECT' | 'UNKNOWN'
  totalSessions: integer('total_sessions').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 29. Analytics Sessions (Visit Sessions)
export const analyticsSessions = pgTable('analytics_sessions', {
  id: text('id').primaryKey(), // Internal session record ID
  sessionId: text('session_id').notNull().unique(), // e.g. ses_20261005_1532...
  visitorId: text('visitor_id').notNull().references(() => analyticsVisitors.visitorId),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  landingPage: text('landing_page'),
  exitPage: text('exit_page'),
  // Session touch attribution (Last touch for this session)
  source: text('source').notNull().default('direct'),
  medium: text('medium'),
  campaign: text('campaign'),
  content: text('content'),
  term: text('term'),
  referrerUrl: text('referrer_url'),
  referrerDomain: text('referrer_domain'),
  attributionConfidence: text('attribution_confidence').notNull().default('UNKNOWN'),
  isBounce: boolean('is_bounce').notNull().default(false),
  deviceCategory: text('device_category').notNull().default('desktop'), // 'desktop' | 'mobile' | 'tablet'
  browser: text('browser'),
  os: text('os'),
  country: text('country'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 30. Analytics Events (Structured Funnel & Behavioural Events)
export const analyticsEvents = pgTable('analytics_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  visitorId: text('visitor_id').notNull(),
  sessionId: text('session_id').notNull(),
  eventType: text('event_type').notNull(),
  // Structured event types:
  // Acquisition: 'SESSION_STARTED', 'LANDING_PAGE_VIEWED'
  // Navigation: 'PAGE_VIEWED', 'PRODUCT_VIEWED', 'PACKAGE_VIEWED'
  // AI Interaction: 'SYNTUC_CHAT_OPENED', 'SYNTUC_MESSAGE_SENT', 'SYNTUC_ACTION_EXECUTED', 'CHAT_RESET'
  // Trip Planning: 'TRIP_CREATED', 'TRIP_ITEM_ADDED', 'TRIP_ITEM_REMOVED', 'ITINERARY_VIEWED'
  // Reservation Funnel: 'BOOKING_STARTED', 'BOOKING_DETAILS_COMPLETED', 'RESERVATION_REQUEST_SUBMITTED', 'RESERVATION_REQUEST_FAILED'
  // Guest Account: 'GUEST_ACCOUNT_CREATED', 'GUEST_LOGIN'
  // Conversion Lifecycle: 'RESERVATION_STATUS_CHANGED', 'RESERVATION_CONFIRMED', 'RESERVATION_CANCELLED'
  route: text('route'),
  productId: text('product_id'),
  packageId: text('package_id'),
  reservationId: text('reservation_id'),
  reservationReference: text('reservation_reference'),
  metadata: jsonb('metadata').default({}),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
});
