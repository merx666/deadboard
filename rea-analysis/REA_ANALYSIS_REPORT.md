# REA Reverse Engineering Analysis Report: DEADBOARD
**Target URL**: `https://tholtman1-del.github.io/deadboard/`  
**Target Repository**: `https://github.com/tholtman1-del/deadboard`  
**Tool**: REA (Reverse Engineer Anything) v6.7.0  
**Date**: 2026-11-17  
**Analyst**: Antigravity REA Agent

---

## 1. Executive Summary

DEADBOARD is an in-browser board-level electronics repair trainer and simulator. Using the REA suite (`capture-browser-scenario`, `export-web-scripts`, static application analysis), the runtime was captured, isolated, unpacked, and analyzed across its DOM, network, WebGPU pipeline, and WebWorker execution boundaries.

The application combines:
1. **WebGPU Hardware-Accelerated PCB Renderer**: Renders multilayer PCB traces, vias, copper pours, silkscreen markings, solder joints, solder bridges, cut traces, and thermal dissipation heatmaps with 60 FPS performance.
2. **Deterministic SPICE & MNA Engine**: In-browser Modified Nodal Analysis (MNA) with non-linear device evaluation (diodes, BJTs, MOSFETs, regulators, bootstrap circuits) running on an isolated `solveWorker`.
3. **Realistic Electronic Bench Instruments**:
   - Digital Multimeter (6000-count, 10 MΩ input impedance, diode forward voltage drop, ESR, in-circuit vs out-of-circuit capacitance, series ammeter).
   - Laboratory Power Supply (OCP current limiting, voltage injection on arbitrary nets, boot state power-tree sequencing).
   - Oscilloscope (2-channel, roll-mode history, auto-triggering on switch nodes, ripple, clock generation).
   - Thermal Camera (Infrared emissivity, thermal dissipation model, cold spray sublimation, isopropyl alcohol evaporation, rosin flux melt visualization).
4. **Physical Rework Engine**: Thermal pad inertia, cold solder joints, lifted pads from excessive heat, solder wick capillary action, scalpel trace cutting, kynar jumper wire routing.
5. **Cryptographic Validation**: Zero-knowledge challenge verification using SHA-256 / HMAC topological board hashes (`crypto.ts`), preventing client-side flag tampering.

---

## 2. REA Capture Provenance & Evidence

### 2.1 Landing Page Capture
- **Scenario Definition**: `rea-analysis/scenario.json`
- **Capture File**: `rea-analysis/capture.json` (Evidence ID: `ev_e79e83b088b54c2f0bf99d00418c2ba1850c53392cb9fb24618c2c67fc7528e2`)
- **Extracted Bundles**:
  - `main-B_sONGRC.js` (SHA-256: `2562d25eed99c17035a8ae2181d36d9f40ce9932cf346d88123cb3bd03d895cf`)
  - `logo-BWg8WFbs.js` (SHA-256: `a64f112155f9a4e0ebd44dc0a52e93de70d38db1d4da09c2033b44eba705d377`)

### 2.2 Workbench Simulator Capture (`app.html`)
- **Scenario Definition**: `rea-analysis/scenario-app.json`
- **Capture File**: `rea-analysis/capture-app.json` (Evidence ID: `ev_f6e3febf66dec7d44f4978bf1079dee8153ec6bfc49cb5c8ab4da2753aa61cd0`)
- **Extracted Bundles**:
  - `app-CmRfO5qf.js` (SHA-256: `962fa25f73677f5c6fecb4b13b9bfe6422ce29b4679af2adbceb39c487740ac7`, 419,263 bytes)
  - `logo-BWg8WFbs.js` (SHA-256: `a64f112155f9a4e0ebd44dc0a52e93de70d38db1d4da09c2033b44eba705d377`, 5,817 bytes)

---

## 3. Architecture & Reverse Engineering Findings

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser GUI                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Top Bar    │  │  Tool Dock   │  │  HUD & Instruments│  │
│  │  (Nav, Lang, │  │ (14 Rework & │  │ (DMM, PSU, Scope, │  │
│  │   Bench Opts)│  │ Probe Tools) │  │  Thermal Camera)  │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      WebGPU Render Mesh      │ │   State & Rework Engine    │
│  - PCB Layers (Top/Bottom)   │ │  - Board Topology Model    │
│  - Traces, Vias, Solder      │ │  - Thermal Field Sim       │
│  - Dynamic Thermal Overlay   │ │  - Component Solder Joints │
│  - Probes & Selection Masks  │ │  - Scalpel Trace Cuts      │
└──────────────┬───────────────┘ └────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          WebWorker Modified Nodal Analysis (SPICE)          │
│  - Netlist Extraction from Physical Connectivity            │
│  - Sparse Matrix Solver (LU Factorization)                  │
│  - Power Tree Sequencing (S5 -> S4 -> S3 -> S0)             │
│  - Realistic Parasitics, Contact Resistance & Leakage       │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Mathematical & Physics Fidelity
- **Multimeter**:
  - Voltage: 10 MΩ divider load with Gaussian thermal noise ($0.05\% \pm 2\text{ counts}$).
  - Resistance: Open circuit voltage 0.5 V or 2.8 V, testing current clamped to prevent artificial semiconductor turn-on. Continuity threshold calibrated at $\le 30\,\Omega$.
  - Diode: 1 mA test current with silicon ($0.55 - 0.75\,\text{V}$), Schottky ($0.15 - 0.35\,\text{V}$), and LED ($1.8 - 3.2\,\text{V}$) voltage curve simulation.
- **Thermal Mechanics**:
  - Fourier heat conduction discretized across PCB grid points.
  - Joule heating $P = I^2 R$ calculated dynamically from node potentials and branch currents.
  - Convective cooling to ambient (25 °C default).
  - Rosin flux melting at ~120 °C, IPA evaporation at ~45 °C, freeze spray sublimating from -50 °C up to room temperature.

### 3.2 Cryptographic Challenge Flag Architecture
- Scenarios contain an encrypted payload:
  $$ \text{Lock} = E_{\text{Key}}(\text{Flag}) $$
  where $\text{Key} = \text{HMAC-SHA256}(\text{ScenarioID}, \text{CanonicalTopology}(\text{Board}))$.
- When the repair is physically correct (all reference connections restored, all faults and shorts eliminated), `CanonicalTopology` produces the exact bitstream to decrypt `PCB{...}`.

---

## 4. Modernization & Expansion Blueprint (Anti-AI-Slop & Craft)

1. **Native Polish & English Localization**:
   - Polish technical standard (terminologia laboratoryjna SEP/NOT/elektroniczna: *multimetr, oscyloskop, zasilacz laboratoryjny, ciągłość obwodu, zimny lut, mostek cynowy, pad lutowniczy, przelotka, kynar*).
   - Zero-dependency type-safe i18n dictionary.
   - Default language: Polish (`pl`), with seamless toggle to English (`en`).
   - Saved persistently in `localStorage`.
2. **Audio Craft Enhancement**:
   - Multimeter continuity buzzer (authentic 2.7 kHz piezo tone for $\le 30\,\Omega$ resistance in diode/continuity mode).
   - PSU relay actuation click on power switch.
3. **Productivity & Accessibility**:
   - Interactive Keyboard Shortcuts dialog (`?` key or header icon).
   - Exportable Diagnostic Repair Report (Protokół Naprawy Laboratoryjnej) in Markdown / text.
   - Dedicated Polish scenario challenge ("Klasyk Warsztatu: Zwarcie na szynie 3.3V").
4. **PWA & Offline Readiness**:
   - Updated manifest and service worker configuration for offline lab training.
