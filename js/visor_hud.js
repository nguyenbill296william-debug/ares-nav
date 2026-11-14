/**
 * ARES-NAV // Mode 3: True Interactive 360° / Wide-FOV Visor Panorama & Stereoscopic 3D AR HUD
 * Seamless 360° wrapping, depth-scaled binocular AR disparity, iOS-safe spectral filters,
 * Martian LTST & Dust Storm Whiteout (τ), DEM Synthetic Vision Wireframe, Bi-Directional CapCom AR Target & LIBS Spectrum
 */

window.ARES_HUD = (function () {
  const imageCache = {};

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  const BUTLER_360_PINS = [
    {
      yawDeg: 58,
      pitchY: 0.43,
      label: 'Western Delta Scarp',
      detail: 'Ancient Jezero river delta front (~2.2 km NW)',
      type: 'sci',
      distM: 2200,
      elevM: '+45m'
    },
    {
      yawDeg: 148,
      pitchY: 0.44,
      label: 'Kodiak Delta Butte',
      detail: 'Erosional delta remnant preserving lakebed strata',
      type: 'sci',
      distM: 2400,
      elevM: '+38m'
    },
    {
      yawDeg: 252,
      pitchY: 0.42,
      label: 'Santa Cruz Hill',
      detail: 'Crater-floor volcanic remnant (~2.5 km SE)',
      type: 'nav',
      distM: 2500,
      elevM: '+52m'
    }
  ];

  function fmtDist(distM) {
    const n = Number(distM) || 0;
    return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n}m`;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, rr);
    } else {
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }
  }

  function getCachedImage(src, onLoad) {
    if (!src) return null;
    if (imageCache[src]) return imageCache[src];
    const img = new Image();
    img.onload = () => {
      if (onLoad) onLoad();
    };
    img.src = src;
    imageCache[src] = img;
    return img;
  }

  function getCrewMapCoords(state, wp) {
    const path = state.routeResult && state.routeResult.path;
    if (path && path.length >= 2) {
      const fIdx = clamp(state.traverseProgress || 0, 0, 1) * (path.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(path.length - 1, i0 + 1);
      const t = fIdx - i0;
      return {
        nx: path[i0].nx + (path[i1].nx - path[i0].nx) * t,
        ny: path[i0].ny + (path[i1].ny - path[i0].ny) * t
      };
    }
    return { nx: wp.x, ny: wp.y };
  }

  function renderVisorHUD(canvas, state, requestRedraw) {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height));

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#04070d';
    ctx.fillRect(0, 0, w, h);

    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];
    const crewPos = getCrewMapCoords(state, wp);

    let activeSrc = wp.panoUrl;
    if (state.customHudImage) {
      activeSrc = state.customHudImage;
    } else if (state.visorSourceMode === 'butler360') {
      activeSrc = 'assets/optimized/mastcamz_360_butler_natural_4096.webp';
    } else if (state.visorSourceMode === 'vert50m') {
      activeSrc = 'assets/optimized/mastcamz_vertical_50m_1600.webp';
    } else if (state.visorSourceMode === 'closeup') {
      activeSrc = wp.photoUrl;
    } else if (state.visorSourceMode === 'alt') {
      activeSrc = wp.altPhotoUrl || wp.photoUrl;
    }

    const img = getCachedImage(activeSrc, requestRedraw);
    const fovDeg = 90 / (state.hudZoom || 1);
    const supportsCtxFilter = typeof ctx.filter === 'string';

    const isPanoView =
      !state.customHudImage &&
      (state.visorSourceMode === 'pano' || state.visorSourceMode === 'butler360');

    const renderSingleEyeViewport = (vw, vh, yawBiasDeg, hudParallaxPx, isStereoEye, eyeSign) => {
      const effectiveYaw = (((state.hudYawDeg || 0) + yawBiasDeg) % 360 + 360) % 360;
      const proj = {
        isPanoView,
        isWide: false,
        drawW: vw * 2.4,
        drawH: vh,
        dy: 0,
        baseW: vw,
        baseH: vh,
        dx: 0,
        refHeadingDeg: wp.hudHeadingDeg || 110
      };

      if (img && img.complete && img.naturalWidth > 0) {
        const isWide = img.naturalWidth / img.naturalHeight >= 2.1;
        proj.isWide = isWide;
        const filterMode = state.visorFilterMode || 'natural';

        if (isWide) {
          proj.drawH = vh * 1.24 * (state.hudZoom || 1);
          proj.drawW = Math.max(vw * 2.2, (img.naturalWidth / img.naturalHeight) * proj.drawH);
          const pitchOffsetPx = (state.hudPitchOffset || 0) * vh * 0.42;
          proj.dy = clamp((vh - proj.drawH) / 2 + pitchOffsetPx, vh - proj.drawH, 0);
        } else {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let baseW = vw * 1.18 * (state.hudZoom || 1);
          let baseH = baseW / imgAspect;
          if (baseH < vh * 1.22 * (state.hudZoom || 1)) {
            baseH = vh * 1.22 * (state.hudZoom || 1);
            baseW = baseH * imgAspect;
          }
          const yawDelta = (((effectiveYaw - wp.hudHeadingDeg + 540) % 360) - 180) / 180;
          proj.baseW = baseW;
          proj.baseH = baseH;
          proj.dx = (vw - baseW) / 2 - yawDelta * (baseW - vw) * 0.48;
          proj.dy = clamp(
            (vh - baseH) / 2 + (state.hudPitchOffset || 0) * vh * 0.36,
            vh - baseH,
            0
          );
        }

        const drawPanoramaPass = (offsetX) => {
          if (isWide) {
            const scrollX =
              (((effectiveYaw / 360) * proj.drawW - vw / 2) % proj.drawW + proj.drawW) %
              proj.drawW;
            ctx.drawImage(img, -scrollX + offsetX, proj.dy, proj.drawW, proj.drawH);
            ctx.drawImage(img, proj.drawW - scrollX + offsetX, proj.dy, proj.drawW, proj.drawH);
          } else {
            ctx.drawImage(img, proj.dx + offsetX, proj.dy, proj.baseW, proj.baseH);
          }
        };

        ctx.save();
        if (filterMode === 'enhanced') {
          if (supportsCtxFilter) {
            ctx.filter = 'contrast(1.38) saturate(1.65) brightness(1.04)';
          }
          drawPanoramaPass(0);
          if (!supportsCtxFilter) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
            ctx.fillRect(0, 0, vw, vh);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else if (filterMode === 'thermal') {
          if (supportsCtxFilter) {
            ctx.filter = 'contrast(1.45) sepia(0.85) hue-rotate(-32deg) saturate(2.2) brightness(0.95)';
          }
          drawPanoramaPass(0);
          if (supportsCtxFilter) ctx.filter = 'none';
          else {
            ctx.globalCompositeOperation = 'color-burn';
            ctx.fillStyle = 'rgba(234, 88, 12, 0.42)';
            ctx.fillRect(0, 0, vw, vh);
            ctx.globalCompositeOperation = 'source-over';
          }
          const thGrad = ctx.createLinearGradient(0, 0, 0, vh);
          thGrad.addColorStop(0, 'rgba(124, 45, 18, 0.28)');
          thGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.14)');
          thGrad.addColorStop(1, 'rgba(16, 185, 129, 0.20)');
          ctx.fillStyle = thGrad;
          ctx.fillRect(0, 0, vw, vh);
        } else if (filterMode === 'anaglyph') {
          if (supportsCtxFilter) ctx.filter = 'contrast(1.2) saturate(0.25)';
          drawPanoramaPass(-5);
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = 'rgb(255, 45, 45)';
          ctx.fillRect(0, 0, vw, vh);

          ctx.globalCompositeOperation = 'screen';
          if (supportsCtxFilter) ctx.filter = 'contrast(1.2) saturate(0.85) hue-rotate(155deg)';
          drawPanoramaPass(5);
          if (!supportsCtxFilter) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(180, 255, 255, 0.88)';
            ctx.fillRect(0, 0, vw, vh);
          }
          ctx.globalCompositeOperation = 'source-over';
        } else {
          drawPanoramaPass(0);
        }
        ctx.restore();
      }

      const eyeState = Object.assign({}, state, {
        hudYawDeg: effectiveYaw,
        _hudParallaxPx: hudParallaxPx || 0,
        _isStereoEye: !!isStereoEye,
        _eyeSign: eyeSign || 0,
        _crewNx: crewPos.nx,
        _crewNy: crewPos.ny,
        _proj: proj
      });

      // 1B. Martian Diurnal Solar LTST Twilight & Atmospheric Dust Optical Depth (τ) Whiteout (Pano views only)
      if (isPanoView) {
        drawAtmosphericScattering(ctx, vw, vh, eyeState);
      }

      if (state.hudDecluttered) return;

      // 2. Render Ground Range Grid ONLY when Synthetic Vision or Laser Aim is active on Panoramic Views
      if (isPanoView && (state.visorSyntheticVision || state.laserAimMode)) {
        drawGroundPerspectiveGrid(ctx, vw, vh, wp, eyeState);
      }
      if (isPanoView && state.visorSyntheticVision) {
        drawSyntheticVisionWireframe(ctx, vw, vh, theater, wp, eyeState, fovDeg);
      }

      // 3. Render Top Azimuth Compass Tape (with Stereo HUD Convergence & Real HAB/Shelter Azimuth)
      drawTopCompassTape(ctx, vw, vh, theater, wp, eyeState);

      // 4. Render Anchored Spatial AR Terrain, Hazard & Bi-Directional CapCom Priority Target Pins
      drawSpatialARPins(ctx, vw, vh, wp, eyeState, fovDeg);

      // 5. Render Center Bore-Sight Crosshair, Gaze-Dwell Ring & SuperCam LIBS Spectrum Card
      drawBoresightAndLaser(ctx, vw, vh, wp, eyeState);

      // 6. Stereo VR Goggle Mode in-lens PLSS status vs Standard Nadir Radar Minimap
      if (isStereoEye) {
        ctx.save();
        const barW = Math.min(vw - 28, 276);
        const barX = (vw - barW) / 2 + (hudParallaxPx || 0) * 0.55;
        const barY = vh - 32;
        ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
        ctx.strokeStyle = state.capcomTarget
          ? 'rgba(56, 189, 248, 0.85)'
          : state.capcomRole === 'visor'
          ? 'rgba(56, 189, 248, 0.7)'
          : 'rgba(249, 115, 22, 0.55)';
        ctx.lineWidth = 1;
        ctx.fillRect(barX, barY, barW, 20);
        ctx.strokeRect(barX, barY, barW, 20);
        ctx.fillStyle = '#fafaf9';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const syncTag = state.capcomTarget
          ? 'CAPCOM LOCK'
          : state.visorSyntheticVision
          ? 'SYNTH DEM'
          : state.capcomRole === 'visor'
          ? 'CAPCOM TX'
          : 'GAZE ZAP';
        ctx.fillText(
          `O₂ ${state.consumables.o2Pct}% • CO₂ ${state.consumables.scrubberPct}% • ${wp.code} • ${syncTag}`,
          barX + barW / 2,
          barY + 10
        );
        ctx.restore();
      } else {
        drawNadirRadarMinimap(ctx, vw, vh, theater, wp, eyeState, fovDeg, requestRedraw);
      }
    };

    // Stereoscopic Side-by-Side (SBS) DIY 3D Goggles Mode on main Visor canvas
    if (state.vrGogglesMode && canvas.id === 'visorHudCanvas') {
      ctx.fillStyle = '#050404';
      ctx.fillRect(0, 0, w, h);

      const eyeW = w / 2;
      const padX = Math.max(8, eyeW * 0.028);
      const padY = Math.max(10, h * 0.038);
      const lensW = eyeW - padX * 2;
      const lensH = h - padY * 2;
      const cornerR = Math.min(44, lensW * 0.14);

      for (let eyeIdx = 0; eyeIdx < 2; eyeIdx++) {
        const offsetX = eyeIdx * eyeW;
        const eyeSign = eyeIdx === 0 ? 1 : -1;
        const yawBias = eyeIdx === 0 ? -1.25 : 1.25;
        const hudParallax = eyeIdx === 0 ? 4.2 : -4.2;

        ctx.save();
        ctx.translate(offsetX + padX, padY);

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, lensW, lensH, cornerR);
        } else {
          ctx.rect(0, 0, lensW, lensH);
        }
        ctx.clip();

        renderSingleEyeViewport(lensW, lensH, yawBias, hudParallax, true, eyeSign);

        const vig = ctx.createRadialGradient(
          lensW / 2,
          lensH / 2,
          lensW * 0.32,
          lensW / 2,
          lensH / 2,
          lensW * 0.62
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.62)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, lensW, lensH);

        ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Center Nose-Bridge Septum & IPD Alignment Reticle
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(18, 16, 14, 0.92)';
      ctx.fillRect(w / 2 - 106, 4, 212, 18);
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.strokeRect(w / 2 - 106, 4, 212, 18);
      ctx.fillStyle = '#fb923c';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const statusText = state.capcomRole === 'visor'
        ? '3D GOGGLES • CAPCOM CO-OP TX'
        : state.gyroActive
        ? '3D VR GOGGLES • IMU GYRO LOCK'
        : '3D VR GOGGLES • 63mm IPD';
      ctx.fillText(statusText, w / 2, 13);
      ctx.restore();

      ctx.restore();
      return;
    }

    // Standard Single-Viewport Fullscreen Visor Render
    renderSingleEyeViewport(w, h, 0, 0, false, 0);

    ctx.restore();
  }

  /**
   * Martian Diurnal Solar Time (LTST) Twilight & Mie-Scattering Dust Storm Whiteout (τ = 0.42..3.5)
   */
  function drawAtmosphericScattering(ctx, w, h, state) {
    const ltst = typeof state.ltstHour === 'number' ? state.ltstHour : 13.5;
    const dustTau = typeof state.dustTau === 'number' ? state.dustTau : 0.42;
    const horizonY = clamp(h * 0.44 + (state.hudPitchOffset || 0) * h * 0.35, h * 0.12, h * 0.85);

    // 1. Diurnal Twilight / Dawn-Dusk Terminator Tint
    const dayPhase = clamp((ltst - 5.5) / 14.0, 0, 1);
    const sunElev = Math.sin(dayPhase * Math.PI);
    const twilightAmt = clamp(1 - sunElev * 1.48, 0, 0.72);

    if (twilightAmt > 0.03) {
      ctx.save();
      const twGrad = ctx.createLinearGradient(0, 0, 0, h);
      // Martian sunset/sunrise exhibits a cool blue Rayleigh forward scatter near solar disk & deep slate dusk zenith
      twGrad.addColorStop(0, `rgba(12, 19, 38, ${(twilightAmt * 0.76).toFixed(3)})`);
      twGrad.addColorStop(
        clamp(horizonY / h, 0.15, 0.75),
        `rgba(56, 89, 138, ${(twilightAmt * 0.38).toFixed(3)})`
      );
      twGrad.addColorStop(1, `rgba(18, 12, 10, ${(twilightAmt * 0.68).toFixed(3)})`);
      ctx.fillStyle = twGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 2. Mie-Scattering Atmospheric Dust Optical Depth (τ) Haze & Whiteout Wall
    if (dustTau > 0.55) {
      ctx.save();
      const hazeFactor = clamp((dustTau - 0.5) / 2.85, 0, 1);
      // Optical depth obscures horizon & mid-field strongly while immediate foreground boots remain faintly visible
      const dustGrad = ctx.createLinearGradient(0, 0, 0, h);
      const topA = clamp(hazeFactor * 0.86, 0, 0.88);
      const horA = clamp(hazeFactor * 0.94, 0, 0.93);
      const botA = clamp(hazeFactor * 0.62, 0, 0.68);
      dustGrad.addColorStop(0, `rgba(166, 92, 44, ${topA.toFixed(3)})`);
      dustGrad.addColorStop(clamp(horizonY / h, 0.12, 0.82), `rgba(208, 124, 62, ${horA.toFixed(3)})`);
      dustGrad.addColorStop(1, `rgba(148, 78, 36, ${botA.toFixed(3)})`);
      ctx.fillStyle = dustGrad;
      ctx.fillRect(0, 0, w, h);

      // Animated wind-driven aeolian dust streaks during heavy storm (τ >= 1.5)
      if (dustTau >= 1.5) {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.0014;
        const streakAlpha = clamp((dustTau - 1.4) * 0.14, 0.03, 0.24);
        ctx.strokeStyle = `rgba(248, 196, 142, ${streakAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.6;
        for (let s = 0; s < 16; s++) {
          const sx = (((s * 137 + t * (190 + (s % 4) * 45)) % (w + 220)) - 110);
          const sy = ((s * 67 + Math.sin(t + s) * 18) % h);
          const len = 65 + (s % 5) * 28;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + len, sy + 7);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  /**
   * xEVA Visor Synthetic Vision: Real 3D DEM Topographic Ridge Wireframe + Ground Holographic Route Corridor
   * Penetrates τ=3.5 Dust Whiteout & Dusk Darkness using onboard MRO HiRISE DEM + LiDAR lock
   */
  function drawSyntheticVisionWireframe(ctx, w, h, theater, wp, state, fovDeg) {
    if (!window.ARES_ENGINE || !window.ARES_ENGINE.sampleAt) return;
    ctx.save();

    const horizonY = h * 0.44 + (state.hudPitchOffset || 0) * h * 0.35;
    const heading = (((state.hudYawDeg || 0) % 360) + 360) % 360;
    const curNx = state._crewNx ?? wp.x;
    const curNy = state._crewNy ?? wp.y;
    const centerSample = window.ARES_ENGINE.sampleAt(curNx, curNy) || { elevM: -2000 };
    const crewElevM = centerSample.elevM + 1.75; // Astronaut helmet eye height (1.75m AGL)

    // 1. Sample 3D DEM radial range rings across visor FOV
    const rangeRingsM = [22, 48, 95, 165, 260];
    const azCols = 23;
    const halfSpanDeg = fovDeg * 0.58;
    const gridPts = [];

    for (let rIdx = 0; rIdx < rangeRingsM.length; rIdx++) {
      const distM = rangeRingsM[rIdx];
      const row = [];
      const stereoDisp = state._isStereoEye
        ? (state._eyeSign || 0) * clamp(15.5 / distM, 0.25, 6.5)
        : 0;

      for (let cIdx = 0; cIdx < azCols; cIdx++) {
        const u = cIdx / (azCols - 1);
        const relYawDeg = (u - 0.5) * 2 * halfSpanDeg;
        const worldAzRad = ((heading + relYawDeg) * Math.PI) / 180;
        const sNx = clamp(curNx + (Math.sin(worldAzRad) * distM) / 1600, 0.01, 0.99);
        const sNy = clamp(curNy - (Math.cos(worldAzRad) * distM) / 1088, 0.01, 0.99);
        const cell = window.ARES_ENGINE.sampleAt(sNx, sNy) || centerSample;

        const dElev = cell.elevM - crewElevM;
        const pitchTan = dElev / distM;
        const px = w * 0.5 + (relYawDeg / (fovDeg * 0.65)) * (w * 0.42) + stereoDisp;
        // Perspective ground depression + true topographic relief elevation
        const py = horizonY - pitchTan * h * 0.88 + (6.4 / distM) * h * 0.34;
        row.push({
          px,
          py: clamp(py, 36, h - 18),
          slopeDeg: cell.slopeDeg || 0,
          elevM: cell.elevM
        });
      }
      gridPts.push(row);
    }

    // Draw transverse DEM contour ribs (far to near)
    for (let rIdx = rangeRingsM.length - 1; rIdx >= 0; rIdx--) {
      const row = gridPts[rIdx];
      const alpha = 0.36 + (1 - rIdx / rangeRingsM.length) * 0.46;
      for (let cIdx = 0; cIdx < row.length - 1; cIdx++) {
        const p0 = row[cIdx];
        const p1 = row[cIdx + 1];
        const maxSlope = Math.max(p0.slopeDeg, p1.slopeDeg);
        ctx.strokeStyle =
          maxSlope >= 18
            ? `rgba(239, 68, 68, ${alpha.toFixed(2)})`
            : maxSlope >= 12
            ? `rgba(249, 115, 22, ${alpha.toFixed(2)})`
            : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
        ctx.lineWidth = rIdx === rangeRingsM.length - 1 ? 1.8 : 1.25;
        ctx.beginPath();
        ctx.moveTo(p0.px, p0.py);
        ctx.lineTo(p1.px, p1.py);
        ctx.stroke();
      }
    }

    // Draw radial longitudinal DEM ridge ribs
    for (let cIdx = 0; cIdx < azCols; cIdx += 2) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let rIdx = 0; rIdx < rangeRingsM.length; rIdx++) {
        const pt = gridPts[rIdx][cIdx];
        if (rIdx === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      }
      ctx.stroke();
    }

    // 2. 3D Ground-Locked Holographic Route Corridor (>>>> Chevrons toward Active Target)
    const nextWp =
      theater.waypoints[Math.min(theater.waypoints.length - 1, state.selectedWaypointIdx + 1)] || wp;
    const shelterWp = theater.waypoints.find((x) => x.role === 'shelter') || theater.waypoints[0];
    let targetX = nextWp.x;
    let targetY = nextWp.y;
    let corridorCol = '#10b981';
    if (state.emergencyAbortActive) {
      targetX = shelterWp.x;
      targetY = shelterWp.y;
      corridorCol = '#ef4444';
    } else if (state.capcomTarget) {
      targetX = state.capcomTarget.nx;
      targetY = state.capcomTarget.ny;
      corridorCol = '#38bdf8';
    }

    const tDx = (targetX - curNx) * 1600;
    const tDy = (targetY - curNy) * 1088;
    const routeBearing =
      Math.hypot(tDx, tDy) > 2
        ? ((Math.atan2(tDx, -tDy) * 180) / Math.PI + 360) % 360
        : wp.hudHeadingDeg;
    const routeDiff = ((routeBearing - heading + 540) % 360) - 180;

    if (Math.abs(routeDiff) <= fovDeg * 0.62) {
      const chevDists = [3.5, 6.5, 11, 18, 28];
      const pulseShift =
        ((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.003) % 1;

      chevDists.forEach((dM, idx) => {
        const stereo = state._isStereoEye
          ? (state._eyeSign || 0) * clamp(15.5 / dM, 0.5, 7.5)
          : 0;
        const cx = w * 0.5 + (routeDiff / (fovDeg * 0.65)) * (w * 0.42) + stereo;
        const cy = clamp(horizonY + (h - horizonY) * (4.2 / (dM + 1.8)), horizonY + 16, h - 34);
        const halfW = clamp((w * 0.24) / (dM * 0.28), 14, 78);
        const isBright = Math.abs((idx / chevDists.length) - pulseShift) < 0.28;

        ctx.strokeStyle = corridorCol;
        ctx.globalAlpha = isBright ? 0.95 : 0.55;
        ctx.lineWidth = isBright ? 2.6 : 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, cy + 10);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + halfW, cy + 10);
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  function drawGroundPerspectiveGrid(ctx, w, h, wp, state) {
    ctx.save();
    const horizonY = h * 0.44 + (state.hudPitchOffset || 0) * h * 0.35;
    const cx = w * 0.5 + (state._hudParallaxPx || 0);
    const headingRad = (((state.hudYawDeg || 0) % 360) * Math.PI) / 180;

    ctx.beginPath();
    ctx.rect(0, Math.max(0, horizonY), w, h - Math.max(0, horizonY));
    ctx.clip();

    const ranges = [
      { d: '2m', frac: 0.86 },
      { d: '5m', frac: 0.72 },
      { d: '12m', frac: 0.60 },
      { d: '25m', frac: 0.51 }
    ];
    ranges.forEach((rg) => {
      const y = horizonY + (h - horizonY) * (rg.frac - 0.42) * 1.65;
      if (y <= horizonY + 12 || y >= h - 18) return;
      const rx = w * (0.22 + ((y - horizonY) / h) * 0.55);
      const ry = (y - horizonY) * 0.16;

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.20)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(cx, y, rx, ry, 0, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(251, 191, 36, 0.72)';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rg.d, cx, y + ry + 10);
    });

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const angOffset = i * 0.24 - ((headingRad * 2) % 0.24);
      const xBot = cx + Math.tan(angOffset) * (h - horizonY) * 1.45;
      const xTop = cx + Math.tan(angOffset) * 45;
      ctx.beginPath();
      ctx.moveTo(xTop, horizonY + 18);
      ctx.lineTo(xBot, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawTopCompassTape(ctx, w, h, theater, wp, state) {
    ctx.save();
    const pShift = (state._hudParallaxPx || 0) * 0.65;
    const tapeW = Math.min(480, w * (state._isStereoEye ? 0.76 : 0.48));
    const centerX = w / 2 + pShift;
    const tapeX = centerX - tapeW / 2;
    const tapeY = state._isStereoEye ? 24 : 12;
    const tapeH = 28;

    ctx.fillStyle = 'rgba(18, 16, 14, 0.88)';
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.48)';
    ctx.lineWidth = 1.2;
    ctx.fillRect(tapeX, tapeY, tapeW, tapeH);
    ctx.strokeRect(tapeX, tapeY, tapeW, tapeH);

    const heading = Math.round((((state.hudYawDeg || 0) % 360) + 360) % 360);
    const cardinals = {
      0: 'N',
      45: 'NE',
      90: 'E',
      135: 'SE',
      180: 'S',
      225: 'SW',
      270: 'W',
      315: 'NW'
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX + 2, tapeY, tapeW - 4, tapeH);
    ctx.clip();

    for (let deg = heading - 65; deg <= heading + 65; deg += 5) {
      const norm = ((deg % 360) + 360) % 360;
      const px = centerX + ((deg - heading) / 65) * (tapeW / 2);

      const isMajor = norm % 15 === 0;
      ctx.strokeStyle = cardinals[norm]
        ? '#f97316'
        : isMajor
        ? 'rgba(231, 229, 228, 0.75)'
        : 'rgba(168, 162, 158, 0.35)';
      ctx.lineWidth = cardinals[norm] ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(px, tapeY + (isMajor ? 17 : 22));
      ctx.lineTo(px, tapeY + tapeH);
      ctx.stroke();

      if (isMajor) {
        const lbl = cardinals[norm] || `${String(norm).padStart(3, '0')}°`;
        ctx.fillStyle = cardinals[norm] ? '#fb923c' : '#e7e5e4';
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, px, tapeY + 11);
      }
    }

    // Dynamic Azimuth Bug to HAB-01 (or Emergency Shelter during Contingency)
    const habWp = theater.waypoints[0];
    const shelterWp = theater.waypoints.find((x) => x.role === 'shelter') || habWp;
    const refWp = state.emergencyAbortActive ? shelterWp : habWp;
    const curX = state._crewNx ?? wp.x;
    const curY = state._crewNy ?? wp.y;
    const dx = (refWp.x - curX) * 1600;
    const dy = (refWp.y - curY) * 1088;
    const refBearing =
      Math.hypot(dx, dy) > 2
        ? ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
        : 225;

    const refDiff = ((refBearing - heading + 540) % 360) - 180;
    if (Math.abs(refDiff) <= 62) {
      const hx = centerX + (refDiff / 65) * (tapeW / 2);
      ctx.fillStyle = state.emergencyAbortActive ? '#34d399' : '#22c55e';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.emergencyAbortActive ? '▲ BUNKER' : '▲ HAB', hx, tapeY + 25);
    }

    // CapCom Target Azimuth Bug on Compass Tape
    if (state.capcomTarget) {
      const cdx = (state.capcomTarget.nx - curX) * 1600;
      const cdy = (state.capcomTarget.ny - curY) * 1088;
      const cBrg =
        Math.hypot(cdx, cdy) > 1
          ? ((Math.atan2(cdx, -cdy) * 180) / Math.PI + 360) % 360
          : state.capcomTarget.bearingDeg || 110;
      const cDiff = ((cBrg - heading + 540) % 360) - 180;
      if (Math.abs(cDiff) <= 62) {
        const cxBug = centerX + (cDiff / 65) * (tapeW / 2);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('◆ CAPCOM', cxBug, tapeY + 25);
      }
    }

    ctx.restore();

    // Digital Heading Readout Pill below center of compass tape
    ctx.fillStyle = 'rgba(18, 16, 14, 0.94)';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.2;
    ctx.fillRect(centerX - 42, tapeY + tapeH + 3, 84, 17);
    ctx.strokeRect(centerX - 42, tapeY + tapeH + 3, 84, 17);
    ctx.fillStyle = '#fb923c';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HDG ${String(heading).padStart(3, '0')}°`, centerX, tapeY + tapeH + 11.5);

    // Sub-pill advisory for Synthetic Vision or Dust Storm Whiteout
    const dustTau = typeof state.dustTau === 'number' ? state.dustTau : 0.42;
    if (state.visorSyntheticVision || dustTau >= 1.8) {
      const pillText = state.visorSyntheticVision
        ? `SYNTHETIC DEM LIDAR LOCK • τ=${dustTau.toFixed(2)}`
        : `⚠ DUST WHITEOUT (τ=${dustTau.toFixed(2)}) • ENGAGE SYNTH VISION`;
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      const pw = Math.min(w - 24, ctx.measureText(pillText).width + 18);
      const py = tapeY + tapeH + 23;
      ctx.fillStyle = 'rgba(12, 10, 9, 0.92)';
      ctx.strokeStyle = state.visorSyntheticVision ? '#38bdf8' : '#f59e0b';
      ctx.fillRect(centerX - pw / 2, py, pw, 16);
      ctx.strokeRect(centerX - pw / 2, py, pw, 16);
      ctx.fillStyle = state.visorSyntheticVision ? '#38bdf8' : '#fbbf24';
      ctx.fillText(pillText, centerX, py + 8.5);
    }

    ctx.restore();
  }

  function drawSpatialARPins(ctx, w, h, wp, state, fovDeg) {
    const proj = state._proj || { isPanoView: false, isWide: true, drawW: w * 2.4, drawH: h, dy: 0 };
    const heading = (((state.hudYawDeg || 0) % 360) + 360) % 360;

    const yawToScreenX = (targetYawDeg, stereoDisp) => {
      const dYaw = ((targetYawDeg - heading + 540) % 360) - 180;
      if (proj.isWide) {
        return w * 0.5 + (dYaw / 360) * proj.drawW + (stereoDisp || 0);
      }
      return (
        w * 0.5 +
        (dYaw / Math.max(30, fovDeg * 0.72)) * (w * 0.42) +
        (stereoDisp || 0)
      );
    };

    ctx.save();

    if (proj.isPanoView && !state.hideArPins) {
      const rawPins =
        state.visorSourceMode === 'butler360' ? BUTLER_360_PINS : wp.arPins || [];
      const visible = [];

      rawPins.forEach((pin, idx) => {
        const distM = Math.max(1.8, parseFloat(pin.distM) || 15);
        const stereoDisparityPx = state._isStereoEye
          ? (state._eyeSign || 0) * clamp(14.0 / distM, 0.35, 7.2)
          : 0;
        const px = yawToScreenX(pin.yawDeg, stereoDisparityPx);
        if (px < -40 || px > w + 40) return;

        const pyRaw = proj.isWide
          ? proj.dy + pin.pitchY * proj.drawH
          : proj.dy + pin.pitchY * proj.baseH;
        const py = clamp(pyRaw, 92, h - 38);
        visible.push({ pin, idx, px, py, distM });
      });

      visible.sort((a, b) => a.px - b.px);

      let prevPillRight = -999;
      let prevTier = 0;

      visible.forEach((item) => {
        const { pin, px, py } = item;
        const isFocused = Math.abs(px - w * 0.5) < 76;
        const accent =
          pin.type === 'hazard'
            ? '#f87171'
            : pin.type === 'shelter' || pin.type === 'sci'
            ? '#34d399'
            : '#fbbf24';
        const borderAlpha = isFocused ? '0.82' : '0.42';
        const borderRgba =
          pin.type === 'hazard'
            ? `rgba(248, 113, 113, ${borderAlpha})`
            : pin.type === 'shelter' || pin.type === 'sci'
            ? `rgba(52, 211, 153, ${borderAlpha})`
            : `rgba(251, 191, 36, ${borderAlpha})`;

        const distLabel = fmtDist(pin.distM);
        const titleTxt = pin.label;
        const badgeTxt = `${distLabel}`;

        ctx.font = '600 10px "Inter", system-ui, sans-serif';
        const titleW = ctx.measureText(titleTxt).width;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const badgeW = ctx.measureText(badgeTxt).width;

        let subW = 0;
        if (isFocused && pin.detail) {
          ctx.font = '500 9px "Inter", system-ui, sans-serif';
          subW = ctx.measureText(pin.detail).width;
        }

        const pillW = Math.min(w - 20, Math.max(titleW + badgeW + 34, isFocused ? subW + 20 : 0));
        const pillH = isFocused && pin.detail ? 36 : 23;

        let bx = clamp(px - pillW / 2, 10, w - pillW - 10);
        let tier = 0;
        if (bx < prevPillRight + 10) {
          tier = (prevTier + 1) % 2;
        }
        prevPillRight = bx + pillW;
        prevTier = tier;

        const stemLen = 18 + tier * 28;
        const by = Math.max(62, py - stemLen - pillH);

        // Sleek precision surface reticle
        ctx.strokeStyle = borderRgba;
        ctx.lineWidth = isFocused ? 1.8 : 1.3;
        ctx.beginPath();
        ctx.arc(px, py, isFocused ? 7.5 : 5.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Slender vertical leader stem
        ctx.strokeStyle = borderRgba;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(px, py - (isFocused ? 7.5 : 5.5));
        ctx.lineTo(px, by + pillH);
        ctx.stroke();

        // Compact Frosted Glass Capsule
        roundRectPath(ctx, bx, by, pillW, pillH, 7);
        ctx.fillStyle = isFocused ? 'rgba(14, 12, 11, 0.90)' : 'rgba(14, 12, 11, 0.74)';
        ctx.fill();
        ctx.strokeStyle = borderRgba;
        ctx.lineWidth = isFocused ? 1.4 : 1.0;
        ctx.stroke();

        ctx.save();
        roundRectPath(ctx, bx + 1, by + 1, pillW - 2, pillH - 2, 6);
        ctx.clip();

        // Status Dot
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(bx + 10, by + 11.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Clean Title
        ctx.fillStyle = '#fafaf9';
        ctx.font = '600 10px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(titleTxt, bx + 18, by + 11.5);

        // Right-aligned Muted Distance Tag
        ctx.fillStyle = accent;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(badgeTxt, bx + pillW - 8, by + 11.5);

        // Secondary geologic detail ONLY when aimed at / focused
        if (isFocused && pin.detail) {
          ctx.fillStyle = '#d6d3d1';
          ctx.font = '500 9px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(pin.detail, bx + 10, by + 26.5);
        }
        ctx.restore();
      });
    }

    // Bi-Directional Houston <-> Mars CapCom Priority Target AR Diamond + Off-Screen Lens Chevrons
    if (state.capcomTarget) {
      const tgt = state.capcomTarget;
      const curX = state._crewNx ?? wp.x;
      const curY = state._crewNy ?? wp.y;
      const dxM = (tgt.nx - curX) * 1600;
      const dyM = (tgt.ny - curY) * 1088;
      const liveDistM = Math.max(2, Math.round(Math.hypot(dxM, dyM) || tgt.distM || 45));
      const liveBrg =
        Math.hypot(dxM, dyM) > 1
          ? Math.round(((Math.atan2(dxM, -dyM) * 180) / Math.PI + 360) % 360)
          : Math.round(tgt.bearingDeg || 110);

      const dYaw = ((liveBrg - heading + 540) % 360) - 180;
      const pulse =
        0.5 +
        0.5 *
          Math.sin(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.006
          );

      const stereoDisp = state._isStereoEye
        ? (state._eyeSign || 0) * clamp(15.5 / liveDistM, 0.5, 8.0)
        : 0;
      const px = yawToScreenX(liveBrg, stereoDisp);

      if (px >= 16 && px <= w - 16) {
        const py = clamp(
          h * (0.46 + clamp(14 / Math.max(12, liveDistM), 0.02, 0.24)) +
            (state.hudPitchOffset || 0) * h * 0.35,
          96,
          h - 56
        );
        const rOut = 11 + pulse * 4.5;

        // Pulsing outer cyan diamond
        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.45 + pulse * 0.45).toFixed(2)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(px, py - rOut);
        ctx.lineTo(px + rOut, py);
        ctx.lineTo(px, py + rOut);
        ctx.lineTo(px - rOut, py);
        ctx.closePath();
        ctx.stroke();

        // Crisp inner target diamond
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(px, py - 4.5);
        ctx.lineTo(px + 4.5, py);
        ctx.lineTo(px, py + 4.5);
        ctx.lineTo(px - 4.5, py);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px, py - rOut);
        ctx.lineTo(px, py - 34);
        ctx.stroke();

        const topTxt = `◆ ${tgt.label || 'CAPCOM TARGET'}  ${liveDistM}m • ${String(liveBrg).padStart(3, '0')}°`;
        const subTxt = `${tgt.mineral || 'Science Outcrop'} • Slope ${tgt.slopeDeg ?? 6.5}°`;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const tw1 = ctx.measureText(topTxt).width;
        ctx.font = '500 9px "Inter", system-ui, sans-serif';
        const tw2 = ctx.measureText(subTxt).width;
        const bw = Math.min(w - 20, Math.max(tw1, tw2) + 20);
        const bh = 36;
        const bx = clamp(px - bw / 2, 10, w - bw - 10);
        const by = Math.max(62, py - 34 - bh);

        roundRectPath(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = 'rgba(8, 22, 34, 0.90)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, 7);
        ctx.clip();
        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(topTxt, bx + 9, by + 5);

        ctx.fillStyle = '#e0f2fe';
        ctx.font = '500 9px "Inter", system-ui, sans-serif';
        ctx.fillText(subTxt, bx + 9, by + 20);
        ctx.restore();
        ctx.restore();
      } else {
        // Off-Screen Edge Guidance Chevron so 3D Goggle Wearer knows which way to turn head!
        const isRight = dYaw > 0;
        const degOff = Math.abs(Math.round(dYaw));
        const pillTxt = isRight
          ? `CAPCOM ${degOff}° ▶`
          : `◀ ${degOff}° CAPCOM`;
        ctx.save();
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const pw = ctx.measureText(pillTxt).width + 18;
        const ph = 24;
        const edgeX = isRight ? w - pw - 12 : 12;
        const edgeY = h * 0.5 - ph / 2;

        roundRectPath(ctx, edgeX, edgeY, pw, ph, 6);
        ctx.fillStyle = 'rgba(8, 24, 38, 0.90)';
        ctx.fill();
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.55 + pulse * 0.45).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pillTxt, edgeX + pw / 2, edgeY + ph / 2);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * Render realistic 240-850 nm SuperCam LIBS Atomic Plasma Emission Spectrum inside Spectrogram Card
   */
  function drawLibsEmissionSpectrum(ctx, sx, sy, sw, sh, ox, bioScore) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 9, 8, 0.95)';
    ctx.strokeStyle = 'rgba(68, 64, 60, 0.85)';
    ctx.lineWidth = 1;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);

    ctx.strokeStyle = 'rgba(120, 113, 108, 0.18)';
    for (let g = 1; g < 5; g++) {
      const gx = sx + (sw * g) / 5;
      ctx.beginPath();
      ctx.moveTo(gx, sy);
      ctx.lineTo(gx, sy + sh);
      ctx.stroke();
    }

    const peaks = [
      { nm: 288, amp: clamp((ox.SiO2 || 45) / 58, 0.25, 1.0), lbl: 'Si', col: '#38bdf8' },
      { nm: 393, amp: clamp(((ox.CaO || 7) * 4.2) / 48, 0.22, 0.96), lbl: 'Ca', col: '#a855f7' },
      { nm: 404, amp: clamp(((ox.FeOT || 16) * 2.5) / 52, 0.28, 0.98), lbl: 'Fe', col: '#60a5fa' },
      { nm: 518, amp: clamp(((ox.MgO || 12) * 3.0) / 50, 0.25, 0.95), lbl: 'Mg', col: '#22c55e' },
      { nm: 560, amp: clamp(((ox.SO3 || 6) * 3.2) / 50, 0.14, 0.88), lbl: 'S', col: '#eab308' },
      { nm: 656, amp: clamp((bioScore || 80) / 102, 0.25, 0.98), lbl: 'Hα', col: '#f97316' },
      { nm: 777, amp: 0.78, lbl: 'O', col: '#ef4444' }
    ];

    const nmMin = 240;
    const nmMax = 850;
    const baseLineY = sy + sh - 5;
    const maxPeakH = sh - 15;

    const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    grad.addColorStop(0.0, '#38bdf8');
    grad.addColorStop(0.28, '#818cf8');
    grad.addColorStop(0.5, '#22c55e');
    grad.addColorStop(0.72, '#f97316');
    grad.addColorStop(1.0, '#ef4444');

    ctx.beginPath();
    ctx.moveTo(sx, baseLineY);
    const steps = 110;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const nm = nmMin + u * (nmMax - nmMin);
      let intensity = 0.06 + 0.04 * Math.sin(u * 18);
      for (let p = 0; p < peaks.length; p++) {
        const d = (nm - peaks[p].nm) / 9.5;
        intensity += peaks[p].amp * Math.exp(-d * d);
      }
      const py = baseLineY - clamp(intensity, 0, 1.02) * maxPeakH;
      ctx.lineTo(sx + u * sw, py);
    }
    ctx.lineTo(sx + sw, baseLineY);
    ctx.closePath();

    ctx.fillStyle = 'rgba(249, 115, 22, 0.14)';
    ctx.fill();

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = '700 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    peaks.forEach((pk) => {
      if (pk.lbl === 'S' && pk.amp < 0.35) return;
      const px = sx + ((pk.nm - nmMin) / (nmMax - nmMin)) * sw;
      const py = baseLineY - pk.amp * maxPeakH - 6;
      ctx.fillStyle = pk.col;
      ctx.fillText(pk.lbl, px, Math.max(sy + 8, py));
    });

    ctx.fillStyle = 'rgba(168, 162, 158, 0.7)';
    ctx.font = '600 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('240nm UV', sx + 3, sy + sh - 2);
    ctx.textAlign = 'right';
    ctx.fillText('850nm VNIR', sx + sw - 3, sy + sh - 2);
    ctx.restore();
  }

  function drawBoresightAndLaser(ctx, w, h, wp, state) {
    ctx.save();
    const pShift = state._hudParallaxPx || 0;
    const cx = w / 2 + pShift;
    const cy = h / 2;
    const tx = (state.laserTargetX ? state.laserTargetX * w : w / 2) + pShift;
    const ty = state.laserTargetY ? state.laserTargetY * h : cy;

    ctx.strokeStyle =
      state.laserPulseFrames > 0 || state.laserAimMode
        ? '#ef4444'
        : 'rgba(249, 115, 22, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy);
    ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx, cy + 12);
    ctx.lineTo(cx, cy + 24);
    ctx.stroke();

    if (
      (state.vrGogglesMode || state.gyroActive) &&
      state.gazeDwellProgress > 0.08 &&
      state.laserPulseFrames <= 0
    ) {
      const pct = Math.min(1, state.gazeDwellProgress);
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = pct > 0.8 ? '#ef4444' : '#f97316';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 28, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fb923c';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`GAZE LASER LOCK ${Math.round(pct * 100)}%`, cx, cy + 42);
      ctx.restore();
    } else if (state.laserAimMode && state.laserPulseFrames <= 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUPERCAM 1064nm LIBS ARMED • CLICK ANY ROCK OUTCROP TO ZAP', cx, cy + 38);
    }

    if (state.laserPulseFrames > 0) {
      const progress = clamp(1 - state.laserPulseFrames / 65, 0, 1);

      if (state.laserPulseFrames > 18) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(w * 0.54 + pShift, h);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      }

      const r1 = Math.max(2, 6 + progress * 28);
      const r2 = Math.max(1.5, 3 + progress * 16);
      ctx.fillStyle = `rgba(251, 146, 60, ${clamp(0.72 - progress * 0.62, 0, 1)})`;
      ctx.beginPath();
      ctx.arc(tx, ty, r2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(239, 68, 68, ${clamp(0.95 - progress * 0.85, 0, 1)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(tx, ty, r1, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.laserResultActive || state.laserPulseFrames > 0) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(tx, ty, 7, 0, Math.PI * 2);
      ctx.stroke();

      const ox = state.lastLaserOxides || wp.oxides;
      const bioScore = state.lastLaserBiosig || 91;
      const rockTitle = state.lastLaserRockName || 'AUTHIGENIC CARBONATE OUTCROP';
      const rockMeta = state.lastLaserMeta || 'AZM 142° • DIST 3.4m • LIBS PLASMA';
      const cardW = Math.min(w - 24, state._isStereoEye ? 268 : 332);
      const cardH = 178;
      const bx = state._isStereoEye
        ? clamp(cx - cardW / 2, 10, w - cardW - 10)
        : Math.max(12, w - cardW - 16);
      const by = state._isStereoEye
        ? Math.max(56, h - cardH - 38)
        : Math.max(60, h - cardH - 16);

      if (!state._isStereoEye && ctx.canvas) {
        ctx.canvas._libsCloseBounds = { x: bx + cardW - 28, y: by + 4, w: 24, h: 22 };
      }

      roundRectPath(ctx, bx, by, cardW, cardH, 10);
      ctx.fillStyle = 'rgba(14, 12, 11, 0.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.save();
      roundRectPath(ctx, bx + 2, by + 2, cardW - 4, cardH - 4, 8);
      ctx.clip();

      // Header + Close [×] button
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 8, by + 4, cardW - (state._isStereoEye ? 16 : 38), 30);
      ctx.clip();
      ctx.fillStyle = '#fb923c';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`LIBS // ${rockTitle}`, bx + 10, by + 7);

      ctx.fillStyle = '#a8a29e';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillText(rockMeta, bx + 10, by + 20);
      ctx.restore();

      if (!state._isStereoEye) {
        roundRectPath(ctx, bx + cardW - 25, by + 6, 18, 18, 4);
        ctx.fillStyle = 'rgba(41, 37, 36, 0.9)';
        ctx.fill();
        ctx.fillStyle = '#d6d3d1';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', bx + cardW - 16, by + 15);
      }

      drawLibsEmissionSpectrum(ctx, bx + 10, by + 35, cardW - 20, 46, ox, bioScore);

      const bars = [
        { k: 'SiO₂', v: ox.SiO2, c: '#f97316' },
        { k: 'FeOT', v: ox.FeOT, c: '#ef4444' },
        { k: 'MgO', v: ox.MgO, c: '#22c55e' },
        { k: 'Al₂O₃', v: ox.Al2O3, c: '#eab308' },
        { k: 'SO₃', v: ox.SO3, c: '#f59e0b' }
      ];
      const maxBarW = Math.max(70, cardW - 122);
      bars.forEach((b, idx) => {
        const rowY = by + 89 + idx * 13;
        ctx.fillStyle = '#e7e5e4';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(b.k, bx + 10, rowY);

        ctx.fillStyle = 'rgba(41, 37, 36, 0.95)';
        ctx.fillRect(bx + 48, rowY + 1.5, maxBarW, 6);
        ctx.fillStyle = b.c;
        ctx.fillRect(bx + 48, rowY + 1.5, Math.min(maxBarW, (b.v / 62) * maxBarW), 6);

        ctx.fillStyle = '#fafaf9';
        ctx.fillText(`${b.v}%`, bx + 54 + maxBarW, rowY);
      });

      const bioTier =
        bioScore >= 85 ? 'HIGH PRIORITY' : bioScore >= 65 ? 'MODERATE' : 'IGNEOUS BASELINE';
      ctx.fillStyle = bioScore >= 85 ? '#34d399' : '#fbbf24';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`BIOSIGNATURE: ${bioScore}% [${bioTier}]`, bx + 10, by + 158);
      ctx.restore();
    } else if (!state._isStereoEye && ctx.canvas) {
      ctx.canvas._libsCloseBounds = null;
    }

    ctx.restore();
  }

  function drawNadirRadarMinimap(ctx, w, h, theater, wp, state, fovDeg, requestRedraw) {
    if (w < 620) return;
    const radSize = 152;
    const rx = w - radSize - 14;
    const ry = 12;
    const cx = rx + radSize / 2;
    const cy = ry + radSize / 2 + 8;
    const r = radSize * 0.39;

    state._nadirRadarBounds = { cx, cy, r: r + 14 };

    ctx.save();
    ctx.fillStyle = 'rgba(18, 16, 14, 0.90)';
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.50)';
    ctx.lineWidth = 1.2;
    ctx.fillRect(rx, ry, radSize, radSize + 16);
    ctx.strokeRect(rx, ry, radSize, radSize + 16);

    ctx.fillStyle = '#fb923c';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('50m NADIR RADAR // POV', rx + 8, ry + 13);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const nadirSrc =
      state.theaterKey === 'jezero'
        ? 'assets/optimized/mastcamz_vertical_50m_1280.webp'
        : theater.basemapImg;
    const nadirImg = getCachedImage(nadirSrc, requestRedraw);
    if (nadirImg && nadirImg.complete && nadirImg.naturalWidth > 0) {
      ctx.globalAlpha = 0.82;
      ctx.drawImage(nadirImg, cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 0.98].forEach((frac) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(168, 162, 158, 0.25)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    const centerAng = (((state.hudYawDeg || 0) - 90) * Math.PI) / 180;
    const halfFovRad = (Math.min(110, fovDeg) * 0.5 * Math.PI) / 180;

    const coneGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    coneGrad.addColorStop(0, 'rgba(249, 115, 22, 0.55)');
    coneGrad.addColorStop(0.75, 'rgba(249, 115, 22, 0.22)');
    coneGrad.addColorStop(1, 'rgba(249, 115, 22, 0.04)');

    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, centerAng - halfFovRad, centerAng + halfFovRad);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(centerAng - halfFovRad) * r,
      cy + Math.sin(centerAng - halfFovRad) * r
    );
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(centerAng + halfFovRad) * r,
      cy + Math.sin(centerAng + halfFovRad) * r
    );
    ctx.stroke();

    (wp.arPins || []).forEach((pin) => {
      const pAng = ((pin.yawDeg - 90) * Math.PI) / 180;
      const distNorm = Math.min(0.92, Math.max(0.18, (pin.distM || 15) / 50));
      const px = cx + Math.cos(pAng) * (r * distNorm);
      const py = cy + Math.sin(pAng) * (r * distNorm);
      ctx.fillStyle =
        pin.type === 'hazard'
          ? '#ef4444'
          : pin.type === 'shelter' || pin.type === 'sci'
          ? '#22c55e'
          : '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Plot CapCom Priority Target on Nadir Radar
    if (state.capcomTarget) {
      const curX = state._crewNx ?? wp.x;
      const curY = state._crewNy ?? wp.y;
      const cdx = (state.capcomTarget.nx - curX) * 1600;
      const cdy = (state.capcomTarget.ny - curY) * 1088;
      const cBrg =
        Math.hypot(cdx, cdy) > 1
          ? ((Math.atan2(cdx, -cdy) * 180) / Math.PI + 360) % 360
          : state.capcomTarget.bearingDeg || 110;
      const cAng = ((cBrg - 90) * Math.PI) / 180;
      const cNorm = clamp(Math.hypot(cdx, cdy) / 180, 0.25, 0.90);
      const cpx = cx + Math.cos(cAng) * (r * cNorm);
      const cpy = cy + Math.sin(cAng) * (r * cNorm);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(cpx, cpy - 4.5);
      ctx.lineTo(cpx + 4.5, cpy);
      ctx.lineTo(cpx, cpy + 4.5);
      ctx.lineTo(cpx - 4.5, cpy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#e7e5e4';
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - r - 3);
    ctx.fillText('S', cx, cy + r + 9);
    ctx.fillText('W', cx - r - 6, cy + 3);
    ctx.fillText('E', cx + r + 6, cy + 3);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText(`CLICK RADAR TO AIM (${Math.round(fovDeg)}° FOV)`, cx, ry + radSize + 11);

    ctx.restore();
  }

  return {
    renderVisorHUD
  };
})();
