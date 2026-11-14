/**
 * ARES-NAV // Feature #3: SHERLOC 248.6nm Deep-UV Raman & PIXL 120µm X-Ray Micro-Lab
 * Interactive Astrobiology Microscope over real 1280px NASA Perseverance & Curiosity micro-scans,
 * millimeter-scale "Leopard-Spot" (Vivianite/Greigite + Organic G-Band) detection & NASA CoLD Scale (1-7)
 */

window.ARES_MICROLAB = (function () {
  const imgCache = {};

  const COLD_DEFINITIONS = {
    1: 'CoLD LEVEL 1 // Detect Signal of Potential Biosignature (Vibrational / Elemental Anomaly)',
    2: 'CoLD LEVEL 2 // Contamination Ruled Out (Flight Blank & Witness Tube Verified Clean)',
    3: 'CoLD LEVEL 3 // Habitable Aqueous Micro-Environment Confirmed (Authigenic Sulfate / Carbonate)',
    4: 'CoLD LEVEL 4 // Abiotic Sources Unlikely at <100°C (Co-Located Organic G-Band + Fe/P/S Redox Rim)',
    5: 'CoLD LEVEL 5 // Independent Secondary Biosignature Line of Evidence Required (MSR Earth Lab)',
    6: 'CoLD LEVEL 6 // Specific Biological Metabolism Hypothesis Established (Earth Return)',
    7: 'CoLD LEVEL 7 // Confirmed Extraterrestrial Life (Mars Sample Return Isotopic Proof)'
  };

  const TARGETS = {
    cheyava_vein: {
      key: 'cheyava_vein',
      shortLabel: 'CHEYAVA VEIN (SRLC)',
      title: 'Cheyava Falls / Bright Angel Ca-Sulfate Vein & Redox Spots',
      instrument: 'SHERLOC 248.6nm Deep-UV ACI + PIXL 120µm Micro-XRF',
      sol: 'Sol 2023',
      coords: '18.4356°N, 77.2328°E',
      fovLabel: '18.0 × 13.5 mm (10.1 µm/px)',
      imgUrl: 'assets/optimized/m2020_sol2023_sherloc_watson_micro_1280.webp',
      thumbUrl: 'assets/optimized/m2020_sol2023_sherloc_watson_micro_thumb.webp',
      baseline: {
        label: 'FERRUGINOUS MUDSTONE HOST MATRIX',
        coldLevel: 2,
        organicG: 0.34,
        dBand: 0.28,
        so4: 0.42,
        co3: 0.24,
        pixl: { FeO: 18.6, P2O5: 2.1, SO3: 9.4, CaO: 7.8, SiO2: 49.2 },
        note: 'Fine-grained ferric mudstone deposited in low-energy Neretva Vallis fluvial-lacustrine waters.'
      },
      hotspots: [
        {
          x: 0.46,
          y: 0.48,
          r: 0.13,
          label: 'LEOPARD SPOT #1 // VIVIANITE-GREIGITE REDOX HALO',
          coldLevel: 4,
          organicG: 0.96,
          dBand: 0.82,
          so4: 0.68,
          co3: 0.36,
          pixl: { FeO: 29.4, P2O5: 12.4, SO3: 17.8, CaO: 13.2, SiO2: 24.1 },
          note: 'Millimeter-scale dark Fe-phosphate (vivianite) rim around Fe-sulfide (greigite) core co-located with 1595 cm⁻¹ organic G-band!'
        },
        {
          x: 0.64,
          y: 0.38,
          r: 0.11,
          label: 'LEOPARD SPOT #2 // AUTHIGENIC REDOX REACTION FRONT',
          coldLevel: 4,
          organicG: 0.91,
          dBand: 0.78,
          so4: 0.61,
          co3: 0.40,
          pixl: { FeO: 31.0, P2O5: 13.2, SO3: 15.1, CaO: 11.6, SiO2: 26.4 },
          note: 'Low-temperature electron-transfer halo; on Earth, sulfate reduction coupled to organic oxidation is microbially mediated.'
        },
        {
          x: 0.28,
          y: 0.59,
          r: 0.14,
          label: 'BASSANITE (CaSO₄·0.5H₂O) DIAGENETIC FRACTURE VEIN',
          coldLevel: 3,
          organicG: 0.46,
          dBand: 0.38,
          so4: 0.98,
          co3: 0.25,
          pixl: { FeO: 6.2, P2O5: 1.6, SO3: 45.2, CaO: 33.4, SiO2: 11.8 },
          note: 'Intense 1014 cm⁻¹ ν₁ symmetric sulfate stretch confirming neutral-to-alkaline habitable groundwater circulation.'
        }
      ]
    },
    nodular_carbonate: {
      key: 'nodular_carbonate',
      shortLabel: 'MARGIN CARBONATE',
      title: 'Jezero Margin Unit Authigenic Carbonate & Silica Spherules',
      instrument: 'PIXL Micro-XRF + WATSON Macro Context',
      sol: 'Sol 2023',
      coords: '18.4381°N, 77.2294°E',
      fovLabel: '24.0 × 18.0 mm (15.0 µm/px)',
      imgUrl: 'assets/optimized/m2020_sol2023_navcam_nodular_outcrop_1280.webp',
      thumbUrl: 'assets/optimized/m2020_sol2023_navcam_nodular_outcrop_thumb.webp',
      baseline: {
        label: 'OLIVINE-CARBONATE LAKEBED MARGIN ARENITE',
        coldLevel: 2,
        organicG: 0.29,
        dBand: 0.24,
        so4: 0.26,
        co3: 0.68,
        pixl: { FeO: 21.4, P2O5: 1.4, SO3: 4.8, CaO: 9.2, SiO2: 43.6 },
        note: 'Carbonated olivine grains cemented along ancient Jezero paleolake shoreline.'
      },
      hotspots: [
        {
          x: 0.51,
          y: 0.52,
          r: 0.14,
          label: 'MAGNESITE-SIDERITE CARBONATE NODULE CLUSTER',
          coldLevel: 3,
          organicG: 0.74,
          dBand: 0.62,
          so4: 0.34,
          co3: 0.97,
          pixl: { FeO: 24.8, P2O5: 3.9, SO3: 6.1, CaO: 18.4, SiO2: 31.2 },
          note: 'Sharp 1088 cm⁻¹ CO₃²⁻ symmetric stretch; authigenic carbonate crystals trap ancient fluid inclusions & organics.'
        },
        {
          x: 0.33,
          y: 0.41,
          r: 0.12,
          label: 'HYDRATED OPALINE SILICA CEMENT RIM',
          coldLevel: 3,
          organicG: 0.68,
          dBand: 0.55,
          so4: 0.31,
          co3: 0.64,
          pixl: { FeO: 11.2, P2O5: 2.8, SO3: 5.4, CaO: 8.6, SiO2: 64.5 },
          note: 'High-SiO₂ amorphous silica cement — highest taphonomic preservation potential for microfossils on Mars.'
        }
      ]
    },
    supercam_ablation: {
      key: 'supercam_ablation',
      shortLabel: 'SUPERCAM RMI PITS',
      title: 'SuperCam RMI Telescopic Micro-Mosaic & 1064nm Laser Pit Raster',
      instrument: 'SuperCam RMI + Deep-UV Cross-Calibration',
      sol: 'Sol 2024',
      coords: '18.4402°N, 77.2261°E',
      fovLabel: '32.0 × 24.0 mm (Laser Pits Ø 350 µm)',
      imgUrl: 'assets/optimized/m2020_sol2024_supercam_rmi_laser_1280.webp',
      thumbUrl: 'assets/optimized/m2020_sol2024_supercam_rmi_laser_thumb.webp',
      baseline: {
        label: 'DUST-FREE LASER-CLEANED SILICATE CORTEX',
        coldLevel: 2,
        organicG: 0.25,
        dBand: 0.21,
        so4: 0.38,
        co3: 0.32,
        pixl: { FeO: 17.2, P2O5: 1.5, SO3: 7.2, CaO: 8.4, SiO2: 53.8 },
        note: 'Acoustic shockwave from pulsed 1064nm laser clears ferric airfall dust to expose fresh rock interior.'
      },
      hotspots: [
        {
          x: 0.49,
          y: 0.49,
          r: 0.13,
          label: '5×1 LIBS PLASMA ABLATION PIT RASTER (350 µm)',
          coldLevel: 3,
          organicG: 0.62,
          dBand: 0.54,
          so4: 0.76,
          co3: 0.48,
          pixl: { FeO: 15.4, P2O5: 4.6, SO3: 19.4, CaO: 14.2, SiO2: 41.8 },
          note: 'Depth-profiling LIBS pits penetrate weathering rind into hydrated Fe/Mg smectite & sulfate lamina.'
        }
      ]
    },
    gale_boxwork: {
      key: 'gale_boxwork',
      shortLabel: 'GALE BOXWORK (PIA26696)',
      title: 'Mount Sharp Polygonal Boxwork Cemented Fracture Suture',
      instrument: 'Curiosity Mastcam Micro-Detail + Simulated SHERLOC UV',
      sol: 'Sol 4462',
      coords: '5.0794°S, 137.8558°E',
      fovLabel: '45.0 × 33.8 mm (Diagenetic Ridge Suture)',
      imgUrl: 'assets/optimized/PIA26696_boxwork_detail_1280.webp',
      thumbUrl: 'assets/optimized/PIA26696_mount_sharp_boxwork_thumb.webp',
      baseline: {
        label: 'MOUNT SHARP SULFATE-BEARING MUDSTONE WALLROCK',
        coldLevel: 2,
        organicG: 0.31,
        dBand: 0.26,
        so4: 0.62,
        co3: 0.22,
        pixl: { FeO: 19.8, P2O5: 1.9, SO3: 16.5, CaO: 10.4, SiO2: 44.2 },
        note: 'Recessive wind-eroded mudstone blocks between erosion-resistant mineralized boxwork fins.'
      },
      hotspots: [
        {
          x: 0.53,
          y: 0.46,
          r: 0.14,
          label: 'CENTRAL BOXWORK GROUNDWATER SUTURE VEIN',
          coldLevel: 3,
          organicG: 0.79,
          dBand: 0.66,
          so4: 0.94,
          co3: 0.35,
          pixl: { FeO: 12.6, P2O5: 5.8, SO3: 34.2, CaO: 22.8, SiO2: 22.4 },
          note: 'Warm subsurface groundwater persisted along polygonal fractures long after Gale surface lakes dried.'
        }
      ]
    }
  };

  const microState = {
    isOpen: false,
    targetKey: 'cheyava_vein',
    lensMode: 'uv_raman', // 'uv_raman' | 'pixl_xrf' | 'fusion'
    lensNx: 0.46,
    lensNy: 0.48,
    isDragging: false,
    bound: false,
    lastEvaluation: null
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getImg(url, onLoad) {
    if (imgCache[url]) return imgCache[url];
    const im = new Image();
    im.onload = () => {
      if (onLoad) onLoad();
    };
    im.src = url;
    imgCache[url] = im;
    return im;
  }

  function evaluateLensSpot() {
    const tgt = TARGETS[microState.targetKey] || TARGETS.cheyava_vein;
    const nx = microState.lensNx;
    const ny = microState.lensNy;

    let bestHs = null;
    let bestWeight = 0;

    (tgt.hotspots || []).forEach((hs) => {
      const dist = Math.hypot(nx - hs.x, ny - hs.y);
      if (dist <= hs.r * 1.35) {
        const w = clamp(1 - dist / (hs.r * 1.35), 0, 1);
        if (w > bestWeight) {
          bestWeight = w;
          bestHs = hs;
        }
      }
    });

    const base = tgt.baseline;
    const microRipple = 0.04 * Math.sin(nx * 41.7 + ny * 53.2);

    if (bestHs && bestWeight > 0.22) {
      const k = clamp(bestWeight * 1.25, 0, 1);
      const lerp = (a, b) => +(a + (b - a) * k).toFixed(2);
      const ev = {
        target: tgt,
        spotLabel: k > 0.48 ? bestHs.label : `${bestHs.label} (MARGIN)`,
        coldLevel: k > 0.45 ? bestHs.coldLevel : Math.max(base.coldLevel, bestHs.coldLevel - 1),
        organicG: clamp(lerp(base.organicG, bestHs.organicG) + microRipple, 0.08, 0.99),
        dBand: clamp(lerp(base.dBand, bestHs.dBand) + microRipple * 0.8, 0.08, 0.96),
        so4: clamp(lerp(base.so4, bestHs.so4) - microRipple * 0.5, 0.08, 0.99),
        co3: clamp(lerp(base.co3, bestHs.co3) + microRipple * 0.4, 0.08, 0.99),
        pixl: {
          FeO: +lerp(base.pixl.FeO, bestHs.pixl.FeO).toFixed(1),
          P2O5: +lerp(base.pixl.P2O5, bestHs.pixl.P2O5).toFixed(1),
          SO3: +lerp(base.pixl.SO3, bestHs.pixl.SO3).toFixed(1),
          CaO: +lerp(base.pixl.CaO, bestHs.pixl.CaO).toFixed(1),
          SiO2: +lerp(base.pixl.SiO2, bestHs.pixl.SiO2).toFixed(1)
        },
        note: bestHs.note,
        isHotspot: k > 0.45
      };
      microState.lastEvaluation = ev;
      return ev;
    }

    const ev = {
      target: tgt,
      spotLabel: base.label,
      coldLevel: base.coldLevel,
      organicG: clamp(base.organicG + microRipple, 0.1, 0.95),
      dBand: clamp(base.dBand + microRipple * 0.7, 0.1, 0.95),
      so4: clamp(base.so4 - microRipple * 0.6, 0.1, 0.95),
      co3: clamp(base.co3 + microRipple * 0.5, 0.1, 0.95),
      pixl: {
        FeO: +(base.pixl.FeO + microRipple * 18).toFixed(1),
        P2O5: +(base.pixl.P2O5 + Math.abs(microRipple) * 6).toFixed(1),
        SO3: +(base.pixl.SO3 - microRipple * 14).toFixed(1),
        CaO: +(base.pixl.CaO + microRipple * 10).toFixed(1),
        SiO2: +(base.pixl.SiO2 - microRipple * 16).toFixed(1)
      },
      note: base.note,
      isHotspot: false
    };
    microState.lastEvaluation = ev;
    return ev;
  }

  function renderMicroScanCanvas(ev) {
    const canvas = document.getElementById('microLabCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090807';
    ctx.fillRect(0, 0, w, h);

    const tgt = ev.target;
    const img = getImg(tgt.imgUrl, render);

    // Draw full-frame cover rock scan
    let drawX = 0;
    let drawY = 0;
    let drawW = w;
    let drawH = h;
    if (img && img.complete && img.naturalWidth > 0) {
      const ia = img.naturalWidth / img.naturalHeight;
      const ca = w / h;
      if (ia > ca) {
        drawH = h;
        drawW = h * ia;
        drawX = (w - drawW) / 2;
      } else {
        drawW = w;
        drawH = w / ia;
        drawY = (h - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, w, h);
    }

    // Subtle scientific micro-grid + hotspot discovery markers
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.11)';
    ctx.lineWidth = 1;
    for (let gx = 48; gx < w; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 48; gy < h; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    (tgt.hotspots || []).forEach((hs, idx) => {
      const hx = hs.x * w;
      const hy = hs.y * h;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(hx, hy, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(12, 10, 9, 0.85)';
      ctx.fillRect(hx - 24, hy - 30, 48, 13);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ROI-0${idx + 1}`, hx, hy - 21);
      ctx.restore();
    });

    // Multi-Spectral Diagnostic Lens (Clipped Circular Magnifier — 100% file:// CORS safe!)
    const lx = microState.lensNx * w;
    const ly = microState.lensNy * h;
    const lensR = Math.min(96, Math.max(68, Math.min(w, h) * 0.23));

    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, lensR, 0, Math.PI * 2);
    ctx.clip();

    // 1.42x optical magnification inside lens
    const mag = 1.42;
    if (img && img.complete && img.naturalWidth > 0) {
      const mx = lx - (lx - drawX) * mag;
      const my = ly - (ly - drawY) * mag;
      ctx.save();
      if (typeof ctx.filter === 'string') {
        if (microState.lensMode === 'uv_raman') {
          ctx.filter = 'contrast(1.45) brightness(0.78) saturate(1.4) hue-rotate(175deg)';
        } else if (microState.lensMode === 'pixl_xrf') {
          ctx.filter = 'contrast(1.55) saturate(1.85) brightness(0.92)';
        } else {
          ctx.filter = 'contrast(1.48) saturate(1.5) brightness(0.88)';
        }
      }
      ctx.drawImage(img, mx, my, drawW * mag, drawH * mag);
      ctx.restore();
    }

    // Mode-specific spectroscopic micro-map overlay inside lens
    if (microState.lensMode === 'uv_raman' || microState.lensMode === 'fusion') {
      const uvGrad = ctx.createRadialGradient(lx, ly, 4, lx, ly, lensR);
      uvGrad.addColorStop(0, `rgba(16, 185, 129, ${(0.18 + ev.organicG * 0.34).toFixed(2)})`);
      uvGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.22)');
      uvGrad.addColorStop(1, 'rgba(30, 27, 75, 0.52)');
      ctx.fillStyle = uvGrad;
      ctx.fillRect(lx - lensR, ly - lensR, lensR * 2, lensR * 2);

      // Render millimeter-scale "Leopard-Spot" redox reaction rims (Vivianite outer ring + Greigite core + Organic luminescence)
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const sx = lx + i * 24 + Math.sin(j * 2.3 + microState.lensNx * 14) * 7;
          const sy = ly + j * 24 + Math.cos(i * 1.9 + microState.lensNy * 14) * 7;
          const seed = Math.abs(Math.sin(sx * 0.08 + sy * 0.11));
          if (seed > 1.06 - ev.organicG * 0.68) {
            const spotR = 4.5 + seed * 5.5;
            // Vivianite Fe-phosphate rim (emerald/cyan UV fluorescence boundary)
            ctx.strokeStyle = ev.coldLevel >= 4 ? '#10b981' : '#38bdf8';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
            ctx.stroke();

            // Greigite Fe-sulfide core + aromatic carbon center
            ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
            ctx.beginPath();
            ctx.arc(sx, sy, spotR * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    if (microState.lensMode === 'pixl_xrf' || microState.lensMode === 'fusion') {
      // PIXL 120 µm X-ray micro-beam elemental raster dots (Fe=red-orange, P=emerald, S=amber, Ca=cyan)
      const step = microState.lensMode === 'fusion' ? 16 : 11;
      const alpha = microState.lensMode === 'fusion' ? 0.48 : 0.66;
      for (let py = ly - lensR; py <= ly + lensR; py += step) {
        for (let px = lx - lensR; px <= lx + lensR; px += step) {
          if (Math.hypot(px - lx, py - ly) > lensR - 4) continue;
          const hVal = Math.abs(Math.sin(px * 0.17 + py * 0.23 + microState.lensNx * 9));
          let col = `rgba(249, 115, 22, ${alpha})`; // Fe
          if (hVal > 0.76 && ev.pixl.P2O5 > 5) {
            col = `rgba(16, 185, 129, ${alpha + 0.18})`; // P (Vivianite)
          } else if (hVal > 0.52 && ev.pixl.SO3 > 16) {
            col = `rgba(250, 204, 21, ${alpha})`; // S (Bassanite)
          } else if (hVal < 0.24) {
            col = `rgba(56, 189, 248, ${alpha})`; // Ca / Carbonate
          }
          ctx.fillStyle = col;
          ctx.fillRect(px - 2, py - 2, 4.2, 4.2);
        }
      }
    }

    // Fine internal laser crosshair inside lens
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx - 14, ly);
    ctx.lineTo(lx + 14, ly);
    ctx.moveTo(lx, ly - 14);
    ctx.lineTo(lx, ly + 14);
    ctx.stroke();

    ctx.restore();

    // Precision Outer Lens Ring & Callout Stamp
    const ringCol =
      ev.coldLevel >= 4 ? '#10b981' : microState.lensMode === 'uv_raman' ? '#38bdf8' : '#f97316';
    ctx.save();
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(lx, ly, lensR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(12, 10, 9, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(lx, ly, lensR + 3, 0, Math.PI * 2);
    ctx.stroke();

    const modeTag =
      microState.lensMode === 'uv_raman'
        ? '248.6nm UV RAMAN • Ø 1.8mm'
        : microState.lensMode === 'pixl_xrf'
        ? 'PIXL 120µm XRF RASTER'
        : 'UV + PIXL REDOX FUSION';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    const bw = ctx.measureText(modeTag).width + 16;
    const bx = clamp(lx - bw / 2, 8, w - bw - 8);
    const by = ly + lensR + 8 < h - 26 ? ly + lensR + 6 : Math.max(8, ly - lensR - 24);
    ctx.fillStyle = 'rgba(12, 10, 9, 0.92)';
    ctx.fillRect(bx, by, bw, 18);
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx, by, bw, 18);
    ctx.fillStyle = ringCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(modeTag, bx + bw / 2, by + 9);

    // Top-Left & Bottom-Right Microscope Calibration Stamps
    ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
    ctx.fillRect(10, 10, Math.min(w - 20, 315), 22);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.strokeRect(10, 10, Math.min(w - 20, 315), 22);
    ctx.fillStyle = '#fb923c';
    ctx.textAlign = 'left';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillText(`${tgt.sol.toUpperCase()} • ${tgt.fovLabel}`, 18, 21);

    // 2.0 mm Physical Scale Bar
    const sbW = 72;
    const sbX = w - sbW - 16;
    const sbY = h - 18;
    ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
    ctx.fillRect(sbX - 8, sbY - 14, sbW + 16, 22);
    ctx.strokeStyle = '#fafaf9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY - 4);
    ctx.lineTo(sbX, sbY + 1);
    ctx.lineTo(sbX + sbW, sbY + 1);
    ctx.lineTo(sbX + sbW, sbY - 4);
    ctx.stroke();
    ctx.fillStyle = '#fafaf9';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('2.0 mm', sbX + sbW / 2, sbY - 6);
    ctx.restore();

    ctx.restore();
  }

  function renderRamanSpectrumCanvas(ev) {
    const canvas = document.getElementById('microRamanCanvas');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 340;
    const h = canvas.clientHeight || 108;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090807';
    ctx.fillRect(0, 0, w, h);

    // Graticule
    ctx.strokeStyle = 'rgba(120, 113, 108, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const gx = (w * i) / 5;
      ctx.beginPath();
      ctx.moveTo(gx, 6);
      ctx.lineTo(gx, h - 16);
      ctx.stroke();
    }

    const cmMin = 800;
    const cmMax = 1800;
    const baseY = h - 18;
    const plotH = h - 34;

    const bands = [
      { cm: 1014, width: 22, amp: ev.so4, lbl: 'SO₄²⁻ (1014)', col: '#fbbf24' },
      { cm: 1088, width: 20, amp: ev.co3, lbl: 'CO₃²⁻ (1088)', col: '#38bdf8' },
      { cm: 1355, width: 38, amp: ev.dBand, lbl: 'D-Band', col: '#a855f7' },
      { cm: 1595, width: 30, amp: ev.organicG, lbl: 'G-Band 1595 (ORGANIC)', col: '#10b981' }
    ];

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#fbbf24');
    grad.addColorStop(0.32, '#38bdf8');
    grad.addColorStop(0.60, '#a855f7');
    grad.addColorStop(1.0, '#10b981');

    ctx.beginPath();
    ctx.moveTo(8, baseY);
    const steps = 140;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const cm = cmMin + u * (cmMax - cmMin);
      let yVal = 0.06 + 0.03 * Math.sin(u * 14); // Fluorescence continuum
      bands.forEach((b) => {
        const d = (cm - b.cm) / b.width;
        yVal += b.amp * (1 / (1 + d * d)); // Lorentzian vibrational Raman line shape
      });
      const px = 8 + u * (w - 16);
      const py = baseY - clamp(yVal, 0, 1.08) * plotH;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w - 8, baseY);
    ctx.closePath();

    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fill();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Label vibrational peaks
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    bands.forEach((b) => {
      if (b.amp < 0.34) return;
      const px = clamp(8 + ((b.cm - cmMin) / (cmMax - cmMin)) * (w - 16), 34, w - 48);
      const py = Math.max(10, baseY - b.amp * plotH - 5);
      ctx.fillStyle = b.col;
      ctx.fillText(b.lbl, px, py);
    });

    ctx.fillStyle = '#a8a29e';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('800 cm⁻¹', 8, h - 4);
    ctx.textAlign = 'center';
    ctx.fillText('STOKES RAMAN SHIFT (248.6nm UV)', w / 2, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText('1800 cm⁻¹', w - 8, h - 4);

    ctx.restore();
  }

  function syncDomReadouts(ev) {
    const titleEl = document.getElementById('microModalTitle');
    if (titleEl) titleEl.textContent = ev.target.title;
    const instEl = document.getElementById('microInstrumentLine');
    if (instEl) instEl.textContent = `${ev.target.instrument} • ${ev.target.coords}`;

    const spotTitle = document.getElementById('microSpotTitle');
    if (spotTitle) {
      spotTitle.textContent = ev.spotLabel;
      spotTitle.className =
        ev.coldLevel >= 4
          ? 'text-xs font-extrabold text-emerald-400'
          : 'text-xs font-extrabold text-amber-300';
    }

    const spotNote = document.getElementById('microSpotNote');
    if (spotNote) spotNote.textContent = ev.note;

    const coldBadge = document.getElementById('microColdBadge');
    if (coldBadge) {
      coldBadge.textContent = `CoLD ${ev.coldLevel} / 7`;
      coldBadge.className =
        ev.coldLevel >= 4
          ? 'px-2 py-0.5 rounded bg-emerald-600 text-white font-mono-tech text-[10.5px] font-extrabold'
          : 'px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/60 text-amber-300 font-mono-tech text-[10.5px] font-extrabold';
    }

    const coldDesc = document.getElementById('microColdDesc');
    if (coldDesc) {
      coldDesc.textContent = COLD_DEFINITIONS[ev.coldLevel] || COLD_DEFINITIONS[2];
    }

    const coldScale = document.getElementById('microColdScaleBar');
    if (coldScale) {
      let html = '';
      for (let lvl = 1; lvl <= 7; lvl++) {
        const active = lvl <= ev.coldLevel;
        const isMarsMax = lvl > 4;
        const cls = active
          ? ev.coldLevel >= 4
            ? 'bg-emerald-500 text-stone-950 border-emerald-300'
            : 'bg-amber-500 text-stone-950 border-amber-300'
          : isMarsMax
          ? 'bg-[#141210] text-stone-500 border-dashed border-[#3f3a36]'
          : 'bg-[#1c1917] text-stone-400 border-[#292524]';
        html += `<div class="flex-1 py-1 rounded border text-center font-mono-tech text-[9.5px] font-extrabold ${cls}" title="${
          isMarsMax ? 'Requires Mars Sample Return Earth Laboratory' : 'In-Situ Rover/Astronaut Assay'
        }">L${lvl}</div>`;
      }
      coldScale.innerHTML = html;
    }

    const pixlEl = document.getElementById('microPixlBars');
    if (pixlEl) {
      const items = [
        { k: 'FeO-T', v: ev.pixl.FeO, max: 42, c: 'bg-orange-500' },
        { k: 'P₂O₅', v: ev.pixl.P2O5, max: 20, c: 'bg-emerald-500' },
        { k: 'SO₃', v: ev.pixl.SO3, max: 50, c: 'bg-amber-400' },
        { k: 'CaO', v: ev.pixl.CaO, max: 38, c: 'bg-sky-400' },
        { k: 'SiO₂', v: ev.pixl.SiO2, max: 70, c: 'bg-purple-400' }
      ];
      pixlEl.innerHTML = items
        .map(
          (it) => `
          <div class="flex items-center gap-2 font-mono-tech text-[10px]">
            <span class="w-11 text-stone-300 font-bold">${it.k}</span>
            <div class="flex-1 h-2 bg-[#0c0a09] rounded overflow-hidden border border-[#292524]">
              <div class="h-full ${it.c}" style="width:${Math.min(100, Math.round((it.v / it.max) * 100))}%"></div>
            </div>
            <span class="w-11 text-right text-stone-100 font-bold">${it.v}%</span>
          </div>
        `
        )
        .join('');
    }

    // Sync target & mode buttons
    Object.keys(TARGETS).forEach((k) => {
      const b = document.getElementById(`btnMicroTgt_${k}`);
      if (b) {
        b.className =
          k === microState.targetKey
            ? 'px-2.5 py-1 rounded bg-orange-600 text-white font-mono-tech text-[10px] font-extrabold transition'
            : 'px-2.5 py-1 rounded bg-[#1c1917] hover:bg-[#292524] border border-[#3f3a36] text-stone-300 font-mono-tech text-[10px] font-bold transition';
      }
    });
    ['uv_raman', 'pixl_xrf', 'fusion'].forEach((m) => {
      const b = document.getElementById(`btnMicroMode_${m}`);
      if (b) {
        b.className =
          m === microState.lensMode
            ? 'flex-1 py-1.5 px-2 rounded bg-sky-500/25 border border-sky-400 text-sky-200 font-mono-tech text-[10px] font-extrabold transition'
            : 'flex-1 py-1.5 px-2 rounded bg-[#1c1917] hover:bg-[#292524] border border-[#3f3a36] text-stone-300 font-mono-tech text-[10px] font-bold transition';
      }
    });
  }

  function render() {
    if (!microState.isOpen) return;
    const ev = evaluateLensSpot();
    renderMicroScanCanvas(ev);
    renderRamanSpectrumCanvas(ev);
    syncDomReadouts(ev);
  }

  function bindCanvasOnce() {
    if (microState.bound) return;
    const canvas = document.getElementById('microLabCanvas');
    if (!canvas) return;
    microState.bound = true;

    const moveLensFromClient = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      microState.lensNx = clamp((clientX - rect.left) / Math.max(1, rect.width), 0.08, 0.92);
      microState.lensNy = clamp((clientY - rect.top) / Math.max(1, rect.height), 0.10, 0.90);
      render();
    };

    canvas.addEventListener('mousedown', (e) => {
      microState.isDragging = true;
      moveLensFromClient(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', (e) => {
      if (microState.isDragging || e.buttons === 1) {
        moveLensFromClient(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', () => {
      microState.isDragging = false;
    });
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          microState.isDragging = true;
          moveLensFromClient(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (microState.isDragging && e.touches.length === 1) {
          moveLensFromClient(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    canvas.addEventListener('touchend', () => {
      microState.isDragging = false;
    });
  }

  function open(preferredTheaterKey) {
    microState.isOpen = true;
    if (preferredTheaterKey === 'gale' && microState.targetKey === 'cheyava_vein') {
      setTarget('gale_boxwork');
    } else {
      const tgt = TARGETS[microState.targetKey];
      if (tgt && tgt.hotspots && tgt.hotspots[0]) {
        microState.lensNx = tgt.hotspots[0].x;
        microState.lensNy = tgt.hotspots[0].y;
      }
    }
    bindCanvasOnce();
    setTimeout(render, 20);
  }

  function close() {
    microState.isOpen = false;
  }

  function setTarget(key) {
    if (!TARGETS[key]) return;
    microState.targetKey = key;
    const hs = TARGETS[key].hotspots && TARGETS[key].hotspots[0];
    microState.lensNx = hs ? hs.x : 0.5;
    microState.lensNy = hs ? hs.y : 0.5;
    render();
  }

  function setLensMode(mode) {
    microState.lensMode = mode;
    render();
  }

  function getAssaySamplePayload(sampleSeqNum) {
    const ev = microState.lastEvaluation || evaluateLensSpot();
    return {
      id: `SRLC-0${sampleSeqNum}`,
      stationCode: 'MICRO',
      theater: ev.target.shortLabel,
      name: `${ev.spotLabel}`,
      mineral: `CoLD ${ev.coldLevel}/7 • Organic G-Band ${Math.round(ev.organicG * 100)}% • P₂O₅ ${ev.pixl.P2O5}%`,
      sol: ev.target.sol,
      coords: ev.target.coords,
      thumb: ev.target.thumbUrl,
      notes: `248.6nm SHERLOC + PIXL XRF Micro-Assay (FeO ${ev.pixl.FeO}%, P₂O₅ ${ev.pixl.P2O5}%, SO₃ ${ev.pixl.SO3}%). ${ev.note}`
    };
  }

  return {
    TARGETS,
    state: microState,
    open,
    close,
    setTarget,
    setLensMode,
    render,
    getAssaySamplePayload
  };
})();
