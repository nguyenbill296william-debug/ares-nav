import os
import sys
import json

sys.path.insert(0, r'd:\Nasa\.pylibs')
from PIL import Image

ROOT = r'd:\Nasa'

# 1. Parse M20_traverse.json and M20_waypoints.json into js/m20_gps_data.js
print('Parsing M20_traverse.json and M20_waypoints.json...')
with open(os.path.join(ROOT, 'M20_traverse.json'), 'r', encoding='utf-8') as f:
    trav_json = json.load(f)

with open(os.path.join(ROOT, 'M20_waypoints.json'), 'r', encoding='utf-8') as f:
    wp_json = json.load(f)

# Extract full mission polyline (downsampled to ~350 points for smooth fast canvas rendering)
all_coords = []
for ft in trav_json.get('features', []):
    geom = ft.get('geometry', {})
    props = ft.get('properties', {})
    sol = props.get('sol', 0)
    coords = geom.get('coordinates', [])
    if geom.get('type') == 'LineString':
        for c in coords:
            if len(c) >= 2:
                all_coords.append([round(c[0], 6), round(c[1], 6), round(c[2], 1) if len(c) >= 3 else -2200.0, sol])

step = max(1, len(all_coords) // 350)
full_traverse_pts = all_coords[::step]
if all_coords and full_traverse_pts[-1] != all_coords[-1]:
    full_traverse_pts.append(all_coords[-1])

# Also extract high-resolution traverse points for the recent Western Rim / Neretva Vallis climb (Sols 1650 to 2022)
rim_traverse_pts = [pt for pt in all_coords if pt[3] >= 1650]
if len(rim_traverse_pts) > 250:
    rstep = max(1, len(rim_traverse_pts) // 250)
    rim_traverse_pts = rim_traverse_pts[::rstep]

# Extract key waypoints from M20_waypoints.json (especially Sites 85-93 + major mission milestones)
wp_features = wp_json.get('features', [])
major_waypoints = []
recent_site_waypoints = []

for i, ft in enumerate(wp_features):
    p = ft.get('properties', {})
    site = p.get('site', 0)
    sol = p.get('sol', 0)
    rmc = p.get('RMC', '')
    lon = p.get('lon')
    lat = p.get('lat')
    if lon is None or lat is None:
        continue
    item = {
        'rmc': rmc,
        'site': site,
        'drive': p.get('drive', 0),
        'sol': sol,
        'lon': round(float(lon), 6),
        'lat': round(float(lat), 6),
        'elev': round(float(p.get('elev_geoid', -2000.0)), 1),
        'easting': round(float(p.get('easting', 0.0)), 1),
        'northing': round(float(p.get('northing', 0.0)), 1),
        'roll': round(float(p.get('roll', 0.0)), 2),
        'pitch': round(float(p.get('pitch', 0.0)), 2),
        'yaw': round(float(p.get('yaw', 0.0)), 1),
        'tilt': round(float(p.get('tilt', 0.0)), 2),
        'dist_km': round(float(p.get('dist_km', 0.0)), 2),
        'dist_total_m': round(float(p.get('dist_total_m', 0.0)), 1)
    }
    if site >= 88 or i == len(wp_features) - 1:
        recent_site_waypoints.append(item)
    if i % 35 == 0 or site in (3, 10, 25, 45, 65, 78, 85, 90, 92, 93):
        major_waypoints.append(item)

# Deduplicate major_waypoints by site
seen_sites = set()
dedup_major = []
for mw in major_waypoints:
    if mw['site'] not in seen_sites or mw['rmc'] == '93_0':
        seen_sites.add(mw['site'])
        dedup_major.append(mw)

gps_summary = {
    'mission': 'Mars 2020 Perseverance Official Localization Dataset (M20_traverse.json + M20_waypoints.json)',
    'totalTraverseSegments': len(trav_json.get('features', [])),
    'totalWaypoints': len(wp_features),
    'startSol': 13,
    'latestSol': 2022,
    'latestRMC': '93_0',
    'latestSite': 93,
    'totalOdometryKm': 45.25,
    'totalOdometryMi': 28.11,
    'lonBounds': [77.216786, 77.463133],
    'latBounds': [18.419970, 18.499663],
    'elevBounds': [-2586.5, -1786.0],
    'fullTraverse': full_traverse_pts,
    'rimAscentTraverse': rim_traverse_pts,
    'milestoneWaypoints': dedup_major,
    'site88to93Waypoints': recent_site_waypoints[-28:]
}

with open(os.path.join(ROOT, 'js', 'm20_gps_data.js'), 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from official NASA M20_traverse.json & M20_waypoints.json\n')
    f.write('window.M20_GPS_DATA = ' + json.dumps(gps_summary, separators=(',', ':')) + ';\n')

print(f'Saved js/m20_gps_data.js ({len(full_traverse_pts)} full pts, {len(rim_traverse_pts)} rim pts, {len(recent_site_waypoints[-28:])} Site 88-93 fixes)')

# 2. Update data/mission_manifest.json and data/mission_manifest.js with the newly added NASA files
manifest_path = os.path.join(ROOT, 'data', 'mission_manifest.json')
with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

new_featured_entries = [
    {
        'id': '8k_mars',
        'filename': '8k_mars.jpg',
        'instrument': 'MRO MARCI / Viking Global Color Mosaic',
        'code': 'GLOBAL_8K',
        'role': '8K Seamless Equirectangular Planetary Albedo Map (8192×4096)',
        'sol': 4462,
        'site': 'GLOBAL',
        'sector': 'global',
        'dimensions': '8192x4096',
        'webUrl': 'assets/optimized/8k_mars_1280.webp',
        'thumbUrl': 'assets/optimized/8k_mars_480.webp',
        'coordinates': '0.0000°N, 0.0000°E (Global Equirectangular)'
    },
    {
        'id': 'PIA26335',
        'filename': 'PIA26335.jpg',
        'instrument': 'Mastcam-Z 360° Ultra-Wide Panorama (PIA26335)',
        'code': 'ZCAM_PANO',
        'role': 'Perseverance Neretva Vallis / Bright Angel 26,911×3,744 Panorama',
        'sol': 2023,
        'site': 'SITE_093',
        'sector': 'jezero',
        'dimensions': '26911x3744',
        'webUrl': 'assets/optimized/PIA26335_pano_2560.webp',
        'thumbUrl': 'assets/optimized/PIA26335_480.webp',
        'coordinates': '18.4356°N, 77.2332°E (-1,936m)'
    },
    {
        'id': 'PIA26374_map',
        'filename': 'e2_-_PIA26374_-_Rim_Drive_Map_-_Final.png',
        'instrument': 'MRO HiRISE + Perseverance Rim Drive Localization Map (PIA26374)',
        'code': 'HIRISE_GPS',
        'role': 'Official NASA Jezero Western Rim Climb Traverse Map',
        'sol': 2022,
        'site': 'SITE_093',
        'sector': 'jezero',
        'dimensions': '1129x929',
        'webUrl': 'assets/optimized/e2_-_PIA26374_-_Rim_Drive_Map_-_Final_1280.webp',
        'thumbUrl': 'assets/optimized/e2_-_PIA26374_-_Rim_Drive_Map_-_Final_480.webp',
        'coordinates': '18.4356°N, 77.2332°E (-1,936m)'
    },
    {
        'id': 'PIA26402',
        'filename': 'PIA26402.jpg',
        'instrument': 'MRO HiRISE Orbital Context Orthophoto (PIA26402)',
        'code': 'HIRISE_ORTHO',
        'role': 'High-Resolution Orbital Terrain Context Base Map',
        'sol': 2023,
        'site': 'SITE_093',
        'sector': 'jezero',
        'dimensions': '2653x2464',
        'webUrl': 'assets/optimized/PIA26402_1280.webp',
        'thumbUrl': 'assets/optimized/PIA26402_480.webp',
        'coordinates': '18.4356°N, 77.2332°E (-1,936m)'
    },
    {
        'id': 'PIA26344_selfie',
        'filename': 'pia26344-perseverance-selfie-at-cheyava.jpg',
        'instrument': 'SHERLOC WATSON 62-Frame Selfie at Cheyava Falls (PIA26344)',
        'code': 'WATSON_SELFIE',
        'role': 'Perseverance Rover & Sapphires Canyon Biosignature Core Sample',
        'sol': 1215,
        'site': 'BRIGHT_ANGEL',
        'sector': 'jezero',
        'dimensions': '10502x7458',
        'webUrl': 'assets/optimized/pia26344-perseverance-selfie-at-cheyava_1280.webp',
        'thumbUrl': 'assets/optimized/pia26344-perseverance-selfie-at-cheyava_480.webp',
        'coordinates': '18.4442°N, 77.3018°E (-2,140m)'
    },
    {
        'id': 'PIA23179',
        'filename': 'PIA23179.tif',
        'instrument': 'MRO HiRISE + MOLA 3D Perspective DEM (PIA23179)',
        'code': 'HIRISE_3D',
        'role': 'Curiosity Gale Crater & Mount Sharp 4K Orbital Perspective',
        'sol': 4462,
        'site': 'MOUNT_SHARP',
        'sector': 'gale',
        'dimensions': '3840x2160',
        'webUrl': 'assets/optimized/PIA23179_1280.webp',
        'thumbUrl': 'assets/optimized/PIA23179_480.webp',
        'coordinates': '5.0846°S, 137.8512°E (-3,940m)'
    },
    {
        'id': 'PIA18391',
        'filename': 'jpegPIA18391.jpg',
        'instrument': 'MRO HiRISE Gale Crater Regional Traverse Map (PIA18391)',
        'code': 'HIRISE_MAP',
        'role': 'Gale Crater Landing Ellipse to Mount Sharp Orbital Cartography',
        'sol': 4462,
        'site': 'GALE_REGIONAL',
        'sector': 'gale',
        'dimensions': '3300x2550',
        'webUrl': 'assets/optimized/jpegPIA18391_1280.webp',
        'thumbUrl': 'assets/optimized/jpegPIA18391_480.webp',
        'coordinates': '4.5895°S, 137.4417°E (-4,501m)'
    }
]

existing_ids = {item.get('id') for item in manifest.get('featuredAssets', [])}
for entry in new_featured_entries:
    if entry['id'] not in existing_ids:
        manifest.setdefault('featuredAssets', []).insert(0, entry)

manifest['totalUniqueImages'] = 232
manifest['gpsDatasets'] = {
    'traverseFile': 'M20_traverse.json',
    'waypointsFile': 'M20_waypoints.json',
    'totalTraverseSegments': 559,
    'totalLocalizationWaypoints': 708,
    'latestSite': 'Site 093 (RMC 93_0, Sol 2022–2024)',
    'totalOdometryKm': 45.25
}

with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

with open(os.path.join(ROOT, 'data', 'mission_manifest.js'), 'w', encoding='utf-8') as f:
    f.write('window.MISSION_MANIFEST = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')

print('Updated data/mission_manifest.json and data/mission_manifest.js!')
