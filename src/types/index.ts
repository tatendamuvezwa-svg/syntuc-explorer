export interface Product {
  id: string;
  operatorId: string | null;
  propertyId: string | null;
  name: string;
  slug: string;
  productType: 'accommodation' | 'activity';
  categorySlug: string;
  shortDescription: string;
  description: string;
  location: string;
  duration: string | null;
  basePrice: string;
  currency: string;
  priceBasis: 'per_person' | 'per_room_night' | 'per_group';
  inclusions: string[];
  exclusions: string[];
  suitability: string[];
  isPublished: boolean;
  isFeatured: boolean;
  availabilityNote: string | null;
  primaryMediaId: string | null;
  videoUrl: string | null;
  evidenceStatus: string;
  operatorName?: string;
  primaryImageUrl?: string | null;
  primaryImageAlt?: string | null;
}

export interface Room {
  id: string;
  productId: string;
  propertyId: string | null;
  name: string;
  roomType: string;
  description: string;
  capacityAdults: number;
  capacityChildren: number;
  pricePerNight: string;
  currency: string;
  amenities: string[];
  isAvailable: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  priceDelta: string;
  duration: string | null;
  isActive: boolean;
}

export interface MediaAsset {
  id: string;
  ownerType: string;
  ownerId: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  thumbnailUrl: string | null;
  isPrimary: boolean;
  displayOrder: number;
  caption: string | null;
  altText: string | null;
  sourceName: string | null;
  sourceType: string | null;
  verificationState: string;
}

export interface Package {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  durationDays: number;
  durationNights: number;
  pricePerPerson: string;
  currency: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  primaryImageUrl: string;
  videoUrl: string | null;
  isPublished: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  type: string;
  displayOrder: number;
}

export interface TripPlan {
  id: string;
  guestSessionId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  adultsCount: number;
  childrenCount: number;
  interests: string[];
  intensity: string;
  items: TripItem[];
}

export interface TripItem {
  id: string;
  tripPlanId: string;
  productId: string;
  roomId: string | null;
  variantId: string | null;
  dayNumber: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  guestCount: number;
  notes: string | null;
  product?: Product;
  room?: Room | null;
}

export interface ReservationRequest {
  id: string;
  referenceNumber: string;
  requestType?: 'STANDARD' | 'SCHOOL_DELEGATION';
  guestId: string;
  guestSessionId: string;
  tripPlanId: string | null;
  status: 'NEW' | 'REVIEWED' | 'CONTACTED' | 'PARTNER_CONTACTED' | 'QUOTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
  startDate: string | null;
  endDate: string | null;
  adultsCount: number;
  childrenCount: number;
  authoritativeTotal: string;
  currency: string;
  specialRequests: string | null;
  isBridgeIncentiveApplied: boolean;
  schoolMetadata?: any;
  assignedStaffId: string | null;
  createdAt: string;
  updatedAt: string;
  guest?: {
    fullName: string;
    email: string;
    phone: string | null;
    country: string | null;
    specialRequests?: string | null;
  };
  items?: ReservationItem[];
  guestToken?: string;
  coordinatorNotes?: Array<{
    id: string;
    authorStaffId: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

export interface ReservationItem {
  id: string;
  reservationRequestId: string;
  productId: string;
  roomId: string | null;
  variantId: string | null;
  snapshotProductName: string;
  snapshotOperatorName: string;
  snapshotProductType: string;
  snapshotUnitPrice: string;
  snapshotPriceBasis: string;
  snapshotCurrency: string;
  guestCount: number;
  nightsCount: number;
  calculatedSubtotal: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
}

export interface Lead {
  id: string;
  guestId: string;
  status: string;
  leadSource: string;
  firstTouchTimestamp: string;
  lastTouchTimestamp: string;
  lastInteractionType: string;
  estimatedValue: string;
  notes: string | null;
  guest?: {
    fullName: string;
    email: string;
    phone: string | null;
    country: string | null;
  };
}

export interface GuestMessage {
  id: string;
  reservationRequestId?: string;
  senderType: 'guest' | 'coordinator' | 'assistant';
  senderName: string;
  messageText: string;
  createdAt: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  sourceUrl: string | null;
  sourceType: string;
  evidenceStatus: 'ESTABLISHED' | 'SUPPORTED' | 'UNCERTAIN' | 'CONFLICTING' | 'LIVE_VERIFICATION_REQUIRED';
  notes: string | null;
  lastVerified: string;
}

export interface AssistantAction {
  type: 'ADD_TO_TRIP' | 'NAVIGATE' | 'OPEN_PRODUCT' | 'OPEN_BOOKING' | 'OPEN_PACKAGE_INQUIRY';
  productId?: string;
  productName?: string;
  destination?: 'explore' | 'packages' | 'planner' | 'school-trips';
  label?: string;
}

export interface AssistantResponse {
  replyText: string;
  action: AssistantAction | null;
  requiresCoordinator: boolean;
}
