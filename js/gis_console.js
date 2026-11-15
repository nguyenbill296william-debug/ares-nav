/**
 * ARES-NAV // Mode 2: Flight-Grade Mars Surface GPS & Tactical GIS Console
 * Real-DEM Cached Scientific Rasters • Mars 2020 45.25km Traverse • 2-Stage Contingency Shelter Routing
 */

window.ARES_GIS = (function () {
  const imgCache = {};

  // Offscreen cache for 100x68 scientific terrain rasters & diurnal solar hillshade (0.1ms blit per frame)
  let rasterCacheCanvas = null;
  let rasterCacheKey = '';
  let solarCacheCanvas = null;
  let solarCacheKey = '';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getImg(src, onLoad) {
    if (!src) return null;
    const resolvedSrc =
      (window.ARES_BASEMAP_DATA_URLS && window.ARES_BASEMAP_DATA_URLS[src]) || src;
    if (imgCache[src]) {
      const cached = imgCache[src];
      if (!cached.complete && onLoad) {
        cached.addEventListener('load', onLoad, { once: true });
      }
      return cached;
    }
    const img = new Image();
    if (onLoad) {
      img.addEventListener('load', onLoad, { once: true });
    }
    img.src = resolvedSrc;
    imgCache[src] = img;
    return img;
  }

  function drawImageCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (iw - sw) * 0.5;
    const sy = (ih - sh) * 0.5;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function drawImageContain(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) * 0.5;
    const dy = y + (h - dh) * 0.5;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /**
   * Convert client mouse/touch coordinates to normalized map coordinates (nx, ny) accounting for Pan & Zoom
   */
  function clientToMapNorm(canvas, clientX, clientY, state) {
    if (!canvas) return { nx: 0.5, ny: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const zoom = state.zoom || 1;
    const wx = (mx - w * 0.5 - (state.panX || 0)) / zoom + w * 0.5;
    const wy = (my - h * 0.5 - (state.panY || 0)) / zoom + h * 0.5;
    return {
      nx: wx / w,
      ny: wy / h,
      inBounds: wx >= 0 && wx <= w && wy >= 0 && wy <= h
    };
  }

  /**
   * Build or return cached offscreen scientific raster overlay derived from real 100x68 ARES_ENGINE grid
   */
  function getScientificRasterCanvas(state) {
    const grid = window.ARES_ENGINE && window.ARES_ENGINE.getGrid ? window.ARES_ENGINE.getGrid() : null;
    if (!grid || !grid.length) return null;

    const layers = state.layers || {};
    const anyActive =
      layers.topoSlope || layers.crismSpectral || layers.thermalInertia || layers.radiationWeather;
    if (!anyActive) return null;

    const key = [
      state.theaterKey,
      state.sepStormActive ? '1' : '0',
      layers.topoSlope ? '1' : '0',
      layers.crismSpectral ? '1' : '0',
      layers.thermalInertia ? '1' : '0',
      layers.radiationWeather ? '1' : '0'
    ].join('|');

    if (rasterCacheCanvas && rasterCacheKey === key) {
      return rasterCacheCanvas;
    }

    const gw = grid[0].length;
    const gh = grid.length;
    if (!rasterCacheCanvas) {
      rasterCacheCanvas = document.createElement('canvas');
    }
    rasterCacheCanvas.width = gw;
    rasterCacheCanvas.height = gh;

    const rctx = rasterCacheCanvas.getContext('2d');
    const imgData = rctx.createImageData(gw, gh);
    const data = imgData.data;

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const cell = grid[y][x];
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        // 1. CRISM Hydrated Mineralogy Raster
        if (layers.crismSpectral && cell.crismIndex > 0.52) {
          const norm = clamp((cell.crismIndex - 0.52) / 0.46, 0, 1);
          const ca = norm * 0.42;
          const cr = norm > 0.65 ? 52 : 6;
          const cg = norm > 0.65 ? 211 : 182;
          const cb = norm > 0.65 ? 153 : 212;
          r = r * (1 - ca) + cr * ca;
          g = g * (1 - ca) + cg * ca;
          b = b * (1 - ca) + cb * ca;
          a = 1 - (1 - a) * (1 - ca);
        }

        // 2. THEMIS Thermal Inertia Footing Raster (<145 TIU Sand Drift vs >315 TIU Solid Bedrock)
        if (layers.thermalInertia) {
          if (cell.thermalInertia < 145) {
            const norm = clamp((145 - cell.thermalInertia) / 55, 0.25, 1);
            const ta = norm * 0.45;
            r = r * (1 - ta) + 245 * ta;
            g = g * (1 - ta) + 158 * ta;
            b = b * (1 - ta) + 11 * ta;
            a = 1 - (1 - a) * (1 - ta);
          } else if (cell.thermalInertia > 315) {
            const norm = clamp((cell.thermalInertia - 315) / 135, 0.15, 1);
            const ta = norm * 0.34;
            r = r * (1 - ta) + 56 * ta;
            g = g * (1 - ta) + 189 * ta;
            b = b * (1 - ta) + 248 * ta;
            a = 1 - (1 - a) * (1 - ta);
          }
        }

        // 3. HiRISE DEM Slope & Topographic Contour Isolines
        if (layers.topoSlope) {
          const vSlope = cell.visualSlopeDeg ?? cell.slopeDeg;
          if (vSlope >= 25.0) {
            const sa = 0.52;
            r = r * (1 - sa) + 239 * sa;
            g = g * (1 - sa) + 68 * sa;
            b = b * (1 - sa) + 68 * sa;
            a = 1 - (1 - a) * (1 - sa);
          } else if (vSlope >= 15.0) {
            const norm = (vSlope - 15.0) / 10.0;
            const sa = 0.18 + norm * 0.24;
            r = r * (1 - sa) + 245 * sa;
            g = g * (1 - sa) + 158 * sa;
            b = b * (1 - sa) + 11 * sa;
            a = 1 - (1 - a) * (1 - sa);
          }

          // Crisp 12-meter elevation contour lines
          if (x > 0 && y > 0) {
            const b0 = Math.floor(cell.elevM / 12);
            const bL = Math.floor(grid[y][x - 1].elevM / 12);
            const bU = Math.floor(grid[y - 1][x].elevM / 12);
            if (b0 !== bL || b0 !== bU) {
              const isMajor = Math.abs(b0) % 3 === 0;
              const ca = isMajor ? 0.52 : 0.26;
              r = r * (1 - ca) + 253 * ca;
              g = g * (1 - ca) + 224 * ca;
              b = b * (1 - ca) + 71 * ca;
              a = 1 - (1 - a) * (1 - ca);
            }
          }
        }

        // 4. Radiation Shielding & 401 MHz UHF Line-of-Sight Shadow Zones
        if (layers.radiationWeather) {
          if (state.sepStormActive && !cell.isShelterZone) {
            const ra = clamp((cell.shieldingFactor - 0.5) * 0.26, 0.05, 0.22);
            r = r * (1 - ra) + 225 * ra;
            g = g * (1 - ra) + 29 * ra;
            b = b * (1 - ra) + 72 * ra;
            a = 1 - (1 - a) * (1 - ra);
          }
          if (!cell.uhfLos) {
            // Non-line-of-sight UHF shadow behind ridges
            const ua = 0.30;
            r = r * (1 - ua) + 168 * ua;
            g = g * (1 - ua) + 85 * ua;
            b = b * (1 - ua) + 247 * ua;
            a = 1 - (1 - a) * (1 - ua);
          }
          if (cell.isShelterZone || cell.shieldingFactor <= 0.80) {
            const sha = cell.isShelterZone ? 0.42 : 0.22;
            r = r * (1 - sha) + 16 * sha;
            g = g * (1 - sha) + 185 * sha;
            b = b * (1 - sha) + 129 * sha;
            a = 1 - (1 - a) * (1 - sha);
          }
        }

        const idx = (y * gw + x) * 4;
        data[idx] = Math.round(r);
        data[idx + 1] = Math.round(g);
        data[idx + 2] = Math.round(b);
        data[idx + 3] = Math.round(clamp(a, 0, 0.82) * 255);
      }
    }

    rctx.putImageData(imgData, 0, 0);
    rasterCacheKey = key;
    return rasterCacheCanvas;
  }

  /**
   * Build cached 100x68 Martian Diurnal Sun-Angle (LTST) Hillshade & Dust Opacity (tau) Raster
   */
  function getSolarHillshadeCanvas(state) {
    const grid = window.ARES_ENGINE && window.ARES_ENGINE.getGrid ? window.ARES_ENGINE.getGrid() : null;
    if (!grid || !grid.length) return null;

    const ltst = typeof state.ltstHour === 'number' ? state.ltstHour : 13.5;
    const tau = typeof state.dustTau === 'number' ? state.dustTau : 0.42;
    // Skip extra pass at default midday clear conditions for crisp baseline ortho fidelity
    if (Math.abs(ltst - 13.5) < 0.35 && tau < 0.65) return null;

    const key = `${state.theaterKey}|${ltst.toFixed(1)}|${tau.toFixed(2)}`;
    if (solarCacheCanvas && solarCacheKey === key) return solarCacheCanvas;

    const gw = grid[0].length;
    const gh = grid.length;
    if (!solarCacheCanvas) solarCacheCanvas = document.createElement('canvas');
    solarCacheCanvas.width = gw;
    solarCacheCanvas.height = gh;

    // Sun trajectory: 06:00 East (az=0), 12:30 Zenith-South, 19:00 West (az=PI)
    const dayFrac = clamp((ltst - 5.5) / 14.0, 0, 1);
    const sunElevRad = Math.max(0.05, Math.sin(dayFrac * Math.PI) * 1.18);
    const sunAzRad = dayFrac * Math.PI;
    const lx = Math.cos(sunAzRad) * Math.cos(sunElevRad);
    const ly = Math.sin(sunAzRad) * 0.35 * Math.cos(sunElevRad);
    const lz = Math.sin(sunElevRad);

    const twilight = clamp(1 - Math.sin(dayFrac * Math.PI) * 1.45, 0, 1);
    const dustHaze = clamp((tau - 0.42) / 3.0, 0, 0.72);

    const sctx = solarCacheCanvas.getContext('2d');
    const imgData = sctx.createImageData(gw, gh);
    const data = imgData.data;

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const cell = grid[y][x];
        const nx = -cell.dzdx * 2.8;
        const ny = -cell.dzdy * 2.8;
        const nz = 1.0;
        const invLen = 1 / Math.hypot(nx, ny, nz);
        const ndotl = clamp((nx * invLen) * lx + (ny * invLen) * ly + (nz * invLen) * lz, 0, 1);

        let r = 14;
        let g = 11;
        let b = 16;
        let a = 0;

        // Topographic ridge shadow when sun is low
        const shadowStrength = clamp((0.68 - ndotl) * (0.55 + twilight * 0.45), 0, 0.64);
        if (shadowStrength > 0.02) {
          a = shadowStrength;
        } else if (ndotl > 0.75 && twilight > 0.15) {
          // Warm low-angle Martian sunlit ridge crest
          r = 251;
          g = 146;
          b = 60;
          a = (ndotl - 0.75) * 0.45 * twilight;
        }

        // Dusk / Dawn twilight ambient shift
        if (twilight > 0.18) {
          const ta = twilight * 0.32;
          r = r * (1 - ta) + 30 * ta;
          g = g * (1 - ta) + 20 * ta;
          b = b * (1 - ta) + 38 * ta;
          a = 1 - (1 - a) * (1 - ta);
        }

        // Butterscotch Mie dust storm scattering veil
        if (dustHaze > 0.03) {
          const da = dustHaze * 0.62;
          r = r * (1 - da) + 198 * da;
          g = g * (1 - da) + 116 * da;
          b = b * (1 - da) + 54 * da;
          a = 1 - (1 - a) * (1 - da);
        }

        const idx = (y * gw + x) * 4;
        data[idx] = Math.round(r);
        data[idx + 1] = Math.round(g);
        data[idx + 2] = Math.round(b);
        data[idx + 3] = Math.round(clamp(a, 0, 0.78) * 255);
      }
    }

    sctx.putImageData(imgData, 0, 0);
    solarCacheKey = key;
    return solarCacheCanvas;
  }

  function drawRibbon(ctx, pts, w, h, casingColor, innerColor, innerWidth, dashed, drawChevrons) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const px = pt.nx * w;
      const py = pt.ny * h;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (casingColor) {
      ctx.strokeStyle = casingColor;
      ctx.lineWidth = innerWidth + 4.0;
      if (dashed) ctx.setLineDash(dashed);
      ctx.stroke();
    }

    ctx.strokeStyle = innerColor;
    ctx.lineWidth = innerWidth;
    if (dashed) ctx.setLineDash(dashed);
    ctx.stroke();
    ctx.setLineDash([]);

    if (drawChevrons) {
      for (let i = 4; i < pts.length - 3; i += 9) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const ang = Math.atan2((p1.ny - p0.ny) * h, (p1.nx - p0.nx) * w);
        ctx.save();
        ctx.translate(p0.nx * w, p0.ny * h);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-3.5, -3);
        ctx.lineTo(2.5, 0);
        ctx.lineTo(-3.5, 3);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function renderStrategicMap(canvas, state, requestRedraw) {
    if (!canvas) return;
    const hasFixed = canvas._fixedWidth && canvas._fixedHeight;
    const rect =
      !hasFixed && canvas.parentElement
        ? canvas.parentElement.getBoundingClientRect()
        : { width: canvas._fixedWidth || 880, height: canvas._fixedHeight || 440 };
    const dpr = hasFixed ? 2 : window.devicePixelRatio || 1;
    const w = Math.max(280, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height));

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, w, h);

    const theater = window.ARES_THEATERS[state.theaterKey];
    const activeBasemapUrl = state.customBasemapUrl || theater.basemapImg;
    const activeVariant =
      (theater.basemapVariants || []).find((v) => v.url === activeBasemapUrl) || {};
    const isRefMap = !!activeVariant.isRef;

    // Clamp Pan so user can smoothly pan around terrain without ever dragging into a black void
    const overscan = isRefMap ? 0 : 0.24;
    const maxPanX = w * (overscan * state.zoom + Math.max(0, state.zoom - 1) * 0.5);
    const maxPanY = h * (overscan * state.zoom + Math.max(0, state.zoom - 1) * 0.5);
    state.panX = Math.max(-maxPanX, Math.min(maxPanX, state.panX));
    state.panY = Math.max(-maxPanY, Math.min(maxPanY, state.panY));

    // Apply World-Space Pan & Zoom
    ctx.save();
    ctx.translate(w / 2 + state.panX, h / 2 + state.panY);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-w / 2, -h / 2);

    // 1. Draw Satellite Basemap or Official NASA Reference Map
    const baseImg = getImg(activeBasemapUrl, requestRedraw);
    if (baseImg && baseImg.complete && baseImg.naturalWidth > 0) {
      if (isRefMap) {
        drawImageContain(ctx, baseImg, 0, 0, w, h);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(18, 16, 14, 0.92)';
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.lineWidth = 1;
        ctx.fillRect(16, h - 46, 365, 28);
        ctx.strokeRect(16, h - 46, 365, 28);
        ctx.fillStyle = '#fb923c';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText('OFFICIAL NASA ARCHIVE MAP • SYNTHETIC GPS OVERLAYS HIDDEN', 28, h - 28);
        ctx.restore();
        ctx.restore();
        return;
      }

      const ox = -w * overscan;
      const oy = -h * overscan;
      const ow = w * (1 + overscan * 2);
      const oh = h * (1 + overscan * 2);
      drawImageCover(ctx, baseImg, ox, oy, ow, oh);

      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.35,
        w * 0.5,
        h * 0.5,
        Math.max(ow, oh) * 0.65
      );
      vig.addColorStop(0, 'rgba(12, 10, 9, 0.02)');
      vig.addColorStop(1, 'rgba(12, 10, 9, 0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(ox, oy, ow, oh);
    }

    // 2. Cached Real-DEM Scientific Raster Overlays + Diurnal Solar/Dust Atmosphere
    const solarRaster = getSolarHillshadeCanvas(state);
    if (solarRaster) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(solarRaster, 0, 0, w, h);
      ctx.restore();
    }

    const sciRaster = getScientificRasterCanvas(state);
    if (sciRaster) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sciRaster, 0, 0, w, h);
      ctx.restore();
    }

    // 3. Subtle Aerospace GPS Graticule
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const gx = (i / 6) * w;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let j = 1; j < 4; j++) {
      const gy = (j / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // 4. Vector Callouts for Active Scientific Layers
    if (state.layers.topoSlope) {
      theater.hazards.forEach((hz) => {
        const hx = hz.x * w;
        const hy = hz.y * h;
        const rx = hz.rx * w;
        const ry = hz.ry * h;
        const isCrit = hz.severity === 'CRITICAL';

        ctx.save();
        ctx.translate(hx, hy);
        ctx.scale(1, ry / rx);
        ctx.strokeStyle = isCrit ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.80)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, rx * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = '700 9px "JetBrains Mono", monospace';
        const shortTag = isCrit ? `NO-GO SCARP (${hz.maxSlope}°)` : 'SAND DRIFT (<130 TIU)';
        const tw = ctx.measureText(shortTag).width + 10;
        ctx.fillStyle = 'rgba(12, 10, 9, 0.84)';
        ctx.fillRect(hx - tw / 2, hy - 7, tw, 14);
        ctx.fillStyle = isCrit ? '#fca5a5' : '#fde68a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shortTag, hx, hy);
        ctx.restore();
      });
    }

    if (state.layers.radiationWeather) {
      theater.shelters.forEach((sh) => {
        const sx = sh.x * w;
        const sy = sh.y * h;
        const sr = sh.radius * Math.min(w, h);
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.90)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 0.78, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#6ee7b7';
        ctx.textAlign = 'center';
        ctx.fillText(`SHELTER (-${sh.shieldingPct}% RAD)`, sx, sy - sr * 0.82 - 5);
        ctx.restore();
      });
    }

    // 5. Real NASA Mars 2020 Perseverance Rim Ascent Track (Site 089 -> Site 093)
    if (state.layers.m20Traverse && state.theaterKey === 'jezero' && window.M20_GPS_DATA) {
      const wps88 = window.M20_GPS_DATA.site88to93Waypoints || [];
      if (wps88.length > 2) {
        // Map Site 89..93 GPS corridor cleanly onto SW approach into HAB-01 (Site 093)
        const minLon = 77.2175;
        const maxLon = 77.2335;
        const minLat = 18.4220;
        const maxLat = 18.4375;
        ctx.save();
        ctx.beginPath();
        wps88.forEach((pt, idx) => {
          const u = clamp((pt.lon - minLon) / (maxLon - minLon), 0, 1);
          const v = clamp((maxLat - pt.lat) / (maxLat - minLat), 0, 1);
          // Anchor end of Site 093 drive directly at HAB-01 (0.16, 0.78)
          const px = (0.03 + u * 0.145) * w;
          const py = (0.64 + v * 0.31) * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = 'rgba(12, 10, 9, 0.9)';
        ctx.lineWidth = 4.6;
        ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.1;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const appTag = 'M2020 ROVER APPROACH (SOLS 1910→2022)';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        const atw = ctx.measureText(appTag).width + 12;
        const ax = 0.028 * w;
        const ay = 0.618 * h;
        ctx.fillStyle = 'rgba(12, 10, 9, 0.86)';
        ctx.fillRect(ax, ay - 8, atw, 15);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ax, ay - 8, atw, 15);
        ctx.fillStyle = '#7dd3fc';
        ctx.textBaseline = 'middle';
        ctx.fillText(appTag, ax + 6, ay);
        ctx.restore();
      }
    }

    // 6. Walk-Back Abort Envelope (Subtle Dashed Safety Ring from HAB-01)
    const habWp = theater.waypoints[0];
    const habX = habWp.x * w;
    const habY = habWp.y * h;
    const abortRx = state.routeResult.stats.walkBackNormRx * w;
    const abortRy = state.routeResult.stats.walkBackNormRy * h;
    const isLow = state.routeResult.stats.limitingPct < 38;

    ctx.save();
    ctx.strokeStyle = isLow ? 'rgba(239, 68, 68, 0.75)' : 'rgba(245, 158, 11, 0.40)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.ellipse(habX, habY, abortRx, abortRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 7. Render Nominal Planned GPS Route Ribbon + Subtle Dashed Direct Scarp Reference Line
    const path = state.routeResult.path;
    const directPath = state.routeResult.directPath;
    const contingency = state.emergencyAbortActive ? state.routeResult.contingency : null;
    if (directPath && directPath.length > 1 && state.routingMode !== 'direct' && !contingency) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      drawRibbon(ctx, directPath, w, h, 'rgba(12, 10, 9, 0.70)', '#fb7185', 1.8, [5, 4], false);
      ctx.restore();
    }
    if (path && path.length > 1) {
      ctx.save();
      if (contingency) ctx.globalAlpha = 0.28;
      const routeColor =
        state.routingMode === 'rad_shelter'
          ? '#22c55e'
          : state.routingMode === 'direct'
          ? '#fb7185'
          : state.routingMode === 'science'
          ? '#38bdf8'
          : '#f97316';
      drawRibbon(ctx, path, w, h, 'rgba(12, 10, 9, 0.94)', routeColor, 3.4, null, !contingency);
      ctx.restore();
    }

    // 7B. Render 2-Stage Contingency Shelter Diversion Route when Emergency Abort is Active
    if (contingency) {
      // Leg 2: Post-Storm Walk-Back Corridor (Shelter -> HAB-01)
      drawRibbon(
        ctx,
        contingency.leg2Path,
        w,
        h,
        'rgba(12, 10, 9, 0.85)',
        '#10b981',
        2.5,
        [6, 5],
        false
      );

      // Leg 1: Immediate Emergency Sprint (Crew Origin -> WP-03 Radiation Shelter)
      drawRibbon(
        ctx,
        contingency.leg1Path,
        w,
        h,
        'rgba(12, 10, 9, 0.96)',
        '#ef4444',
        3.8,
        null,
        true
      );

      // Pulsing Emerald Bunker Lock around Shelter Waypoint
      const shX = contingency.shelterNx * w;
      const shY = contingency.shelterNy * h;
      ctx.save();
      ctx.beginPath();
      ctx.arc(shX, shY, 26, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // 8. Render Clean, Non-Overlapping GPS Waypoint Beacons
    theater.waypoints.forEach((wp, idx) => {
      const wx = wp.x * w;
      const wy = wp.y * h;
      const isSel = idx === state.selectedWaypointIdx;
      const isEmergencyTarget = contingency && wp.role === 'shelter';

      ctx.save();
      if (isSel || isEmergencyTarget) {
        ctx.beginPath();
        ctx.arc(wx, wy, 18, 0, Math.PI * 2);
        ctx.fillStyle = isEmergencyTarget ? 'rgba(16, 185, 129, 0.25)' : 'rgba(249, 115, 22, 0.22)';
        ctx.fill();
        ctx.strokeStyle = isEmergencyTarget ? '#10b981' : '#f97316';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(wx, wy, isSel ? 8.5 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle =
        wp.role === 'habitat'
          ? '#f97316'
          : wp.role === 'shelter'
          ? '#22c55e'
          : isSel
          ? '#ffffff'
          : '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const yOff = idx % 2 === 0 ? -21 : 20;
      const tag = isEmergencyTarget ? `${wp.code} • BUNKER` : wp.code;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tag).width + 12;

      ctx.fillStyle = isEmergencyTarget
        ? '#059669'
        : isSel
        ? '#ea580c'
        : 'rgba(18, 16, 14, 0.92)';
      ctx.fillRect(wx - tw / 2, wy + yOff - 8.5, tw, 17);
      ctx.strokeStyle = isSel || isEmergencyTarget ? '#ffffff' : 'rgba(168, 162, 158, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx - tw / 2, wy + yOff - 8.5, tw, 17);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, wx, wy + yOff);
      ctx.restore();

      wp._screenX = wx;
      wp._screenY = wy;
      wp._labelY = wy + yOff;
    });

    // 8B. Render User-Plotted Custom EVA GPS Pins
    if (state.customWaypoints && state.customWaypoints.length > 0) {
      state.customWaypoints.forEach((cwp, cIdx) => {
        const cx = cwp.x * w;
        const cy = cwp.y * h;
        ctx.save();

        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#f43f5e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();

        ctx.save();
        const cTag = `${cwp.code} • ${cwp.slopeDeg}° [×]`;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const ctw = ctx.measureText(cTag).width + 12;
        const yOff = cIdx % 2 === 0 ? -22 : 21;
        ctx.fillStyle = 'rgba(18, 16, 14, 0.94)';
        ctx.fillRect(cx - ctw / 2, cy + yOff - 8.5, ctw, 17);
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(cx - ctw / 2, cy + yOff - 8.5, ctw, 17);
        ctx.fillStyle = '#ffe4e6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cTag, cx, cy + yOff);
        ctx.restore();

        cwp._screenX = cx;
        cwp._screenY = cy;
      });
    }

    // 8C. Render Clicked Terrain Inspection Reticle (when explorer clicks any spot on Mars)
    if (state.inspectedPoint && !state._isSnapshot) {
      const ipx = state.inspectedPoint.nx * w;
      const ipy = state.inspectedPoint.ny * h;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(ipx, ipy, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ipx - 19, ipy);
      ctx.lineTo(ipx - 8, ipy);
      ctx.moveTo(ipx + 8, ipy);
      ctx.lineTo(ipx + 19, ipy);
      ctx.moveTo(ipx, ipy - 19);
      ctx.lineTo(ipx, ipy - 8);
      ctx.moveTo(ipx, ipy + 8);
      ctx.lineTo(ipx, ipy + 19);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ipx, ipy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Render Live Directional 3D GPS Navigation Chevron for Astronaut Crew
    let crewX = w * 0.35;
    let crewY = h * 0.65;
    const activeCrewTrack =
      contingency && contingency.leg1Path && contingency.leg1Path.length > 1
        ? contingency.leg1Path
        : path;
    const activeProgress = contingency
      ? clamp(state.emergencyProgress ?? 0, 0, 1)
      : clamp(state.traverseProgress ?? 0, 0, 1);

    if (activeCrewTrack && activeCrewTrack.length > 1) {
      const fIdx = activeProgress * (activeCrewTrack.length - 1);
      const i0 = Math.min(activeCrewTrack.length - 1, Math.floor(fIdx));
      const i1 = Math.min(activeCrewTrack.length - 1, i0 + 1);
      const frac = fIdx - i0;
      const crewNx = activeCrewTrack[i0].nx + (activeCrewTrack[i1].nx - activeCrewTrack[i0].nx) * frac;
      const crewNy = activeCrewTrack[i0].ny + (activeCrewTrack[i1].ny - activeCrewTrack[i0].ny) * frac;
      const cx = crewNx * w;
      const cy = crewNy * h;
      crewX = cx;
      crewY = cy;
      state._crewNx = crewNx;
      state._crewNy = crewNy;

      const iNext = Math.min(activeCrewTrack.length - 1, i0 + 2);
      const iPrev = Math.max(0, i0 - 1);
      const headingAng = Math.atan2(
        (activeCrewTrack[iNext].ny - activeCrewTrack[iPrev].ny) * h,
        (activeCrewTrack[iNext].nx - activeCrewTrack[iPrev].nx) * w
      );

      const isShelteredNow = contingency && activeProgress >= 0.99;

      // Dual-Astronaut Buddy Crew: EV-2 Scout trailing ~26m behind EV-1 Lead with Co-Visibility Link
      const ev2Prog = Math.max(0, activeProgress - 0.032);
      const fIdx2 = ev2Prog * (activeCrewTrack.length - 1);
      const j0 = Math.min(activeCrewTrack.length - 1, Math.floor(fIdx2));
      const j1 = Math.min(activeCrewTrack.length - 1, j0 + 1);
      const frac2 = fIdx2 - j0;
      const ev2Nx = activeCrewTrack[j0].nx + (activeCrewTrack[j1].nx - activeCrewTrack[j0].nx) * frac2;
      const ev2Ny = activeCrewTrack[j0].ny + (activeCrewTrack[j1].ny - activeCrewTrack[j0].ny) * frac2;
      const ev2X = ev2Nx * w;
      const ev2Y = ev2Ny * h;
      state._ev2Nx = ev2Nx;
      state._ev2Ny = ev2Ny;

      if (Math.hypot(cx - ev2X, cy - ev2Y) > 4) {
        ctx.save();
        ctx.strokeStyle = state.buddyFaultSim
          ? 'rgba(239, 68, 68, 0.92)'
          : 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth = state.buddyFaultSim ? 2.2 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ev2X, ev2Y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = state.buddyFaultSim ? '#ef4444' : '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ev2X, ev2Y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const ev2Tag = state.buddyFaultSim ? 'EV-2 TOW' : 'EV-2';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        const ev2Tw = ctx.measureText(ev2Tag).width + 8;
        const candidates = [
          { lx: ev2X, ly: ev2Y - 14 },
          { lx: ev2X, ly: ev2Y + 15 },
          { lx: ev2X - ev2Tw / 2 - 9, ly: ev2Y },
          { lx: ev2X + ev2Tw / 2 + 9, ly: ev2Y }
        ];
        let bestCand = candidates[0];
        let bestClear = -1;
        candidates.forEach((cand) => {
          let minD = Math.hypot(cand.lx - cx, cand.ly - cy);
          theater.waypoints.forEach((wp) => {
            minD = Math.min(
              minD,
              Math.hypot(cand.lx - (wp._screenX || 0), cand.ly - (wp._labelY || 0)),
              Math.hypot(cand.lx - (wp._screenX || 0), cand.ly - (wp._screenY || 0))
            );
          });
          if (minD > bestClear) {
            bestClear = minD;
            bestCand = cand;
          }
        });
        ctx.fillStyle = 'rgba(12, 10, 9, 0.86)';
        ctx.fillRect(bestCand.lx - ev2Tw / 2, bestCand.ly - 6.5, ev2Tw, 13);
        ctx.strokeStyle = state.buddyFaultSim ? 'rgba(248, 113, 113, 0.65)' : 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bestCand.lx - ev2Tw / 2, bestCand.ly - 6.5, ev2Tw, 13);
        ctx.fillStyle = state.buddyFaultSim ? '#fecaca' : '#bae6fd';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ev2Tag, bestCand.lx, bestCand.ly);
        ctx.restore();
      }

      // Bi-Directional CapCom Holographic Target Vector & Pulsing Diamond
      if (state.capcomTarget) {
        const tgt = state.capcomTarget;
        const tx = tgt.nx * w;
        const ty = tgt.ny * h;
        const dxM = (tgt.nx - crewNx) * 1600;
        const dyM = (tgt.ny - crewNy) * 1088;
        tgt.distM = Math.max(2, Math.round(Math.hypot(dxM, dyM)));
        tgt.bearingDeg = Math.round(((Math.atan2(dxM, -dyM) * 180) / Math.PI + 360) % 360);

        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.82)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        const pulseR = 14 + 5 * Math.sin(performance.now() * 0.006);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();

        const mTag = `◆ CAPCOM • ${tgt.bearingDeg}° • ${tgt.distM}m [×]`;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const mtw = ctx.measureText(mTag).width + 12;
        ctx.fillStyle = 'rgba(8, 28, 42, 0.94)';
        ctx.fillRect(tx - mtw / 2, ty - 28, mtw, 17);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(tx - mtw / 2, ty - 28, mtw, 17);
        ctx.fillStyle = '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mTag, tx, ty - 19.5);
        ctx.restore();

        tgt._screenX = tx;
        tgt._screenY = ty;
      }

      ctx.save();
      ctx.translate(cx, cy);

      // Synced 360° Visor FOV Frustum Cone when CapCom Live Link is active
      if (state.capcomLinked) {
        const visorRad = (((state.hudYawDeg || 0) - 90) * Math.PI) / 180;
        const halfFov = ((45 / (state.hudZoom || 1)) * Math.PI) / 180;
        const coneR = 76;
        const vGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, coneR);
        vGrad.addColorStop(0, 'rgba(56, 189, 248, 0.52)');
        vGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
        ctx.fillStyle = vGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, coneR, visorRad - halfFov, visorRad + halfFov);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // GPS HDOP accuracy halo
      ctx.fillStyle = isShelteredNow
        ? 'rgba(16, 185, 129, 0.34)'
        : state.emergencyAbortActive
        ? 'rgba(239, 68, 68, 0.32)'
        : 'rgba(249, 115, 22, 0.18)';
      ctx.strokeStyle = isShelteredNow
        ? '#10b981'
        : state.emergencyAbortActive
        ? '#ef4444'
        : 'rgba(249, 115, 22, 0.65)';
      ctx.lineWidth = state.emergencyAbortActive ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.rotate(headingAng);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isShelteredNow
        ? '#059669'
        : state.emergencyAbortActive
        ? '#ef4444'
        : '#ea580c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-8, -7.5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (isShelteredNow) {
        const sBadge = `SHELTERED (-${contingency.shieldingPct}% SEP DOSE)`;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const bw = ctx.measureText(sBadge).width + 14;
        ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
        ctx.fillRect(-bw / 2, -39, bw, 18);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-bw / 2, -39, bw, 18);
        ctx.fillStyle = '#ecfdf5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sBadge, 0, -30);
      }

      ctx.restore();

      // Live Walk-Back Return Distance & Safety Margin
      const dxHabM = (crewNx - habWp.x) * 1600;
      const dyHabM = (crewNy - habWp.y) * 1088;
      const distToHabM = Math.round(Math.hypot(dxHabM, dyHabM));
      const walkBackMaxM = state.routeResult.stats.walkBackRadiusM || 1200;
      const marginPct = Math.round(((walkBackMaxM - distToHabM) / Math.max(1, walkBackMaxM)) * 100);
      state._liveDistToHabM = distToHabM;
      state._liveWalkBackMarginPct = marginPct;
    }

    // 9B. Render Realistic NASA Ingenuity Mars Helicopter Aerial Scout
    if (state.ingenuityScoutActive) {
      const allWps = theater.waypoints.concat(state.customWaypoints || []);
      const targetWp =
        allWps[allWps.length - 1] ||
        theater.waypoints[state.selectedWaypointIdx] ||
        theater.waypoints[0];
      const tx = targetWp.x * w;
      const ty = targetWp.y * h;

      const t = state.ingenuityPhase || 0;
      const lerp = 0.30 + 0.40 * (0.5 + 0.5 * Math.sin(t * 1.3));
      const lat = 0.24 + 0.12 * Math.cos(t * 2.4);
      const orthoX = -(ty - crewY) * lat;
      const orthoY = (tx - crewX) * lat;
      const hx = crewX + (tx - crewX) * lerp + orthoX;
      const hy = crewY + (ty - crewY) * lerp + orthoY;

      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(crewX, crewY);
      ctx.lineTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      const scanGrad = ctx.createRadialGradient(hx, hy, 4, hx, hy, 48);
      scanGrad.addColorStop(0, 'rgba(245, 158, 11, 0.24)');
      scanGrad.addColorStop(0.7, 'rgba(249, 115, 22, 0.08)');
      scanGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = scanGrad;
      ctx.beginPath();
      ctx.arc(hx, hy, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(hx + 14, hy + 16);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(hx, hy);
      const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.8;
      legAngles.forEach((ang) => {
        const lx = Math.cos(ang) * 21;
        const ly = Math.sin(ang) * 21;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 5, Math.sin(ang) * 5);
        ctx.lineTo(lx, ly);
        ctx.stroke();

        ctx.fillStyle = '#292524';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 1.8;
      });

      const blurGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
      blurGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      blurGrad.addColorStop(0.75, 'rgba(214, 211, 209, 0.14)');
      blurGrad.addColorStop(1, 'rgba(255, 255, 255, 0.03)');
      ctx.fillStyle = blurGrad;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-6.5, -6.5, 13, 13);
      ctx.strokeRect(-6.5, -6.5, 13, 13);

      const drawCoaxialPropeller = (angleRad, bladeColor, edgeColor) => {
        ctx.save();
        ctx.rotate(angleRad);
        ctx.fillStyle = bladeColor;
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 1.1;
        [-1, 1].forEach((dir) => {
          ctx.beginPath();
          ctx.moveTo(dir * 2.5, -1.2);
          ctx.quadraticCurveTo(dir * 14, -4.6, dir * 25.5, -1.2);
          ctx.lineTo(dir * 25.5, 1.2);
          ctx.quadraticCurveTo(dir * 14, 4.6, dir * 2.5, 1.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      };

      drawCoaxialPropeller(-t * 8.5, 'rgba(38, 38, 38, 0.92)', '#a8a29e');
      drawCoaxialPropeller(t * 8.5 + 0.85, 'rgba(68, 64, 60, 0.95)', '#f5f5f4');

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-8, -4.2, 16, 8.4);
      ctx.strokeRect(-8, -4.2, 16, 8.4);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-2.6, -4.2);
      ctx.lineTo(-2.6, 4.2);
      ctx.moveTo(2.6, -4.2);
      ctx.lineTo(2.6, 4.2);
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      ctx.restore();

      const hTag = 'INGENUITY • 12m AGL';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      const htw = ctx.measureText(hTag).width + 12;
      ctx.fillStyle = 'rgba(18, 16, 14, 0.92)';
      ctx.fillRect(hx - htw / 2, hy - 39, htw, 16);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.1;
      ctx.strokeRect(hx - htw / 2, hy - 39, htw, 16);
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hTag, hx, hy - 31);
      ctx.restore();
    }

    ctx.restore(); // End world-space pan/zoom

    // =========================================================================
    // SCREEN-SPACE HUD CORNERS (Zero Overlap • Clean Aerospace Telemetry)
    // =========================================================================

    // 10A. Top-Left Quantitative A* Suit-Physics Proof Pill
    const hasTopRightInset =
      !!(state.layers.m20Traverse && state.theaterKey === 'jezero' && window.M20_GPS_DATA && w > 520);
    const maxLeftW = hasTopRightInset ? Math.max(200, w - 236) : w - 24;
    const savings = state.routeResult && state.routeResult.stats && state.routeResult.stats.savings;
    if (savings && w > 420) {
      ctx.save();
      let pillText = '';
      let borderCol = 'rgba(249, 115, 22, 0.55)';
      let textCol = '#fed7aa';

      if (contingency) {
        const done = (state.emergencyProgress || 0) >= 0.99;
        pillText = done
          ? `CONTINGENCY LOCK: ${contingency.shelterCode} SHELTER REACHED • -${contingency.shieldingPct}% SEP ATTENUATION`
          : `SEP CONTINGENCY A*: SPRINT ${contingency.distToShelterM}m → ${contingency.shelterCode} BUNKER (${contingency.etaShelterMin} MIN)`;
        borderCol = done ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
        textCol = done ? '#a7f3d0' : '#fecaca';
      } else if (state.routingMode === 'direct') {
        pillText = `DIRECT BASELINE [NO-GO]: HITS ${savings.directMaxSlopeDeg}° SCARP • +${savings.o2SavedPct}% HIGHER PLSS O₂`;
        borderCol = 'rgba(244, 63, 94, 0.80)';
        textCol = '#fecdd3';
      } else {
        const modeTag =
          state.routingMode === 'science'
            ? 'A* MAX-SCIENCE'
            : state.routingMode === 'rad_shelter'
            ? 'A* RAD-SHIELD'
            : 'A* OPTIMAL';
        pillText = `${modeTag} vs DIRECT: -${savings.o2SavedPct}% PLSS O₂ (-${savings.kcalSaved} kcal) • BYPASSES ${savings.directMaxSlopeDeg}° SCARP (MAX ${state.routeResult.stats.maxSlopeDeg}°)`;
        borderCol =
          state.routingMode === 'rad_shelter'
            ? 'rgba(34, 197, 94, 0.70)'
            : state.routingMode === 'science'
            ? 'rgba(56, 189, 248, 0.70)'
            : 'rgba(249, 115, 22, 0.60)';
        textCol =
          state.routingMode === 'rad_shelter'
            ? '#bbf7d0'
            : state.routingMode === 'science'
            ? '#bae6fd'
            : '#fed7aa';
      }

      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      const pw = Math.min(maxLeftW, ctx.measureText(pillText).width + 20);
      ctx.fillStyle = 'rgba(14, 12, 11, 0.88)';
      ctx.fillRect(12, 10, pw, 22);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 10, pw, 22);
      ctx.save();
      ctx.beginPath();
      ctx.rect(14, 10, pw - 4, 22);
      ctx.clip();
      ctx.fillStyle = textCol;
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, 20, 21);
      ctx.restore();

      // Compact Visual Legend Strip right under the A* pill (width-bounded so it never touches top-right inset)
      if (!state._isSnapshot && w > 580 && maxLeftW >= 360) {
        const legY = 36;
        const legH = 20;
        const actCol =
          state.routingMode === 'rad_shelter'
            ? '#22c55e'
            : state.routingMode === 'science'
            ? '#38bdf8'
            : state.routingMode === 'direct'
            ? '#fb7185'
            : '#f97316';
        const showClickHint = maxLeftW >= 492;
        const legW = showClickHint ? 486 : Math.min(356, maxLeftW);
        ctx.fillStyle = 'rgba(14, 12, 11, 0.84)';
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.40)';
        ctx.fillRect(12, legY, legW, legH);
        ctx.strokeRect(12, legY, legW, legH);

        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';
        // Item 1: Planned Route
        ctx.strokeStyle = actCol;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(20, legY + 10);
        ctx.lineTo(36, legY + 10);
        ctx.stroke();
        ctx.fillStyle = '#e7e5e4';
        ctx.fillText('Planned Route', 41, legY + 10.5);

        // Item 2: Direct Steep Line
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(124, legY + 10);
        ctx.lineTo(140, legY + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fda4af';
        ctx.fillText('Direct Cliff Line', 145, legY + 10.5);

        // Item 3: Walk-Back Safe Limit
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(248, legY + 10);
        ctx.lineTo(264, legY + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fcd34d';
        ctx.fillText('Walk-Back Limit', 269, legY + 10.5);

        // Item 4: Direct-Click Affordance Hint (only when wide enough)
        if (showClickHint) {
          ctx.fillStyle = '#93c5fd';
          ctx.fillText('• Click terrain to inspect', 362, legY + 10.5);
        }
      }
      ctx.restore();
    }

    // 10B. Top-Right Mars 2020 Full 45.25 km Crater-to-Rim Overview Inset (When M2020 Track Enabled)
    if (state.layers.m20Traverse && state.theaterKey === 'jezero' && window.M20_GPS_DATA && w > 520) {
      const m20 = window.M20_GPS_DATA;
      const fullPts = m20.fullTraverse || [];
      if (fullPts.length > 10) {
        const boxW = 204;
        const boxH = 122;
        const bx = w - boxW - 12;
        const by = 10;

        ctx.save();
        ctx.fillStyle = 'rgba(14, 12, 11, 0.92)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 1.1;
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeRect(bx, by, boxW, boxH);

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('M2020 FULL TRAVERSE • 45.25 KM', bx + 8, by + 13);

        const padX = 12;
        const padTop = 22;
        const padBot = 16;
        const pw = boxW - padX * 2;
        const ph = boxH - padTop - padBot;
        const [minLon, maxLon] = m20.lonBounds;
        const [minLat, maxLat] = m20.latBounds;

        const mapPt = (lon, lat) => ({
          x: bx + padX + ((lon - minLon) / (maxLon - minLon)) * pw,
          y: by + padTop + ((maxLat - lat) / (maxLat - minLat)) * ph
        });

        // Plot 350-point Perseverance traverse from Sol 13 Landing to Sol 2022 Rim
        ctx.beginPath();
        fullPts.forEach((p, idx) => {
          const mp = mapPt(p[0], p[1]);
          if (idx === 0) ctx.moveTo(mp.x, mp.y);
          else ctx.lineTo(mp.x, mp.y);
        });
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Start (Sol 13 Butler Landing) & End (Sol 2022 Site 093)
        const pStart = mapPt(fullPts[0][0], fullPts[0][1]);
        const pEnd = mapPt(fullPts[fullPts.length - 1][0], fullPts[fullPts.length - 1][1]);

        ctx.fillStyle = '#a8a29e';
        ctx.beginPath();
        ctx.arc(pStart.x, pStart.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(pEnd.x, pEnd.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Active Scrubber Marker if user is scrubbing historical rover odometry
        if (state.scrubGpsCoord) {
          const pScrub = mapPt(state.scrubGpsCoord.lon, state.scrubGpsCoord.lat);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(pScrub.x, pScrub.y, 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('SOL 13 (-2570m)', bx + 8, by + boxH - 5);
        ctx.fillStyle = '#fb923c';
        ctx.textAlign = 'right';
        ctx.fillText('SITE 093 (-1936m)', bx + boxW - 8, by + boxH - 5);
        ctx.restore();
      }
    }

    // 10D. Bottom-Right Scale & GPS Coordinates Watermark (with clean contrast pill)
    const gpsStr = `GPS LOCK: ${theater.coords} • ELEV ${theater.baseElevM}m • HDOP 0.4m`;
    ctx.save();
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    const gpsW = ctx.measureText(gpsStr).width + 16;
    ctx.fillStyle = 'rgba(14, 12, 11, 0.84)';
    ctx.strokeStyle = 'rgba(68, 64, 60, 0.65)';
    ctx.lineWidth = 1;
    ctx.fillRect(w - gpsW - 10, h - 28, gpsW, 19);
    ctx.strokeRect(w - gpsW - 10, h - 28, gpsW, 19);
    ctx.fillStyle = 'rgba(214, 211, 209, 0.88)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(gpsStr, w - 18, h - 18.5);
    ctx.restore();

    // 10C. Bottom-Left Live Cursor Scientific Terrain Probe (auto-hidden when Terrain Inspector card is open)
    if (state.hoverProbe && !state.inspectedPoint && w > 540) {
      const hp = state.hoverProbe;
      const uhfTag = hp.uhfLos ? `UHF +${hp.uhfMarginDb}dB` : `UHF SHADOW (${hp.uhfMarginDb}dB)`;
      const probeStr = `PROBE ${Math.abs(hp.lat).toFixed(4)}°${hp.lat >= 0 ? 'N' : 'S'}, ${hp.lon.toFixed(4)}°E • ELEV ${Math.round(hp.elevM)}m • SLOPE ${hp.slopeDeg}° • ${hp.thermalInertia} TIU • ${uhfTag}`;
      ctx.save();
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      const maxProbeW = Math.max(180, w - gpsW - 34);
      const tw = Math.min(maxProbeW, ctx.measureText(probeStr).width + 18);
      ctx.fillStyle = 'rgba(14, 12, 11, 0.88)';
      ctx.strokeStyle = hp.slopeDeg >= 25 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(120, 113, 108, 0.45)';
      ctx.lineWidth = 1;
      ctx.fillRect(12, h - 28, tw, 19);
      ctx.strokeRect(12, h - 28, tw, 19);
      ctx.beginPath();
      ctx.rect(14, h - 28, tw - 4, 19);
      ctx.clip();
      ctx.fillStyle = hp.slopeDeg >= 25 ? '#fca5a5' : '#e7e5e4';
      ctx.textBaseline = 'middle';
      ctx.fillText(probeStr, 20, h - 18.5);
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    renderStrategicMap,
    clientToMapNorm,
    getScientificRasterCanvas
  };
})();
