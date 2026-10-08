import {
  Product,
  Category,
  Package,
  TripPlan,
  ReservationRequest,
  Lead,
  GuestMessage,
  KnowledgeSource,
  AssistantResponse,
  MediaAsset,
} from '../types/index.ts';
import { getAttributionHeaders } from './analytics.ts';

const API_BASE = '/api';

function getSessionHeaders(): Record<string, string> {
  const sessionId = localStorage.getItem('syntuc_guest_session_id') || '';
  const signature = localStorage.getItem('syntuc_guest_signature') || '';
  return {
    'Content-Type': 'application/json',
    'x-guest-session-id': sessionId,
    'x-guest-signature': signature,
    ...getAttributionHeaders(),
  };
}

function getStaffHeaders(): Record<string, string> {
  const token = localStorage.getItem('syntuc_staff_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const api = {
  // --- Catalog ---
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/catalog/products`);
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  },

  async getProductDetail(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/catalog/products/${id}`);
    if (!res.ok) throw new Error('Failed to load product detail');
    return res.json();
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/catalog/categories`);
    if (!res.ok) throw new Error('Failed to load categories');
    return res.json();
  },

  async getPackages(): Promise<Package[]> {
    const res = await fetch(`${API_BASE}/catalog/packages`);
    if (!res.ok) throw new Error('Failed to load packages');
    return res.json();
  },

  // --- Guest Session & Trip Plan ---
  async initSession(): Promise<{ sessionId: string; sessionSecret: string; signature: string; tripPlanId?: string }> {
    const existingId = localStorage.getItem('syntuc_guest_session_id');
    const existingSecret = localStorage.getItem('syntuc_guest_session_secret');

    const res = await fetch(`${API_BASE}/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: existingId, sessionSecret: existingSecret }),
    });

    if (!res.ok) throw new Error('Failed to initialize session');
    const data = await res.json();
    localStorage.setItem('syntuc_guest_session_id', data.sessionId);
    localStorage.setItem('syntuc_guest_session_secret', data.sessionSecret);
    localStorage.setItem('syntuc_guest_signature', data.signature);
    return data;
  },

  async getTripPlan(): Promise<TripPlan> {
    const res = await fetch(`${API_BASE}/session/trip`, {
      headers: getSessionHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load trip plan');
    return res.json();
  },

  async updateTripPlan(data: Partial<TripPlan>): Promise<any> {
    const res = await fetch(`${API_BASE}/session/trip`, {
      method: 'PUT',
      headers: getSessionHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update trip plan');
    return res.json();
  },

  async addTripItem(item: {
    productId: string;
    roomId?: string;
    variantId?: string;
    dayNumber?: number;
    guestCount?: number;
    scheduledDate?: string;
    scheduledTime?: string;
    notes?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/session/trip/items`, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to add item to trip');
    }
    return res.json();
  },

  async removeTripItem(itemId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/session/trip/items/${itemId}`, {
      method: 'DELETE',
      headers: getSessionHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove trip item');
    return res.json();
  },

  // --- Reservations ---
  async submitReservationRequest(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to submit reservation request');
    }
    return res.json();
  },

  async getGuestReservationDashboard(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/reservations/guest/${token}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to load guest reservation dashboard');
    }
    return res.json();
  },

  async sendGuestReservationMessage(token: string, messageText: string): Promise<any> {
    const res = await fetch(`${API_BASE}/reservations/guest/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageText }),
    });
    if (!res.ok) throw new Error('Failed to send message to desk');
    return res.json();
  },

  // --- School Trips ---
  async calculateSchoolTrip(input: any): Promise<any> {
    const res = await fetch(`${API_BASE}/school-trips/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to calculate school trip quote');
    return res.json();
  },

  async submitSchoolTrip(input: any): Promise<any> {
    const sessionId = localStorage.getItem('syntuc_guest_session_id') || undefined;
    const res = await fetch(`${API_BASE}/school-trips/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, guestSessionId: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to submit school delegation request');
    }
    return res.json();
  },

  // --- Assistant ---
  async sendAssistantChat(
    message: string,
    history: { role: string; text: string }[] = [],
    tripContext?: any
  ): Promise<AssistantResponse> {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, tripContext }),
    });
    if (!res.ok) throw new Error('Failed to get digital guide response');
    return res.json();
  },

  // --- Coordinator / Reservations Desk ---
  async coordinatorLogin(email: string, password: string): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Coordinator authentication failed');
    }
    const data = await res.json();
    localStorage.setItem('syntuc_staff_token', data.token);
    return data;
  },

  async getCoordinatorMe(): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/me`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  async getLeads(): Promise<Lead[]> {
    const res = await fetch(`${API_BASE}/coordinator/leads`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load leads');
    return res.json();
  },

  async getReservations(): Promise<ReservationRequest[]> {
    const res = await fetch(`${API_BASE}/coordinator/reservations`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load reservations');
    return res.json();
  },

  async getReservationDetail(id: string): Promise<ReservationRequest> {
    const res = await fetch(`${API_BASE}/coordinator/reservations/${id}`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load reservation detail');
    return res.json();
  },

  async updateReservationStatus(id: string, status: string, internalNote?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/reservations/${id}/status`, {
      method: 'PATCH',
      headers: getStaffHeaders(),
      body: JSON.stringify({ status, internalNote }),
    });
    if (!res.ok) throw new Error('Failed to update reservation status');
    return res.json();
  },

  async getReservationMessages(id: string): Promise<GuestMessage[]> {
    const res = await fetch(`${API_BASE}/coordinator/reservations/${id}/messages`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load messages');
    return res.json();
  },

  async sendCoordinatorMessage(reservationRequestId: string, messageText: string): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/messages`, {
      method: 'POST',
      headers: getStaffHeaders(),
      body: JSON.stringify({ reservationRequestId, messageText }),
    });
    if (!res.ok) throw new Error('Failed to post coordinator message');
    return res.json();
  },

  async getCoordinatorProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/coordinator/products`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load coordinator products');
    return res.json();
  },

  async createProduct(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/products`, {
      method: 'POST',
      headers: getStaffHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create product');
    }
    return res.json();
  },

  async updateProduct(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/products/${id}`, {
      method: 'PUT',
      headers: getStaffHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update product');
    }
    return res.json();
  },

  async toggleProductPublish(id: string, isPublished: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/products/${id}/publish`, {
      method: 'PATCH',
      headers: getStaffHeaders(),
      body: JSON.stringify({ isPublished }),
    });
    if (!res.ok) throw new Error('Failed to toggle product publication state');
    return res.json();
  },

  async getOperators(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/coordinator/operators`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load operators');
    return res.json();
  },

  async getStaffUsers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/coordinator/staff-users`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load staff users');
    return res.json();
  },

  async toggleStaffActive(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/staff-users/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to update staff user status');
    return res.json();
  },

  async getProperties(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/coordinator/properties`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load properties');
    return res.json();
  },

  async getCoordinatorPackages(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/coordinator/packages`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load coordinator packages');
    return res.json();
  },

  async createPackage(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/packages`, {
      method: 'POST',
      headers: getStaffHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create package');
    return res.json();
  },

  async updatePackage(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/coordinator/packages/${id}`, {
      method: 'PUT',
      headers: getStaffHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update package');
    return res.json();
  },

  async getProductMedia(productId: string): Promise<MediaAsset[]> {
    if (!productId || typeof productId !== 'string' || productId.trim() === '' || productId === 'undefined' || productId === 'null') {
      return [];
    }
    try {
      const res = await fetch(`${API_BASE}/media/product/${encodeURIComponent(productId.trim())}`);
      if (!res.ok) {
        console.warn(`[api] getProductMedia failed with status ${res.status}`);
        return [];
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn(`[api] getProductMedia expected JSON but received ${contentType}`);
        return [];
      }
      return res.json();
    } catch (err) {
      console.warn('[api] getProductMedia error:', err);
      return [];
    }
  },

  async uploadMedia(formData: FormData): Promise<any> {
    const token = localStorage.getItem('syntuc_staff_token') || '';
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Media upload failed');
    }
    return res.json();
  },

  async setPrimaryMedia(mediaId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/media/${mediaId}/set-primary`, {
      method: 'POST',
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to set primary media');
    return res.json();
  },

  async deleteMedia(mediaId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/media/${mediaId}`, {
      method: 'DELETE',
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete media asset');
    return res.json();
  },

  async reorderMedia(items: { id: string; displayOrder: number }[]): Promise<any> {
    const res = await fetch(`${API_BASE}/media/reorder`, {
      method: 'POST',
      headers: getStaffHeaders(),
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Failed to reorder media assets');
    return res.json();
  },

  async getKnowledgeSources(): Promise<KnowledgeSource[]> {
    const res = await fetch(`${API_BASE}/coordinator/knowledge-sources`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load knowledge sources');
    return res.json();
  },

  async runR2SecurityTests(): Promise<any> {
    const res = await fetch(`${API_BASE}/tests/r2`);
    if (!res.ok) throw new Error('Failed to execute R2 tests');
    return res.json();
  },

  // --- Marketing Attribution & Conversion Intelligence ---
  async getAnalyticsDashboard(range: string = 'all', startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams({ range });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetch(`${API_BASE}/analytics/dashboard?${params.toString()}`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch analytics dashboard');
    }
    return res.json();
  },

  async getVisitorJourney(identifier: string): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/journey/${encodeURIComponent(identifier)}`, {
      headers: getStaffHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch visitor journey');
    }
    return res.json();
  },
};
