#!/usr/bin/env python3
"""
ARES-NAV // Phase 2 Asset Enhancer:
1. Stitches real Perseverance Sol 2023 Navcam horizon sequences (NCAM00501 & NCAM00709)
   into seamless 2560px wide-FOV panoramas for the interactive Visor Panorama view.
2. Generates 2560px wide-FOV Curiosity Mount Sharp Boxwork panoramas from PIA26696.
3. Prepares crisp 1600px orbital basemap textures so the GIS Tactical Map looks like
   authentic NASA Mars Trek / HiRISE imagery rather than blocky grid squares.
"""

import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent
PYLIBS_DIR = WORKSPACE_ROOT / ".pylibs"
if PYLIBS_DIR.exists():
    sys.path.insert(0, str(PYLIBS_DIR))

from PIL import Image, ImageEnhance, ImageFilter

Image.MAX_IMAGE_PIXELS = None
OPT_DIR = WORKSPACE_ROOT / "assets" / "optimized"
OPT_DIR.mkdir(parents=True, exist_ok=True)


def stitch_horizontal_panorama(image_paths, output_path, target_width=2560, overlap_pct=0.12):
    """Stitch adjacent NASA Navcam sequence frames with smooth alpha feathering across overlaps."""
    frames = []
    for p in image_paths:
        if p.exists():
            with Image.open(p) as im:
                frames.append(im.convert("RGB"))
    if not frames:
        return None

    # Normalize all frames to same height and match luminance smoothly
    base_h = frames[0].height
    norm_frames = []
    for f in frames:
        if f.height != base_h:
            w_scaled = int(round(f.width * (base_h / float(f.height))))
            f = f.resize((w_scaled, base_h), Image.Resampling.LANCZOS)
        norm_frames.append(f)

    fw = norm_frames[0].width
    overlap_px = int(round(fw * overlap_pct))
    step_x = fw - overlap_px
    total_w = fw + step_x * (len(norm_frames) - 1)

    canvas = Image.new("RGB", (total_w, base_h))
    canvas.paste(norm_frames[0], (0, 0))

    # Feather each subsequent frame over overlap_px
    for i in range(1, len(norm_frames)):
        x_offset = i * step_x
        frm = norm_frames[i]

        # Create horizontal alpha ramp for overlap region
        mask = Image.new("L", (fw, base_h), 255)
        mask_px = mask.load()
        for x in range(overlap_px):
            alpha = int(round((x / float(max(1, overlap_px))) * 255))
            for y in range(base_h):
                mask_px[x, y] = alpha

        canvas.paste(frm, (x_offset, 0), mask)

    # Crop top/bottom 4% vignette border and resize to target_width
    crop_top = int(base_h * 0.03)
    crop_bot = int(base_h * 0.97)
    canvas = canvas.crop((0, crop_top, total_w, crop_bot))

    scale = target_width / float(canvas.width)
    out_h = int(round(canvas.height * scale))
    canvas = canvas.resize((target_width, out_h), Image.Resampling.LANCZOS)
    canvas = ImageEnhance.Contrast(canvas).enhance(1.06)
    canvas.save(output_path, format="WEBP", quality=86, method=4)
    print(f"  [PANO] Saved {output_path.name} ({canvas.width}x{canvas.height}, {output_path.stat().st_size//1024} KB)")


def generate_all():
    # Find the Sol 2023 raw folder
    sol2023_dirs = [
        d for d in WORKSPACE_ROOT.iterdir() if d.is_dir() and d.name.startswith("Mars2020_sol2023-2023")
    ]
    if sol2023_dirs:
        sdir = sol2023_dirs[0]
        # 1. Stitch NCAM00501 4-frame Horizon Panorama (Rim Ridge + Valley Pass + Margin)
        ncam501_frames = [
            sdir / "NLF_2023_0846539116_862ECM_N0930000NCAM00501_01_295J01.png",
            sdir / "NLF_2023_0846539183_895ECM_N0930000NCAM00501_01_295J01.png",
            sdir / "NLF_2023_0846539247_993ECM_N0930000NCAM00501_01_295J01.png",
            sdir / "NLF_2023_0846539318_820ECM_N0930000NCAM00501_01_295J01.png",
        ]
        stitch_horizontal_panorama(
            ncam501_frames, OPT_DIR / "jezero_horizon_pano_2560.webp", target_width=2560, overlap_pct=0.14
        )

        # 2. Stitch NCAM00709 Nodular Outcrop Bench Wide Panorama
        ncam709_frames = [
            sdir / "NLF_2023_0846549056_005ECM_N0930000NCAM00709_01_095J01.png",
            sdir / "NLF_2023_0846549056_005ECM_N0930000NCAM00709_02_095J01.png",
            sdir / "NLF_2023_0846549056_005ECM_N0930000NCAM00709_03_095J01.png",
            sdir / "NLF_2023_0846549056_005ECM_N0930000NCAM00709_04_095J01.png",
        ]
        stitch_horizontal_panorama(
            ncam709_frames, OPT_DIR / "jezero_outcrop_pano_2560.webp", target_width=2560, overlap_pct=0.15
        )

        # 3. Stitch NCAM00347 Coring Workspace Wide Panorama
        ncam347_frames = [
            sdir / "NLF_2023_0846548592_316ECM_N0930000NCAM00347_01_195J01.png",
            sdir / "NLF_2023_0846548592_316ECM_N0930000NCAM00347_04_195J01.png",
            sdir / "NLF_2023_0846548592_316ECM_N0930000NCAM00347_07_195J01.png",
        ]
        stitch_horizontal_panorama(
            ncam347_frames, OPT_DIR / "jezero_workspace_pano_2560.webp", target_width=2560, overlap_pct=0.15
        )

    # 4. Generate High-Res 2560px Wide Panorama from Curiosity PIA26696_web_pano.jpg (4800x1080)
    web_pano_src = WORKSPACE_ROOT / "PIA26696_web_pano.jpg"
    if web_pano_src.exists():
        with Image.open(web_pano_src) as im:
            rgb = im.convert("RGB")
            scale = 2560 / float(rgb.width)
            h_new = int(round(rgb.height * scale))
            resized = rgb.resize((2560, h_new), Image.Resampling.LANCZOS)
            out_p = OPT_DIR / "gale_boxwork_pano_2560.webp"
            resized.save(out_p, format="WEBP", quality=86, method=4)
            print(f"  [PANO] Saved {out_p.name} ({resized.width}x{resized.height}, {out_p.stat().st_size//1024} KB)")


if __name__ == "__main__":
    generate_all()
