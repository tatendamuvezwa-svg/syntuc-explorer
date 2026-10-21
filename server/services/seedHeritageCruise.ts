import { getDocById, setDocById } from '../lib/firestore.ts';

export const HERITAGE_CRUISE_PRODUCT_ID = 'heritage-standard-sunset-cruise';

export async function ensureHeritageCruiseProduct(): Promise<void> {
  try {
    const existing = await getDocById<any>('products', HERITAGE_CRUISE_PRODUCT_ID);
    const nowIso = new Date().toISOString();

    const productRecord = {
      id: HERITAGE_CRUISE_PRODUCT_ID,
      name: 'Heritage Standard Sunset Cruise',
      slug: 'heritage-standard-sunset-cruise',
      productType: 'activity',
      categorySlug: 'river-cruises',
      operatorName: 'Pure Africa',
      operatorId: 'op_pure_africa',
      propertyId: null,
      location: 'Victoria Falls, Zimbabwe',
      duration: '2 hours',
      basePrice: '52',
      currency: 'USD',
      priceBasis: 'per_person',
      shortDescription: 'Sunset cruise on the Zambezi River. Cruise fare US$52 per person. National Park fee US$12 (international) / US$6 (local). Indicative totals: US$64 (international) / US$58 (local).',
      description: 'The Heritage Standard Sunset Cruise offers an unforgettable voyage along the Zambezi River. Cruise price: US$52 per person. Park fee: US$12 per person for international guests (Total: US$64 per person) or US$6 per person for local guests (Total: US$58 per person). Totals clearly include the cruise price and the applicable park fee.',
      primaryMediaId: 'med_2db2d6add31909b4f3d0adcf',
      primaryImageUrl: '/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
      primaryImageAlt: 'Heritage Standard Sunset Cruise on the Zambezi River',
      isPublished: true,
      isFeatured: true,
      evidenceStatus: 'ESTABLISHED',
      inclusions: ['Zambezi River sunset cruise', 'Transfers', 'Canapés', 'Selected beverages'],
      exclusions: ['National Park fee (US$12 international / US$6 local per person)'],
      mandatoryFees: [
        {
          name: 'National Park Fee (International Guests)',
          amount: 12,
          currency: 'USD',
          basis: 'per_person',
          mandatory: true,
        },
        {
          name: 'National Park Fee (Local Guests)',
          amount: 6,
          currency: 'USD',
          basis: 'per_person',
          mandatory: true,
        },
      ],
      pricingBreakdown: {
        cruisePrice: 52,
        parkFeeInternational: 12,
        parkFeeLocal: 6,
        totalInternational: 64,
        totalLocal: 58,
      },
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await setDocById('products', HERITAGE_CRUISE_PRODUCT_ID, productRecord, true);

    // Ensure corresponding media asset exists
    const existingMedia = await getDocById<any>('media_assets', 'med_heritage_standard_sunset_cruise');
    if (!existingMedia) {
      await setDocById('media_assets', 'med_heritage_standard_sunset_cruise', {
        id: 'med_heritage_standard_sunset_cruise',
        ownerType: 'product',
        ownerId: HERITAGE_CRUISE_PRODUCT_ID,
        mediaType: 'IMAGE',
        url: '/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
        thumbnailUrl: '/uploads/med_2db2d6add31909b4f3d0adcf.jpeg',
        isPrimary: true,
        displayOrder: 0,
        caption: 'Heritage Standard Sunset Cruise on the Zambezi River',
        altText: 'Heritage Standard Sunset Cruise on the Zambezi River',
        sourceName: 'Pure Africa',
        sourceType: 'SUPPLIER_OFFICIAL',
        verificationState: 'ESTABLISHED',
        createdAt: nowIso,
      }, true);
    }

    console.log('[Catalog] Heritage Standard Sunset Cruise verified and persisted in Firestore.');
  } catch (error) {
    console.warn('[Catalog] Notice ensuring Heritage Standard Sunset Cruise product:', error);
  }
}

export async function ensureBaselineAccommodations(): Promise<void> {
  try {
    const { BASELINE_ACCOMMODATIONS } = await import('../lib/baselineCatalog.ts');
    for (const acc of BASELINE_ACCOMMODATIONS) {
      const existing = await getDocById<any>('products', acc.id);
      if (!existing) {
        await setDocById('products', acc.id, {
          ...acc,
          isPublished: true,
          updatedAt: new Date().toISOString(),
        }, true);
      }
      if (acc.primaryMediaId) {
        const existingMedia = await getDocById<any>('media_assets', acc.primaryMediaId);
        if (!existingMedia) {
          await setDocById('media_assets', acc.primaryMediaId, {
            id: acc.primaryMediaId,
            ownerType: 'product',
            ownerId: acc.id,
            mediaType: 'IMAGE',
            url: acc.primaryImageUrl,
            thumbnailUrl: acc.primaryImageUrl,
            isPrimary: true,
            displayOrder: 0,
            caption: acc.name,
            altText: acc.primaryImageAlt || acc.name,
            sourceName: acc.operatorName,
            sourceType: 'SUPPLIER_OFFICIAL',
            verificationState: 'ESTABLISHED',
            createdAt: acc.createdAt,
          }, true);
        }
      }
    }
    console.log('[Catalog] Canonical baseline accommodations verified and persisted in Firestore.');
  } catch (error) {
    console.warn('[Catalog] Notice ensuring baseline accommodations:', error);
  }
}
