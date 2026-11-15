/**
 * ARES-NAV // Flight-Ready Mission Dataset Linked to `data/mission_manifest.json`
 * Uses real NASA orbital basemaps, stitched 2560px wide-FOV panoramas, and PDS metadata
 */

window.ARES_THEATERS = {
  gale: {
    id: 'gale',
    name: 'Gale Crater — Mount Sharp Boxwork & Gediz Vallis',
    shortName: 'Mount Sharp Boxwork (MSL PIA26696)',
    missionBadge: 'MSL CURIOSITY // SOL 4462 // PIA26696',
    coords: '5.0846°S, 137.8512°E',
    baseLat: -5.0846,
    baseLon: 137.8512,
    baseElevM: -3940,
    basemapImg: 'assets/optimized/gale_hirise_clean_1600.webp',
    basemapVariants: [
      { id: 'hirise_gale', label: 'HiRISE Clean Satellite', url: 'assets/optimized/gale_hirise_clean_1600.webp', isRef: false },
      { id: 'pia23179', label: 'PIA23179 4K Terrain', url: 'assets/optimized/gale_pia23179_orbital_1600.webp', isRef: false },
      { id: 'pia18391', label: 'Official NASA Map (PIA18391)', url: 'assets/optimized/jpegPIA18391_1600.webp', isRef: true }
    ],
    crismOverlayImg: 'assets/optimized/jezero_clean_dem_1600.webp',
    defaultPanoImg: 'assets/optimized/gale_boxwork_pano_2560.webp',
    roverCallsign: 'MULE-MSL "CURIOSITY-II"',
    medaWeather: {
      source: 'MSL REMS / RAD // SOL 4462',
      pressureMbar: 7.42,
      airTempC: -19.8,
      groundTempC: -14.2,
      windSpeedMps: 5.1,
      windDir: '318° NW',
      dustTau: 0.48,
      radBaselineMsvHr: 0.019,
      radBaselineUsvHr: 19.0
    },
    hazards: [
      {
        id: 'HZ-GC-1',
        type: 'scarp',
        label: 'Gediz Vallis Scarp (>26°)',
        x: 0.76,
        y: 0.22,
        rx: 0.11,
        ry: 0.07,
        maxSlope: 27.4,
        severity: 'CRITICAL'
      },
      {
        id: 'HZ-GC-2',
        type: 'sand_trap',
        label: 'Eolian Sand Hollow (<120 TIU)',
        x: 0.48,
        y: 0.72,
        rx: 0.09,
        ry: 0.06,
        maxSlope: 11.2,
        severity: 'WARNING'
      }
    ],
    shelters: [
      {
        id: 'SH-GC-1',
        name: 'Boxwork Cemented Fracture Trough',
        x: 0.62,
        y: 0.44,
        radius: 0.08,
        shieldingPct: 68,
        notes: '2.4m cemented polygonal boxwork wall providing 68% GCR/SEP horizon attenuation.'
      }
    ],
    waypoints: [
      {
        id: 'GALE-HAB',
        code: 'HAB-01',
        name: 'Greenheugh Pediment Base & Rover Dock',
        role: 'habitat',
        x: 0.18,
        y: 0.78,
        elevOffsetM: 0,
        slopeDeg: 4.2,
        thermalInertia: 355,
        crismMineral: 'Sulfate-Cemented Pediment Caprock',
        crismIndex: 0.76,
        radMsvHr: 0.019,
        dwellMins: 15,
        panoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        photoUrl: 'assets/optimized/curiosity_mount_sharp_path_3d_1280.webp',
        altPhotoUrl: 'assets/optimized/curiosity_mount_sharp_units_3d_1280.webp',
        thumbUrl: 'assets/optimized/curiosity_mount_sharp_path_3d_thumb.webp',
        metaBadge: {
          instrument: 'MRO HiRISE + MOLA 3D',
          sol: 'SOL 4462',
          siteDrive: 'PEDIMENT BASE // PIA26696',
          coords: '5.0846°S, 137.8512°E'
        },
        hudHeadingDeg: 215,
        outcropNotes:
          'Base station situated on consolidated pediment sandstone at the foot of the Gediz Vallis channel. Direct visual and UWB telemetry lock across the clay-to-sulfate stratigraphic transition.',
        samplingProtocol: [
          'Verify dual-suit PLSS O₂ pressure (4.3 psi / 29.6 kPa) and LiOH/RCA CO₂ scrubber status.',
          'Cross-check MRO CRISM spectral unit boundaries (Clay-Bearing Green vs. Sulfate Yellow).',
          'Calibrate portable XRF/Raman spectrometer on rover titanium witness standard.',
          'Confirm Walk-Back Abort Envelope radius before ascending toward Boxwork ridge network.'
        ],
        oxides: { SiO2: 45.1, MgO: 11.4, FeOT: 17.8, SO3: 9.5, Al2O3: 9.0, CaO: 7.2 },
        arPins: [
          { yawDeg: 196, pitchY: 0.44, label: 'Gediz Vallis Ascent', detail: 'Least-effort switchback corridor (<12° grade)', type: 'nav', distM: 145, elevM: '+19m' },
          { yawDeg: 238, pitchY: 0.25, label: 'Sulfate Unit Scarp', detail: '27.4° steep cliff — flagged No-Go on HiRISE DEM', type: 'hazard', distM: 310, elevM: '+68m' }
        ]
      },
      {
        id: 'GALE-WP1',
        code: 'WP-01',
        name: 'Sulfate Bench & Wheel Track Calibration',
        role: 'navigation',
        x: 0.34,
        y: 0.64,
        elevOffsetM: +19,
        slopeDeg: 6.4,
        thermalInertia: 280,
        crismMineral: 'Polyhydrated Mg-Sulfate Crust',
        crismIndex: 0.81,
        radMsvHr: 0.020,
        dwellMins: 20,
        panoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        photoUrl: 'assets/optimized/PIA26696_tracks_gale_rim_1280.webp',
        altPhotoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        thumbUrl: 'assets/optimized/PIA26696_tracks_gale_rim_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM LEFT/RIGHT',
          sol: 'SOL 4462',
          siteDrive: 'PIA26696 // GALE RIM VIEW',
          coords: '5.0821°S, 137.8534°E'
        },
        hudHeadingDeg: 340,
        outcropNotes:
          'Curiosity rover wheel tracks cutting across indurated sulfate regolith looking back toward the northern Gale Crater rim. Grouser trench depth (1.6 cm) validates THEMIS 280 TIU trafficability model.',
        samplingProtocol: [
          'Inspect rover wheel grouser trench to measure regolith cohesion and sinkage depth.',
          'Sample exposed white sulfate salts crushed along wheel track margin.',
          'Acquire northern horizon atmospheric opacity sightline toward Gale Crater rim.',
          'Deploy UWB comms relay marker #1 for non-line-of-sight boxwork trough ingress.'
        ],
        oxides: { SiO2: 41.2, MgO: 13.8, FeOT: 16.4, SO3: 13.7, Al2O3: 8.1, CaO: 6.8 },
        arPins: [
          { yawDeg: 324, pitchY: 0.62, label: 'Wheel Trench Test', detail: '280 TIU sulfate crust (1.6 cm grouser depth)', type: 'sci', distM: 3.4, elevM: '-0.2m' },
          { yawDeg: 356, pitchY: 0.22, label: 'Gale Northern Rim', detail: '28.5 km horizon optical tau reference', type: 'nav', distM: 28500, elevM: '+1840m' },
          { yawDeg: 292, pitchY: 0.58, label: 'Eolian Sand Hollow', detail: 'Loose drift (<120 TIU) — stay on bedrock spine', type: 'hazard', distM: 12.0, elevM: '-1.4m' }
        ]
      },
      {
        id: 'GALE-WP2',
        code: 'WP-02',
        name: 'Polygonal Boxwork Ridge Primary Outcrop',
        role: 'science',
        x: 0.48,
        y: 0.54,
        elevOffsetM: +38,
        slopeDeg: 9.8,
        thermalInertia: 395,
        crismMineral: 'Cemented Boxwork Sulfate-Silica Fins',
        crismIndex: 0.94,
        radMsvHr: 0.021,
        dwellMins: 35,
        panoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        photoUrl: 'assets/optimized/PIA26696_mount_sharp_boxwork_1280.webp',
        altPhotoUrl: 'assets/optimized/PIA26696_boxwork_detail_1280.webp',
        thumbUrl: 'assets/optimized/PIA26696_mount_sharp_boxwork_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM MOSAIC',
          sol: 'SOL 4462',
          siteDrive: 'PIA26696 // BOXWORK RIDGES',
          coords: '5.0794°S, 137.8558°E'
        },
        hudHeadingDeg: 110,
        outcropNotes:
          'Extensive polygonal network of erosion-resistant mineralized ridges on lower Mount Sharp. Formed by mineral-rich groundwater circulating through fractures during late-stage drying of ancient Gale lake beds.',
        samplingProtocol: [
          'Traverse along high-thermal-inertia cemented ridge crest (395 TIU) avoiding sand hollows.',
          'Perform standoff Raman/XRF scan across polygonal fracture triple-junction.',
          'Extract 50mm core across cemented ridge fin to sample ancient groundwater precipitates.',
          'Log conjugate fracture strike/dip angles into Science & Sample Log.'
        ],
        oxides: { SiO2: 49.8, MgO: 10.2, FeOT: 18.9, SO3: 14.2, Al2O3: 7.5, CaO: 9.4 },
        arPins: [
          { yawDeg: 92, pitchY: 0.58, label: 'Boxwork Ridge Fin #1', detail: 'Groundwater sulfate-silica vein precipitate', type: 'sci', distM: 4.8, elevM: '+1.2m' },
          { yawDeg: 132, pitchY: 0.66, label: 'Inter-Ridge Sand Trap', detail: 'Windblown hollow (<120 TIU) — bypass along crest', type: 'hazard', distM: 7.5, elevM: '-1.8m' }
        ]
      },
      {
        id: 'GALE-WP3',
        code: 'WP-03',
        name: 'Diagenetic Vein Alcove & Rad Shelter',
        role: 'shelter',
        x: 0.62,
        y: 0.44,
        elevOffsetM: +49,
        slopeDeg: 11.2,
        thermalInertia: 425,
        crismMineral: 'Gypsum / Halite / Fe-Oxide Vein Suture',
        crismIndex: 0.97,
        radMsvHr: 0.007,
        dwellMins: 30,
        panoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        photoUrl: 'assets/optimized/PIA26696_boxwork_detail_1280.webp',
        altPhotoUrl: 'assets/optimized/PIA26696_figB_1280.webp',
        thumbUrl: 'assets/optimized/PIA26696_boxwork_detail_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM TELEPHOTO',
          sol: 'SOL 4462',
          siteDrive: 'PIA26696 // VEIN ALCOVE',
          coords: '5.0772°S, 137.8579°E'
        },
        hudHeadingDeg: 165,
        outcropNotes:
          'High-relief boxwork fracture wall exposing multi-generational white calcium-sulfate veins and dark iron-oxide cores. The 2.4m vertical rock face shields 68% of the sky hemisphere (0.007 mSv/hr inside alcove).',
        samplingProtocol: [
          'Verify Emergency Radiation Shelter attenuation (-68% dose rate inside boxwork trough).',
          'Capture macro-scale texture of central vein suture and alteration halo.',
          'Sample paired inner gypsum vein and outer cemented mudstone wall.',
          'Leave passive radiation dosimeter puck at alcove base.'
        ],
        oxides: { SiO2: 44.6, MgO: 11.9, FeOT: 20.4, SO3: 17.5, Al2O3: 6.8, CaO: 11.2 },
        arPins: [
          { yawDeg: 146, pitchY: 0.56, label: 'Diagenetic Vein Suture', detail: 'CaSO₄ + Fe-oxide fracture zone (0.97 CRISM)', type: 'sci', distM: 2.1, elevM: '+0.6m' },
          { yawDeg: 184, pitchY: 0.44, label: 'Shelter Alcove Wall', detail: 'Radiation Shelter SH-GC-1 (-68% SEP/GCR flux)', type: 'shelter', distM: 3.2, elevM: '+2.4m' }
        ]
      },
      {
        id: 'GALE-WP4',
        code: 'WP-04',
        name: 'Upper Boxwork 360° Horizon Overlook',
        role: 'overlook',
        x: 0.74,
        y: 0.34,
        elevOffsetM: +74,
        slopeDeg: 13.8,
        thermalInertia: 390,
        crismMineral: 'Kieserite & Starkeyite Sulfate Unit',
        crismIndex: 0.89,
        radMsvHr: 0.022,
        dwellMins: 25,
        panoUrl: 'assets/optimized/gale_boxwork_pano_2560.webp',
        photoUrl: 'assets/optimized/PIA26696_web_pano_1280.webp',
        altPhotoUrl: 'assets/optimized/PIA26696_figB_1280.webp',
        thumbUrl: 'assets/optimized/PIA26696_web_pano_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM 360° MOSAIC',
          sol: 'SOL 4462',
          siteDrive: 'PIA26696 // 29,643px FIG B',
          coords: '5.0748°S, 137.8604°E'
        },
        hudHeadingDeg: 75,
        outcropNotes:
          'Panoramic turnaround station overlooking the upper Mount Sharp boxwork plateau and Gediz Vallis ridge. Provides 360° visual correlation with orbital MRO HiRISE and CRISM mineral mapping.',
        samplingProtocol: [
          'Execute 360° horizon visor scan across PIA26696 panoramic mosaic.',
          'Collect sealed sample of desiccated Mg-sulfate (kieserite/starkeyite) bed.',
          'Confirm Walk-Back Abort Envelope margin (>25% O₂/Scrubber reserve) for descent.',
          'Transmit complete waypoint sample log to Habitat via Rover X-band link.'
        ],
        oxides: { SiO2: 47.3, MgO: 14.5, FeOT: 16.9, SO3: 15.3, Al2O3: 8.2, CaO: 7.8 },
        arPins: [
          { yawDeg: 56, pitchY: 0.54, label: 'Boxwork Mega-Grid', detail: 'Polygonal ridge network spanning >400m', type: 'sci', distM: 38.0, elevM: '+8.5m' },
          { yawDeg: 102, pitchY: 0.36, label: 'Mount Sharp Scarp (>26°)', detail: 'Turnaround limit — exceeds 25° safe EVA slope', type: 'hazard', distM: 85.0, elevM: '+34.0m' }
        ]
      }
    ]
  },

  jezero: {
    id: 'jezero',
    name: 'Jezero Crater — Neretva Vallis & Western Rim (Site 093)',
    shortName: 'Jezero Rim / Site 093 (Sols 2023–2024)',
    missionBadge: 'MARS 2020 PERSEVERANCE // SOLS 2023–2024 // RMC 93_0',
    coords: '18.4356°N, 77.2332°E',
    baseLat: 18.4356,
    baseLon: 77.2332,
    baseElevM: -1936,
    basemapImg: 'assets/optimized/jezero_hirise_natural_color_1600.webp',
    basemapVariants: [
      { id: 'hirise_nat', label: 'HiRISE Natural Color Satellite', url: 'assets/optimized/jezero_hirise_natural_color_1600.webp', isRef: false },
      { id: 'pia26402', label: 'HiRISE Site 093 Ortho (PIA26402)', url: 'assets/optimized/jezero_orbital_terrain_1600.webp', isRef: false },
      { id: 'mcz_vert50m', label: 'Mastcam-Z 50m Vertical Projection (360° Nadir)', url: 'assets/optimized/mastcamz_vertical_50m_1600.webp', isRef: false },
      { id: 'esp082945', label: 'HiRISE Raw CCD Swath (ESP_082945)', url: 'assets/optimized/ESP_082945_1985_MRGB_1600.webp', isRef: false },
      { id: 'hirise_ortho', label: 'HiRISE Panchromatic Greyscale', url: 'assets/optimized/jezero_hirise_clean_ortho_1600.webp', isRef: false },
      { id: 'pia26374', label: 'Official NASA Map (PIA26374)', url: 'assets/optimized/jezero_rim_drive_map_1600.webp', isRef: true }
    ],
    crismOverlayImg: 'assets/optimized/jezero_clean_dem_1600.webp',
    defaultPanoImg: 'assets/optimized/mastcamz_360_butler_natural_4096.webp',
    roverCallsign: 'MULE-2020 "ATHENA" (RMC 93_0)',
    medaWeather: {
      source: 'MEDA SKYCAM N0930000MEDA00000 // SOL 2023',
      pressureMbar: 6.85,
      airTempC: -24.6,
      groundTempC: -18.4,
      windSpeedMps: 6.4,
      windDir: '112° ESE',
      dustTau: 0.42,
      radBaselineMsvHr: 0.021,
      radBaselineUsvHr: 21.0
    },
    hazards: [
      {
        id: 'HZ-JV-1',
        type: 'scarp',
        label: 'Western Rim Steep Scarp (>27° No-Go)',
        x: 0.78,
        y: 0.24,
        rx: 0.13,
        ry: 0.08,
        maxSlope: 28.4,
        severity: 'CRITICAL'
      },
      {
        id: 'HZ-JV-2',
        type: 'sand_trap',
        label: 'Neretva Eolian Ripple Drift (<130 TIU)',
        x: 0.45,
        y: 0.68,
        rx: 0.11,
        ry: 0.07,
        maxSlope: 10.8,
        severity: 'WARNING'
      }
    ],
    shelters: [
      {
        id: 'SH-JV-1',
        name: 'Megabreccia Alcove Overhang Shelter',
        x: 0.58,
        y: 0.45,
        radius: 0.10,
        shieldingPct: 74,
        notes: '3.8m fractured Noachian megabreccia overhang providing 74% GCR/SEP horizon attenuation.'
      }
    ],
    waypoints: [
      {
        id: 'JEZERO-HAB',
        code: 'HAB-01',
        name: 'Site 093 Pressurized Rover & Turret Dock',
        role: 'habitat',
        x: 0.16,
        y: 0.78,
        elevOffsetM: 0,
        slopeDeg: 3.4,
        thermalInertia: 345,
        crismMineral: 'Mg-Fe Carbonate Shoreline Bench',
        crismIndex: 0.78,
        radMsvHr: 0.018,
        dwellMins: 15,
        panoUrl: 'assets/optimized/jezero_workspace_pano_2560.webp',
        photoUrl: 'assets/optimized/m2020_sol2023_fhaz_turret_deploy_1280.webp',
        altPhotoUrl: 'assets/optimized/mastcamz_vertical_50m_1280.webp',
        thumbUrl: 'assets/optimized/m2020_sol2023_fhaz_turret_deploy_thumb.webp',
        metaBadge: {
          instrument: 'FHAZ LEFT (FLF) // RMC 91_852',
          sol: 'SOL 2023',
          siteDrive: 'SITE 093 / DRIVE 0000 // FHAZ00206',
          coords: '18.4371°N, 77.2319°E (-1,928m)'
        },
        hudHeadingDeg: 65,
        outcropNotes:
          'High-inertia carbonate pavement at Site 093. Front Hazcam sequence N0930000FHAZ02008 (26 frames) documents robotic arm turret deployment over solid bedrock with zero wheel sinkage.',
        samplingProtocol: [
          'Verify EV-1 & EV-2 suit pressurization and UWB telemetry lock with MULE-2020.',
          'Review MEDA SkyCam (WSM_2023_0846550213) zenith dust opacity (Tau = 0.42).',
          'Confirm FHAZ turret workspace clearance prior to departing along Neretva corridor.',
          'Collect baseline carbonate sand reference sample #2023-01.'
        ],
        oxides: { SiO2: 43.8, MgO: 17.2, FeOT: 16.1, SO3: 4.6, Al2O3: 8.9, CaO: 7.4 },
        arPins: [
          { yawDeg: 48, pitchY: 0.64, label: 'IDD Calibration Target', detail: 'FHAZ00206 turret deployed on carbonate slab', type: 'nav', distM: 1.9, elevM: '-0.4m' },
          { yawDeg: 88, pitchY: 0.44, label: 'Neretva Low-Grade Pass', detail: 'Optimal <6° route bypassing southern sand drift', type: 'nav', distM: 185, elevM: '+14m' }
        ]
      },
      {
        id: 'JEZERO-WP1',
        code: 'WP-01',
        name: 'Neretva Vallis Pass & Horizon Panorama',
        role: 'navigation',
        x: 0.32,
        y: 0.60,
        elevOffsetM: +14,
        slopeDeg: 5.8,
        thermalInertia: 290,
        crismMineral: 'Olivine-Bearing Fluvial Sandstone',
        crismIndex: 0.68,
        radMsvHr: 0.019,
        dwellMins: 20,
        panoUrl: 'assets/optimized/jezero_horizon_pano_2560.webp',
        photoUrl: 'assets/optimized/m2020_sol2023_navcam_valley_pass_1280.webp',
        altPhotoUrl: 'assets/optimized/mastcamz_vertical_50m_1280.webp',
        thumbUrl: 'assets/optimized/m2020_sol2023_navcam_valley_pass_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM-Z 360° (PIA26335) + NAVCAM',
          sol: 'SOL 2023',
          siteDrive: 'RMC 91_970 // NCAM00501',
          coords: '18.4369°N, 77.2321°E (-1,930m)'
        },
        hudHeadingDeg: 115,
        outcropNotes:
          'Stitched 4-frame Navcam horizon sequence (N0930000NCAM00501) capturing the low-gradient valley corridor flanked by eolian ripples and the ascending Western Crater Rim ridge.',
        samplingProtocol: [
          'Stay on exposed >280 TIU bedrock pavement; avoid stepping into <130 TIU eolian ripple trough.',
          'Capture solar tau calibration frame (NLF_2023_0846539402) to monitor afternoon dust loading.',
          'Sample dark mafic ripple crest grains for wind-transport sorting analysis.',
          'Confirm line-of-sight UHF relay back to HAB-01.'
        ],
        oxides: { SiO2: 46.2, MgO: 15.8, FeOT: 17.5, SO3: 3.5, Al2O3: 9.1, CaO: 6.9 },
        arPins: [
          { yawDeg: 98, pitchY: 0.58, label: 'Bedrock Traverse Spine', detail: '5.8° grade — lowest metabolic O₂ burn path', type: 'nav', distM: 24.0, elevM: '+2.1m' },
          { yawDeg: 142, pitchY: 0.68, label: 'Eolian Ripple Drift', detail: 'Loose sand (<130 TIU) — bypass to north', type: 'hazard', distM: 11.5, elevM: '-0.8m' }
        ]
      },
      {
        id: 'JEZERO-WP2',
        code: 'WP-02',
        name: 'Bright Angel Coring & SHERLOC Vein Station',
        role: 'science',
        x: 0.46,
        y: 0.52,
        elevOffsetM: +29,
        slopeDeg: 7.2,
        thermalInertia: 365,
        crismMineral: 'Hydrated Silica & Ca-Sulfate Veins',
        crismIndex: 0.92,
        radMsvHr: 0.020,
        dwellMins: 35,
        panoUrl: 'assets/optimized/PIA26335_pano_2560.webp',
        photoUrl: 'assets/optimized/pia26344-perseverance-selfie-at-cheyava_1280.webp',
        altPhotoUrl: 'assets/optimized/m2020_sol2023_sherloc_watson_micro_1280.webp',
        thumbUrl: 'assets/optimized/pia26344-perseverance-selfie-at-cheyava_480.webp',
        metaBadge: {
          instrument: 'WATSON SELFIE (PIA26344) + SHERLOC ACI',
          sol: 'SOL 2023',
          siteDrive: 'RMC 91_1496 // CHEYAVA & SRLC02503',
          coords: '18.4356°N, 77.2328°E (-1,938m)'
        },
        hudHeadingDeg: 145,
        outcropNotes:
          'Primary contact science workspace (N0930000NCAM00347, 8 stereo frames) paired with SHERLOC ACI micro-imager scan (N0930000SRLC02503, 6 frames) revealing sub-millimeter hydrated mineral veins.',
        samplingProtocol: [
          'Position rotary-percussive drill over planar Bright Angel mudstone slab.',
          'Execute SHERLOC 248.6nm deep-UV Raman & fluorescence scan across white Ca-sulfate veins.',
          'Extract twin rock core sample into titanium tube #2023-BA.',
          'Acquire WATSON/ACI macro context mosaic of abraded patch.'
        ],
        oxides: { SiO2: 52.4, MgO: 9.6, FeOT: 14.2, SO3: 11.4, Al2O3: 7.9, CaO: 8.8 },
        arPins: [
          { yawDeg: 126, pitchY: 0.69, label: 'Coring Slab #2023-BA', detail: 'Bright Angel planar mudstone (NCAM00347)', type: 'sci', distM: 2.2, elevM: '-0.5m' },
          { yawDeg: 166, pitchY: 0.61, label: 'Ca-Sulfate Vein Array', detail: 'SHERLOC hydrated fracture veins (SRLC02503)', type: 'sci', distM: 3.1, elevM: '-0.3m' }
        ]
      },
      {
        id: 'JEZERO-WP3',
        code: 'WP-03',
        name: 'Megabreccia Boulder Shelter & SuperCam LIBS',
        role: 'shelter',
        x: 0.58,
        y: 0.45,
        elevOffsetM: +46,
        slopeDeg: 11.4,
        thermalInertia: 430,
        crismMineral: 'Low-Ca Pyroxene & Impact Megabreccia',
        crismIndex: 0.84,
        radMsvHr: 0.006,
        dwellMins: 30,
        panoUrl: 'assets/optimized/mastcamz_360_butler_natural_4096.webp',
        photoUrl: 'assets/optimized/m2020_sol2023_mastcamz_boulder_1280.webp',
        altPhotoUrl: 'assets/optimized/m2020_sol2024_supercam_rmi_laser_1280.webp',
        thumbUrl: 'assets/optimized/m2020_sol2023_mastcamz_boulder_thumb.webp',
        metaBadge: {
          instrument: 'MASTCAM-Z + SUPERCAM RMI',
          sol: 'SOL 2023–2024',
          siteDrive: 'RMC 92_0 // ZCAM04499 & SCAM01024',
          coords: '18.4356°N, 77.2329°E (-1,937m)'
        },
        hudHeadingDeg: 74,
        outcropNotes:
          'Massive angular Noachian megabreccia boulder documented in 45-frame Mastcam-Z multispectral cube (N0930000ZCAM04499, filters ZL0–ZL6/ZR0–ZR6) and Sol 2024 SuperCam RMI laser target (N0930000SCAM01024). Overhang provides 74% radiation shielding.',
        samplingProtocol: [
          'Verify radiation shelter attenuation beneath boulder overhang (0.006 mSv/hr inside lee).',
          'Fire SuperCam 1064nm LIBS laser burst across dark clast (LRE_2024_0846616684).',
          'Capture Mastcam-Z 14-filter VNIR multispectral sequence (442nm–1022nm).',
          'Chip unweathered corner fragment for terrestrial noble-gas geochronology.'
        ],
        oxides: { SiO2: 50.9, MgO: 14.1, FeOT: 15.6, SO3: 2.1, Al2O3: 10.4, CaO: 6.2 },
        arPins: [
          { yawDeg: 52, pitchY: 0.42, label: 'Megabreccia Shelter', detail: 'SH-JV-1 overhang: -74% GCR/SEP shielding', type: 'shelter', distM: 4.5, elevM: '+2.8m' },
          { yawDeg: 92, pitchY: 0.54, label: 'SuperCam LIBS Target', detail: 'Sol 2024 RMI pit array (SCAM01024)', type: 'sci', distM: 2.8, elevM: '+0.4m' }
        ]
      },
      {
        id: 'JEZERO-WP4',
        code: 'WP-04',
        name: 'Nodular Phyllosilicate Biosignature Bench',
        role: 'science',
        x: 0.70,
        y: 0.36,
        elevOffsetM: +64,
        slopeDeg: 13.8,
        thermalInertia: 380,
        crismMineral: 'Fe/Mg Phyllosilicates & Spherulitic Nodules',
        crismIndex: 0.98,
        radMsvHr: 0.021,
        dwellMins: 40,
        panoUrl: 'assets/optimized/jezero_outcrop_pano_2560.webp',
        photoUrl: 'assets/optimized/m2020_sol2023_navcam_nodular_outcrop_1280.webp',
        altPhotoUrl: 'assets/optimized/m2020_sol2023_navcam_rim_ridge_1280.webp',
        thumbUrl: 'assets/optimized/m2020_sol2023_navcam_nodular_outcrop_thumb.webp',
        metaBadge: {
          instrument: 'NAVCAM + SHERLOC Z-STACK',
          sol: 'SOL 2023',
          siteDrive: 'RMC 93_0 // NCAM00709 & SRLC00630',
          coords: '18.4356°N, 77.2332°E (-1,936m)'
        },
        hudHeadingDeg: 240,
        outcropNotes:
          'Stitched 18-frame Navcam outcrop mosaic (N0930000NCAM00709) and 40-frame SHERLOC autofocus Z-stack (N0930000SRLC00630) over a spherulitic phyllosilicate/carbonate bench on the Western Rim.',
        samplingProtocol: [
          'Run 40-frame SHERLOC ACI focus stack (N0930000SRLC00630) over spherulitic nodule cluster.',
          'Extract priority astrobiology core sample #2023-NOD for Mars Sample Return.',
          'Halt ascent 20m below the >27° Western Rim scarp (imaged in NLF_2023_0846539247).',
          'Verify Walk-Back Abort Envelope before commencing return traverse to HAB-01.'
        ],
        oxides: { SiO2: 48.7, MgO: 12.4, FeOT: 19.8, SO3: 9.8, Al2O3: 7.6, CaO: 5.9 },
        arPins: [
          { yawDeg: 222, pitchY: 0.60, label: 'Spherulitic Nodule Bench', detail: '0.98 CRISM Hydration Index (NCAM00709)', type: 'sci', distM: 3.6, elevM: '+0.5m' },
          { yawDeg: 266, pitchY: 0.36, label: 'Western Rim Scarp (>27°)', detail: 'Exceeds 25° suit slope limit — No-Go', type: 'hazard', distM: 42.0, elevM: '+24.0m' }
        ]
      }
    ]
  }
};
