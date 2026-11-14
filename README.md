# ARES-NAV // Martian Orbital-to-Surface EVA Navigation & 3D AR Visor

**Team:** Project Interplanetary Explorers — NASA Space Apps Challenge  
**Live Interactive Web App (GitHub Pages):** [https://nguyenbill296william-debug.github.io/ares-nav/](https://nguyenbill296william-debug.github.io/ares-nav/)

---

## Overview

**ARES-NAV** is an orbital-to-surface Martian Extravehicular Activity (EVA) tactical navigation system, JPL *OnSight*-inspired WebGL 3D holographic terrain table, bi-directional CapCom co-op suite, and smartphone-powered stereoscopic 3D AR spacesuit visor built on **219 authentic NASA Mars 2020 Perseverance and MSL Curiosity mission files**.

Mars lacks GPS satellites, a global dipole magnetic field, and breathable air—turning $>25^\circ$ crater scarps, $\tau = 3.2$ dust-storm whiteouts, and Solar Particle Events (SPE) into life-or-death hazards. ARES-NAV integrates four operational modes:

1. **`[1]` 360° Planet Mars (Orbital PNT):** Live WebGL Mars globe tracking NASA's real relay constellation (**MRO, Mars Odyssey, MAVEN**) and computing Horizontal Dilution of Precision (`HDOP`) via Electra UHF radiometric Doppler/ranging across **Jezero Crater (Site 093)** and **Gale Crater (Boxwork)**.
2. **`[2]` Surface GPS Map & WebGL 3D Terrain Table:** 8-connected **A\* pathfinder** over real `100×68` **MRO HiRISE (`DTEEC_048900_1745`) & MOLA Digital Elevation Models** coupled with **0.38g Pandolf-Santee spacesuit metabolic physics**, **401 MHz UHF line-of-sight ray-casting**, and **NASA Dual-Crew (`EV-1 + EV-2`) 26m Buddy-Rule** reserve checks—saving **~24% primary PLSS oxygen** vs. direct climbs. Includes a 13,266-triangle extruded 3D terrain fly-through, `+48%` Buddy-Tow fault verification (`15%` $\text{O}_2$ redline), and 2-stage SPE overhang shelter abort (`-74%` radiation dose).
3. **`[3]` 360° Stereoscopic Spacesuit Visor HUD & Bi-Directional CapCom:** Pair any smartphone inside a DIY stereoscopic 3D visor via QR code over local Wi-Fi (`<20 ms` SSE telemetry, zero internet required). Streams 20 Hz head-tracking and hands-free Gaze-Dwell **1064nm SuperCam LIBS** laser shots to Mission Control, projects **3D Cyan AR Priority Target Diamonds** from Houston into the astronaut's goggles, and renders DEM wireframe **Synthetic Vision** through zero-visibility dust whiteouts.
4. **`[4]` SHERLOC Deep-UV Micro-Lab & Printable NASA FDF Debrief:** Interactive `248.6nm` Deep-UV Raman & `120 µm` PIXL XRF micro-spectroscopy on real *Cheyava Falls* imagery (`vivianite`/`greigite` leopard spots + `1595 cm⁻¹` organic G-band, **NASA CoLD Level 4**) with Flight Data File export.

---

## Quick Start

### Option A: Instant Browser Launch (Zero Install)
Open the live deployment at **[https://nguyenbill296william-debug.github.io/ares-nav/](https://nguyenbill296william-debug.github.io/ares-nav/)** and click **`▶ JUDGE TOUR`** in the top header for a narrated 5-step walkthrough.

### Option B: Local Bi-Directional CapCom Server (Laptop Mission Control ↔ Smartphone 3D Goggles)
Requires Python 3 (standard library only — zero `pip` packages needed):

```bash
python ares_capcom_server.py
```
*(On Windows, double-click `START_ARES_CAPCOM.bat`.)*
1. Opens Mission Control at `http://localhost:8080`.
2. Click **`CAPCOM`** in the top-right bar and scan the QR code (`http://<LAN_IP>:8080/?visor=1`) on a smartphone connected to the same Wi-Fi / Hotspot.
3. Tap **`GYRO TRACK`** and **`3D GOGGLES [V]`** on the phone to begin two-way Houston ↔ Mars co-op telemetry!

---

## NASA Data & Credits
- **Mars 2020 Perseverance PDS Bundles:** Mastcam-Z, Navcam, Front Hazcam, SuperCam RMI, SHERLOC WATSON/ACI, MEDA SkyCam, Mars Microphone audio, and official M2020 traverse/waypoints GeoJSON.
- **MSL Curiosity:** PIA26696 Mount Sharp Boxwork panoramas.
- **Orbital Topography & 3D Assets:** MRO HiRISE DEMs, MGS MOLA global elevation, and official NASA 3D `.glb` meshes (Perseverance, Ingenuity, xEMU spacesuit, Jezero Crater).
