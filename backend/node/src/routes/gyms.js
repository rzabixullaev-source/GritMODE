import { Router } from 'express';

const router = Router();
const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryTypeDisplayName',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'nextPageToken',
].join(',');

function parseBounds(value) {
  const bounds = value?.split(',').map(Number);
  if (!bounds || bounds.length !== 4 || bounds.some((coordinate) => !Number.isFinite(coordinate))) return null;
  const [west, south, east, north] = bounds;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  if (east - west > 8 || north - south > 8) return null;
  return { west, south, east, north };
}

function normalizeGooglePlace(place) {
  const { latitude, longitude } = place.location || {};
  if (!place.id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: place.id,
    name: place.displayName?.text || 'Sport zali',
    category: place.primaryTypeDisplayName?.text || 'Sport zali',
    address: place.formattedAddress || '',
    latitude,
    longitude,
    mapsUrl: place.googleMapsUri || '',
    rating: Number.isFinite(place.rating) ? place.rating : null,
    ratingCount: Number.isFinite(place.userRatingCount) ? place.userRatingCount : null,
    openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
    phone: place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    businessStatus: place.businessStatus || '',
  };
}

async function searchGoogleGyms(bounds, area) {
  const gyms = new Map();
  let pageToken;

  // Places Text Search returns up to 20 results per page. Follow its tokens
  // for a maximum of three pages and deduplicate overlapping place IDs.
  for (let page = 0; page < 3; page += 1) {
    const body = {
      textQuery: `gyms, fitness centers and sports clubs in ${area}`,
      includedType: 'gym',
      locationRestriction: {
        rectangle: {
          low: { latitude: bounds.south, longitude: bounds.west },
          high: { latitude: bounds.north, longitude: bounds.east },
        },
      },
      pageSize: 20,
      languageCode: 'uz',
      regionCode: 'UZ',
      ...(pageToken ? { pageToken } : {}),
    };
    const result = await fetch(GOOGLE_PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_PLACES_API_KEY,
        'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      const message = data.error?.message || `Google Places returned ${result.status}.`;
      throw new Error(message);
    }
    for (const place of data.places || []) {
      const gym = normalizeGooglePlace(place);
      if (gym) gyms.set(gym.id, gym);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return [...gyms.values()];
}

function distanceKm(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function geocodeLocation(location) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', location);
  url.searchParams.set('limit', '1');
  url.searchParams.set('lang', 'en');
  const result = await fetch(url, { headers: { 'user-agent': 'GritMODE/1.0 gym finder' }, signal: AbortSignal.timeout(10_000) });
  if (!result.ok) throw new Error('Manzilni aniqlab bo‘lmadi.');
  const feature = (await result.json()).features?.[0];
  const [longitude, latitude] = feature?.geometry?.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const p = feature.properties || {};
  return { latitude, longitude, label: [p.name, p.city, p.state, p.country].filter(Boolean).join(', ') || location };
}

function boundsAround(latitude, longitude, radiusKm) {
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta = radiusKm / (111 * Math.max(Math.cos(latitude * Math.PI / 180), 0.2));
  return { west: longitude - longitudeDelta, east: longitude + longitudeDelta, south: latitude - latitudeDelta, north: latitude + latitudeDelta };
}

router.get('/nearby', async (request, response) => {
  const location = typeof request.query.location === 'string' ? request.query.location.trim().slice(0, 160) : '';
  const hasCoordinates = request.query.latitude !== undefined && request.query.longitude !== undefined;
  const latitude = hasCoordinates ? Number(request.query.latitude) : NaN;
  const longitude = hasCoordinates ? Number(request.query.longitude) : NaN;
  const radiusKm = Number(request.query.radiusKm || 5);
  const sort = request.query.sort === 'rating' ? 'rating' : 'distance';
  if (!location && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    return response.status(400).json({ error: 'Manzilni yozing yoki lokatsiyaga ruxsat bering.' });
  }
  if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 50) return response.status(400).json({ error: 'Qidiruv radiusi 1–50 km oralig‘ida bo‘lsin.' });

  try {
    const resolved = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, label: location || 'Joriy lokatsiya' }
      : await geocodeLocation(location);
    if (!resolved) return response.status(404).json({ error: 'Bu manzil topilmadi. Shahar yoki tuman nomini yozib ko‘ring.' });
    if (Math.abs(resolved.latitude) > 90 || Math.abs(resolved.longitude) > 180) return response.status(400).json({ error: 'Lokatsiya koordinatalari noto‘g‘ri.' });

    const googleKey = process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim();
    let gyms;
    if (googleKey) {
      const center = { latitude: resolved.latitude, longitude: resolved.longitude };
      gyms = [];
      let pageToken;
      for (let page = 0; page < 3; page += 1) {
        const body = {
          textQuery: `gyms and fitness centers near ${resolved.label}`,
          includedType: 'gym',
          locationBias: { circle: { center, radius: radiusKm * 1000 } },
          rankPreference: sort === 'distance' ? 'DISTANCE' : 'RELEVANCE',
          pageSize: 20,
          languageCode: 'uz',
          regionCode: 'UZ',
          ...(pageToken ? { pageToken } : {}),
        };
        const result = await fetch(GOOGLE_PLACES_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': googleKey, 'X-Goog-FieldMask': GOOGLE_FIELD_MASK },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12_000),
        });
        const data = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(data.error?.message || `Google Places returned ${result.status}.`);
        gyms.push(...(data.places || []).map(normalizeGooglePlace).filter(Boolean));
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } else {
      const bounds = boundsAround(resolved.latitude, resolved.longitude, radiusKm);
      gyms = await searchOpenStreetMap(bounds);
    }

    gyms = gyms.map((gym) => ({ ...gym, distanceKm: Number(distanceKm(resolved, gym).toFixed(1)) }))
      .filter((gym) => gym.distanceKm <= radiusKm)
      .sort(sort === 'rating'
        ? (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || a.distanceKm - b.distanceKm
        : (a, b) => a.distanceKm - b.distanceKm);
    return response.json({ gyms, source: googleKey ? 'Google Maps' : 'OpenStreetMap', location: resolved, radiusKm, sort });
  } catch (error) {
    console.warn('Nearby gym search provider unavailable:', error.message);
    return response.status(502).json({ error: 'Yaqin zallarni olishda xatolik. Birozdan so‘ng qayta urinib ko‘ring.' });
  }
});

function normalizeOsmPlace(feature) {
  const properties = feature.properties || {};
  const [longitude, latitude] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: `${properties.osm_type}/${properties.osm_id}`,
    name: properties.name || properties.osm_value || 'Sport zali',
    category: properties.osm_value === 'sports_centre' ? 'Sport markazi' : 'Fitness zal',
    address: [properties.street, properties.housenumber, properties.locality, properties.city].filter(Boolean).join(', '),
    latitude,
    longitude,
  };
}

async function searchOpenStreetMap(bounds) {
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  const searches = ['fitness', 'gym'].map(async (query) => {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('limit', '30');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('osm_tag', 'leisure:fitness_centre');
    const result = await fetch(url, {
      headers: { 'user-agent': 'GritMODE/1.0 gym finder' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!result.ok) throw new Error(`OpenStreetMap search returned ${result.status}.`);
    const data = await result.json();
    return (data.features || []).map(normalizeOsmPlace).filter(Boolean);
  });
  const results = await Promise.all(searches);
  return [...new Map(results.flat().map((gym) => [gym.id, gym])).values()].slice(0, 50);
}

router.get('/', async (request, response) => {
  const bounds = parseBounds(request.query.bbox);
  const area = typeof request.query.area === 'string' ? request.query.area.trim().slice(0, 160) : '';
  if (!bounds) return response.status(400).json({ error: 'Tuman xarita chegarasi noto‘g‘ri.' });

  try {
    const googleKey = process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim();
    const gyms = googleKey
      ? await searchGoogleGyms(bounds, area || 'Uzbekistan')
      : await searchOpenStreetMap(bounds);
    return response.json({ gyms, source: googleKey ? 'Google Maps' : 'OpenStreetMap' });
  } catch (error) {
    console.warn('Gym search provider unavailable:', error.message);
    return response.status(502).json({ error: 'Zallar ro‘yxatini olish muvaffaqiyatsiz tugadi. API kaliti va provider sozlamalarini tekshiring.' });
  }
});

export default router;
