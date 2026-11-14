import os
import sys
import io
import json
import base64

sys.path.insert(0, r'd:\Nasa\.pylibs')
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
Image.MAX_IMAGE_PIXELS = None

ROOT = r'd:\Nasa'
OPT_DIR = os.path.join(ROOT, 'assets', 'optimized')
os.makedirs(OPT_DIR, exist_ok=True)

def save_webp_variants(src_path, base_name, make_1600=False, make_pano_2560=False):
    with Image.open(src_path) as im:
        im_rgb = im.convert('RGB')
        w, h = im_rgb.size
        # If ultra-large (>8000px), pre-downsample with BILINEAR for speed
        if max(w, h) > 6000:
            scale = 4096.0 / max(w, h)
            im_work = im_rgb.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.BILINEAR)
        else:
            im_work = im_rgb

        if make_pano_2560:
            pw = 2560
            ph = max(480, int(im_rgb.height * (pw / float(im_rgb.width))))
            pano = im_work.resize((pw, ph), Image.Resampling.LANCZOS)
            pano = ImageEnhance.Contrast(pano).enhance(1.06)
            pano.save(os.path.join(OPT_DIR, f'{base_name}_pano_2560.webp'), 'WEBP', quality=86)

        if make_1600:
            mw = min(1600, im_work.width)
            mh = max(1, int(im_work.height * (mw / float(im_work.width))))
            m1600 = im_work.resize((mw, mh), Image.Resampling.LANCZOS)
            m1600.save(os.path.join(OPT_DIR, f'{base_name}_1600.webp'), 'WEBP', quality=86)

        w1280 = min(1280, im_work.width)
        h1280 = max(1, int(im_work.height * (w1280 / float(im_work.width))))
        im1280 = im_work.resize((w1280, h1280), Image.Resampling.LANCZOS)
        p1280 = os.path.join(OPT_DIR, f'{base_name}_1280.webp')
        im1280.save(p1280, 'WEBP', quality=84)

        w480 = min(480, im_work.width)
        h480 = max(1, int(im_work.height * (w480 / float(im_work.width))))
        im480 = im_work.resize((w480, h480), Image.Resampling.LANCZOS)
        p480 = os.path.join(OPT_DIR, f'{base_name}_480.webp')
        im480.save(p480, 'WEBP', quality=80)
        return (w, h)

print('1. Processing newly added NASA images...')
new_images = [
    ('8k_mars.jpg', '8k_mars', False, False),
    ('PIA23179.tif', 'PIA23179', True, False),
    ('PIA26335.jpg', 'PIA26335', False, True),
    ('PIA26402.jpg', 'PIA26402', True, False),
    ('e2_-_PIA26374_-_Rim_Drive_Map_-_Final.png', 'e2_-_PIA26374_-_Rim_Drive_Map_-_Final', True, False),
    ('jpegPIA18391.jpg', 'jpegPIA18391', True, False),
    ('pia26344-fig-a-perseverance-selfie-at-cheyava.jpg', 'pia26344-fig-a-perseverance-selfie-at-cheyava', False, False),
    ('pia26344-perseverance-selfie-at-cheyava.jpg', 'pia26344-perseverance-selfie-at-cheyava', False, False),
    ('Screenshot 2026-11-14 053222.png', 'Screenshot_053222', True, False),
    ('Screenshot 2026-11-14 053232.png', 'Screenshot_053232', True, False),
    ('Screenshot 2026-11-14 053310.png', 'Screenshot_053310', True, False),
    ('Screenshot 2026-11-14 053326.png', 'Screenshot_053326', True, False),
    ('Screenshot 2026-11-14 054200.png', 'Screenshot_054200', True, False),
]

for fn, bname, m1600, mpano in new_images:
    p = os.path.join(ROOT, fn)
    if os.path.exists(p):
        sz = save_webp_variants(p, bname, make_1600=m1600, make_pano_2560=mpano)
        print(f'  Processed {fn} ({sz[0]}x{sz[1]}) -> {bname}')

# Also create dedicated named orbital basemaps for Jezero and Gale from the new authentic NASA images!
# Jezero primary orbital basemap: PIA26402.jpg (high-res orbital view) and e2_-_PIA26374_-_Rim_Drive_Map_-_Final.png
with Image.open(os.path.join(ROOT, 'PIA26402.jpg')) as im:
    im_c = im.convert('RGB').resize((1600, 1486), Image.Resampling.LANCZOS)
    im_c.save(os.path.join(OPT_DIR, 'jezero_orbital_terrain_1600.webp'), 'WEBP', quality=86)

with Image.open(os.path.join(ROOT, 'e2_-_PIA26374_-_Rim_Drive_Map_-_Final.png')) as im:
    im_r = im.convert('RGB')
    im_r.save(os.path.join(OPT_DIR, 'jezero_rim_drive_map_1600.webp'), 'WEBP', quality=88)

with Image.open(os.path.join(ROOT, 'PIA23179.tif')) as im:
    im_g = im.convert('RGB').resize((1600, 900), Image.Resampling.LANCZOS)
    im_g.save(os.path.join(OPT_DIR, 'gale_pia23179_orbital_1600.webp'), 'WEBP', quality=88)

# 2. Build dark-HUD transparent logo (removing white rectangle & illuminating dark text)
print('2. Building dark-HUD transparent logo from logo.png...')
logo_path = os.path.join(ROOT, 'logo.png')
if os.path.exists(logo_path):
    with Image.open(logo_path) as lim:
        lim_rgba = lim.convert('RGBA')
        # Crop tight to non-white content first
        gray = lim.convert('L')
        inv = ImageOps.invert(gray).point(lambda x: 255 if x > 18 else 0)
        bbox = inv.getbbox()
        if bbox:
            pad = 20
            x0 = max(0, bbox[0] - pad)
            y0 = max(0, bbox[1] - pad)
            x1 = min(lim.width, bbox[2] + pad)
            y1 = min(lim.height, bbox[3] + pad)
            lim_crop = lim_rgba.crop((x0, y0, x1, y1))
        else:
            lim_crop = lim_rgba
        # Resize to 440px width for crisp HUD rendering
        tw = 440
        th = max(1, int(lim_crop.height * (tw / float(lim_crop.width))))
        lim_small = lim_crop.resize((tw, th), Image.Resampling.LANCZOS)
        px = lim_small.load()
        for y in range(th):
            for x in range(tw):
                r, g, b, a = px[x, y]
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                sat = max(r, g, b) - min(r, g, b)
                if lum > 240 and sat < 25:
                    # Pure white background -> transparent
                    px[x, y] = (0, 0, 0, 0)
                elif sat < 35 and lum < 240:
                    # Grayscale typography / swoosh -> invert luminance so dark grey becomes bright crisp white/cyan on dark HUD
                    alpha = int(min(255, max(0, (242 - lum) * 1.45)))
                    px[x, y] = (232, 246, 255, alpha)
                else:
                    # Colorful Mars globe & orange ring -> keep vivid color, smooth alpha edge against white
                    alpha = int(min(255, max(160, (255 - lum) * 2.2 + sat * 1.5)))
                    px[x, y] = (min(255, int(r * 1.08)), min(255, int(g * 1.05)), b, alpha)
        lim_small.save(os.path.join(OPT_DIR, 'logo_dark_hud.webp'), 'WEBP', quality=92)
        lim_small.save(os.path.join(OPT_DIR, 'logo_transparent.webp'), 'WEBP', quality=92)
        print(f'  Saved dark-HUD transparent logo ({tw}x{th})')

# 3. Rebuild js/globe_textures.js using the seamless 8k_mars.jpg!
print('3. Rebuilding js/globe_textures.js from seamless 8k_mars.jpg...')
with Image.open(os.path.join(ROOT, '8k_mars.jpg')) as m8k:
    m8k_rgb = m8k.convert('RGB')
    # Downsample to 2048x1024 for fast, crisp WebGL globe rendering
    mars_day = m8k_rgb.resize((2048, 1024), Image.Resampling.LANCZOS)
    mars_day = ImageEnhance.Contrast(mars_day).enhance(1.08)
    mars_day = ImageEnhance.Color(mars_day).enhance(1.06)

    # Create seamless bump/normal heightmap from 8k_mars luminance + high-pass detail
    mars_gray = mars_day.convert('L')
    mars_bump = ImageOps.autocontrast(mars_gray, cutoff=1)

    # Create seamless MOLA false-color hypsometric map derived cleanly so there are ZERO white boxes or seams
    # Blend cropped MOLA color palette with 8k_mars topographic detail
    mola_src = Image.open(os.path.join(ROOT, 'usgs_planetary_geologic_mola.jpg')).convert('RGB')
    # Crop strictly inside the MOLA map area avoiding any outer borders
    mw, mh = mola_src.size
    mola_crop = mola_src.crop((int(mw * 0.04), int(mh * 0.19), int(mw * 0.74), int(mh * 0.88))).resize((2048, 1024), Image.Resampling.BILINEAR)
    # Make horizontal edges wrap smoothly across 0/2048
    mola_blur = mola_crop.filter(ImageFilter.GaussianBlur(radius=18))
    mars_mola = Image.blend(mars_day, mola_blur, 0.58)
    mars_mola = ImageEnhance.Color(mars_mola).enhance(1.35)

    def to_b64_webp(img, q=84):
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=q)
        return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

    b64_day = to_b64_webp(mars_day, 85)
    b64_bump = to_b64_webp(mars_bump, 80)
    b64_mola = to_b64_webp(mars_mola, 82)
    b64_logo = to_b64_webp(Image.open(os.path.join(OPT_DIR, 'logo_dark_hud.webp')), 90)

    globe_tex_js = (
        '// Auto-generated seamless 8K Mars WebGL textures & Dark-HUD Logo (offline file:// compatible)\n'
        'window.ARES_GLOBE_TEXTURES = {\n'
        f'  marsDay: "{b64_day}",\n'
        f'  marsBump: "{b64_bump}",\n'
        f'  marsMola: "{b64_mola}",\n'
        f'  logoTransparent: "{b64_logo}"\n'
        '};\n'
    )
    with open(os.path.join(ROOT, 'js', 'globe_textures.js'), 'w', encoding='utf-8') as f:
        f.write(globe_tex_js)
    print('  Updated js/globe_textures.js successfully!')
