#!/usr/bin/env python3
"""
NASA Mars Surface EVA Tactical & Scientific Navigation System
Step 1: Local Raw Image Indexer, Metadata Extractor & Thumbnail Compressor
"""

import os
import re
import sys
import json
import time
from pathlib import Path

# Support local standalone Pillow wheel directory (.pylibs)
WORKSPACE_ROOT = Path(__file__).resolve().parent
PYLIBS_DIR = WORKSPACE_ROOT / ".pylibs"
if PYLIBS_DIR.exists():
    sys.path.insert(0, str(PYLIBS_DIR))

from PIL import Image, ImageStat

# Allow large NASA panoramas (e.g., 289 MB PIA26696_figB.png at 29643x6655)
Image.MAX_IMAGE_PIXELS = None

THUMBNAIL_DIR = WORKSPACE_ROOT / "assets" / "thumbnails"
MAX_WIDTH = 640
WEBP_QUALITY = 82

# Official Mars 2020 Perseverance PDS Instrument Code Lookup
M2020_INSTRUMENTS = {
    "NLF": ("Navigation Camera - Left (Full Frame)", "NAVCAM", "Engineering / Traverse Hazard & Terrain Nav"),
    "NLG": ("Navigation Camera - Left (Subframe / Sky Movie)", "NAVCAM", "Atmospheric Dust Devil & Cloud Survey"),
    "NRF": ("Navigation Camera - Right (Full Frame)", "NAVCAM", "Stereo Elevation & Workspace Triangulation"),
    "FLF": ("Front Hazcam - Left (Full Frame)", "FHAZ", "Near-Field Obstacle & Robotic Arm Clearance"),
    "FRF": ("Front Hazcam - Right (Full Frame)", "FHAZ", "Near-Field Stereo Footing & Turret Safety"),
    "ZL0": ("Mastcam-Z Left (Filter 0 — Broadband RGB)", "MASTCAM-Z", "High-Res Geomorphology & Outcrop Context"),
    "ZL1": ("Mastcam-Z Left (Filter 1 — 800nm NIR)", "MASTCAM-Z", "VNIR Multispectral Mineralogy"),
    "ZL2": ("Mastcam-Z Left (Filter 2 — 754nm)", "MASTCAM-Z", "VNIR Ferric/Ferrous Iron Absorption"),
    "ZL3": ("Mastcam-Z Left (Filter 3 — 677nm Red)", "MASTCAM-Z", "VNIR Oxide & Hematite Mapping"),
    "ZL4": ("Mastcam-Z Left (Filter 4 — 605nm Orange)", "MASTCAM-Z", "VNIR Regolith & Alterite Discrimination"),
    "ZL5": ("Mastcam-Z Left (Filter 5 — 528nm Green)", "MASTCAM-Z", "VNIR Spectral Slope & Weathering Rind"),
    "ZL6": ("Mastcam-Z Left (Filter 6 — 442nm Blue)", "MASTCAM-Z", "VNIR Dust Coating & Frost Detection"),
    "ZL7": ("Mastcam-Z Left (Filter 7 — 880nm ND Solar)", "MASTCAM-Z", "Direct Solar Optical Depth (Tau) & Radiation"),
    "ZR0": ("Mastcam-Z Right (Filter 0 — Broadband RGB)", "MASTCAM-Z", "Stereo High-Res Outcrop & Boulder Geometry"),
    "ZR1": ("Mastcam-Z Right (Filter 1 — 800nm NIR)", "MASTCAM-Z", "VNIR Stereo Multispectral Band"),
    "ZR2": ("Mastcam-Z Right (Filter 2 — 866nm NIR)", "MASTCAM-Z", "VNIR Pyroxene/Olivine Absorption Band"),
    "ZR3": ("Mastcam-Z Right (Filter 3 — 910nm NIR)", "MASTCAM-Z", "VNIR Hydrated Silica / Bound Water Band"),
    "ZR4": ("Mastcam-Z Right (Filter 4 — 939nm NIR)", "MASTCAM-Z", "VNIR Phyllosilicate / Carbonate Band"),
    "ZR5": ("Mastcam-Z Right (Filter 5 — 978nm NIR)", "MASTCAM-Z", "VNIR Hydrated Mineral / Gypsum Absorption"),
    "ZR6": ("Mastcam-Z Right (Filter 6 — 1022nm NIR)", "MASTCAM-Z", "VNIR Olivine & Mafic Bedrock Discrimination"),
    "ZR7": ("Mastcam-Z Right (Filter 7 — 440nm ND Solar)", "MASTCAM-Z", "Blue Solar Optical Depth & Aerosol Scattering"),
    "LRE": ("SuperCam Remote Micro-Imager (Enhanced Color)", "SUPERCAM", "LIBS Laser Ablation Pit & Micro-Texture"),
    "LRF": ("SuperCam Remote Micro-Imager (Raw Bayer)", "SUPERCAM", "Sub-Millimeter Grain & Vein Stratigraphy"),
    "SI1": ("SHERLOC Context Imager / ACI (Processed)", "SHERLOC", "Deep-UV Raman Astrobiology & Organic Vein Scan"),
    "SIF": ("SHERLOC Context Imager / ACI (Full Frame)", "SHERLOC", "Abraded Patch Micro-Textural Mapping"),
    "WSM": ("MEDA SkyCam (Radiative Flux & Dust Imager)", "MEDA", "Sky Luminance, Solar Halo & Dust Opacity"),
}

# Curated Root-Level Mission Assets Metadata
CURATED_ASSETS_META = {
    "PIA26696_boxwork_detail.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp Boxwork Region",
        "subsystem": "MASTCAM",
        "title": "Mount Sharp Boxwork Fracture Ridges (Close-Up)",
        "eva_role": "Gale WP-3 Science Target: Diagenetic Mineralized Ridge Network",
        "geology_notes": "Cemented polygonal ridges resistant to wind erosion; ancient groundwater circulation pathways.",
    },
    "PIA26696_figB.png": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp Boxwork Region",
        "subsystem": "MASTCAM_PANO",
        "title": "Mount Sharp Boxwork Full-Resolution Mosaic (PIA26696 Fig B)",
        "eva_role": "High-Res Panoramic Context for Boxwork Ridge Traverse",
        "geology_notes": "29,643 x 6,655 ultra-wide Mastcam mosaic capturing transitional sulfate-to-boxwork stratigraphy.",
    },
    "PIA26696_mount_sharp_boxwork.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp Boxwork Region",
        "subsystem": "MASTCAM",
        "title": "Polygonal Boxwork Formations on Aeolis Mons",
        "eva_role": "Gale WP-2 Primary Astrobiology & Geochemistry Outcrop",
        "geology_notes": "Intersecting mineral veins formed by subsurface fluid flow during late drying epochs.",
    },
    "PIA26696_tracks_gale_rim.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp Ascent & Rim View",
        "subsystem": "NAVCAM_CURIOSITY",
        "title": "Rover Traverse Wheel Tracks Looking Toward Northern Gale Rim",
        "eva_role": "Gale WP-1 Regolith Trafficability & Thermal Inertia Calibration",
        "geology_notes": "Wheel sinkage depth indicates consolidated sulfate-cemented crust over loose eolian drift.",
    },
    "PIA26696_web_pano.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp Boxwork Region",
        "subsystem": "MASTCAM_PANO",
        "title": "360-Degree Mount Sharp Boxwork & Gediz Vallis Horizon Panorama",
        "eva_role": "Gale Helmet HUD Primary Wide-Field Visor Backdrop",
        "geology_notes": "Wide-field surface panorama showing boxwork ridge topography, boulders, and northern crater floor.",
    },
    "curiosity_mount_sharp_path_3d.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp (Aeolis Mons)",
        "subsystem": "ORBITAL_3D",
        "title": "Curiosity Proposed & Executed Ascent Route Up Mount Sharp (3D Perspective)",
        "eva_role": "Gale Strategic Console 2.5D/3D Base Terrain Reference",
        "geology_notes": "HiRISE/MRO digital elevation drape showing Gediz Vallis channel, pediment, and traverse switchbacks.",
    },
    "curiosity_mount_sharp_units_3d.jpg": {
        "mission": "MSL Curiosity",
        "site_region": "Gale Crater — Mount Sharp (Aeolis Mons)",
        "subsystem": "CRISM_MINERALOGY",
        "title": "Mount Sharp Mineralogical Units: Clay-Bearing, Sulfate-Bearing & Gediz Vallis Ridge",
        "eva_role": "Gale Spectral & Mineralogical (MRO CRISM) Layer Reference",
        "geology_notes": "Color-coded orbital spectral overlay mapping phyllosilicates (green), sulfates (yellow), and channel deposits (red).",
    },
    "m2020_sol2023_fhaz_turret_deploy.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim / Neretva Vallis Margin",
        "subsystem": "FHAZ",
        "title": "Front Hazcam View of Robotic Arm Turret Deployment on Bedrock",
        "eva_role": "Jezero Tool-Mule Rover Coring & Contact Science Telemetry",
        "geology_notes": "Near-field hazard camera confirming stable rover footing and zero sand-trap sinkage.",
    },
    "m2020_sol2023_mastcamz_boulder.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim / Neretva Vallis",
        "subsystem": "MASTCAM-Z",
        "title": "Mastcam-Z Angular Float Boulder & Fractured Impact Breccia",
        "eva_role": "Jezero WP-3 Megabreccia & Radiation Shelter Overhang Assessment",
        "geology_notes": "Coarse angular block shedding from upper crater rim scarp; high thermal inertia solid rock.",
    },
    "m2020_sol2023_meda_skycam.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim / Neretva Vallis",
        "subsystem": "MEDA",
        "title": "MEDA SkyCam Fisheye Atmospheric & Solar Radiation Dome",
        "eva_role": "Space Weather, UV/Optical Depth & Dust Storm Early Warning Sensor",
        "geology_notes": "Full-sky radiometric calibration ring monitoring aerosol scattering and SEP/GCR atmospheric column.",
    },
    "m2020_sol2023_navcam_arm_workspace.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim / Bright Angel Contact",
        "subsystem": "NAVCAM",
        "title": "Navcam Robotic Arm & Sampling Workspace Over Outcrop Slab",
        "eva_role": "Jezero WP-2 Crew + Rover Collaborative Core Sampling Station",
        "geology_notes": "Low-dipping planar outcrop exposure ideal for core drill extraction and SHERLOC scanning.",
    },
    "m2020_sol2023_navcam_nodular_outcrop.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Neretva Vallis / Bright Angel",
        "subsystem": "NAVCAM",
        "title": "Navcam Nodular Phyllosilicate & Carbonate Outcrop Bench",
        "eva_role": "Jezero WP-4 High-Priority Astrobiology Biosignature Target",
        "geology_notes": "Fine-grained mudstone/siltstone bench exhibiting spherulitic nodules ('popcorn' texture) and veins.",
    },
    "m2020_sol2023_navcam_rim_ridge.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim Ridge",
        "subsystem": "NAVCAM",
        "title": "Navcam Steep Rim Ridge Scarp (>20° Metabolic Slope Hazard)",
        "eva_role": "Jezero Tactical HUD & Slope Hazard (>15° / >25° No-Go) Ground Truth",
        "geology_notes": "Steep boulder-strewn ridge crest with loose talus; requires route bypass along valley floor.",
    },
    "m2020_sol2023_navcam_valley_pass.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Neretva Vallis Corridor",
        "subsystem": "NAVCAM",
        "title": "Navcam Low-Gradient Valley Pass & Eolian Ripple Corridor",
        "eva_role": "Jezero WP-1 Optimal Least-Effort EVA Traverse Corridor (<8° Slope)",
        "geology_notes": "Smooth bedrock pavement flanked by shallow windblown ripples; low metabolic cost walk-back route.",
    },
    "m2020_sol2023_sherloc_watson_micro.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Bright Angel / Neretva Vallis",
        "subsystem": "SHERLOC",
        "title": "SHERLOC ACI Micro-Imager Scan of Hydrated Mineral Veins",
        "eva_role": "Jezero WP-4 Micro-Scale Biosignature & Carbonate/Silica Assay",
        "geology_notes": "Sub-millimeter textures revealing calcium-sulfate veins and putative redox reaction rims.",
    },
    "m2020_sol2023_solar_tau_halo.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2023,
        "site_region": "Jezero Crater — Western Rim Atmosphere",
        "subsystem": "NAVCAM",
        "title": "Solar Halo & Dust Optical Depth (Tau = 0.42) Measurement",
        "eva_role": "Atmospheric Dust Opacity & Solar Array / Suit Thermal Load Telemetry",
        "geology_notes": "Direct solar disk observation used to quantify suspended ferric dust aerosol loading.",
    },
    "m2020_sol2024_supercam_rmi_laser.png": {
        "mission": "Mars 2020 Perseverance",
        "sol": 2024,
        "site_region": "Jezero Crater — Western Rim / Neretva Vallis",
        "subsystem": "SUPERCAM",
        "title": "SuperCam RMI Circular Field of View with LIBS Laser Pit Raster",
        "eva_role": "Jezero WP-3 Stand-Off Geochemical LIBS Elemental Assay",
        "geology_notes": "High-magnification circular telescopic view showing sub-mm grain packing and laser ablation spots.",
    },
    "nasa_mars_trek_global.jpg": {
        "mission": "NASA Mars Trek / MGS MOC / Viking",
        "site_region": "Global Mars Cartographic Basemap",
        "subsystem": "ORBITAL_GLOBAL",
        "title": "NASA Mars Trek Global Color Mosaic",
        "eva_role": "Global Landing Site Locator (Jezero Crater 18.38°N 77.58°E / Gale Crater 5.4°S 137.8°E)",
        "geology_notes": "Planetary context map linking dichotomous lowlands/highlands to local EVA operational zones.",
    },
    "usgs_planetary_geologic_mola.jpg": {
        "mission": "USGS / NASA MGS MOLA",
        "site_region": "Global Mars MOLA Elevation & Geologic Quadrangles",
        "subsystem": "ORBITAL_MOLA",
        "title": "USGS-NASA Planetary Geologic Mapping Program MOLA Hypsometric DEM",
        "eva_role": "Regional Topographic Elevation & Quadrangle Reference Layer",
        "geology_notes": "Laser altimeter elevation baseline showing planetary dichotomy, Tharsis, Hellas, Jezero, and Gale.",
    },
}

# Regex for Mars 2020 Perseverance Raw Image Filenames:
# Example: NLF_2023_0846539116_862ECM_N0930000NCAM00501_01_295J01.png
# Example: ZL0_2023_0846534114_973EBY_N0930000ZCAM04499_1100LMJ02.png
M2020_RAW_REGEX = re.compile(
    r"^(?P<inst>[A-Z0-9]{3})_(?P<sol>\d{4})_(?P<sclk>\d{10})_(?P<msec>\d{3})(?P<prod>[A-Z]{3})_"
    r"(?P<venue>[A-Z])(?P<site>\d{3})(?P<drive>\d{4})(?P<seq>[A-Z0-9]{9})_(?P<tail>.+)\.(?:png|jpg|jpeg)$",
    re.IGNORECASE,
)


def parse_m2020_filename(filename: str) -> dict:
    """Extract structured telemetry from NASA Mars 2020 PDS raw filenames."""
    m = M2020_RAW_REGEX.match(filename)
    if not m:
        return {}
    d = m.groupdict()
    inst_code = d["inst"].upper()
    inst_name, subsystem, science_purpose = M2020_INSTRUMENTS.get(
        inst_code, ("Mars 2020 Instrument", "UNKNOWN", "Surface Observation")
    )
    return {
        "mission": "Mars 2020 Perseverance",
        "site_region": f"Jezero Crater — Site {int(d['site'])} (Sol {int(d['sol'])})",
        "instrument_code": inst_code,
        "instrument_name": inst_name,
        "subsystem": subsystem,
        "science_purpose": science_purpose,
        "sol": int(d["sol"]),
        "sclk": f"{d['sclk']}.{d['msec']}",
        "product_type": d["prod"].upper(),
        "site": int(d["site"]),
        "drive": int(d["drive"]),
        "sequence_id": d["seq"],
        "is_stereo_left": inst_code.startswith(("NL", "FL", "ZL")),
        "is_stereo_right": inst_code.startswith(("NR", "FR", "ZR")),
        "is_solar_tau": inst_code in ("ZL7", "ZR7"),
    }


def process_all_images():
    t0 = time.time()
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    image_records = []
    curated_lookup = {}
    subsystem_counts = {}
    mission_counts = {}
    sol_counts = {}

    total_raw_bytes = 0
    total_thumb_bytes = 0

    # Collect all candidate image paths across workspace (excluding output & library dirs)
    candidates = []
    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        # Skip generated thumbnails and local python libs
        dirs[:] = [d for d in dirs if d not in ("assets", ".pylibs", "__pycache__", ".git")]
        for f in sorted(files):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                candidates.append(Path(root) / f)

    print(f"[ARES-NAV] Found {len(candidates)} local NASA images to index and compress...")

    for idx, img_path in enumerate(candidates, 1):
        rel_path = img_path.relative_to(WORKSPACE_ROOT).as_posix()
        filename = img_path.name
        stem = img_path.stem
        is_root_curated = img_path.parent == WORKSPACE_ROOT

        # Prefix folder context if inside raw directory so filenames never collide
        if is_root_curated:
            thumb_filename = f"{stem}.webp"
        else:
            thumb_filename = f"raw_{stem}.webp"

        thumb_path = THUMBNAIL_DIR / thumb_filename
        thumb_rel_path = thumb_path.relative_to(WORKSPACE_ROOT).as_posix()

        raw_size = img_path.stat().st_size
        total_raw_bytes += raw_size

        try:
            with Image.open(img_path) as im:
                orig_w, orig_h = im.size
                orig_mode = im.mode
                orig_format = im.format or img_path.suffix.lstrip(".").upper()

                # Compute resized dimensions (max-width: 640px)
                if orig_w > MAX_WIDTH:
                    scale = MAX_WIDTH / float(orig_w)
                    new_w = MAX_WIDTH
                    new_h = max(1, int(round(orig_h * scale)))
                else:
                    new_w, new_h = orig_w, orig_h

                # Convert to RGB and resize first (computing stats on the thumbnail is 100x faster on huge images!)
                rgb_im = im.convert("RGB") if im.mode != "RGB" else im
                if (new_w, new_h) != (orig_w, orig_h):
                    thumb_im = rgb_im.resize((new_w, new_h), Image.Resampling.LANCZOS)
                else:
                    thumb_im = rgb_im.copy()

                # Extract fast colorimetric / luminance stats from the resized RGB image
                stat = ImageStat.Stat(thumb_im)
                mean_r, mean_g, mean_b = [round(v, 2) for v in stat.mean[:3]]
                std_r, std_g, std_b = [round(v, 2) for v in stat.stddev[:3]]
                luminance = round(0.299 * mean_r + 0.587 * mean_g + 0.114 * mean_b, 2)
                contrast = round((std_r + std_g + std_b) / 3.0, 2)
                is_monochrome = (abs(mean_r - mean_g) < 1.5 and abs(mean_g - mean_b) < 1.5)

                # Save web-optimized WebP thumbnail
                thumb_im.save(thumb_path, format="WEBP", quality=WEBP_QUALITY, method=4)

        except Exception as exc:
            print(f"  [WARN] Failed processing {rel_path}: {exc}")
            continue

        thumb_size = thumb_path.stat().st_size
        total_thumb_bytes += thumb_size

        # Build metadata dictionary
        meta = {}
        if filename in CURATED_ASSETS_META:
            meta.update(CURATED_ASSETS_META[filename])
            meta["category"] = "curated_highlight"
        else:
            parsed = parse_m2020_filename(filename)
            meta.update(parsed)
            meta["category"] = "raw_rover_edr"

        mission = meta.get("mission", "NASA Mars Surface Mission")
        subsystem = meta.get("subsystem", "SURFACE_CAM")
        sol = meta.get("sol", None)

        mission_counts[mission] = mission_counts.get(mission, 0) + 1
        subsystem_counts[subsystem] = subsystem_counts.get(subsystem, 0) + 1
        if sol is not None:
            sol_key = f"Sol {sol}"
            sol_counts[sol_key] = sol_counts.get(sol_key, 0) + 1

        record = {
            "id": stem,
            "filename": filename,
            "original_path": rel_path,
            "thumbnail_path": thumb_rel_path,
            "original_width": orig_w,
            "original_height": orig_h,
            "aspect_ratio": round(orig_w / float(orig_h), 4) if orig_h else 1.0,
            "thumbnail_width": new_w,
            "thumbnail_height": new_h,
            "original_format": orig_format,
            "original_mode": orig_mode,
            "original_bytes": raw_size,
            "thumbnail_bytes": thumb_size,
            "compression_ratio": round(raw_size / float(max(1, thumb_size)), 2),
            "image_stats": {
                "luminance_mean": luminance,
                "contrast_stddev": contrast,
                "rgb_mean": [mean_r, mean_g, mean_b],
                "is_monochrome_or_bayer": is_monochrome,
            },
            "metadata": meta,
        }

        image_records.append(record)
        if is_root_curated:
            curated_lookup[filename] = record

        if idx % 25 == 0 or idx == len(candidates):
            print(
                f"  [{idx:3d}/{len(candidates)}] Compressed {filename[:40]:40s} "
                f"({orig_w}x{orig_h} -> {new_w}x{new_h}, {raw_size/1024:.1f}KB -> {thumb_size/1024:.1f}KB)"
            )

    elapsed = round(time.time() - t0, 2)
    savings_pct = round((1.0 - (total_thumb_bytes / float(max(1, total_raw_bytes)))) * 100.0, 2)

    manifest = {
        "project": "ARES-NAV // Mars Surface EVA Tactical & Scientific Navigation System",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "processing_seconds": elapsed,
        "thumbnail_config": {
            "max_width_px": MAX_WIDTH,
            "format": "webp",
            "quality": WEBP_QUALITY,
            "directory": "assets/thumbnails",
        },
        "summary": {
            "total_images_indexed": len(image_records),
            "curated_root_images": len(curated_lookup),
            "raw_edr_frames": len(image_records) - len(curated_lookup),
            "total_original_bytes": total_raw_bytes,
            "total_original_mb": round(total_raw_bytes / (1024 * 1024), 2),
            "total_thumbnail_bytes": total_thumb_bytes,
            "total_thumbnail_mb": round(total_thumb_bytes / (1024 * 1024), 2),
            "size_reduction_percent": savings_pct,
            "by_mission": mission_counts,
            "by_subsystem": subsystem_counts,
            "by_sol": sol_counts,
        },
        "curated_assets": curated_lookup,
        "images": image_records,
    }

    # Write manifest to assets/thumbnails/manifest.json, assets/manifest.json, and root manifest.json
    manifest_paths = [
        THUMBNAIL_DIR / "manifest.json",
        WORKSPACE_ROOT / "assets" / "manifest.json",
        WORKSPACE_ROOT / "manifest.json",
    ]
    for mp in manifest_paths:
        with open(mp, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

    print("\n=== STEP 1 COMPLETE: IMAGE INDEXING & COMPRESSION SUMMARY ===")
    print(f"Total Images Processed : {len(image_records)} ({len(curated_lookup)} curated + {len(image_records)-len(curated_lookup)} raw EDRs)")
    print(f"Original Dataset Size  : {manifest['summary']['total_original_mb']} MB ({total_raw_bytes:,} bytes)")
    print(f"Compressed Thumbs Size : {manifest['summary']['total_thumbnail_mb']} MB ({total_thumb_bytes:,} bytes)")
    print(f"Bandwidth / Token Save : {savings_pct}% reduction in image payload")
    print(f"Processing Time        : {elapsed}s")
    print(f"Manifest Written To    : {manifest_paths[0].relative_to(WORKSPACE_ROOT).as_posix()}")


if __name__ == "__main__":
    process_all_images()
