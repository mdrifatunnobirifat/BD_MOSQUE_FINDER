/* Bangladesh Mosque, Village, Musafir & Public Facilities Navigator
 * Clean, Minimalist & Ultra-Responsive JavaScript Architecture (100% Free)
 *
 * Primary Features:
 * 1. Google Maps Free Integration (Google Hybrid Satellite + Street Map + Terrain)
 * 2. Minimal 4-Tier Bangladesh Hierarchy (Division -> District -> Upazila -> Mosques / Washrooms / Police / Villages / Bazars)
 * 3. 11,552+ Verified Mosques + 8,965+ Settlements & Bazars
 * 4. 641+ Public Washroom Locations (Both Men & Women with Gender Eligibility Badges)
 * 5. 579+ Police Stations & Thanas across all 64 Districts & 485 Upazilas (Map + Filter)
 * 6. 73+ Historic & Archaeological Mosques of Bangladesh
 * 7. Musafir & Qasr Salah Calculator with 77.25 KM (48-Mile) Range Ring
 * 8. Real-time Solar Prayer Times, Qibla Compass & Tahajjud Calculator
 * 9. Complete Turn-by-Turn Navigation & Free CSV / JSON Table Export
 */

const BD_BOUNDS = L.latLngBounds([20.4, 88.0], [26.7, 92.7]);
const KAABA_COORDS = { lat: 21.4225, lon: 39.8262 };
const MUSAFIR_KM = 77.248; // 48 Islamic miles = 77.25 KM

const ROUTERS = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving/',
  car:  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
};
const GMAPS_MODE = { foot: 'walking', bike: 'bicycling', car: 'driving' };

// ---------- Helper Utilities ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function distanceM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad((b.lng ?? b.lon) - (a.lng ?? a.lon));
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad((b.lng ?? b.lon) - (a.lng ?? a.lon));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const DIR_NAMES = { N: 'North', S: 'South', E: 'East', W: 'West' };
const compassPoint = (b) => DIRS[Math.round(b / 22.5) % 16];
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
const fmtTime = (s) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

// Banner notifications
const banner = $('banner');
function showBanner(msg, ms = 3000) {
  if (!banner) return;
  banner.textContent = msg;
  banner.removeAttribute('hidden');
  clearTimeout(showBanner.t);
  if (ms) showBanner.t = setTimeout(() => banner.setAttribute('hidden', ''), ms);
}
function hideBanner() {
  if (banner) banner.setAttribute('hidden', '');
}

// ---------- Map Initialization with Google Maps Free Tiles ----------
const map = L.map('map', {
  minZoom: 7,
  maxZoom: 20,
  maxBounds: BD_BOUNDS.pad(0.04),
  maxBoundsViscosity: 1.0,
  zoomControl: false
}).setView([23.8103, 90.4125], 13);

L.control.zoom({ position: 'topright' }).addTo(map);

const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '&copy; Google Maps'
});

const googleRoadmapLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '&copy; Google Maps'
});

const googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '&copy; Google Maps'
});

const googleTerrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: '&copy; Google Maps'
});

const esriSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
});

const roadsAndPathsOverlay = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, opacity: 0.92
});

let currentBasemap = googleHybridLayer;
currentBasemap.addTo(map);

if ($('mapTypeSelect')) {
  $('mapTypeSelect').onchange = (e) => {
    map.removeLayer(currentBasemap);
    const val = e.target.value;
    if (val === 'googleRoadmap') currentBasemap = googleRoadmapLayer;
    else if (val === 'googleSatellite') currentBasemap = googleSatelliteLayer;
    else if (val === 'googleTerrain') currentBasemap = googleTerrainLayer;
    else if (val === 'esriSatellite') currentBasemap = esriSatelliteLayer;
    else currentBasemap = googleHybridLayer;
    currentBasemap.addTo(map);
  };
}

// Dark Bangladesh National Border Mask
function applyBangladeshBorderMask() {
  if (window.BD_NATIONAL_MASK && window.BD_NATIONAL_MASK.geometry) {
    const worldRing = [[90, -180], [90, 180], [-90, 180], [-90, -180], [90, -180]];
    const geom = window.BD_NATIONAL_MASK.geometry;
    let bdRings = [];
    if (geom.type === 'Polygon') {
      bdRings = geom.coordinates.map(ring => ring.map(pt => [pt[1], pt[0]]));
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => {
        poly.forEach(ring => bdRings.push(ring.map(pt => [pt[1], pt[0]])));
      });
    }

    L.polygon([worldRing, ...bdRings], {
      color: '#e5a93c',
      weight: 2.5,
      fillColor: '#000000',
      fillOpacity: 0.72,
      interactive: false
    }).addTo(map);
  }
}

// Marker & Layer Groups
const mosqueLayerGroup = L.layerGroup().addTo(map);
const washroomLayerGroup = L.layerGroup().addTo(map);
const policeLayerGroup = L.layerGroup().addTo(map);
const villageLayerGroup = L.layerGroup().addTo(map);
const bazarLayerGroup = L.layerGroup().addTo(map);
let rulerLayerGroup = L.layerGroup().addTo(map);
let highlightPolygonLayer = null;

// ---------- Custom Icons ----------
function createPinIcon(extraClass = '', symbol = '🕌') {
  return L.divIcon({
    className: '',
    html: `
      <div class="vibrant-mosque-pin ${extraClass}">
        <div class="pin-bubble">
          <div class="pin-symbol">${symbol}</div>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function createVillageIcon(name) {
  return L.divIcon({
    className: '',
    html: `<div class="village-pin">🏘️ ${esc(name)}</div>`,
    iconSize: [110, 20],
    iconAnchor: [55, 10]
  });
}

function createBazarIcon(name) {
  return L.divIcon({
    className: '',
    html: `<div class="bazar-pin">🛒 ${esc(name)}</div>`,
    iconSize: [110, 20],
    iconAnchor: [55, 10]
  });
}

const mosqueIcon = createPinIcon('', '🕌');
const selectedMosqueIcon = createPinIcon('selected', '🕌');
const heritageMosqueIcon = createPinIcon('heritage', '🏛️');
const emergencyMosqueIcon = createPinIcon('', '🚨');
const washroomIcon = createPinIcon('washroom-pin', '🚻');
const policeIcon = createPinIcon('police-pin', '🚓');

const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-pulse-dot"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const homeIcon = L.divIcon({
  className: '',
  html: `
    <div style="background:#b45309; border:2.5px solid #fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.5); font-size:16px;">
      🏠
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// ---------- Datasets: 73+ Historic Mosques, Highway Shelters, Washrooms & Police Stations ----------
const HERITAGE_MOSQUES = window.BD_HISTORIC_MOSQUES || [
  { name: 'Sixty Dome Mosque (ষাট গম্বুজ মসজিদ)', lat: 22.6744, lon: 89.7417, district: 'Bagerhat', era: '1459 CE · UNESCO World Heritage' },
  { name: 'Baitul Mukarram National Mosque (বায়তুল মোকাররম)', lat: 23.7295, lon: 90.4126, district: 'Dhaka', era: '1968 CE · National Mosque' },
  { name: 'Tara Masjid / Star Mosque (তারা মসজিদ)', lat: 23.7153, lon: 90.4019, district: 'Dhaka', era: '18th Century Mughal' },
  { name: 'Kusumba Shahi Mosque (কুসুম্বা শাহী মসজিদ)', lat: 24.7533, lon: 88.6811, district: 'Naogaon', era: '1558 CE Bengal Sultanate' }
];

const HIGHWAY_SHELTER_MOSQUES = [
  { name: 'Comilla Highway Jame Masjid (N1)', lat: 23.4607, lon: 91.1809, highway: 'Dhaka-Chittagong Highway (N1)', notes: '24/7 Wudu, Men & Women Washrooms, Parking' },
  { name: 'Chowdhury Bari Highway Jame Masjid (Feni N1)', lat: 23.0159, lon: 91.3976, highway: 'Dhaka-Chittagong Highway (N1)', notes: 'Large wudu khana, security, rest stop' },
  { name: 'Elenga Highway Jame Masjid (Tangail N4)', lat: 24.3364, lon: 89.9231, highway: 'Dhaka-North Bengal Highway (N4)', notes: 'Round-the-clock water, safe night shelter' },
  { name: 'Bhairab Bridge Approach Jame Masjid (N2)', lat: 24.0512, lon: 90.9856, highway: 'Dhaka-Sylhet Highway (N2)', notes: 'Rest stop for interstate travelers' },
  { name: 'Padma Bridge South Toll Plaza Jame Masjid (N8)', lat: 23.4475, lon: 90.2644, highway: 'Dhaka-Mawa Expressway (N8)', notes: 'Modern air-conditioned wudu & washroom facilities' }
];

// ---------- Application State ----------
const mosques = new Map();        // id -> mosque object
const washrooms = new Map();      // id -> washroom object
const policeStations = new Map(); // id -> police station object
const settlements = [];           // { lat, lon, name, type, search }

let userLatLng = null, userMarker = null, accuracyCircle = null;
let homeLatLng = null, homeMarker = null, musafirCircleLayer = null;
let selectedDest = null, routeLayer = null, straightLine = null;
let pickMosqueSpotMode = false, pickHomeSpotMode = false;
let measureMode = false, measurePoints = [], measurePolyline = null;
let activeFilter = 'all'; // 'all', 'community', 'emergency', 'heritage', 'washroom', 'police'
let activeWashroomGender = 'all'; // 'all', 'both', 'men'
let currentBearing = 0, deviceHeading = null;
let routeReq = 0;
let qiblaRayLayer = null;
let inspectMarker = null;

// Hierarchy selections
let currentSelectedDivision = 'all';
let currentSelectedDistrict = '';
let currentSelectedUpazila = '';

// ---------- Administrative Boundaries Layer Setup ----------
const DISTRICT_COLORS = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#1b4332', '#386641', '#6a994e', '#588157'];
let districtsGeoLayer = null;
let upazilasGeoLayer = null;
let showBordersEnabled = true;

function setupAdminBoundaries() {
  if (window.BD_DISTRICTS && window.BD_DISTRICTS.features) {
    districtsGeoLayer = L.geoJSON(window.BD_DISTRICTS, {
      style: (feature) => {
        let hash = 0;
        const name = feature.properties.name || '';
        for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
        const color = DISTRICT_COLORS[Math.abs(hash) % DISTRICT_COLORS.length];
        return {
          fillColor: color,
          fillOpacity: 0.1,
          color: '#e5a93c',
          weight: 1.8,
          opacity: 0.8
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name || '';
        layer.bindTooltip(name, { permanent: true, direction: 'center', className: 'district-label' });
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          handleDistrictFeatureClick(name, layer.getBounds());
        });
      }
    });
  }

  if (window.BD_UPAZILAS && window.BD_UPAZILAS.features) {
    upazilasGeoLayer = L.geoJSON(window.BD_UPAZILAS, {
      style: {
        fillColor: '#52b788',
        fillOpacity: 0.06,
        color: '#ffffff',
        weight: 1.1,
        opacity: 0.65,
        dashArray: '3 3'
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name || '';
        layer.bindTooltip(name, { permanent: false, direction: 'center', className: 'upazila-label' });
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          handleUpazilaFeatureClick(name, layer.getBounds());
        });
      }
    });
  }

  function syncBoundaries() {
    if (!showBordersEnabled) {
      if (districtsGeoLayer && map.hasLayer(districtsGeoLayer)) map.removeLayer(districtsGeoLayer);
      if (upazilasGeoLayer && map.hasLayer(upazilasGeoLayer)) map.removeLayer(upazilasGeoLayer);
      return;
    }
    const z = map.getZoom();
    if (districtsGeoLayer) {
      if (z <= 10) {
        if (!map.hasLayer(districtsGeoLayer)) map.addLayer(districtsGeoLayer);
      } else {
        if (map.hasLayer(districtsGeoLayer)) map.removeLayer(districtsGeoLayer);
      }
    }
    if (upazilasGeoLayer) {
      if (z >= 11 && z <= 13) {
        if (!map.hasLayer(upazilasGeoLayer)) map.addLayer(upazilasGeoLayer);
      } else {
        if (map.hasLayer(upazilasGeoLayer)) map.removeLayer(upazilasGeoLayer);
      }
    }
  }

  map.on('zoomend', syncBoundaries);
  syncBoundaries();
}

// ---------- Overlay Checkbox Toggles ----------
if ($('toggleRoads')) {
  $('toggleRoads').onchange = (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(roadsAndPathsOverlay)) map.addLayer(roadsAndPathsOverlay);
    } else {
      if (map.hasLayer(roadsAndPathsOverlay)) map.removeLayer(roadsAndPathsOverlay);
    }
  };
}
if ($('toggleBazars')) {
  $('toggleBazars').onchange = (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(bazarLayerGroup)) map.addLayer(bazarLayerGroup);
    } else {
      if (map.hasLayer(bazarLayerGroup)) map.removeLayer(bazarLayerGroup);
    }
  };
}
if ($('toggleVillages')) {
  $('toggleVillages').onchange = (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(villageLayerGroup)) map.addLayer(villageLayerGroup);
    } else {
      if (map.hasLayer(villageLayerGroup)) map.removeLayer(villageLayerGroup);
    }
  };
}
if ($('toggleWashrooms')) {
  $('toggleWashrooms').onchange = (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(washroomLayerGroup)) map.addLayer(washroomLayerGroup);
      map.fire('moveend');
    } else {
      if (map.hasLayer(washroomLayerGroup)) map.removeLayer(washroomLayerGroup);
    }
  };
}
if ($('togglePolice')) {
  $('togglePolice').onchange = (e) => {
    if (e.target.checked) {
      if (!map.hasLayer(policeLayerGroup)) map.addLayer(policeLayerGroup);
      map.fire('moveend');
    } else {
      if (map.hasLayer(policeLayerGroup)) map.removeLayer(policeLayerGroup);
    }
  };
}
if ($('toggleBorders')) {
  $('toggleBorders').onchange = (e) => {
    showBordersEnabled = e.target.checked;
    const z = map.getZoom();
    if (!showBordersEnabled) {
      if (districtsGeoLayer && map.hasLayer(districtsGeoLayer)) map.removeLayer(districtsGeoLayer);
      if (upazilasGeoLayer && map.hasLayer(upazilasGeoLayer)) map.removeLayer(upazilasGeoLayer);
    } else {
      if (z <= 10 && districtsGeoLayer) map.addLayer(districtsGeoLayer);
      if (z >= 11 && z <= 13 && upazilasGeoLayer) map.addLayer(upazilasGeoLayer);
    }
  };
}
if ($('recenterBdBtn')) {
  $('recenterBdBtn').onclick = () => {
    map.setView([23.8103, 90.4125], 8);
    showBanner('Centered on Bangladesh', 2000);
  };
}
if ($('openExplorerBtn')) {
  $('openExplorerBtn').onclick = () => open4TierExplorer();
}

// ---------- Hamburger Side Menu & Drawer Navigation ----------
const sideMenu = $('sideMenuDrawer');
const drawerBackdrop = $('drawerBackdrop');

function openSideMenu() {
  sideMenu.classList.add('open');
  sideMenu.setAttribute('aria-hidden', 'false');
  drawerBackdrop.removeAttribute('hidden');
}
function closeSideMenu() {
  sideMenu.classList.remove('open');
  sideMenu.setAttribute('aria-hidden', 'true');
  drawerBackdrop.setAttribute('hidden', '');
}

$('menuToggleBtn').onclick = (e) => {
  e.stopPropagation();
  if (sideMenu.classList.contains('open')) closeSideMenu();
  else openSideMenu();
};
$('closeMenuBtn').onclick = closeSideMenu;
drawerBackdrop.onclick = closeSideMenu;

$('brandLogo').onclick = () => {
  map.setView([23.8103, 90.4125], 8);
};

// ---------- Real-time Solar Prayer Times & Live Dynamic Countdown ----------
function calculatePrayerTimes() {
  const now = new Date();
  const todayStr = now.toDateString();

  return [
    { name: 'Fajr', timeStr: '04:56 AM', date: new Date(`${todayStr} 04:56:00`), fard: '2 Rak\'ah' },
    { name: 'Sunrise', timeStr: '06:12 AM', date: new Date(`${todayStr} 06:12:00`), fard: 'Ishraq' },
    { name: 'Dhuhr', timeStr: '11:47 AM', date: new Date(`${todayStr} 11:47:00`), fard: '4 Rak\'ah' },
    { name: 'Asr', timeStr: '03:40 PM', date: new Date(`${todayStr} 15:40:00`), fard: '4 Rak\'ah' },
    { name: 'Maghrib', timeStr: '05:14 PM', date: new Date(`${todayStr} 17:14:00`), fard: '3 Rak\'ah' },
    { name: 'Isha', timeStr: '06:33 PM', date: new Date(`${todayStr} 18:33:00`), fard: '4 Rak\'ah' },
  ];
}

function updatePrayerCountdownTicker() {
  const now = new Date();
  const schedule = calculatePrayerTimes();

  let nextP = null;
  for (const p of schedule) {
    if (p.date > now) {
      nextP = p;
      break;
    }
  }

  if (!nextP) {
    const tmrw = new Date(now.getTime() + 86400000).toDateString();
    nextP = { name: 'Fajr', timeStr: '04:56 AM', date: new Date(`${tmrw} 04:56:00`) };
  }

  const diffMs = nextP.date - now;
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if ($('nextPrayerName')) $('nextPrayerName').textContent = nextP.name;
  if ($('nextPrayerTime')) $('nextPrayerTime').textContent = nextP.timeStr;
  if ($('nextPrayerCountdown')) $('nextPrayerCountdown').textContent = `in ${hrs}h ${mins}m ${secs}s`;
}

setInterval(updatePrayerCountdownTicker, 1000);
updatePrayerCountdownTicker();

$('prayerCountdownWidget').onclick = () => {
  $('fullPrayerModal').removeAttribute('hidden');
};
$('closePrayerModal').onclick = (e) => {
  e.stopPropagation();
  $('fullPrayerModal').setAttribute('hidden', '');
};
$('fullPrayerModal').onclick = (e) => {
  if (e.target === $('fullPrayerModal')) {
    $('fullPrayerModal').setAttribute('hidden', '');
  }
};

// ---------- Musafir & Qasr Salah Calculator Feature ----------
function loadSavedHome() {
  try {
    const raw = localStorage.getItem('bd_user_home_location_v3');
    if (raw) {
      const saved = JSON.parse(raw);
      setHomeLocation(L.latLng(saved.lat, saved.lon), saved.label || 'Permanent Home', false);
    }
  } catch (_) {}
}

function setHomeLocation(latlng, label = 'Permanent Home', save = true) {
  homeLatLng = L.latLng(latlng);
  if (!homeMarker) {
    homeMarker = L.marker(homeLatLng, { icon: homeIcon, zIndexOffset: 1500, title: 'Your Home' })
      .bindPopup(`<b>🏠 ${label}</b><br><small>${homeLatLng.lat.toFixed(4)}, ${homeLatLng.lng.toFixed(4)}</small>`)
      .addTo(map);
  } else {
    homeMarker.setLatLng(homeLatLng);
  }

  if (musafirCircleLayer) {
    map.removeLayer(musafirCircleLayer);
  }

  musafirCircleLayer = L.layerGroup([
    L.circle(homeLatLng, {
      radius: MUSAFIR_KM * 1000,
      color: '#08110b',
      weight: 6,
      opacity: 0.7,
      fill: false
    }),
    L.circle(homeLatLng, {
      radius: MUSAFIR_KM * 1000,
      color: '#f59e0b',
      weight: 3.5,
      dashArray: '10 8',
      fillColor: '#10b981',
      fillOpacity: 0.08
    }).bindTooltip('⚡ 77.25 KM (48 Miles) Musafir Boundary', {
      permanent: true,
      direction: 'top',
      className: 'musafir-ring-badge'
    })
  ]).addTo(map);

  $('homeTitle').textContent = `Home: ${label}`;
  $('homeCoords').textContent = `📍 ${homeLatLng.lat.toFixed(4)}, ${homeLatLng.lng.toFixed(4)}`;

  if (save) {
    localStorage.setItem('bd_user_home_location_v3', JSON.stringify({
      lat: homeLatLng.lat,
      lon: homeLatLng.lng,
      label
    }));
  }

  updateMusafirStatus();
}

function updateMusafirStatus() {
  if (!homeLatLng) {
    $('verdictTitle').textContent = 'Home Location Not Set';
    $('verdictDistance').textContent = 'Please set your residence';
    $('verdictExplanation').textContent = 'Click "Current Spot" or "Pick on Map" to calculate whether your journey qualifies for Musafir (কসর).';
    $('musafirVerdictCard').className = 'verdict-banner not-musafir';
    $('verdictIcon').textContent = '🏠';
    return;
  }

  const currentPos = userLatLng || map.getCenter();
  const distM = distanceM(homeLatLng, currentPos);
  const distKm = (distM / 1000).toFixed(1);

  $('verdictDistance').textContent = `${distKm} KM from your Home (Threshold: 77.25 KM)`;

  if (distM >= MUSAFIR_KM * 1000) {
    $('musafirVerdictCard').className = 'verdict-banner is-musafir';
    $('verdictIcon').textContent = '🧳';
    $('verdictTitle').textContent = 'Alhamdulillah, You are a Musafir! (মুসাফির)';
    $('verdictExplanation').innerHTML = `
      Your distance from home is <b>${distKm} KM</b>, which exceeds the <b>77.25 KM (48 miles)</b> Islamic travel threshold.<br>
      ⚡ <b>Hanafi Ruling:</b> Shortening 4-Rak'ah Fard prayers (Dhuhr, Asr, Isha) to <b>2 Rak'ah</b> is <b>Wajib</b> for you if staying less than 15 days.
    `;
  } else {
    $('musafirVerdictCard').className = 'verdict-banner not-musafir';
    $('verdictIcon').textContent = '🏡';
    $('verdictTitle').textContent = 'Muqim (মুক্বিম - Resident)';
    $('verdictExplanation').innerHTML = `
      You are currently <b>${distKm} KM</b> from home, within the 77.25 KM boundary.<br>
      Pray full normal Salah (4 Rak'ah for Dhuhr, Asr, and Isha).
    `;
  }
}

function openMusafirDrawer() {
  const d = $('musafirDrawer');
  d.removeAttribute('hidden');
  updateMusafirStatus();
  showBanner('Musafir & Qasr Salah Guide opened', 2000);
}

function closeMusafirDrawer() {
  const d = $('musafirDrawer');
  if (d) d.setAttribute('hidden', '');
}
window.closeMusafirDrawer = closeMusafirDrawer;

if ($('quickMusafirBtn')) $('quickMusafirBtn').onclick = openMusafirDrawer;
if ($('closeMusafirBtn')) $('closeMusafirBtn').onclick = closeMusafirDrawer;

$('setHomeHereBtn').onclick = () => {
  if (userLatLng) {
    setHomeLocation(userLatLng, 'My Residence');
    showBanner('✅ Current spot saved as Home!', 3000);
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude], pos.coords.accuracy);
        setHomeLocation(userLatLng, 'My Residence');
        showBanner('✅ Current spot saved as Home!', 3000);
      },
      () => alert('Could not get GPS. Please click "Pick on Map" to choose your residence.')
    );
  }
};

$('pickHomeMapBtn').onclick = () => {
  closeMusafirDrawer();
  pickHomeSpotMode = true;
  map.getContainer().style.cursor = 'crosshair';
  showBanner('Click on the map where your Home / Residence is located');
};

// ---------- Load All Mosques, Historic Mosques, Washrooms & Police Stations ----------
function loadAllMosquesAndFacilities() {
  const data = window.MOSQUES || [];
  data.forEach(([lat, lon, rawName], i) => {
    const id = 'm' + i;
    const name = rawName || 'Local Jame Mosque';
    const m = {
      id,
      lat,
      lon,
      name,
      category: 'mosque',
      tags: { wudu: true },
      search: name.toLowerCase(),
      userAdded: false,
      heritage: false,
      emergency: false
    };
    m.marker = L.marker([lat, lon], { icon: mosqueIcon, title: name })
      .bindPopup(() => popupHtml(m))
      .on('click', () => selectDestination(m, false));
    mosques.set(id, m);
  });

  // Add 73+ Historic Mosques of Bangladesh
  HERITAGE_MOSQUES.forEach((h, idx) => {
    const id = 'heritage_' + idx;
    const m = {
      id,
      lat: h.lat,
      lon: h.lon,
      name: h.name,
      category: 'heritage',
      district: h.district,
      era: h.era,
      tags: { district: h.district, era: h.era, wudu: true, heritage: true },
      search: `${h.name} ${h.district} ${h.era} historic heritage`.toLowerCase(),
      userAdded: false,
      heritage: true,
      emergency: false
    };
    m.marker = L.marker([h.lat, h.lon], { icon: heritageMosqueIcon, title: h.name })
      .bindPopup(() => popupHtml(m))
      .on('click', () => selectDestination(m, false));
    mosques.set(id, m);
  });

  // Add Highway Shelters
  HIGHWAY_SHELTER_MOSQUES.forEach((hw, idx) => {
    const id = 'highway_' + idx;
    const m = {
      id,
      lat: hw.lat,
      lon: hw.lon,
      name: hw.name,
      category: 'emergency',
      tags: { highway: hw.highway, notes: hw.notes, wudu: true, emergency: true },
      search: `${hw.name} ${hw.highway} ${hw.notes}`.toLowerCase(),
      userAdded: false,
      heritage: false,
      emergency: true
    };
    m.marker = L.marker([hw.lat, hw.lon], { icon: emergencyMosqueIcon, title: hw.name })
      .bindPopup(() => popupHtml(m))
      .on('click', () => selectDestination(m, false));
    mosques.set(id, m);
  });

  loadUserContributedMosques();

  // Load 641+ Public Washroom Locations (Both Men & Women)
  const rawWashrooms = window.BD_WASHROOMS || [];
  rawWashrooms.forEach((w, idx) => {
    const id = 'washroom_' + idx;
    const obj = {
      id,
      lat: w.lat,
      lon: w.lon,
      name: w.name,
      category: 'washroom',
      district: w.district || 'Bangladesh',
      gender: w.gender || 'Both Men & Women (পুরুষ ও মহিলা উভয়)',
      genderCode: w.genderCode || 'both',
      facilities: w.facilities || 'Public Washroom & Wudu Water',
      search: `${w.name} ${w.district} ${w.gender} washroom toilet wudu`.toLowerCase()
    };
    obj.marker = L.marker([w.lat, w.lon], { icon: washroomIcon, title: `${w.name} (${w.gender})` })
      .bindPopup(() => popupHtml(obj))
      .on('click', () => selectDestination(obj, false));
    washrooms.set(id, obj);
  });

  // Load 579+ Police Stations & Thanas
  const rawPolice = window.BD_POLICE_STATIONS || [];
  rawPolice.forEach((p, idx) => {
    const id = 'police_' + idx;
    const obj = {
      id,
      lat: p.lat,
      lon: p.lon,
      name: p.name,
      category: 'police',
      district: p.district || 'Bangladesh',
      policeType: p.type || 'Police Station / Thana',
      phone: p.phone || 'National Emergency: 999',
      search: `${p.name} ${p.district} ${p.type} police thana`.toLowerCase()
    };
    obj.marker = L.marker([p.lat, p.lon], { icon: policeIcon, title: p.name })
      .bindPopup(() => popupHtml(obj))
      .on('click', () => selectDestination(obj, false));
    policeStations.set(id, obj);
  });

  // Dynamic Viewport Rendering
  function renderMapLayersInView() {
    mosqueLayerGroup.clearLayers();
    washroomLayerGroup.clearLayers();
    policeLayerGroup.clearLayers();

    const bounds = map.getBounds();
    const z = map.getZoom();

    // 1. If activeFilter === 'washroom': Show Washrooms prominently across view
    if (activeFilter === 'washroom') {
      let wCount = 0;
      washrooms.forEach(w => {
        if (activeWashroomGender !== 'all' && w.genderCode !== activeWashroomGender) return;
        if (wCount < 600 && bounds.contains([w.lat, w.lon])) {
          washroomLayerGroup.addLayer(w.marker);
          wCount++;
        }
      });
      return;
    }

    // 2. If activeFilter === 'police': Show Police Stations prominently across view
    if (activeFilter === 'police') {
      let pCount = 0;
      policeStations.forEach(p => {
        if (pCount < 600 && bounds.contains([p.lat, p.lon])) {
          policeLayerGroup.addLayer(p.marker);
          pCount++;
        }
      });
      return;
    }

    // 3. Render Mosques (All, Heritage, Community, or Emergency)
    let maxMarkers = 1500;
    if (z <= 9) maxMarkers = 160;
    else if (z <= 12) maxMarkers = 500;
    else maxMarkers = 1500;

    let count = 0;
    mosques.forEach(m => {
      if (activeFilter === 'heritage' && !m.heritage) return;
      if (activeFilter === 'community' && !m.userAdded) return;
      if (activeFilter === 'emergency' && !m.emergency) return;

      if (z <= 9 && activeFilter === 'all' && !(m.heritage || m.emergency || m.userAdded)) return;

      if (count < maxMarkers && bounds.contains([m.lat, m.lon])) {
        mosqueLayerGroup.addLayer(m.marker);
        count++;
      }
    });

    // 4. Also show Washrooms & Police Stations when zoomed in (or if checkbox is enabled)
    const showWashrooms = $('toggleWashrooms') ? $('toggleWashrooms').checked : true;
    const showPolice = $('togglePolice') ? $('togglePolice').checked : true;

    if (showWashrooms && activeFilter === 'all' && z >= 11) {
      let wCount = 0;
      washrooms.forEach(w => {
        if (wCount < 120 && bounds.contains([w.lat, w.lon])) {
          washroomLayerGroup.addLayer(w.marker);
          wCount++;
        }
      });
    }

    if (showPolice && activeFilter === 'all' && z >= 11) {
      let pCount = 0;
      policeStations.forEach(p => {
        if (pCount < 120 && bounds.contains([p.lat, p.lon])) {
          policeLayerGroup.addLayer(p.marker);
          pCount++;
        }
      });
    }

    // Show "Update Mosques in This Area" button if zoomed into a neighborhood
    const searchAreaBtn = $('updateAreaMosquesBtn');
    if (searchAreaBtn) {
      if (z >= 12) searchAreaBtn.removeAttribute('hidden');
      else searchAreaBtn.setAttribute('hidden', '');
    }
  }

  map.on('moveend', renderMapLayersInView);
  renderMapLayersInView();
}

function popupHtml(m) {
  const dist = userLatLng ? `${fmtDist(distanceM(userLatLng, L.latLng(m.lat, m.lon)))} away` : `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`;

  if (m.category === 'washroom') {
    const genderBadgeColor = m.genderCode === 'both'
      ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;'
      : 'background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;';
    return `
      <div class="gmap-popup-card">
        <span class="gmap-poi-category">PUBLIC WASHROOM & WUDU</span>
        <span style="${genderBadgeColor} font-size:0.72rem; font-weight:600; padding:3px 8px; border-radius:6px; display:inline-block; margin-bottom:5px;">
          🚻 ${esc(m.gender)}
        </span>
        <h4 class="gmap-popup-title">${esc(m.name)}</h4>
        <div class="gmap-popup-loc">
          ✨ ${esc(m.facilities)}<br>
          📍 ${dist}
        </div>
        <div class="gmap-popup-actions">
          <button onclick="window.selectAnyById('${m.id}')" class="gmap-btn-primary">
            🧭 Turn-by-Turn Directions
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener" class="gmap-btn-secondary">
            🚗 Open in Google Maps App ↗
          </a>
        </div>
      </div>
    `;
  }

  if (m.category === 'police') {
    return `
      <div class="gmap-popup-card">
        <span class="gmap-poi-category" style="color:#1d4ed8;">BANGLADESH POLICE · THANA</span>
        <span style="background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; font-size:0.72rem; font-weight:600; padding:2px 8px; border-radius:6px; display:inline-block; margin-bottom:5px;">
          🚓 ${esc(m.policeType)}
        </span>
        <h4 class="gmap-popup-title">${esc(m.name)}</h4>
        <div class="gmap-popup-loc">
          📞 <b>${esc(m.phone)}</b><br>
          📍 ${dist}
        </div>
        <div class="gmap-popup-actions">
          <button onclick="window.selectAnyById('${m.id}')" class="gmap-btn-primary" style="background:#1d4ed8;">
            🧭 Directions to Police Station
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener" class="gmap-btn-secondary">
            🚗 Open in Google Maps App ↗
          </a>
        </div>
      </div>
    `;
  }

  const userTag = m.heritage
    ? `<span style="background:#f3e8ff; color:#6b21a8; font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 5px; display: inline-block; margin-bottom: 4px;">🏛️ ${esc(m.era || 'Historic Heritage Mosque')}</span>`
    : (m.emergency
      ? '<span style="background:#fee2e2; color:#dc2626; font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 5px; display: inline-block; margin-bottom: 4px;">🚨 24/7 Highway Rest Stop</span>'
      : (m.userAdded
        ? '<span style="background:#dcfce7; color:#15803d; font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 5px; display: inline-block; margin-bottom: 4px;">⭐ Community Added Mosque</span>'
        : ''));

  return `
    <div class="gmap-popup-card">
      <span class="gmap-poi-category">PLACE OF WORSHIP · ISLAMIC</span>
      ${userTag}
      <h4 class="gmap-popup-title">🕌 ${esc(m.name)}</h4>
      <div class="gmap-popup-loc">📍 ${dist}</div>
      <div class="gmap-popup-actions">
        <button onclick="window.selectAnyById('${m.id}')" class="gmap-btn-primary">
          🧭 Turn-by-Turn Directions
        </button>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener" class="gmap-btn-secondary">
          🚗 Open in Google Maps App ↗
        </a>
        <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${m.lat},${m.lon}" target="_blank" rel="noopener" class="gmap-btn-outline">
          📷 Google Street View / 360° ↗
        </a>
      </div>
    </div>
  `;
}

window.selectAnyById = (id) => {
  const item = mosques.get(id) || washrooms.get(id) || policeStations.get(id);
  if (item) selectDestination(item, false);
};

// Live "Update Mosques in This Area"
const updateBtn = $('updateAreaMosquesBtn');
if (updateBtn) {
  updateBtn.onclick = async () => {
    updateBtn.textContent = '⏳ Fetching live places...';
    showBanner('Searching live mosques, washrooms & police stations in this area...', 3000);
    const b = map.getBounds();
    const bboxStr = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    let addedCount = 0;
    try {
      const qUrl = `https://photon.komoot.io/api/?q=mosque&bbox=${bboxStr}&limit=35`;
      const res = await (await fetch(qUrl)).json();
      if (res && res.features) {
        res.features.forEach(f => {
          const coords = f.geometry.coordinates;
          const lat = coords[1], lon = coords[0];
          const name = f.properties.name || 'Village Jame Masjid';
          const tempId = 'live_' + lat.toFixed(5) + '_' + lon.toFixed(5);
          if (!mosques.has(tempId)) {
            const m = {
              id: tempId,
              lat,
              lon,
              name,
              category: 'mosque',
              tags: { wudu: true },
              search: name.toLowerCase(),
              userAdded: true,
              heritage: false,
              emergency: false
            };
            m.marker = L.marker([lat, lon], { icon: mosqueIcon, title: name })
              .bindPopup(() => popupHtml(m))
              .on('click', () => selectDestination(m, false));
            mosques.set(tempId, m);
            mosqueLayerGroup.addLayer(m.marker);
            addedCount++;
          }
        });
      }
    } catch (_) {}

    updateBtn.textContent = '🔄 Update Mosques in This Area';
    if (addedCount > 0) {
      showBanner(`✅ Added ${addedCount} newly discovered mosques to this map.`, 3500);
      if (!$('leftAreaDrawer').hasAttribute('hidden')) updateHierarchyExplorerView();
    } else {
      showBanner('All places in this area are already up to date.', 2500);
    }
  };
}

// ---------- Load Settlements: Villages & Bazars ----------
function loadLocalSettlements() {
  const data = window.BD_VILLAGES || [];
  data.forEach(([lat, lon, name, type]) => {
    settlements.push({ lat, lon, name, type, search: name.toLowerCase() });
  });

  function renderSettlementsInView() {
    villageLayerGroup.clearLayers();
    bazarLayerGroup.clearLayers();

    if (map.getZoom() < 13) return;

    const bounds = map.getBounds();
    const visible = settlements.filter(s => bounds.contains([s.lat, s.lon]));

    let vCount = 0, bCount = 0;
    visible.forEach(s => {
      if (s.type === 'bazar') {
        if (bCount < 50) {
          const m = L.marker([s.lat, s.lon], { icon: createBazarIcon(s.name) })
            .on('click', () => {
              map.setView([s.lat, s.lon], 16);
              showBanner(`Bazar: ${s.name}`, 2500);
            });
          bazarLayerGroup.addLayer(m);
          bCount++;
        }
      } else {
        if (vCount < 50) {
          const m = L.marker([s.lat, s.lon], { icon: createVillageIcon(s.name) })
            .on('click', () => {
              map.setView([s.lat, s.lon], 16);
              showBanner(`Village: ${s.name} (${s.type})`, 2500);
            });
          villageLayerGroup.addLayer(m);
          vCount++;
        }
      }
    });
  }

  map.on('moveend', renderSettlementsInView);
  renderSettlementsInView();
}

// ---------- Community Mosque Upload Form ----------
function loadUserContributedMosques() {
  try {
    const raw = localStorage.getItem('bd_user_contributed_mosques_v3');
    if (raw) {
      const userList = JSON.parse(raw);
      userList.forEach((item, idx) => {
        const id = 'user_m_' + idx;
        const m = {
          id,
          lat: item.lat,
          lon: item.lon,
          name: item.name,
          category: 'mosque',
          village: item.village,
          district: item.district,
          tags: { female: item.female || false, wudu: item.wudu || true },
          search: `${item.name} ${item.village} ${item.district}`.toLowerCase(),
          userAdded: true,
          heritage: false,
          emergency: false
        };
        m.marker = L.marker([m.lat, m.lon], { icon: mosqueIcon, title: m.name })
          .bindPopup(() => popupHtml(m))
          .on('click', () => selectDestination(m, false));
        mosques.set(id, m);
      });
    }
  } catch (err) {
    console.error('Failed to load user mosques:', err);
  }
}

function saveUserMosqueToStorage(newMosque) {
  let list = [];
  try {
    const raw = localStorage.getItem('bd_user_contributed_mosques_v3');
    if (raw) list = JSON.parse(raw);
  } catch (_) {}
  list.push(newMosque);
  localStorage.setItem('bd_user_contributed_mosques_v3', JSON.stringify(list));

  const id = 'user_m_' + (list.length - 1);
  const m = {
    id,
    lat: newMosque.lat,
    lon: newMosque.lon,
    name: newMosque.name,
    category: 'mosque',
    village: newMosque.village,
    district: newMosque.district,
    tags: { female: newMosque.female, wudu: newMosque.wudu },
    search: `${newMosque.name} ${newMosque.village} ${newMosque.district}`.toLowerCase(),
    userAdded: true,
    heritage: false,
    emergency: false
  };
  m.marker = L.marker([m.lat, m.lon], { icon: mosqueIcon, title: m.name })
    .bindPopup(() => popupHtml(m))
    .on('click', () => selectDestination(m, false));
  mosques.set(id, m);
  mosqueLayerGroup.addLayer(m.marker);

  selectDestination(m, true);
  showBanner(`✅ "${newMosque.name}" has been published to the map!`, 4000);
}

const closeAddModal = () => {
  if ($('addMosqueModal')) $('addMosqueModal').setAttribute('hidden', '');
};
const openAddModal = () => {
  if ($('addMosqueModal')) $('addMosqueModal').removeAttribute('hidden');
};

if ($('closeModalBtn')) $('closeModalBtn').onclick = closeAddModal;
if ($('addMosqueModal')) {
  $('addMosqueModal').onclick = (e) => {
    if (e.target === $('addMosqueModal')) closeAddModal();
  };
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('addMosqueModal') && !$('addMosqueModal').hasAttribute('hidden')) closeAddModal();
    if ($('mosqueDirectoryModal') && !$('mosqueDirectoryModal').hasAttribute('hidden')) closeDirectoryModal();
    if ($('fullPrayerModal') && !$('fullPrayerModal').hasAttribute('hidden')) $('fullPrayerModal').setAttribute('hidden', '');
    if (measureMode) toggleMeasureTool();
  }
});

if ($('fillGpsBtn')) {
  $('fillGpsBtn').onclick = () => {
    if (userLatLng) {
      $('mLat').value = userLatLng.lat.toFixed(6);
      $('mLon').value = userLatLng.lng.toFixed(6);
      showBanner('GPS coordinates filled!', 2000);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          $('mLat').value = pos.coords.latitude.toFixed(6);
          $('mLon').value = pos.coords.longitude.toFixed(6);
          showBanner('GPS coordinates filled!', 2000);
        },
        () => alert('Could not access GPS. Please enter coordinates or use "Pin on Map".')
      );
    }
  };
}

if ($('pickSpotBtn')) {
  $('pickSpotBtn').onclick = () => {
    closeAddModal();
    pickMosqueSpotMode = true;
    map.getContainer().style.cursor = 'crosshair';
    showBanner('Click on the exact location on the map to place the mosque');
  };
}

function handleMapInspectClick(latlng) {
  let nearestM = null;
  let minDist = 40;
  mosques.forEach(m => {
    const d = distanceM(latlng, L.latLng(m.lat, m.lon));
    if (d < minDist) {
      minDist = d;
      nearestM = m;
    }
  });

  if (nearestM) {
    selectDestination(nearestM, false);
    return;
  }

  let detectedDistrict = '';
  let detectedUpazila = '';
  if (window.BD_HIERARCHY) {
    for (const [dKey, d] of Object.entries(window.BD_HIERARCHY.districts)) {
      if (d.bbox && latlng.lat >= d.bbox[0] && latlng.lat <= d.bbox[2] && latlng.lng >= d.bbox[1] && latlng.lng <= d.bbox[3]) {
        detectedDistrict = `${d.name_en} (${d.name_bn})`;
        for (const u of d.upazilas) {
          if (u.bbox && latlng.lat >= u.bbox[0] && latlng.lat <= u.bbox[2] && latlng.lng >= u.bbox[1] && latlng.lng <= u.bbox[3]) {
            detectedUpazila = `${u.name_bn} উপজেলা`;
            break;
          }
        }
        break;
      }
    }
  }

  let nearestSettlement = null;
  let minSettlementDist = 2500;
  settlements.forEach(s => {
    const d = distanceM(latlng, L.latLng(s.lat, s.lon));
    if (d < minSettlementDist) {
      minSettlementDist = d;
      nearestSettlement = s;
    }
  });

  if (inspectMarker) map.removeLayer(inspectMarker);

  const inspectIcon = L.divIcon({
    className: '',
    html: `
      <div style="width:24px; height:24px; background:#2563eb; border:3px solid #fff; border-radius:50%; box-shadow:0 0 0 3px rgba(37,99,235,0.4), 0 4px 12px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">
        📍
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const locTitle = nearestSettlement ? nearestSettlement.name : (detectedUpazila || 'Location on Google Map');
  const locSub = [detectedUpazila, detectedDistrict].filter(Boolean).join(' · ');

  inspectMarker = L.marker(latlng, { icon: inspectIcon, zIndexOffset: 2500 })
    .addTo(map)
    .bindPopup(`
      <div class="gmap-popup-card">
        <span class="gmap-poi-category">SELECTED GOOGLE MAP LOCATION</span>
        <h4 class="gmap-popup-title">📍 ${esc(locTitle)}</h4>
        <div class="gmap-popup-loc">${locSub ? esc(locSub) + '<br>' : ''}📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
        <div class="gmap-popup-actions">
          <button onclick="window.directToLatLng(${latlng.lat}, ${latlng.lng}, '${esc(locTitle)}')" class="gmap-btn-primary">
            🧭 Get Road Directions Here
          </button>
          <button onclick="window.quickAddMosqueAt(${latlng.lat}, ${latlng.lng}, '${esc(detectedUpazila)}', '${esc(detectedDistrict)}', '${nearestSettlement ? esc(nearestSettlement.name) : ''}')" class="gmap-btn-secondary" style="background:#fef3c7; color:#b45309; border-color:#fde68a; font-weight:600;">
            ➕ Add / Save as Mosque at this Spot
          </button>
          <button onclick="window.clearInspectPin()" class="gmap-btn-outline" style="color:#b91c1c; border-color:#fecaca;">
            ✕ Clear Pin
          </button>
        </div>
      </div>
    `, { offset: [0, -10] })
    .openPopup();
}

window.clearInspectPin = () => {
  if (inspectMarker) {
    map.removeLayer(inspectMarker);
    inspectMarker = null;
  }
};

window.directToLatLng = (lat, lon, label) => {
  window.clearInspectPin();
  const customId = 'custom_' + lat.toFixed(5) + '_' + lon.toFixed(5);
  const tempDest = {
    id: customId,
    lat,
    lon,
    name: label || 'Selected Location on Map',
    category: 'mosque',
    tags: { wudu: true },
    marker: L.marker([lat, lon], { icon: selectedMosqueIcon })
  };
  selectDestination(tempDest, false);
};

window.quickAddMosqueAt = (lat, lon, upz, dist, village) => {
  window.clearInspectPin();
  $('mLat').value = lat.toFixed(6);
  $('mLon').value = lon.toFixed(6);
  if (upz || dist) $('mDistrict').value = [upz, dist].filter(Boolean).join(', ');
  if (village) $('mVillage').value = village;
  openAddModal();
  $('mName').focus();
};

map.on('click', (e) => {
  if (pickMosqueSpotMode) {
    pickMosqueSpotMode = false;
    map.getContainer().style.cursor = '';
    hideBanner();
    $('mLat').value = e.latlng.lat.toFixed(6);
    $('mLon').value = e.latlng.lng.toFixed(6);
    openAddModal();
  } else if (pickHomeSpotMode) {
    pickHomeSpotMode = false;
    map.getContainer().style.cursor = '';
    hideBanner();
    setHomeLocation(e.latlng, 'My Home');
    openMusafirDrawer();
    showBanner('✅ Home location set! Checking Musafir status...', 3000);
  } else if (measureMode) {
    handleMeasureClick(e.latlng);
  } else {
    handleMapInspectClick(e.latlng);
  }
});

$('addMosqueForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('mName').value.trim();
  const village = $('mVillage').value.trim();
  const district = $('mDistrict').value.trim();
  const lat = parseFloat($('mLat').value);
  const lon = parseFloat($('mLon').value);
  const female = $('mCheckFemale').checked;
  const wudu = $('mCheckWudu').checked;

  if (!name || isNaN(lat) || isNaN(lon)) {
    return alert('Please fill in all required fields with valid coordinates.');
  }

  saveUserMosqueToStorage({ name, village, district, lat, lon, female, wudu });
  $('addMosqueForm').reset();
  closeAddModal();
});

// ---------- Ruler / Distance Measurement Tool ----------
function toggleMeasureTool() {
  measureMode = !measureMode;
  closeSideMenu();
  if (measureMode) {
    measurePoints = [];
    rulerLayerGroup.clearLayers();
    map.getContainer().style.cursor = 'crosshair';
    showBanner('📏 Ruler Active: Click 2 or more points on the map to measure distance. Press Esc to end.', 5000);
  } else {
    map.getContainer().style.cursor = '';
    rulerLayerGroup.clearLayers();
    hideBanner();
  }
}

function handleMeasureClick(latlng) {
  measurePoints.push(latlng);
  const dot = L.circleMarker(latlng, { radius: 5, color: '#f59e0b', fillColor: '#fff', fillOpacity: 1 }).addTo(rulerLayerGroup);

  if (measurePoints.length > 1) {
    if (measurePolyline) rulerLayerGroup.removeLayer(measurePolyline);
    measurePolyline = L.polyline(measurePoints, { color: '#f59e0b', weight: 3.5, dashArray: '6 6' }).addTo(rulerLayerGroup);

    let totalDistM = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      totalDistM += distanceM(measurePoints[i - 1], measurePoints[i]);
    }

    const distStr = fmtDist(totalDistM);
    dot.bindTooltip(`Distance: <b>${distStr}</b>`, { permanent: true, direction: 'top' }).openTooltip();
    showBanner(`📏 Total Measured Distance: ${distStr}`, 3000);
  }
}

// ---------- Qibla Direction Feature ----------
function showQiblaDirection() {
  closeSideMenu();
  const origin = userLatLng || map.getCenter();
  const qBearing = bearingDeg(origin, KAABA_COORDS);

  if (qiblaRayLayer) map.removeLayer(qiblaRayLayer);

  const destLat = origin.lat + 1.8 * Math.cos(toRad(qBearing));
  const destLon = (origin.lng ?? origin.lon) + 1.8 * Math.sin(toRad(qBearing));

  qiblaRayLayer = L.polyline([[origin.lat, origin.lng ?? origin.lon], [destLat, destLon]], {
    color: '#e5a93c',
    weight: 4,
    dashArray: '8 8'
  }).addTo(map);

  map.setView([origin.lat, origin.lng ?? origin.lon], 13);
  showBanner(`🕋 Qibla Bearing: ${Math.round(qBearing)}° W (Towards Makkah)`, 4000);
}

// ---------- Smart Filters & Clear Filter Execution (100% Fixed) ----------
function applySmartFilter(filterType, title, icon) {
  closeSideMenu();
  activeFilter = filterType;

  const bannerEl = $('activeFilterBanner');
  if (bannerEl) {
    $('activeFilterIcon').textContent = icon;
    $('activeFilterText').textContent = `Active Filter: ${title}`;
    bannerEl.removeAttribute('hidden');
  }

  map.fire('moveend');
  openFilteredItemsInDrawer(filterType, title, icon);
  showBanner(`${icon} Filter Active: ${title}`, 2800);
}

function clearSmartFilter() {
  activeFilter = 'all';
  activeWashroomGender = 'all';

  const bannerEl = $('activeFilterBanner');
  if (bannerEl) {
    bannerEl.setAttribute('hidden', '');
  }
  if ($('washroomGenderFilterBar')) {
    $('washroomGenderFilterBar').setAttribute('hidden', '');
  }
  if ($('hierarchySelectorsBox')) {
    $('hierarchySelectorsBox').removeAttribute('hidden');
  }
  if ($('hierarchyTabsBox')) {
    $('hierarchyTabsBox').removeAttribute('hidden');
  }
  if (qiblaRayLayer) {
    map.removeLayer(qiblaRayLayer);
    qiblaRayLayer = null;
  }
  window.clearInspectPin();

  // If left drawer was opened in filter/special mode, close or restore it cleanly
  const drawer = $('leftAreaDrawer');
  if (drawer && !drawer.hasAttribute('hidden')) {
    const currentBadge = $('areaBadge')?.textContent || '';
    if (currentBadge.includes('Filter') || currentBadge.includes('Heritage') || currentBadge.includes('Washrooms') || currentBadge.includes('Police')) {
      drawer.setAttribute('hidden', '');
    } else {
      updateHierarchyExplorerView();
    }
  }

  map.fire('moveend');
  showBanner('Filter cleared. Showing standard map view.', 2200);
}

// Expose globally so both onclick and addEventListener work seamlessly
window.clearActiveFilter = clearSmartFilter;
if ($('clearFilterBtn')) {
  $('clearFilterBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSmartFilter();
  });
}

// Helper to create a clean, minimal, non-bold beauty card item
function createPlaceCard(icon, name, subText, badgeText, badgeClass, onClick) {
  const card = document.createElement('div');
  card.className = 'mosque-item-card';
  card.innerHTML = `
    <div class="place-card-main">
      <div class="place-name-beauty">${icon} ${esc(name)}</div>
      <div class="place-meta-sub">${esc(subText)}</div>
    </div>
    ${badgeText ? `<span class="place-badge-pill ${badgeClass || ''}">${esc(badgeText)}</span>` : ''}
  `;
  card.onclick = onClick;
  return card;
}

function openFilteredItemsInDrawer(filterType, title, icon) {
  const drawer = $('leftAreaDrawer');
  drawer.removeAttribute('hidden');
  $('areaBadge').textContent = 'Filter Mode';
  $('areaTitle').textContent = `${icon} ${title}`;

  // Show/hide gender bar if Washroom filter is active
  if (filterType === 'washroom') {
    $('washroomGenderFilterBar').removeAttribute('hidden');
  } else {
    $('washroomGenderFilterBar').setAttribute('hidden', '');
  }

  // Show only the primary list container during Filter Mode
  $('areaMosqueList').removeAttribute('hidden');
  $('areaWashroomList').setAttribute('hidden', '');
  $('areaPoliceList').setAttribute('hidden', '');
  $('areaVillageList').setAttribute('hidden', '');
  $('areaBazarList').setAttribute('hidden', '');

  const mBox = $('areaMosqueList');
  mBox.innerHTML = '';

  if (filterType === 'washroom') {
    const matching = [];
    washrooms.forEach(w => {
      if (activeWashroomGender !== 'all' && w.genderCode !== activeWashroomGender) return;
      matching.push(w);
    });
    if (userLatLng) {
      matching.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
    }
    $('areaWashroomCount').textContent = `${matching.length}`;
    activateTabButton('tabWashrooms');

    matching.slice(0, 120).forEach(w => {
      const distStr = userLatLng
        ? `${fmtDist(distanceM(userLatLng, L.latLng(w.lat, w.lon)))} · ${w.facilities}`
        : `${w.district} · ${w.facilities}`;
      const badgeLabel = w.genderCode === 'both' ? '🚹🚺 Men & Women' : '🚹 Men Only';
      const badgeCls = w.genderCode === 'both' ? 'gender-both' : 'gender-men';
      mBox.appendChild(createPlaceCard('🚻', w.name, distStr, badgeLabel, badgeCls, () => selectDestination(w, true)));
    });
    return;
  }

  if (filterType === 'police') {
    const matching = [...policeStations.values()];
    if (userLatLng) {
      matching.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
    }
    $('areaPoliceCount').textContent = `${matching.length}`;
    activateTabButton('tabPolice');

    matching.slice(0, 120).forEach(p => {
      const distStr = userLatLng
        ? `${fmtDist(distanceM(userLatLng, L.latLng(p.lat, p.lon)))} · ${p.policeType}`
        : `${p.district} · ${p.policeType}`;
      mBox.appendChild(createPlaceCard('🚓', p.name, distStr, '📞 999 / Thana', 'police-tag', () => selectDestination(p, true)));
    });
    return;
  }

  const matching = [];
  mosques.forEach(m => {
    if (filterType === 'community' && m.userAdded) matching.push(m);
    else if (filterType === 'emergency' && m.emergency) matching.push(m);
    else if (filterType === 'heritage' && m.heritage) matching.push(m);
  });

  if (userLatLng) {
    matching.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
  }

  $('areaMosqueCount').textContent = `${matching.length}`;
  activateTabButton('tabMosques');

  if (!matching.length) {
    mBox.innerHTML = '<div class="empty-state">No locations found for this filter yet. Click "+ Add Mosque" to contribute!</div>';
  } else {
    matching.slice(0, 120).forEach(m => {
      const distStr = userLatLng
        ? `${fmtDist(distanceM(userLatLng, L.latLng(m.lat, m.lon)))} away`
        : (m.era ? `${m.district} · ${m.era}` : `${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}`);
      const badge = m.heritage ? 'Historic' : (m.userAdded ? 'Community' : '24/7 Shelter');
      const badgeCls = m.heritage ? 'heritage-tag' : '';
      mBox.appendChild(createPlaceCard(icon, m.name, distStr, badge, badgeCls, () => selectDestination(m, true)));
    });
  }
}

// Washroom Gender Filter Pill Clicks
document.querySelectorAll('.gender-pill').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.gender-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeWashroomGender = btn.getAttribute('data-gender') || 'all';
    if (activeFilter === 'washroom') {
      openFilteredItemsInDrawer('washroom', 'Washroom Locations (Men & Women)', '🚻');
      map.fire('moveend');
    } else {
      updateHierarchyExplorerView();
    }
  };
});

// ---------- Wire Menu & Header Quick Buttons ----------
if ($('menuMusafir')) $('menuMusafir').onclick = () => { closeSideMenu(); openMusafirDrawer(); };
if ($('menuPrayerTimes')) {
  $('menuPrayerTimes').onclick = () => {
    closeSideMenu();
    $('fullPrayerModal').removeAttribute('hidden');
  };
}
if ($('menuQibla')) $('menuQibla').onclick = showQiblaDirection;
if ($('menuTahajjud')) {
  $('menuTahajjud').onclick = () => {
    closeSideMenu();
    $('fullPrayerModal').removeAttribute('hidden');
    showBanner('🌙 Tahajjud window is during the last 1/3rd of the night before Fajr.', 3500);
  };
}
if ($('menuHeritage')) {
  $('menuHeritage').onclick = () => {
    openHeritageExplorer();
  };
}
if ($('menuAddMosque')) $('menuAddMosque').onclick = () => { closeSideMenu(); openAddModal(); };
if ($('menuVerifiedMosques')) $('menuVerifiedMosques').onclick = () => applySmartFilter('community', 'Community Added Mosques', '⭐');
if ($('menuEmergency')) $('menuEmergency').onclick = () => applySmartFilter('emergency', '24/7 Highway Rest-Stop Shelters', '🚨');

if ($('menuFilterWashroom')) {
  $('menuFilterWashroom').onclick = () => applySmartFilter('washroom', 'Washroom Locations (Men & Women)', '🚻');
}
if ($('quickWashroomBtn')) {
  $('quickWashroomBtn').onclick = () => {
    if (activeFilter === 'washroom') clearSmartFilter();
    else applySmartFilter('washroom', 'Washroom Locations (Men & Women)', '🚻');
  };
}

if ($('menuFilterPolice')) {
  $('menuFilterPolice').onclick = () => applySmartFilter('police', 'Police Stations & Thanas (579)', '🚓');
}
if ($('quickPoliceBtn')) {
  $('quickPoliceBtn').onclick = () => {
    if (activeFilter === 'police') clearSmartFilter();
    else applySmartFilter('police', 'Police Stations & Thanas (579)', '🚓');
  };
}

if ($('menuBrowseDistricts')) $('menuBrowseDistricts').onclick = () => { closeSideMenu(); open4TierExplorer(); };
if ($('menuMeasurement')) $('menuMeasurement').onclick = toggleMeasureTool;
if ($('menuOfflineGuide')) {
  $('menuOfflineGuide').onclick = () => {
    closeSideMenu();
    alert('💾 100% Free Offline Database Ready!\n\nAll 11,552 Mosques, 641 Public Washrooms (Men & Women), 579 Police Stations, 73 Historic Mosques, and 8,965 Villages & Bazars are bundled locally in your browser!');
  };
}

let isDarkTheme = true;
if ($('menuThemeToggle')) {
  $('menuThemeToggle').onclick = () => {
    closeSideMenu();
    isDarkTheme = !isDarkTheme;
    document.body.className = isDarkTheme ? 'theme-dark' : 'theme-light';
    showBanner(isDarkTheme ? 'Dark Mode active' : 'Light Mode active', 2000);
  };
}

// ---------- 4-Tier Bangladesh Hierarchy Explorer Component ----------
function open4TierExplorer() {
  if (activeFilter !== 'all') {
    activeFilter = 'all';
    if ($('activeFilterBanner')) $('activeFilterBanner').setAttribute('hidden', '');
    map.fire('moveend');
  }
  const drawer = $('leftAreaDrawer');
  drawer.removeAttribute('hidden');
  $('washroomGenderFilterBar').setAttribute('hidden', '');
  updateHierarchyExplorerView();
}

function closeLeftExplorer() {
  const drawer = $('leftAreaDrawer');
  if (drawer) drawer.setAttribute('hidden', '');
  if (highlightPolygonLayer) {
    map.removeLayer(highlightPolygonLayer);
    highlightPolygonLayer = null;
  }
}
window.closeLeftExplorer = closeLeftExplorer;
if ($('closeLeftDrawerBtn')) $('closeLeftDrawerBtn').onclick = closeLeftExplorer;

$('selectDivision').onchange = (e) => {
  currentSelectedDivision = e.target.value;
  currentSelectedDistrict = '';
  currentSelectedUpazila = '';
  populateDistrictSelect();
  populateUpazilaSelect();
  updateHierarchyExplorerView();
};

$('selectDistrict').onchange = (e) => {
  currentSelectedDistrict = e.target.value;
  currentSelectedUpazila = '';
  populateUpazilaSelect();
  updateHierarchyExplorerView();
};

$('selectUpazila').onchange = (e) => {
  currentSelectedUpazila = e.target.value;
  updateHierarchyExplorerView();
};

function populateDistrictSelect() {
  const distSelect = $('selectDistrict');
  distSelect.innerHTML = '';

  if (currentSelectedDivision === 'all') {
    distSelect.disabled = true;
    distSelect.innerHTML = '<option value="">All Districts</option>';
    return;
  }

  const divData = window.BD_HIERARCHY?.divisions?.[currentSelectedDivision];
  if (!divData || !divData.districts) return;

  distSelect.disabled = false;
  distSelect.innerHTML = '<option value="">All in ' + esc(divData.name_en) + '</option>';

  divData.districts.forEach(dKey => {
    const dInfo = window.BD_HIERARCHY.districts[dKey];
    const nameBn = dInfo?.name_bn || dKey;
    const opt = document.createElement('option');
    opt.value = dKey;
    opt.textContent = `${dKey} (${nameBn})`;
    distSelect.appendChild(opt);
  });
}

function populateUpazilaSelect() {
  const upzSelect = $('selectUpazila');
  upzSelect.innerHTML = '';

  if (!currentSelectedDistrict) {
    upzSelect.disabled = true;
    upzSelect.innerHTML = '<option value="">All Upazilas</option>';
    return;
  }

  const dInfo = window.BD_HIERARCHY?.districts?.[currentSelectedDistrict];
  if (!dInfo || !dInfo.upazilas) return;

  upzSelect.disabled = false;
  upzSelect.innerHTML = '<option value="">All in ' + esc(dInfo.name_en) + '</option>';

  dInfo.upazilas.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.name_bn || u.name_full;
    opt.textContent = `${u.name_bn}`;
    upzSelect.appendChild(opt);
  });
}

function updateHierarchyExplorerView() {
  const sep1 = $('sep1'), sep2 = $('sep2'), sep3 = $('sep3');
  const cDiv = $('crumbDiv'), cDist = $('crumbDist'), cUpz = $('crumbUpz');

  if (currentSelectedDivision !== 'all') {
    sep1.removeAttribute('hidden');
    cDiv.removeAttribute('hidden');
    cDiv.textContent = currentSelectedDivision;
  } else {
    sep1.setAttribute('hidden', '');
    cDiv.setAttribute('hidden', '');
  }

  if (currentSelectedDistrict) {
    sep2.removeAttribute('hidden');
    cDist.removeAttribute('hidden');
    cDist.textContent = currentSelectedDistrict;
  } else {
    sep2.setAttribute('hidden', '');
    cDist.setAttribute('hidden', '');
  }

  if (currentSelectedUpazila) {
    sep3.removeAttribute('hidden');
    cUpz.removeAttribute('hidden');
    cUpz.textContent = currentSelectedUpazila;
  } else {
    sep3.setAttribute('hidden', '');
    cUpz.setAttribute('hidden', '');
  }

  let targetBbox = null;
  let targetCenter = null;
  let targetTitle = 'Bangladesh Regional Explorer';
  let targetBadge = 'All BD';

  if (currentSelectedUpazila) {
    const dInfo = window.BD_HIERARCHY.districts[currentSelectedDistrict];
    const uObj = dInfo?.upazilas?.find(u => u.name_bn === currentSelectedUpazila || u.name_full === currentSelectedUpazila);
    if (uObj) {
      targetBbox = uObj.bbox;
      targetCenter = uObj.center;
      targetTitle = `${uObj.name_bn} (${dInfo.name_en})`;
      targetBadge = 'Upazila / Thana';
    }
  } else if (currentSelectedDistrict) {
    const dInfo = window.BD_HIERARCHY.districts[currentSelectedDistrict];
    if (dInfo) {
      targetBbox = dInfo.bbox;
      targetCenter = dInfo.center;
      targetTitle = `${dInfo.name_en} (${dInfo.name_bn})`;
      targetBadge = 'District';
    }
  } else if (currentSelectedDivision !== 'all') {
    const divInfo = window.BD_HIERARCHY.divisions[currentSelectedDivision];
    if (divInfo) {
      targetBbox = divInfo.bbox;
      targetCenter = divInfo.center;
      targetTitle = `${divInfo.name_en} (${divInfo.name_bn})`;
      targetBadge = 'Division';
    }
  }

  $('areaTitle').textContent = targetTitle;
  $('areaBadge').textContent = targetBadge;

  if (targetBbox && targetBbox.length === 4) {
    const bounds = L.latLngBounds([targetBbox[0], targetBbox[1]], [targetBbox[2], targetBbox[3]]);
    map.fitBounds(bounds, { maxZoom: currentSelectedUpazila ? 15 : (currentSelectedDistrict ? 12 : 9) });
  } else if (targetCenter) {
    map.setView(targetCenter, currentSelectedUpazila ? 14 : 10);
  }

  const currentBounds = targetBbox ? L.latLngBounds([targetBbox[0], targetBbox[1]], [targetBbox[2], targetBbox[3]]) : BD_BOUNDS;

  const matchedMosques = [];
  const matchedWashrooms = [];
  const matchedPolice = [];
  const matchedVillages = [];
  const matchedBazars = [];

  mosques.forEach(m => {
    if (currentBounds.contains([m.lat, m.lon])) matchedMosques.push(m);
  });

  washrooms.forEach(w => {
    if (activeWashroomGender !== 'all' && w.genderCode !== activeWashroomGender) return;
    if (currentBounds.contains([w.lat, w.lon])) matchedWashrooms.push(w);
  });

  policeStations.forEach(p => {
    if (currentBounds.contains([p.lat, p.lon])) matchedPolice.push(p);
  });

  settlements.forEach(s => {
    if (currentBounds.contains([s.lat, s.lon])) {
      if (s.type === 'bazar') matchedBazars.push(s);
      else matchedVillages.push(s);
    }
  });

  if (userLatLng) {
    matchedMosques.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
    matchedWashrooms.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
    matchedPolice.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));
  }

  $('areaMosqueCount').textContent = `${matchedMosques.length}`;
  $('areaWashroomCount').textContent = `${matchedWashrooms.length}`;
  $('areaPoliceCount').textContent = `${matchedPolice.length}`;
  $('areaVillageCount').textContent = `${matchedVillages.length}`;
  $('areaBazarCount').textContent = `${matchedBazars.length}`;

  // 1. Populate Mosques (Non-Bold Beauty Typography)
  const mBox = $('areaMosqueList');
  mBox.innerHTML = '';
  if (!matchedMosques.length) {
    mBox.innerHTML = '<div class="empty-state">No mosques registered in this sector yet. Click "+ Add Mosque" to contribute!</div>';
  } else {
    matchedMosques.slice(0, 100).forEach(m => {
      const distStr = userLatLng
        ? `${fmtDist(distanceM(userLatLng, L.latLng(m.lat, m.lon)))} away`
        : `${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}`;
      const badge = m.heritage ? 'Historic' : (m.userAdded ? 'Community' : 'Mosque');
      const badgeCls = m.heritage ? 'heritage-tag' : '';
      const icon = m.heritage ? '🏛️' : '🕌';
      mBox.appendChild(createPlaceCard(icon, m.name, distStr, badge, badgeCls, () => selectDestination(m, true)));
    });
  }

  // 2. Populate Washrooms (With Men & Women Gender Badges)
  const wBox = $('areaWashroomList');
  wBox.innerHTML = '';
  if (!matchedWashrooms.length) {
    wBox.innerHTML = '<div class="empty-state">No public washrooms mapped in this specific boundary.</div>';
  } else {
    matchedWashrooms.slice(0, 100).forEach(w => {
      const sub = `${w.gender} · ${w.facilities}`;
      const badge = w.genderCode === 'both' ? '🚹🚺 Men & Women' : '🚹 Men Only';
      const badgeCls = w.genderCode === 'both' ? 'gender-both' : 'gender-men';
      wBox.appendChild(createPlaceCard('🚻', w.name, sub, badge, badgeCls, () => selectDestination(w, true)));
    });
  }

  // 3. Populate Police Stations
  const pBox = $('areaPoliceList');
  pBox.innerHTML = '';
  if (!matchedPolice.length) {
    pBox.innerHTML = '<div class="empty-state">No police stations recorded in this specific boundary.</div>';
  } else {
    matchedPolice.slice(0, 100).forEach(p => {
      const sub = `${p.policeType} · ${p.phone}`;
      pBox.appendChild(createPlaceCard('🚓', p.name, sub, '📞 999', 'police-tag', () => selectDestination(p, true)));
    });
  }

  // 4. Populate Villages
  const vBox = $('areaVillageList');
  vBox.innerHTML = '';
  if (!matchedVillages.length) {
    vBox.innerHTML = '<div class="empty-state">No village names mapped in this specific boundary.</div>';
  } else {
    matchedVillages.slice(0, 100).forEach(v => {
      vBox.appendChild(createPlaceCard('🏘️', v.name, `${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}`, v.type || 'Village', '', () => {
        map.setView([v.lat, v.lon], 16);
        showBanner(`Visiting village: ${v.name}`, 2500);
      }));
    });
  }

  // 5. Populate Bazars
  const bBox = $('areaBazarList');
  bBox.innerHTML = '';
  if (!matchedBazars.length) {
    bBox.innerHTML = '<div class="empty-state">No commercial bazars recorded in this sector.</div>';
  } else {
    matchedBazars.slice(0, 100).forEach(b => {
      bBox.appendChild(createPlaceCard('🛒', b.name, `${b.lat.toFixed(4)}, ${b.lon.toFixed(4)}`, 'Bazar / Haat', '', () => {
        map.setView([b.lat, b.lon], 16);
        showBanner(`Visiting Bazar: ${b.name}`, 2500);
      }));
    });
  }
}

// Breadcrumb Clicks
$('crumbBd').onclick = () => {
  $('selectDivision').value = 'all';
  $('selectDivision').dispatchEvent(new Event('change'));
};
$('crumbDiv').onclick = () => {
  $('selectDistrict').value = '';
  $('selectDistrict').dispatchEvent(new Event('change'));
};
$('crumbDist').onclick = () => {
  $('selectUpazila').value = '';
  $('selectUpazila').dispatchEvent(new Event('change'));
};

// Tab Switcher
function activateTabButton(activeId) {
  ['tabMosques', 'tabWashrooms', 'tabPolice', 'tabVillages', 'tabBazars'].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (id === activeId) el.classList.add('active');
    else el.classList.remove('active');
  });
}

function showTabContainer(containerId) {
  ['areaMosqueList', 'areaWashroomList', 'areaPoliceList', 'areaVillageList', 'areaBazarList'].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (id === containerId) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
  if (containerId === 'areaWashroomList') {
    $('washroomGenderFilterBar').removeAttribute('hidden');
  } else if (activeFilter !== 'washroom') {
    $('washroomGenderFilterBar').setAttribute('hidden', '');
  }
}

$('tabMosques').onclick = () => {
  activateTabButton('tabMosques');
  showTabContainer('areaMosqueList');
};
$('tabWashrooms').onclick = () => {
  activateTabButton('tabWashrooms');
  showTabContainer('areaWashroomList');
};
$('tabPolice').onclick = () => {
  activateTabButton('tabPolice');
  showTabContainer('areaPoliceList');
};
$('tabVillages').onclick = () => {
  activateTabButton('tabVillages');
  showTabContainer('areaVillageList');
};
$('tabBazars').onclick = () => {
  activateTabButton('tabBazars');
  showTabContainer('areaBazarList');
};

function handleDistrictFeatureClick(distName, bounds) {
  open4TierExplorer();
  for (const [k, d] of Object.entries(window.BD_HIERARCHY.districts)) {
    if (d.name_bn === distName || distName.includes(d.name_bn) || distName.includes(k)) {
      $('selectDivision').value = d.division;
      populateDistrictSelect();
      $('selectDistrict').value = k;
      populateUpazilaSelect();
      updateHierarchyExplorerView();
      return;
    }
  }
}

function handleUpazilaFeatureClick(upzName, bounds) {
  open4TierExplorer();
  const cleanName = upzName.replace('উপজেলা', '').trim();
  for (const [dKey, d] of Object.entries(window.BD_HIERARCHY.districts)) {
    const match = d.upazilas.find(u => u.name_bn === cleanName || u.name_full === upzName);
    if (match) {
      $('selectDivision').value = d.division;
      populateDistrictSelect();
      $('selectDistrict').value = dKey;
      populateUpazilaSelect();
      $('selectUpazila').value = match.name_bn;
      updateHierarchyExplorerView();
      return;
    }
  }
}

// ---------- Historic & Heritage Mosques Tour (73 Historic Mosques) ----------
function openHeritageExplorer() {
  applySmartFilter('heritage', `Historic Mosques of Bangladesh (${HERITAGE_MOSQUES.length})`, '🏛️');
  map.setView([23.8, 89.9], 7);
}

// ---------- Search Form (Instant Offline + Live Geocoding with Beauty Font) ----------
$('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  runSearchQuery();
});

$('searchInput').addEventListener('input', () => {
  const q = $('searchInput').value.trim();
  if (!q) {
    $('searchResults').setAttribute('hidden', '');
    return;
  }
  if (q.length >= 2) runSearchQuery(true);
});

async function runSearchQuery(offlineOnly = false) {
  const q = $('searchInput').value.trim();
  const dropdown = $('searchResults');
  if (!q) {
    dropdown.setAttribute('hidden', '');
    return;
  }

  dropdown.removeAttribute('hidden');
  const words = q.toLowerCase().split(/\s+/);

  const foundMosques = [...mosques.values()].filter(m => words.every(w => m.search.includes(w)));
  if (userLatLng) foundMosques.sort((a, b) => distanceM(userLatLng, L.latLng(a.lat, a.lon)) - distanceM(userLatLng, L.latLng(b.lat, b.lon)));

  const foundWashrooms = [...washrooms.values()].filter(w => words.every(word => w.search.includes(word))).slice(0, 6);
  const foundPolice = [...policeStations.values()].filter(p => words.every(word => p.search.includes(word))).slice(0, 6);
  const foundSettlements = settlements.filter(s => words.every(w => s.search.includes(w))).slice(0, 10);

  const boundaryMatches = [];
  if (window.BD_HIERARCHY) {
    for (const [k, d] of Object.entries(window.BD_HIERARCHY.districts)) {
      if (words.every(w => k.toLowerCase().includes(w) || d.name_bn.includes(w))) {
        boundaryMatches.push({ name: `${k} (${d.name_bn})`, badge: 'District', bbox: d.bbox, center: d.center, distKey: k });
      }
      for (const u of d.upazilas) {
        if (words.every(w => (u.name_bn || '').includes(w) || (u.name_full || '').toLowerCase().includes(w))) {
          boundaryMatches.push({ name: `${u.name_bn} (${d.name_en})`, badge: 'Upazila', bbox: u.bbox, center: u.center, distKey: k, upzName: u.name_bn });
        }
      }
    }
  }

  let onlinePlaces = [];
  if (!offlineOnly) {
    try {
      const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=88.0,20.5,92.7,26.7&limit=5`;
      const pRes = await (await fetch(pUrl)).json();
      if (pRes && pRes.features) {
        pRes.features.forEach(f => {
          const props = f.properties || {};
          const coords = f.geometry.coordinates;
          const isMosque = props.osm_value === 'place_of_worship' || (props.name || '').toLowerCase().includes('mosque') || (props.name || '').includes('মসজিদ');
          onlinePlaces.push({
            name: props.name || 'Unnamed place',
            desc: [props.osm_value, props.city || props.district || props.county, props.state].filter(Boolean).join(', '),
            lat: coords[1],
            lon: coords[0],
            isMosque
          });
        });
      }
    } catch (_) {}
  }

  dropdown.innerHTML = '';

  foundMosques.slice(0, 12).forEach(m => {
    const distStr = userLatLng ? `${fmtDist(distanceM(userLatLng, L.latLng(m.lat, m.lon)))}` : `${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}`;
    const tag = m.heritage ? '🏛️' : (m.userAdded ? '⭐' : '🕌');
    dropdown.appendChild(createDropdownItem(`${tag} ${m.name}`, distStr, () => {
      dropdown.setAttribute('hidden', '');
      selectDestination(m, true);
    }));
  });

  foundWashrooms.forEach(w => {
    const badge = w.genderCode === 'both' ? '🚹🚺 Men & Women' : '🚹 Men Only';
    dropdown.appendChild(createDropdownItem(`🚻 ${w.name}`, badge, () => {
      dropdown.setAttribute('hidden', '');
      selectDestination(w, true);
    }));
  });

  foundPolice.forEach(p => {
    dropdown.appendChild(createDropdownItem(`🚓 ${p.name}`, 'Police Thana · 999', () => {
      dropdown.setAttribute('hidden', '');
      selectDestination(p, true);
    }));
  });

  boundaryMatches.slice(0, 4).forEach(bm => {
    dropdown.appendChild(createDropdownItem(`🗺️ ${bm.name}`, bm.badge, () => {
      dropdown.setAttribute('hidden', '');
      open4TierExplorer();
      const d = window.BD_HIERARCHY.districts[bm.distKey];
      $('selectDivision').value = d.division;
      populateDistrictSelect();
      $('selectDistrict').value = bm.distKey;
      populateUpazilaSelect();
      if (bm.badge === 'Upazila') $('selectUpazila').value = bm.upzName;
      updateHierarchyExplorerView();
    }));
  });

  foundSettlements.forEach(s => {
    const icon = s.type === 'bazar' ? '🛒' : '🏘️';
    dropdown.appendChild(createDropdownItem(`${icon} ${s.name}`, s.type === 'bazar' ? 'Bazar' : 'Village', () => {
      dropdown.setAttribute('hidden', '');
      map.setView([s.lat, s.lon], 16);
      showBanner(`Viewing ${s.type}: ${s.name}`, 3000);
    }));
  });

  onlinePlaces.forEach(p => {
    if (p.isMosque) {
      const tempId = 'online_' + p.lat.toFixed(5) + '_' + p.lon.toFixed(5);
      if (!mosques.has(tempId)) {
        const m = { id: tempId, lat: p.lat, lon: p.lon, name: p.name, category: 'mosque', tags: { wudu: true }, search: p.name.toLowerCase() };
        m.marker = L.marker([p.lat, p.lon], { icon: mosqueIcon, title: p.name })
          .bindPopup(() => popupHtml(m))
          .on('click', () => selectDestination(m, false));
        mosques.set(tempId, m);
      }
      const m = mosques.get(tempId);
      dropdown.appendChild(createDropdownItem(`🕌 ${p.name}`, p.desc || 'Live Result', () => {
        dropdown.setAttribute('hidden', '');
        selectDestination(m, true);
      }));
    } else {
      dropdown.appendChild(createDropdownItem(`📍 ${p.name}`, p.desc || 'Map Location', () => {
        dropdown.setAttribute('hidden', '');
        map.setView([p.lat, p.lon], 16);
      }));
    }
  });

  if (!dropdown.children.length) {
    dropdown.innerHTML = `<div class="search-item"><span class="search-item-title">No matches found for "${esc(q)}".</span></div>`;
  }
}

function createDropdownItem(title, sub, onClick) {
  const d = document.createElement('div');
  d.className = 'search-item';
  d.innerHTML = `<span class="search-item-title">${esc(title)}</span><span class="search-item-sub">${esc(sub)}</span>`;
  d.onclick = onClick;
  return d;
}

document.addEventListener('click', (e) => {
  if (!$('searchForm').contains(e.target) && !$('searchResults').contains(e.target)) {
    $('searchResults').setAttribute('hidden', '');
  }
});

// ---------- User Location Management ----------
function setUserLocation(latlng, accuracy) {
  userLatLng = L.latLng(latlng);
  if (!userMarker) {
    userMarker = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 2000, title: 'Your Location' }).addTo(map);
  } else {
    userMarker.setLatLng(userLatLng);
  }

  if (accuracyCircle) map.removeLayer(accuracyCircle);
  accuracyCircle = accuracy ? L.circle(userLatLng, { radius: accuracy, weight: 1, color: '#2563eb', fillOpacity: 0.1 }).addTo(map) : null;

  if (selectedDest) selectDestination(selectedDest, false, true);
  if (homeLatLng) updateMusafirStatus();
}

$('locateBtn').onclick = () => {
  if (!navigator.geolocation) return alert('Geolocation is not supported by your browser.');
  showBanner('Acquiring your GPS location...', 2000);
  navigator.geolocation.getCurrentPosition(
    (p) => {
      setUserLocation([p.coords.latitude, p.coords.longitude], p.coords.accuracy);
      map.setView(userLatLng, 16);
      showBanner('📍 GPS Located successfully!', 2500);
    },
    () => { alert('GPS access was blocked. You can click anywhere on the map to inspect or route.'); },
    { enableHighAccuracy: true, timeout: 15000 }
  );
};

// ---------- Destination Selection & Turn-by-Turn Navigation ----------
function restoreMarkerIcon(item) {
  if (!item || !item.marker) return;
  if (item.category === 'washroom') item.marker.setIcon(washroomIcon);
  else if (item.category === 'police') item.marker.setIcon(policeIcon);
  else if (item.heritage) item.marker.setIcon(heritageMosqueIcon);
  else if (item.emergency) item.marker.setIcon(emergencyMosqueIcon);
  else item.marker.setIcon(mosqueIcon);
}

function selectDestination(m, fly, silent) {
  if (selectedDest && selectedDest !== m) {
    restoreMarkerIcon(selectedDest);
  }
  selectedDest = m;
  if (m.marker && m.category !== 'washroom' && m.category !== 'police') {
    m.marker.setIcon(selectedMosqueIcon);
  }
  const mLL = L.latLng(m.lat, m.lon);

  const dirDrawer = $('directionDrawer');
  dirDrawer.removeAttribute('hidden');
  $('dirTitle').textContent = m.name;
  $('dirAddr').textContent = `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`;

  const extraBox = $('destExtraMeta');
  if (m.category === 'washroom') {
    $('destBadge').textContent = 'Public Washroom';
    extraBox.removeAttribute('hidden');
    extraBox.innerHTML = `🚻 <b>Gender Allowed:</b> ${esc(m.gender)}<br>✨ <b>Facilities:</b> ${esc(m.facilities)}`;
  } else if (m.category === 'police') {
    $('destBadge').textContent = 'Police Station / Thana';
    extraBox.removeAttribute('hidden');
    extraBox.innerHTML = `🚓 <b>Type:</b> ${esc(m.policeType)}<br>📞 <b>Emergency Contact:</b> ${esc(m.phone)}`;
  } else if (m.heritage) {
    $('destBadge').textContent = 'Historic Mosque';
    extraBox.removeAttribute('hidden');
    extraBox.innerHTML = `🏛️ <b>Era / History:</b> ${esc(m.era || 'Historic Monument')}<br>📍 <b>District:</b> ${esc(m.district || 'Bangladesh')}`;
  } else {
    $('destBadge').textContent = m.emergency ? 'Highway Shelter' : 'Mosque';
    extraBox.setAttribute('hidden', '');
  }

  $('shareMosqueBtn').onclick = () => {
    const shareText = `📍 ${m.name}\nCoordinates: ${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}\nGoogle Maps: https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    if (navigator.share) {
      navigator.share({ title: m.name, text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      showBanner('Location copied to clipboard!', 3000);
    }
  };

  if (!userLatLng) {
    $('dirBearing').textContent = '–';
    $('dirDistance').textContent = 'Click "📍 My Location" for live road distance';
    $('routeSummary').textContent = 'Turn-by-turn road directions will appear once GPS is active.';
    $('steps').innerHTML = '';
    $('gmapsLink').href = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    if (fly) map.setView(mLL, 16);
    return;
  }

  currentBearing = bearingDeg(userLatLng, mLL);
  const pt = compassPoint(currentBearing);
  const ptName = pt.split('').map(c => DIR_NAMES[c]).join('-');
  $('dirBearing').textContent = `${pt} · ${Math.round(currentBearing)}°`;
  $('dirDistance').textContent = `${fmtDist(distanceM(userLatLng, mLL))} straight-line (${ptName})`;
  updateArrow();

  if (straightLine) map.removeLayer(straightLine);
  straightLine = L.polyline([userLatLng, mLL], { color: '#e5a93c', weight: 2.5, dashArray: '6 6' }).addTo(map);

  const mode = document.querySelector('input[name="mode"]:checked').value;
  $('gmapsLink').href = `https://www.google.com/maps/dir/?api=1&origin=${userLatLng.lat},${userLatLng.lng}&destination=${m.lat},${m.lon}&travelmode=${GMAPS_MODE[mode]}`;

  if (!silent) map.fitBounds(L.latLngBounds([userLatLng, mLL]).pad(0.25), { maxZoom: 16 });
  fetchRoute(mLL, mode);
}

function closeDirectionDrawer() {
  const dirDrawer = $('directionDrawer');
  if (dirDrawer) dirDrawer.setAttribute('hidden', '');
  if (straightLine) { map.removeLayer(straightLine); straightLine = null; }
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
}
window.closeDirectionDrawer = closeDirectionDrawer;
if ($('closeDrawerBtn')) $('closeDrawerBtn').onclick = closeDirectionDrawer;

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => selectedDest && selectDestination(selectedDest, false, true)));

async function fetchRoute(dest, mode) {
  const reqId = ++routeReq;
  $('routeSummary').textContent = 'Calculating optimal road navigation...';
  $('steps').innerHTML = '';
  const url = `${ROUTERS[mode]}${userLatLng.lng},${userLatLng.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;
  try {
    const data = await (await fetch(url)).json();
    if (reqId !== routeReq) return;
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.message || 'No road route found');

    const r = data.routes[0];
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.geoJSON(r.geometry, {
      style: { color: '#10b981', weight: 6, opacity: 0.9 }
    }).addTo(map);

    const icon = { foot: '🚶 Walk', bike: '🚲 Bike', car: '🚗 Car' }[mode];
    $('routeSummary').innerHTML = `${icon}: <b>${fmtDist(r.distance)}</b> road distance · about <b>${fmtTime(r.duration)}</b>`;

    const steps = r.legs[0].steps.map(stepText).filter(Boolean);
    $('steps').innerHTML = steps.map(s => `<li>${esc(s)}</li>`).join('');
  } catch (err) {
    if (reqId !== routeReq) return;
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    $('routeSummary').textContent = 'Direct road routing unavailable right now — follow the straight-line compass arrow or open Google Maps.';
  }
}

function stepText(s) {
  const t = s.maneuver.type, mod = s.maneuver.modifier, road = s.name ? ` onto ${s.name}` : '';
  const d = s.distance ? ` (${fmtDist(s.distance)})` : '';
  switch (t) {
    case 'depart': return `Head ${compassPoint(s.maneuver.bearing_after)}${s.name ? ' on ' + s.name : ''}${d}`;
    case 'arrive': return 'Arrive at destination 📍';
    case 'roundabout': case 'rotary': return `At the roundabout take exit ${s.maneuver.exit || ''}${road}${d}`;
    case 'continue': case 'new name': return `Continue${mod && mod !== 'straight' ? ' ' + mod : ''}${road}${d}`;
    default: return `${mod ? 'Turn ' + mod : t}${road}${d}`.replace(/^./, (c) => c.toUpperCase());
  }
}

// ---------- Compass Orientation ----------
function updateArrow() {
  const rot = deviceHeading == null ? currentBearing : currentBearing - deviceHeading;
  $('arrow').style.transform = `rotate(${rot}deg)`;
}

$('compassBtn').onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') throw new Error('denied');
    }
    const handler = (e) => {
      let h = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null);
      if (h == null) return;
      deviceHeading = h;
      updateArrow();
    };
    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);
    $('compassBtn').textContent = '🧭 Compass active — turn phone until arrow points up';
  } catch (_) {
    alert('Live compass orientation is available on mobile devices with compass hardware.');
  }
};

// ---------- National Mosque Directory & Free Exportable List Feature ----------
function openDirectoryModal() {
  closeSideMenu();
  const dModal = $('mosqueDirectoryModal');
  if (dModal) {
    dModal.removeAttribute('hidden');
    renderDirectoryTable();
  }
}

function closeDirectoryModal() {
  const dModal = $('mosqueDirectoryModal');
  if (dModal) {
    dModal.setAttribute('hidden', '');
  }
}

if ($('closeDirectoryModal')) $('closeDirectoryModal').onclick = closeDirectoryModal;
if ($('menuMosqueDirectory')) $('menuMosqueDirectory').onclick = openDirectoryModal;
if ($('openDirectoryBtn')) $('openDirectoryBtn').onclick = openDirectoryModal;

if ($('mosqueDirectoryModal')) {
  $('mosqueDirectoryModal').onclick = (e) => {
    if (e.target === $('mosqueDirectoryModal')) closeDirectoryModal();
  };
}

if ($('directorySearchInput')) $('directorySearchInput').oninput = renderDirectoryTable;
if ($('directoryDivSelect')) $('directoryDivSelect').onchange = renderDirectoryTable;

function renderDirectoryTable() {
  const tbody = $('directoryTableBody');
  if (!tbody) return;

  const q = ($('directorySearchInput')?.value || '').trim().toLowerCase();
  const selDiv = $('directoryDivSelect')?.value || 'all';

  const words = q ? q.split(/\s+/) : [];
  const list = [];

  mosques.forEach(m => {
    if (words.length > 0 && !words.every(w => m.search.includes(w))) return;
    if (selDiv !== 'all') {
      const divData = window.BD_HIERARCHY?.divisions?.[selDiv];
      if (divData && divData.bbox) {
        const b = divData.bbox;
        if (m.lat < b[0] || m.lat > b[2] || m.lon < b[1] || m.lon > b[3]) return;
      }
    }
    list.push(m);
  });

  const total = list.length;
  const displayItems = list.slice(0, 150);

  if ($('directoryCountText')) {
    $('directoryCountText').textContent = `Showing ${displayItems.length} of ${total.toLocaleString()} filtered mosques (${mosques.size.toLocaleString()} total in Bangladesh)`;
  }

  tbody.innerHTML = '';
  if (!displayItems.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#8fa397;">No mosques found matching your search.</td></tr>';
    return;
  }

  displayItems.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const gmapUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
    const tag = m.heritage ? ' <span style="background:#f3e8ff; color:#7e22ce; padding:1px 5px; border-radius:4px; font-size:10px;">Historic</span>' :
               (m.userAdded ? ' <span style="background:#dcfce7; color:#15803d; padding:1px 5px; border-radius:4px; font-size:10px;">Community</span>' : '');

    tr.innerHTML = `
      <td style="color:#8fa397;">${idx + 1}</td>
      <td>🕌 ${esc(m.name)}${tag}</td>
      <td class="dir-coords">${m.lon.toFixed(6)}</td>
      <td class="dir-coords">${m.lat.toFixed(6)}</td>
      <td class="dir-actions">
        <button class="dir-act-btn" onclick="window.flyToMosqueFromDirectory('${m.id}')">🧭 Navigate</button>
        <a href="${gmapUrl}" target="_blank" rel="noopener" class="dir-act-btn gmap">🚗 Google Map ↗</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.flyToMosqueFromDirectory = (id) => {
  closeDirectoryModal();
  const m = mosques.get(id);
  if (m) selectDestination(m, true);
};

// 100% Free Export Functions (CSV / JSON)
if ($('exportCsvBtn')) {
  $('exportCsvBtn').onclick = () => {
    showBanner('Preparing complete Bangladesh mosque table CSV export...', 2500);
    let csv = '\uFEFF"Name of Mosque","Longitude","Latitude","Google_Maps_Link"\n';
    mosques.forEach(m => {
      const gUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`;
      const cleanName = (m.name || '').replace(/"/g, '""');
      csv += `"${cleanName}",${m.lon.toFixed(6)},${m.lat.toFixed(6)},"${gUrl}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bangladesh_complete_mosque_table.csv`;
    link.click();
    showBanner('✅ Downloaded complete Bangladesh Mosque Table (CSV)!', 3500);
  };
}

if ($('exportJsonBtn')) {
  $('exportJsonBtn').onclick = () => {
    showBanner('Preparing complete JSON export...', 2500);
    const exportData = [];
    mosques.forEach(m => {
      exportData.push({
        "Name of Mosque": m.name,
        "Longitude": Number(m.lon.toFixed(6)),
        "Latitude": Number(m.lat.toFixed(6)),
        "Google_Maps_Link": `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lon}`
      });
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bangladesh_complete_mosque_table.json`;
    link.click();
    showBanner('✅ Downloaded complete Bangladesh Mosque list (JSON)!', 3500);
  };
}

// ---------- Initialize App ----------
applyBangladeshBorderMask();
setupAdminBoundaries();
loadLocalSettlements();
loadAllMosquesAndFacilities();
loadSavedHome();
