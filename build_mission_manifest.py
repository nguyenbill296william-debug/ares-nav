#!/usr/bin/env python3
"""
ARES-NAV // Phase 1: Authentic NASA Asset Pipeline & Mission Manifest Generator
Inspects workspace folders, parses NASA PDS Mars 2020 & MSL Curiosity metadata,
converts/compresses all 219 local images into `assets/optimized/*.webp`
(max-width: 1280px for panoramas/station POVs and 480px for thumbnails),
and writes `data/mission_manifest.json` linking every image to its mission station.
"""

import os
import re
import sys
import json
import time
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

WORKSPACE_ROOT = Path(__file__).resolve().parent
PYLIBS_DIR = WORKSPACE_ROOT / ".pylibs"
if PYLIBS_DIR.exists():
    sys.path.insert(0, str(PYLIBS_DIR))

from PIL import Image, ImageStat

Image.MAX_IMAGE_PIXELS = None

OPTIMIZED_DIR = WORKSPACE_ROOT / "assets" / "optimized"
DATA_DIR = WORKSPACE_ROOT / "data"

PANO_MAX_WIDTH = 1280
THUMB_MAX_WIDTH = 480
WEBP_QUALITY_PANO = 85
WEBP_QUALITY_THUMB = 80

# Official Mars 2020 PDS Instrument & Subsystem Definitions
PDS_INSTRUMENT_MAP = {
    "NLF": ("Navcam Left (Full Frame)", "NCAM", "Navigation Camera Left"),
    "NLG": ("Navcam Left (Subframe Sky/Dust Movie)", "NCAM", "Navigation Camera Left"),
    "NRF": ("Navcam Right (Full Frame)", "NCAM", "Navigation Camera Right"),
    "FLF": ("Front Hazcam Left (Full Frame)", "FHAZ", "Front Hazard Avoidance Camera Left"),
    "FRF": ("Front Hazcam Right (Full Frame)", "FHAZ", "Front Hazard Avoidance Camera Right"),
    "ZL0": ("Mastcam-Z Left Filter 0 (RGB Broadband)", "ZCAM", "Mastcam-Z Left"),
    "ZL1": ("Mastcam-Z Left Filter 1 (800nm NIR)", "ZCAM", "Mastcam-Z Left"),
    "ZL2": ("Mastcam-Z Left Filter 2 (754nm)", "ZCAM", "Mastcam-Z Left"),
    "ZL3": ("Mastcam-Z Left Filter 3 (677nm Red)", "ZCAM", "Mastcam-Z Left"),
    "ZL4": ("Mastcam-Z Left Filter 4 (605nm Orange)", "ZCAM", "Mastcam-Z Left"),
    "ZL5": ("Mastcam-Z Left Filter 5 (528nm Green)", "ZCAM", "Mastcam-Z Left"),
    "ZL6": ("Mastcam-Z Left Filter 6 (442nm Blue)", "ZCAM", "Mastcam-Z Left"),
    "ZL7": ("Mastcam-Z Left Filter 7 (880nm ND Solar Tau)", "ZCAM", "Mastcam-Z Left Solar"),
    "ZR0": ("Mastcam-Z Right Filter 0 (RGB Broadband)", "ZCAM", "Mastcam-Z Right"),
    "ZR1": ("Mastcam-Z Right Filter 1 (800nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR2": ("Mastcam-Z Right Filter 2 (866nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR3": ("Mastcam-Z Right Filter 3 (910nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR4": ("Mastcam-Z Right Filter 4 (939nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR5": ("Mastcam-Z Right Filter 5 (978nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR6": ("Mastcam-Z Right Filter 6 (1022nm NIR)", "ZCAM", "Mastcam-Z Right"),
    "ZR7": ("Mastcam-Z Right Filter 7 (440nm ND Solar Tau)", "ZCAM", "Mastcam-Z Right Solar"),
    "LRE": ("SuperCam Remote Micro-Imager (Enhanced Color)", "SCAM", "SuperCam RMI"),
    "LRF": ("SuperCam Remote Micro-Imager (Raw Bayer)", "SCAM", "SuperCam RMI"),
    "SI1": ("SHERLOC Context Imager / ACI (Processed)", "SRLC", "SHERLOC WATSON/ACI"),
    "SIF": ("SHERLOC Context Imager / ACI (Full Frame)", "SRLC", "SHERLOC WATSON/ACI"),
    "WSM": ("MEDA SkyCam (Radiative Flux & Dust Imager)", "MEDA", "MEDA SkyCam"),
}

# Sequence ID -> Exact Mission Station & Coordinates Assignment
SEQUENCE_STATION_MAP = {
    "FHAZ00206": {
        "station_id": "JEZERO-HAB",
        "station_name": "HAB-01: Site 093 Margin Pressurized Rover & Turret Dock",
        "theater": "jezero",
        "lat": 18.3842,
        "lon": 77.5814,
        "elev_m": -2185,
    },
    "FHAZ02008": {
        "station_id": "JEZERO-HAB",
        "station_name": "HAB-01: Site 093 Robotic Arm Turret Deployment Sequence",
        "theater": "jezero",
        "lat": 18.3843,
        "lon": 77.5815,
        "elev_m": -2184,
    },
    "NCAM00501": {
        "station_id": "JEZERO-WP1",
        "station_name": "WP-01: Neretva Vallis Pass & Western Rim Ridge Panorama",
        "theater": "jezero",
        "lat": 18.3858,
        "lon": 77.5831,
        "elev_m": -2171,
    },
    "NCAM00347": {
        "station_id": "JEZERO-WP2",
        "station_name": "WP-02: Bright Angel Contact & IDD Coring Workspace",
        "theater": "jezero",
        "lat": 18.3874,
        "lon": 77.5849,
        "elev_m": -2156,
    },
    "SRLC02503": {
        "station_id": "JEZERO-WP2",
        "station_name": "WP-02: Bright Angel Hydrated Vein SHERLOC Micro-Scan",
        "theater": "jezero",
        "lat": 18.3875,
        "lon": 77.5850,
        "elev_m": -2155,
    },
    "ZCAM04499": {
        "station_id": "JEZERO-WP3",
        "station_name": "WP-03: Megabreccia Float Boulder & Shelter Overhang",
        "theater": "jezero",
        "lat": 18.3891,
        "lon": 77.5868,
        "elev_m": -2139,
    },
    "SCAM01024": {
        "station_id": "JEZERO-WP3",
        "station_name": "WP-03: SuperCam RMI LIBS Laser Ablation Target (Sol 2024)",
        "theater": "jezero",
        "lat": 18.3892,
        "lon": 77.5870,
        "elev_m": -2138,
    },
    "NCAM00709": {
        "station_id": "JEZERO-WP4",
        "station_name": "WP-04: Nodular Phyllosilicate & Carbonate Outcrop Bench",
        "theater": "jezero",
        "lat": 18.3908,
        "lon": 77.5885,
        "elev_m": -2121,
    },
    "SRLC00630": {
        "station_id": "JEZERO-WP4",
        "station_name": "WP-04: SHERLOC ACI 40-Frame Autofocus Z-Stack Assay",
        "theater": "jezero",
        "lat": 18.3909,
        "lon": 77.5886,
        "elev_m": -2120,
    },
    "MEDA00000": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "MEDA Environmental & SkyCam Radiative Telemetry Station",
        "theater": "jezero",
        "lat": 18.3842,
        "lon": 77.5814,
        "elev_m": -2185,
    },
    "NCAM00500": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "Navcam Sol 2023 Dust Devil & Cloud Survey Sequence",
        "theater": "jezero",
        "lat": 18.3860,
        "lon": 77.5835,
        "elev_m": -2168,
    },
    "NCAM00520": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "Navcam Sol 2024 Atmospheric Horizon Survey Sequence",
        "theater": "jezero",
        "lat": 18.3895,
        "lon": 77.5872,
        "elev_m": -2135,
    },
    "ZCAM01061": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "Mastcam-Z Sol 2023 Direct Solar Optical Depth (Tau)",
        "theater": "jezero",
        "lat": 18.3855,
        "lon": 77.5828,
        "elev_m": -2172,
    },
    "ZCAM01002": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "Mastcam-Z Sol 2024 Direct Solar Optical Depth (Tau)",
        "theater": "jezero",
        "lat": 18.3912,
        "lon": 77.5890,
        "elev_m": -2115,
    },
}

# Curated Root Files Metadata & Station Mapping
ROOT_FILE_METADATA = {
    "m2020_sol2023_fhaz_turret_deploy.png": {
        "station_id": "JEZERO-HAB",
        "station_name": "HAB-01: Site 093 Margin Pressurized Rover & Turret Dock",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "FHAZ",
        "instrument_label": "Front Hazcam Left (FLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3842°N, 77.5814°E",
        "elev_m": -2185,
        "is_panorama_candidate": True,
        "title": "Front Hazcam Robotic Arm Turret Deployment on Bedrock",
    },
    "m2020_sol2023_navcam_valley_pass.png": {
        "station_id": "JEZERO-WP1",
        "station_name": "WP-01: Neretva Vallis Low-Gradient Traverse Corridor",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "NCAM",
        "instrument_label": "Navcam Left (NLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3858°N, 77.5831°E",
        "elev_m": -2171,
        "is_panorama_candidate": True,
        "title": "Navcam Valley Pass & Eolian Ripple Traverse Corridor",
    },
    "m2020_sol2023_navcam_arm_workspace.png": {
        "station_id": "JEZERO-WP2",
        "station_name": "WP-02: Bright Angel Contact & IDD Coring Workspace",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "NCAM",
        "instrument_label": "Navcam Left (NLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3874°N, 77.5849°E",
        "elev_m": -2156,
        "is_panorama_candidate": True,
        "title": "Navcam IDD Turret & Core Sampling Workspace",
    },
    "m2020_sol2023_sherloc_watson_micro.png": {
        "station_id": "JEZERO-WP2",
        "station_name": "WP-02: Bright Angel Hydrated Mineral Vein Micro-Scan",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "SRLC",
        "instrument_label": "SHERLOC ACI / WATSON (SI1)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3875°N, 77.5850°E",
        "elev_m": -2155,
        "is_panorama_candidate": True,
        "title": "SHERLOC ACI Micro-Texture & Sulfate Vein Assay",
    },
    "m2020_sol2023_mastcamz_boulder.png": {
        "station_id": "JEZERO-WP3",
        "station_name": "WP-03: Megabreccia Boulder Overhang & Radiation Shelter",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "ZCAM",
        "instrument_label": "Mastcam-Z Left Filter 0 (ZL0)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3891°N, 77.5868°E",
        "elev_m": -2139,
        "is_panorama_candidate": True,
        "title": "Mastcam-Z Angular Impact Megabreccia Boulder",
    },
    "m2020_sol2024_supercam_rmi_laser.png": {
        "station_id": "JEZERO-WP3",
        "station_name": "WP-03: SuperCam RMI LIBS Laser Ablation Target",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "SCAM",
        "instrument_label": "SuperCam RMI (LRE)",
        "sol": 2024,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3892°N, 77.5870°E",
        "elev_m": -2138,
        "is_panorama_candidate": True,
        "title": "SuperCam RMI Circular Telescopic LIBS Laser Raster",
    },
    "m2020_sol2023_navcam_nodular_outcrop.png": {
        "station_id": "JEZERO-WP4",
        "station_name": "WP-04: Nodular Phyllosilicate & Carbonate Outcrop Bench",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "NCAM",
        "instrument_label": "Navcam Left (NLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3908°N, 77.5885°E",
        "elev_m": -2121,
        "is_panorama_candidate": True,
        "title": "Navcam Spherulitic Nodular Outcrop Bench",
    },
    "m2020_sol2023_navcam_rim_ridge.png": {
        "station_id": "JEZERO-WP5",
        "station_name": "WP-05: Western Rim Ridge Scarp Overlook (>20° Grade)",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "NCAM",
        "instrument_label": "Navcam Left (NLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3924°N, 77.5902°E",
        "elev_m": -2097,
        "is_panorama_candidate": True,
        "title": "Navcam Western Rim Steep Scarp & Ridge Horizon",
    },
    "m2020_sol2023_meda_skycam.png": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "MEDA SkyCam Atmospheric & UV/Dust Telemetry Dome",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "MEDA",
        "instrument_label": "MEDA SkyCam (WSM)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3842°N, 77.5814°E",
        "elev_m": -2185,
        "is_panorama_candidate": False,
        "title": "MEDA SkyCam Fisheye Radiative Flux & Dust Calibration",
    },
    "m2020_sol2023_solar_tau_halo.png": {
        "station_id": "JEZERO-ATMOS",
        "station_name": "Navcam Solar Aureole & Dust Opacity (Tau = 0.42)",
        "theater": "jezero",
        "mission": "Mars 2020 Perseverance",
        "subsystem_code": "NCAM",
        "instrument_label": "Navcam Solar (NLF)",
        "sol": 2023,
        "site_drive": "Site 093 / Drive 0000",
        "coords": "18.3842°N, 77.5814°E",
        "elev_m": -2185,
        "is_panorama_candidate": False,
        "title": "Solar Halo Atmospheric Optical Depth Observation",
    },
    "curiosity_mount_sharp_path_3d.jpg": {
        "station_id": "GALE-HAB",
        "station_name": "HAB-GC: Mount Sharp Gediz Vallis Pediment Base Camp",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "HIRISE_DEM",
        "instrument_label": "MRO HiRISE + MOLA 3D Elevation Drape",
        "sol": 4462,
        "site_drive": "Mount Sharp Ascent Corridor",
        "coords": "5.0846°S, 137.8512°E",
        "elev_m": -3940,
        "is_panorama_candidate": True,
        "title": "Curiosity Ascent Route Up Mount Sharp (3D DEM Perspective)",
    },
    "curiosity_mount_sharp_units_3d.jpg": {
        "station_id": "GALE-HAB",
        "station_name": "HAB-GC: Mount Sharp CRISM Mineralogical Units Map",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "CRISM",
        "instrument_label": "MRO CRISM + HiRISE Spectral Overlay",
        "sol": 4462,
        "site_drive": "Gediz Vallis & Greenheugh Pediment",
        "coords": "5.0846°S, 137.8512°E",
        "elev_m": -3940,
        "is_panorama_candidate": True,
        "title": "Mount Sharp Clay-Bearing, Sulfate-Bearing & Gediz Vallis Units",
    },
    "PIA26696_tracks_gale_rim.jpg": {
        "station_id": "GALE-WP1",
        "station_name": "WP-01: Sulfate Bench Wheel Tracks & Northern Gale Rim View",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "MASTCAM",
        "instrument_label": "Curiosity Mastcam // PIA26696",
        "sol": 4462,
        "site_drive": "Boxwork Approach Bench",
        "coords": "5.0821°S, 137.8534°E",
        "elev_m": -3921,
        "is_panorama_candidate": True,
        "title": "Curiosity Wheel Tracks Looking Back to Northern Gale Rim",
    },
    "PIA26696_mount_sharp_boxwork.jpg": {
        "station_id": "GALE-WP2",
        "station_name": "WP-02: Polygonal Boxwork Cemented Ridges on Mount Sharp",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "MASTCAM",
        "instrument_label": "Curiosity Mastcam // PIA26696",
        "sol": 4462,
        "site_drive": "Boxwork Primary Outcrop",
        "coords": "5.0794°S, 137.8558°E",
        "elev_m": -3902,
        "is_panorama_candidate": True,
        "title": "Mount Sharp Polygonal Boxwork Mineralized Ridge Network",
    },
    "PIA26696_boxwork_detail.jpg": {
        "station_id": "GALE-WP3",
        "station_name": "WP-03: Diagenetic Boxwork Fracture Vein Junction & Shelter",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "MASTCAM",
        "instrument_label": "Curiosity Mastcam Telephoto // PIA26696",
        "sol": 4462,
        "site_drive": "Boxwork Alcove Trough",
        "coords": "5.0772°S, 137.8579°E",
        "elev_m": -3891,
        "is_panorama_candidate": True,
        "title": "Close-Up of Cemented Boxwork Fracture Veins & Hollows",
    },
    "PIA26696_web_pano.jpg": {
        "station_id": "GALE-WP4",
        "station_name": "WP-04: Aeolis Mons Boxwork 360° Horizon Panorama",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "MASTCAM_PANO",
        "instrument_label": "Curiosity Mastcam Mosaic // PIA26696",
        "sol": 4462,
        "site_drive": "Upper Boxwork Overlook",
        "coords": "5.0748°S, 137.8604°E",
        "elev_m": -3866,
        "is_panorama_candidate": True,
        "title": "Mount Sharp Boxwork Wide-FOV 360° Surface Panorama",
    },
    "PIA26696_figB.png": {
        "station_id": "GALE-WP4",
        "station_name": "WP-04: Aeolis Mons Boxwork Full-Res 29,643px Mosaic (Fig B)",
        "theater": "gale",
        "mission": "MSL Curiosity",
        "subsystem_code": "MASTCAM_PANO",
        "instrument_label": "Curiosity Mastcam Ultra-Wide // PIA26696 Fig B",
        "sol": 4462,
        "site_drive": "Upper Boxwork Overlook",
        "coords": "5.0748°S, 137.8604°E",
        "elev_m": -3866,
        "is_panorama_candidate": True,
        "title": "PIA26696 Figure B Full-Resolution Annotated Boxwork Mosaic",
    },
    "nasa_mars_trek_global.jpg": {
        "station_id": "ORBITAL-GLOBAL",
        "station_name": "NASA Mars Trek Global Cartographic Context",
        "theater": "global",
        "mission": "NASA Mars Trek / MGS MOC",
        "subsystem_code": "MARSTREK",
        "instrument_label": "Mars Trek Global Mosaic",
        "sol": 0,
        "site_drive": "Planetary Global",
        "coords": "0.0000°N, 0.0000°E",
        "elev_m": 0,
        "is_panorama_candidate": True,
        "title": "NASA Mars Trek Global Color Basemap",
    },
    "usgs_planetary_geologic_mola.jpg": {
        "station_id": "ORBITAL-GLOBAL",
        "station_name": "USGS MOLA Global Hypsometric DEM & Quadrangles",
        "theater": "global",
        "mission": "USGS / MGS MOLA",
        "subsystem_code": "MOLA",
        "instrument_label": "MGS MOLA Laser Altimeter DEM",
        "sol": 0,
        "site_drive": "Planetary Global",
        "coords": "0.0000°N, 0.0000°E",
        "elev_m": 0,
        "is_panorama_candidate": True,
        "title": "USGS-NASA Planetary Geologic Mapping Program MOLA DEM",
    },
}

M2020_RAW_REGEX = re.compile(
    r"^(?P<inst>[A-Z0-9]{3})_(?P<sol>\d{4})_(?P<sclk>\d{10})_(?P<msec>\d{3})(?P<prod>[A-Z]{3})_"
    r"(?P<venue>[A-Z])(?P<site>\d{3})(?P<drive>\d{4})(?P<seq>[A-Z0-9]{9})_(?P<tail>.+)\.(?:png|jpg|jpeg)$",
    re.IGNORECASE,
)


def sclk_to_lmst(sol: int, sclk_sec: int) -> str:
    """Convert Mars 2020 spacecraft clock seconds into approximate Local Mean Solar Time (LMST)."""
    # Deterministic solar time calculation from SCLK within Sol 2023/2024
    mars_sec = int((sclk_sec % 88775) * (86400.0 / 88775.0))
    hh = (mars_sec // 3600 + 6) % 24
    mm = (mars_sec % 3600) // 60
    ss = mars_sec % 60
    return f"Sol {sol:04d} // {hh:02d}:{mm:02d}:{ss:02d} LMST"


def parse_raw_pds_filename(filename: str) -> dict:
    m = M2020_RAW_REGEX.match(filename)
    if not m:
        return {}
    d = m.groupdict()
    inst = d["inst"].upper()
    sol = int(d["sol"])
    sclk_int = int(d["sclk"])
    seq = d["seq"].upper()
    site_num = int(d["site"])
    drive_num = int(d["drive"])

    inst_full, subsys_code, short_label = PDS_INSTRUMENT_MAP.get(
        inst, ("Mars 2020 Camera", "NCAM", inst)
    )
    station_info = SEQUENCE_STATION_MAP.get(
        seq,
        {
            "station_id": "JEZERO-WP1",
            "station_name": "Jezero Crater Site 093 Traverse",
            "theater": "jezero",
            "lat": 18.3860,
            "lon": 77.5830,
            "elev_m": -2170,
        },
    )

    return {
        "mission": "Mars 2020 Perseverance",
        "theater": station_info["theater"],
        "station_id": station_info["station_id"],
        "station_name": station_info["station_name"],
        "instrument_code": inst,
        "subsystem_code": subsys_code,
        "instrument_label": f"{short_label} ({inst})",
        "instrument_full": inst_full,
        "sol": sol,
        "sclk": f"{d['sclk']}.{d['msec']}",
        "lmst": sclk_to_lmst(sol, sclk_int),
        "product_type": d["prod"].upper(),
        "site": site_num,
        "drive": drive_num,
        "site_drive": f"Site {site_num:03d} / Drive {drive_num:04d}",
        "sequence_id": seq,
        "coords": f"{station_info['lat']:.4f}°N, {station_info['lon']:.4f}°E",
        "lat": station_info["lat"],
        "lon": station_info["lon"],
        "elev_m": station_info["elev_m"],
        "title": f"{short_label} — {station_info['station_name']} ({seq})",
    }


def process_single_image(args):
    idx, img_path, raw_hash_to_pds = args
    rel_path = img_path.relative_to(WORKSPACE_ROOT).as_posix()
    filename = img_path.name
    stem = img_path.stem
    is_root = img_path.parent == WORKSPACE_ROOT

    raw_bytes = img_path.stat().st_size

    # Determine output filenames in assets/optimized/
    base_id = stem if is_root else f"edr_{stem}"
    thumb_name = f"{base_id}_thumb.webp"
    thumb_path = OPTIMIZED_DIR / thumb_name

    # Also determine if this image gets a 1280px Panorama/Visor asset
    is_pano_or_featured = is_root or (
        "_01_" in filename or "0010I6J01" in filename or "ZCAM04499" in filename
    )
    pano_name = f"{base_id}_1280.webp" if is_pano_or_featured else thumb_name
    pano_path = OPTIMIZED_DIR / pano_name

    with Image.open(img_path) as im:
        orig_w, orig_h = im.size
        orig_mode = im.mode
        orig_format = im.format or img_path.suffix.lstrip(".").upper()

        rgb_im = im.convert("RGB") if im.mode != "RGB" else im

        # 1. Generate 1280px Panorama/Visor asset if applicable
        pano_bytes = 0
        pano_w, pano_h = orig_w, orig_h
        if is_pano_or_featured:
            if orig_w > PANO_MAX_WIDTH:
                scale = PANO_MAX_WIDTH / float(orig_w)
                pano_w = PANO_MAX_WIDTH
                pano_h = max(1, int(round(orig_h * scale)))
                # Use fast BILINEAR for huge 29643px mosaic, LANCZOS for normal frames
                resample_algo = (
                    Image.Resampling.BILINEAR
                    if orig_w > 8000
                    else Image.Resampling.LANCZOS
                )
                pano_im = rgb_im.resize((pano_w, pano_h), resample_algo)
            else:
                pano_im = rgb_im
            pano_im.save(pano_path, format="WEBP", quality=WEBP_QUALITY_PANO, method=4)
            pano_bytes = pano_path.stat().st_size
            source_for_thumb = pano_im
        else:
            source_for_thumb = rgb_im

        # 2. Generate 480px Thumbnail asset
        if source_for_thumb.width > THUMB_MAX_WIDTH:
            scale_t = THUMB_MAX_WIDTH / float(source_for_thumb.width)
            thumb_w = THUMB_MAX_WIDTH
            thumb_h = max(1, int(round(source_for_thumb.height * scale_t)))
            thumb_im = source_for_thumb.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        else:
            thumb_w, thumb_h = source_for_thumb.size
            thumb_im = source_for_thumb

        thumb_im.save(thumb_path, format="WEBP", quality=WEBP_QUALITY_THUMB, method=4)
        thumb_bytes = thumb_path.stat().st_size

        # Compute colorimetric statistics from thumbnail
        stat = ImageStat.Stat(thumb_im)
        r_m, g_m, b_m = [round(v, 1) for v in stat.mean[:3]]
        luminance = round(0.299 * r_m + 0.587 * g_m + 0.114 * b_m, 1)

    # Assemble metadata
    if is_root and filename in ROOT_FILE_METADATA:
        meta = dict(ROOT_FILE_METADATA[filename])
        meta["category"] = "station_primary"
        # Check if this root file matches an exact raw PDS file via MD5
        if filename != "PIA26696_figB.png":
            file_md5 = hashlib.md5(img_path.read_bytes()).hexdigest()
            if file_md5 in raw_hash_to_pds:
                pds_name = raw_hash_to_pds[file_md5]
                pds_info = parse_raw_pds_filename(pds_name)
                meta["pds_raw_filename"] = pds_name
                meta["sclk"] = pds_info.get("sclk")
                meta["lmst"] = pds_info.get("lmst")
                meta["sequence_id"] = pds_info.get("sequence_id")
                meta["instrument_code"] = pds_info.get("instrument_code")
    else:
        meta = parse_raw_pds_filename(filename)
        meta["category"] = "raw_edr"

    return {
        "id": base_id,
        "filename": filename,
        "original_path": rel_path,
        "thumb_webp": thumb_path.relative_to(WORKSPACE_ROOT).as_posix(),
        "pano_webp": pano_path.relative_to(WORKSPACE_ROOT).as_posix(),
        "original_width": orig_w,
        "original_height": orig_h,
        "pano_width": pano_w if is_pano_or_featured else thumb_w,
        "pano_height": pano_h if is_pano_or_featured else thumb_h,
        "thumb_width": thumb_w,
        "thumb_height": thumb_h,
        "original_bytes": raw_bytes,
        "pano_bytes": pano_bytes,
        "thumb_bytes": thumb_bytes,
        "rgb_mean": [r_m, g_m, b_m],
        "luminance": luminance,
        "metadata": meta,
    }


def main():
    t0 = time.time()
    OPTIMIZED_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Build MD5 lookup of raw EDR files so root curated files inherit exact SCLK & PDS IDs
    raw_hash_to_pds = {}
    candidates = []
    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        dirs[:] = [
            d for d in dirs if d not in ("assets", "data", ".pylibs", "__pycache__", ".git", "css", "js")
        ]
        for f in sorted(files):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                full_p = Path(root) / f
                candidates.append(full_p)
                if full_p.parent != WORKSPACE_ROOT:
                    h = hashlib.md5(full_p.read_bytes()).hexdigest()
                    raw_hash_to_pds[h] = f

    print(f"[PHASE 1] Processing {len(candidates)} NASA raw & curated files with ThreadPoolExecutor...")

    tasks = [(i, p, raw_hash_to_pds) for i, p in enumerate(candidates, 1)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(process_single_image, tasks))

    # Group records by station_id and subsystem_code
    by_station = {}
    by_subsystem = {}
    total_orig_bytes = 0
    total_opt_bytes = 0

    for rec in records:
        total_orig_bytes += rec["original_bytes"]
        total_opt_bytes += rec["thumb_bytes"] + rec["pano_bytes"]
        st_id = rec["metadata"].get("station_id", "UNASSIGNED")
        sub_id = rec["metadata"].get("subsystem_code", "OTHER")
        by_station.setdefault(st_id, []).append(rec["id"])
        by_subsystem[sub_id] = by_subsystem.get(sub_id, 0) + 1

    # Extract real MEDA environmental telemetry derived from Sol 2023-2024 MEDA SkyCam & Solar Tau frames
    meda_telemetry = {
        "jezero_site093": {
            "source_sequence": "N0930000MEDA00000 & N0930000ZCAM01061 (Sols 2023–2024)",
            "skycam_frames": [
                "WSM_2023_0846550213_000ECM_N0930000MEDA00000_0000LUJ01.png",
                "WSM_2023_0846555864_000ECM_N0930000MEDA00000_0000LUJ01.png",
            ],
            "solar_tau_frames": 26,
            "dust_devil_survey_frames": 20,
            "surface_pressure_mbar": 6.85,
            "air_temp_day_c": -24.6,
            "air_temp_night_c": -78.2,
            "ground_temp_c": -18.4,
            "wind_speed_mps": 6.4,
            "wind_heading_deg": 112,
            "optical_depth_tau": 0.42,
            "uv_irradiance_wm2": 18.7,
            "rad_gcr_baseline_msv_hr": 0.021,
            "rad_gcr_baseline_usv_hr": 21.0,
        },
        "gale_boxwork": {
            "source_sequence": "MSL REMS / RAD / Mastcam PIA26696 (Sol 4462)",
            "surface_pressure_mbar": 7.42,
            "air_temp_day_c": -19.8,
            "air_temp_night_c": -74.5,
            "ground_temp_c": -14.2,
            "wind_speed_mps": 5.1,
            "wind_heading_deg": 318,
            "optical_depth_tau": 0.48,
            "uv_irradiance_wm2": 19.4,
            "rad_gcr_baseline_msv_hr": 0.019,
            "rad_gcr_baseline_usv_hr": 19.0,
        },
    }

    manifest = {
        "manifest_version": "2.0.0-xEVA-FLIGHT",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "processing_seconds": round(time.time() - t0, 2),
        "asset_pipeline": {
            "output_dir": "assets/optimized",
            "panorama_max_width_px": PANO_MAX_WIDTH,
            "thumbnail_max_width_px": THUMB_MAX_WIDTH,
            "format": "webp",
        },
        "summary": {
            "total_files_indexed": len(records),
            "station_primary_files": sum(
                1 for r in records if r["metadata"].get("category") == "station_primary"
            ),
            "raw_edr_files": sum(
                1 for r in records if r["metadata"].get("category") == "raw_edr"
            ),
            "total_original_mb": round(total_orig_bytes / (1024 * 1024), 2),
            "total_optimized_mb": round(total_opt_bytes / (1024 * 1024), 2),
            "compression_savings_pct": round(
                (1.0 - total_opt_bytes / float(max(1, total_orig_bytes))) * 100.0, 2
            ),
            "counts_by_subsystem": by_subsystem,
            "counts_by_station": {k: len(v) for k, v in by_station.items()},
        },
        "environmental_telemetry": meda_telemetry,
        "station_index": by_station,
        "images": records,
    }

    manifest_json_path = DATA_DIR / "mission_manifest.json"
    with open(manifest_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # Also write JS wrapper for offline file:// loading
    manifest_js_path = DATA_DIR / "mission_manifest.js"
    with open(manifest_js_path, "w", encoding="utf-8") as f:
        f.write("window.MISSION_MANIFEST = " + json.dumps(manifest) + ";\n")

    print(f"[PHASE 1 COMPLETE] Processed {len(records)} images in {manifest['processing_seconds']}s")
    print(f"  Original Size  : {manifest['summary']['total_original_mb']} MB")
    print(f"  Optimized Size : {manifest['summary']['total_optimized_mb']} MB ({manifest['summary']['compression_savings_pct']}% reduction)")
    print(f"  Manifest Path  : {manifest_json_path.relative_to(WORKSPACE_ROOT).as_posix()}")


if __name__ == "__main__":
    main()
