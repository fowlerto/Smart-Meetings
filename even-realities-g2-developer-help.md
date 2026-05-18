# Even Realities G2 – Developer Help

> Compiled from hub.evenrealities.com/docs – May 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Your First App](#your-first-app)
4. [Architecture](#architecture)
5. [Page Lifecycle](#page-lifecycle)
6. [Input & Events](#input--events)
7. [Display & UI System](#display--ui-system)
8. [Device APIs](#device-apis)
9. [UI/UX Design Guidelines](#uiux-design-guidelines)
10. [Networking](#networking)
11. [Headless Testing](#headless-testing)
12. [AI Tooling – Claude Code](#ai-tooling--claude-code)
13. [Claude Code Skill Catalog](#claude-code-skill-catalog)
14. [Simulator Reference](#simulator-reference)
15. [Packaging & Deployment](#packaging--deployment)
16. [CLI Reference](#cli-reference)
17. [App Submission & QA Guidelines](#app-submission--qa-guidelines)
18. [Community Resources](#community-resources)

---

## Overview

The Even Realities G2 are smart glasses with dual micro-LED displays (one per lens), a four-microphone array, touchpads on the temples, and an optional Even R1 ring for additional input. They pair with your phone via Bluetooth 5.2.

The glasses are privacy-focused by design — no camera, no speaker. App logic runs on the phone; the glasses handle display rendering and native scroll processing.

### Key Hardware Specs

| Spec | Value |
|---|---|
| Display | 576 × 288 pixels per eye |
| Color depth | 4-bit greyscale (16 shades of green) |
| Connectivity | Bluetooth 5.2 |
| Audio input | 4-mic array (single audio stream, 16kHz PCM) |
| Even G2 touchpads | Press, double press, swipe up, swipe down |
| Even R1 touchpads | Press, double press, swipe up, swipe down (optional accessory) |
| Camera / Speaker | None |

### What You Can Build

The Even Hub platform currently supports **plugins** — background-layer apps that run alongside the core glasses experience. The platform is actively expanding to include:

- **Dashboard widgets** — glanceable cards on the glasses home screen
- **Dashboard layouts** — custom arrangements of widgets and information
- **AI skills and integrations** — intelligent features that extend the glasses' capabilities

Plugins are web apps built with standard web technologies (HTML, CSS, JavaScript/TypeScript) and the Even Hub SDK. You develop with any framework you prefer — Vite, React, vanilla JS — and the SDK provides the bridge between your web code and the glasses hardware.

### Development Workflow

1. Write code — Standard web app (Vite + SDK)
2. Preview locally — `evenhub-simulator http://localhost:5173`
3. Test on device — Sideload via QR, or upload a private build to the dev portal
4. Package — `evenhub pack app.json dist -o myapp.ehpk`
5. Submit — Upload `.ehpk` to Even Hub for distribution

### Quick Reference

| Resource | Link |
|---|---|
| SDK | npm: `@evenrealities/even_hub_sdk` |
| Simulator | npm: `@evenrealities/evenhub-simulator` |
| CLI | npm: `@evenrealities/evenhub-cli` |
| Design Guidelines | Figma: Software Design Guidelines |
| Community Notes | GitHub: even-g2-notes |
| Community Toolkit | GitHub: even-toolkit |
| Discord | discord.gg/Y4jHMCU4sv |

---

## Installation

_Last updated: 2026-04-22_

This page walks you through the tooling you need on your machine — the Even Hub SDK, simulator, and CLI — plus the hardware (or simulator) you will use to exercise Even G2 apps end to end.

### Prerequisites

- **Node.js** — v20 LTS or v22+ (Node 18 is not supported)
- A web framework of your choice (Vite recommended)
- A phone with the Even Realities App installed (for hardware testing)
- Even G2 glasses (for hardware testing; the simulator covers early development)
- Even R1 ring (optional — provides additional touchpad input)

### Install the SDK

```bash
npm install @evenrealities/even_hub_sdk
```

Current version: **0.0.10** (published 2026-04-10). The SDK provides typed methods for display control, input handling, audio, device info, and local storage.

### Install the Simulator

The simulator lets you preview UI layouts and test logic without physical hardware. It is a supplement to — not a replacement for — hardware testing.

```bash
npm install -g @evenrealities/evenhub-simulator
```

Current version: **0.7.2** (published 2026-04-15). Cross-platform (macOS, Linux, Windows).

### Install the CLI

The CLI handles authentication, QR sideloading, and app packaging. Global installation is recommended:

```bash
npm install -g @evenrealities/evenhub-cli
```

Alternative — pin the version per-repo:

```bash
npm install -D @evenrealities/evenhub-cli
```

Current version: **0.1.12** (published 2026-04-16).

---

## Your First App

This walkthrough builds the smallest useful Even Hub plugin: connect to the app bridge, render a text page on the glasses, then run it in the simulator or on hardware using QR sideloading.

### Initialize the SDK

```typescript
import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk'

// Recommended: async wait — resolves when the bridge is ready
const bridge = await waitForEvenAppBridge()

// Alternative: synchronous singleton — only after bridge is initialized
const bridge = EvenAppBridge.getInstance()
```

### Create a Page

```typescript
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
} from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Hello from G2!',
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [mainText],
  }),
)
// result: 0 = success, 1 = invalid, 2 = oversize, 3 = out of memory
```

### Run It

**With the Simulator:**

```bash
evenhub-simulator http://localhost:5173
```

No hardware needed — the simulator renders the glasses display on your screen.

**On Real Hardware:**

Generate a QR code pointing to your local dev server:

```bash
evenhub qr --url "http://192.168.1.100:5173"
```

Scan it with the Even Realities App on your phone. Your app loads on the glasses with hot reload support.

### Next Steps

- Learn about the [Display & UI System](#display--ui-system) — containers, text, images, and fonts
- Understand [Input & Events](#input--events) — handling presses, swipes, and gestures
- Read the [UI/UX Design Guidelines](#uiux-design-guidelines) for the 576×288 canvas

---

## Architecture

Even Hub apps are web apps built with standard web technologies and the Even Hub SDK. You develop them locally, and when ready for distribution, you package and submit them to the Even Hub platform.

### Connection Model

```
+------------------+  HTTPS  +--------------------+  Bluetooth  +---------------------+
| Even Hub Cloud   | <-----> | Phone              | <---------> | Even G2 Glasses     |
| (distribution   |         | (Even Realities    |             | (display + input)   |
|  & hosting)     |         |  App + WebView)    |             |                     |
+------------------+         +--------------------+             +---------------------+
```

The phone runs the Even Realities App (Flutter), which hosts your plugin inside a WebView (Chromium on Android, WKWebView on iOS). Your app logic executes inside this WebView; the Even Realities App relays everything to the glasses over Bluetooth.

The glasses render UI containers and emit input events (presses, scrolls, swipes). Aside from native scroll processing, app logic does not run on the glasses.

> **Important:** The `app.json` network whitelist is an Even-side permission check — it controls which domains your plugin is allowed to call from the WebView. It does **not** bypass CORS. APIs that work on localhost but fail inside the WebView are almost always CORS misconfigurations on the remote side.

### Testing Your App

- **QR sideloading** — run a local dev server and generate a QR code via the CLI. Scan it with the Even Realities App to load your app directly with hot reload.
- **Private builds** — package your app via the CLI (`evenhub pack`) and upload it to the developer portal for testing on your own devices.
- **Simulator** — preview layouts and test logic entirely on your computer, no hardware needed.

### The SDK Bridge

The SDK injects a JavaScript bridge (`EvenAppBridge`) into the WebView. Your frontend calls this bridge to control the glasses display and receive input events.

- **Web → Glasses:** Your JS calls `bridge.callEvenApp(method, params)` → WebView bridge → Even Realities App → Bluetooth → glasses.
- **Glasses → Web:** Input events travel Bluetooth → Even Realities App → `window._listenEvenAppMessage(...)` → your callback.

### App Structure

```
my-app/
├── src/
│   ├── main.ts            # App entry point
│   └── components/        # Your UI components
├── public/
│   └── assets/            # Static assets (icons, images)
├── index.html             # HTML entry
├── package.json
├── vite.config.ts         # Build config (Vite recommended)
├── tsconfig.json          # TypeScript config (optional)
└── app.json               # Even Hub manifest (required for packaging)
```

The SDK (`@evenrealities/even_hub_sdk`) is the only Even-specific dependency. Everything else is standard web tooling.

### PWA as an Alternative

If you prefer to keep your app private or distribute it outside of Even Hub, you can build a Progressive Web App (PWA) and route users directly to your hosted web app.

---

## Page Lifecycle

Every glasses screen flows through a small set of SDK calls for creation, incremental updates, full rebuilds, and shutdown.

### Methods

| Method | Purpose | Notes |
|---|---|---|
| `createStartUpPageContainer` | Create the initial page | Called exactly once at startup. Returns result code. |
| `rebuildPageContainer` | Replace the entire page | Full redraw — all state is lost, brief flicker on hardware. |
| `textContainerUpgrade` | Update text in-place | Faster, flicker-free. Requires matching `containerID` + `containerName`. |
| `updateImageRawData` | Update an image container | No concurrent sends allowed. |
| `shutDownPageContainer` | Exit the app | Pass `0` for immediate exit, `1` for exit confirmation dialog. |
| `callEvenApp` | Generic method call | Escape hatch — all typed methods are wrappers around this. |

### Result Codes

For `createStartUpPageContainer`:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Invalid parameters |
| 2 | Oversize |
| 3 | Out of memory |

`rebuildPageContainer`, `textContainerUpgrade`, and `shutDownPageContainer` return `boolean`.

`updateImageRawData` returns a status string: `success`, `imageException`, `imageSizeInvalid`, `imageToGray4Failed`, or `sendFailed`.

### Best Practices

- Use `textContainerUpgrade` for frequent text updates (counters, status, live data) — it avoids the flicker of a full rebuild.
- Use `rebuildPageContainer` when changing the container layout (adding/removing containers, switching between text and list).
- Always match `containerID` and `containerName` exactly when using `textContainerUpgrade`.
- Do not call `updateImageRawData` concurrently — wait for one to complete before sending the next.

---

## Input & Events

Input on Even G2 reaches your web app as structured events from the temple touchpads, optional Even R1 ring, IMU, and app lifecycle hooks.

### Input Sources

| Source | Gestures / Data | Notes |
|---|---|---|
| Even G2 touchpads (temple) | Press, double press, swipe up, swipe down | Primary input on the glasses frame |
| Even R1 touchpads (ring) | Press, double press, swipe up, swipe down | Same gesture set; events are distinguishable by source |
| IMU (accelerometer / gyroscope) | Head orientation, motion data | Available for motion-aware apps |

Even G2 and Even R1 touchpad events share the same event types but can be distinguished by their input source, allowing apps to assign different behaviors to glasses vs. ring input.

### Event Types

| Event | Value | Description |
|---|---|---|
| `CLICK_EVENT` | 0 | Single press (Even G2 or Even R1) |
| `SCROLL_TOP_EVENT` | 1 | Swipe up / scroll reaches top boundary |
| `SCROLL_BOTTOM_EVENT` | 2 | Swipe down / scroll reaches bottom boundary |
| `DOUBLE_CLICK_EVENT` | 3 | Double press (Even G2 or Even R1) |
| `FOREGROUND_ENTER_EVENT` | 4 | App comes to foreground |
| `FOREGROUND_EXIT_EVENT` | 5 | App goes to background |
| `ABNORMAL_EXIT_EVENT` | 6 | Unexpected disconnect |

### Handling Events

```typescript
bridge.onEvenHubEvent(event => {
  const textEvent = event.textEvent
  if (textEvent) {
    const eventType = textEvent.eventType
    switch (eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined: // SDK normalizes 0 to undefined in some cases
        // Handle press
        break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        // Handle double press
        break
      case OsEventTypeList.SCROLL_TOP_EVENT:
        // Handle swipe up
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        // Handle swipe down
        break
    }
  }
})
```

### Event Routing

Event delivery depends on which container has `isEventCapture: 1`:

| Capture container type | Events arrive as |
|---|---|
| Text container | `event.textEvent` |
| List container | `event.listEvent` |

Only one container per page can capture events. Design your interaction model around a single active input target.

### Lifecycle Events

- **`FOREGROUND_ENTER_EVENT`** — the user has opened or returned to your app. Use this to resume updates or refresh data.
- **`FOREGROUND_EXIT_EVENT`** — your app has moved to the background. Pause any timers or ongoing work.
- **`ABNORMAL_EXIT_EVENT`** — the Bluetooth connection was lost unexpectedly.

---

## Display & UI System

The glasses do not render arbitrary HTML — they composite a fixed-resolution canvas from SDK container objects with explicit pixel layout.

### Canvas

Each eye displays a **576 × 288 pixel** canvas. Coordinate origin is at the top-left corner. X increases rightward, Y increases downward.

All colors are rendered as **4-bit greyscale** — 16 levels of green. White pixels appear as bright green; black pixels are off (transparent).

### Containers

The UI is built from containers — rectangular regions positioned with absolute pixel coordinates. There is no CSS, no flexbox, no DOM.

**Rules:**
- Maximum 4 image containers and 8 other containers per page
- Exactly one container must have `isEventCapture: 1` — this container receives all input events
- Containers can overlap; later containers draw on top
- No z-index control beyond declaration order

### Shared Properties

| Property | Type | Range | Notes |
|---|---|---|---|
| `xPosition` | number | 0–576 | Left edge (px) |
| `yPosition` | number | 0–288 | Top edge (px) |
| `width` | number | 0–576 | Container width (px) |
| `height` | number | 0–288 | Container height (px) |
| `containerID` | number | — | Unique per page |
| `containerName` | string | max 16 chars | Unique per page |
| `isEventCapture` | number | 0 or 1 | Exactly one must be 1 |

### Border Properties

Available on text and list containers only:

| Property | Type | Range | Notes |
|---|---|---|---|
| `borderWidth` | number | 0–5 | 0 = no border |
| `borderColor` | number | 0–15 / 0–16 | Greyscale level |
| `borderRadius` | number | 0–10 | Rounded corners |
| `paddingLength` | number | 0–32 | Uniform padding on all sides |

There is no background color or fill color property. The only visual decoration is the border.

### Text Containers

The primary container type. Renders plain text, left-aligned, top-aligned. No text alignment options, no font size control, no bold/italic.

```typescript
new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Your text here',
  isEventCapture: 1,
})
```

**Content Limits:**

| Method | Max Characters |
|---|---|
| `createStartUpPageContainer` | 1,000 |
| `textContainerUpgrade` | 2,000 |
| `rebuildPageContainer` | 1,000 |

**Behavior:**
- Text wraps at container width
- If content overflows and the container has `isEventCapture: 1`, the firmware handles internal scrolling
- `\n` works for line breaks
- Unicode characters are supported (within the firmware's font set)
- ~400–500 characters fill a full-screen text container
- To center text, manually pad with spaces

**In-Place Updates:**

```typescript
await bridge.textContainerUpgrade(containerID, containerName, newContent, contentOffset, contentLength)
```

### List Containers

Native scrollable lists. The firmware handles scroll highlighting natively.

- Maximum 20 items per list
- Maximum 64 characters per item
- No custom styling per item, no item height control, no separator lines
- Cannot be updated in-place — must rebuild the entire page

### Image Containers

Display greyscale images on the glasses.

- Width: 20–200 px, Height: 20–100 px
- 4-bit greyscale
- Accepts `number[]`, `Uint8Array`, `ArrayBuffer`, or base64
- Cannot send during `createStartUpPageContainer` — create a placeholder container, then update via `updateImageRawData`
- No concurrent image sends

**Image-based app pattern:** Use a full-screen text container (`content: ' '`) with `isEventCapture: 1` behind the image container. The text container receives events; the image container draws on top.

### Font & Unicode Support

The glasses use a single LVGL font baked into firmware. No font selection, no font size control, not monospaced. Characters outside the font are silently skipped.

**Useful Characters for Building UIs:**

| Use Case | Characters |
|---|---|
| Progress bars | `━ ─ █▇▆▅▄▃▂▁` |
| Navigation | `▲△▶▷▼▽◀◁` |
| Selection | `●○ ■□ ★☆` |
| Borders | `╭╮╯╰ │─` (box drawing set) |
| Card suits | `♠♣♥♦` |

---

## Device APIs

Beyond drawing and touch handling, the bridge exposes microphone capture, IMU motion streams, device metadata, user profile helpers, and scoped storage.

### Audio

```typescript
// Start/stop microphone capture
await bridge.audioControl(true)  // start
await bridge.audioControl(false) // stop
```

Audio data arrives via `audioEvent` in the event callback. Format: PCM 16kHz, signed 16-bit little-endian, mono.

### IMU

```typescript
import { waitForEvenAppBridge, ImuReportPace, OsEventTypeList } from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

// Start IMU reporting
await bridge.imuControl(true, ImuReportPace.P500)

// Listen for IMU data
const unsubscribe = bridge.onEvenHubEvent(event => {
  const sys = event.sysEvent
  if (!sys?.imuData) return
  if (sys.eventType !== OsEventTypeList.IMU_DATA_REPORT) return
  const { x, y, z } = sys.imuData
  console.log('IMU:', x, y, z)
})

// Stop IMU reporting
await bridge.imuControl(false)
unsubscribe()
```

**`imuControl(isOpen, reportFrq)` Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `isOpen` | boolean | `true` to start, `false` to stop |
| `reportFrq` | ImuReportPace | Pacing code for report frequency |

**ImuReportPace values:** P100, P200, P300, P400, P500, P600, P700, P800, P900, P1000 (protocol pacing codes, not literal Hz values).

**IMU Data Shape:**

| Field | Type | Description |
|---|---|---|
| `eventType` | OsEventTypeList | `IMU_DATA_REPORT` for IMU samples |
| `imuData.x` | float | X-axis value |
| `imuData.y` | float | Y-axis value |
| `imuData.z` | float | Z-axis value |

### Device Info

```typescript
const info = await bridge.getDeviceInfo()
// Returns: model (G1/G2/Ring1), serial number, battery, wearing status, charging, in-case

// Real-time monitoring
bridge.onDeviceStatusChanged(status => {
  // Battery, wearing, charging updates
})
```

### User Info

```typescript
const user = await bridge.getUserInfo()
// Returns: uid, name, avatar, country
```

### Local Storage

```typescript
await bridge.setLocalStorage('key', 'value')
const value = await bridge.getLocalStorage('key')
```

### OS Event Models

| Model | Description |
|---|---|
| `Text_ItemEvent` | Text container event |
| `List_ItemEvent` | List container event |
| `Sys_ItemEvent` | System event — carries `eventType`, `eventSource`, `imuData`, `systemExitReasonCode` |
| `IMU_Report_Data` | IMU sample payload (`x`, `y`, `z` floats) inside `Sys_ItemEvent.imuData` |
| `OsEventTypeList` | Event type enum |

### What the SDK Does NOT Expose

No direct Bluetooth access, no arbitrary pixel drawing, no audio output, no text alignment, no font control, no background colors, no per-item list styling, no programmatic scroll position, no animations, no camera (there is none), and images are greyscale only.

---

## UI/UX Design Guidelines

Even Realities publishes official software design guidelines covering layout principles, component patterns, interaction models, and visual standards for the glasses display and companion app screens.

View the full [Design Guidelines in Figma](https://www.figma.com/).

### Display Constraints

- **576 × 288 px** — this is a very small canvas. Every pixel matters.
- **4-bit greyscale** — design in shades of grey; the hardware renders them as shades of green.
- **No background fill** — you can only use borders and text/image content for visual structure.
- **Max 4 image containers, 8 other containers** — plan your layout within this constraint.
- **One event-capturing container** — design your interaction model around a single active input target.

### Designing Icons

- **Design at native resolution** — work at the actual pixel size (e.g., 24×24). Avoid designing large and scaling down.
- **Keep it simple** — aim for immediately recognizable silhouettes with minimal internal detail.
- **Test on hardware** — the green-tinted greyscale rendering on the glasses differs from your monitor. Always verify icon legibility on the actual display or simulator with glow enabled.

### Common UI Patterns

| Pattern | How |
|---|---|
| Fake buttons | Prefix text with `>` as a cursor indicator |
| Selection highlight | Toggle `borderWidth` on individual text containers |
| Multi-row layout | Stack multiple text containers vertically (e.g., 3 containers at 96px height) |
| Progress bars | Use Unicode block characters: `━` and `─` |
| Page flipping | Pre-paginate text at ~400–500 character boundaries, rebuild on scroll events |

---

## Networking

Even Hub plugins make HTTP requests from inside the WebView that the Even Realities App hosts on the phone. There are two independent gates a request must clear before it reaches the network.

### The Two Gates

1. **Even-side permission check** — the destination domain must be listed in your `app.json` network permission whitelist. Domains not in the whitelist are blocked with no network traffic generated at all.
2. **Browser CORS check** — the browser engine in the WebView enforces standard CORS. The remote server must return the right `Access-Control-Allow-Origin` headers, otherwise the response is dropped.

> **The whitelist is not a CORS bypass.** Adding a domain to `app.json` does not override CORS. It only tells the Even Realities App that your plugin is allowed to talk to that domain. If the remote server doesn't return the right CORS headers, the browser still blocks the response.

### Declaring the Whitelist

```json
"permissions": [
  {
    "name": "network",
    "desc": "Fetches weather data and stores user preferences in the cloud.",
    "whitelist": [
      "https://api.weather.com",
      "https://prefs.example.com"
    ]
  }
]
```

**Notes:**
- Use the full origin (`https://api.example.com`) — bare hostnames or wildcards are not supported.
- HTTPS is required in production.
- Every domain in the whitelist must actually be used. App review flags unused entries.

### Why APIs That Work Locally Fail on Device

| Surface | Local dev | Production WebView |
|---|---|---|
| Page origin | `http://localhost:5173` | Origin injected by Even Realities App |
| CORS enforcement | Often relaxed by dev proxies | Strict browser enforcement |
| Whitelist gate | Bypassed during sideload | Enforced against `app.json` |

Common failure causes:
- **Domain missing from whitelist** — the Even Realities App blocks the request before it leaves the WebView.
- **Server missing `Access-Control-Allow-Origin`** — the request reaches your server but the browser drops the response.
- **Preflight (OPTIONS) failing** — non-simple requests trigger an OPTIONS preflight. The server must respond 200/204 with `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`.
- **Mixed content** — an HTTPS WebView origin cannot fetch from `http://`.

### Required Server-Side CORS Headers

```http
Access-Control-Allow-Origin: *
```

For requests with custom headers, JSON bodies, or non-GET/POST methods, also handle the preflight:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### Debugging Checklist

1. Confirm the domain is in `app.json` `network.whitelist`. Re-pack and re-upload if you changed it.
2. Open the WebView inspector and look at the failed request in the Network tab. `(blocked)` with no status code = whitelist gate. A status code but empty body = CORS.
3. Check response headers for `Access-Control-Allow-Origin`.
4. Check the OPTIONS preflight if sending JSON or custom headers.
5. Try the same request from `curl` to isolate server problems from WebView problems.
6. Test on the simulator — whitelist gate is not enforced, but CORS still applies.

---

## Headless Testing

The EvenHub Simulator (v0.7.0+) ships an HTTP control plane that lets you drive the simulated glasses from any process that can talk to a local socket — Python, Node, a CI script, or your own QA harness.

### When to Use This

- Pre-submission checks — assert rules from App Submission & QA Guidelines before uploading.
- CI smoke tests — run a "did the app even boot" check on every PR.
- Regression testing SDK upgrades.
- Genesis Day judging automation.

### Boot the Simulator with a Control Plane

```bash
evenhub-simulator http://localhost:5173 --automation-port 9898
# → control plane on http://127.0.0.1:9898

curl http://127.0.0.1:9898/api/ping
# pong
```

### The End-to-End Loop

1. **Boot** the simulator pointing at your dev server.
2. **Wait for ready** — poll `GET /api/console` for an app-ready log line. Allow ~4s minimum after launch.
3. **Snapshot the state** — `GET /api/screenshot/glasses` for the framebuffer, `GET /api/console` for log entries.
4. **Send input** — `POST /api/input` with `{ "action": "click" | "double_click" | "up" | "down" }`.
5. **Snapshot again and assert.**

### Patterns and Pitfalls

**Read startup logs before clearing:**

Simulator boot logs are emitted exactly once. Always poll for the ready marker first, then clear the console buffer.

**Use `since_id` for incremental polling:**

```python
data = get_json(f'/api/console?since_id={last_seen}')
for entry in data['entries']:
    last_seen = max(last_seen, entry['id'])
    handle(entry)
```

**Keep screenshots in RGBA:**

`/api/screenshot/glasses` returns RGBA. Test with `pixel.alpha > 0`, not by comparing RGB channels.

**Wait for input capture:**

Posting input before `createStartUpPageContainer` has run is silently dropped. Always wait for your readiness signal first.

**Cleaning up:**

The control plane has no shutdown endpoint — kill the simulator process when done.

---

## AI Tooling – Claude Code

`everything-evenhub` is an open-source plugin for Claude Code that teaches Claude everything it needs to know about building Even G2 smart glasses apps — SDK APIs, display constraints, the simulator, packaging, and more. Install it once, then describe what you want to build in plain English.

### What Is Claude Code?

Claude Code is Anthropic's command-line AI coding tool. Instead of copy-pasting prompts into a chat window, Claude runs inside your terminal, reads your files, writes code, and runs commands for you. See [claude.com/claude-code](https://claude.com/claude-code).

The plugin adds **13 skills** that cover the full development lifecycle:

| Tier | Skills | Purpose |
|---|---|---|
| Tier 1 | `quickstart`, `template`, `build-and-deploy` | Scaffold a new app; package and publish |
| Tier 2 | `glasses-ui`, `handle-input`, `device-features`, `background-state`, `test-with-simulator`, `simulator-automation`, `font-measurement` | Day-to-day coding tasks |
| Tier 3 | `sdk-reference`, `cli-reference`, `design-guidelines` | Look-up / deep-dive |

### Install

1. Install Claude Code — see [claude.com/claude-code](https://claude.com/claude-code)
2. Add the marketplace:
   ```bash
   /plugin marketplace add even-realities/everything-evenhub
   ```
3. Install the plugin:
   ```bash
   /plugin install everything-evenhub
   ```

### Try It

In Claude Code:

> Build me a hello-world app for the Even G2 glasses that shows "Hello, Even!" on the display.

Claude will recognize the request, invoke the `quickstart` skill, scaffold the project, and walk you through running it in the simulator.

### How It Works

You don't need to memorize skill names. Each skill is a markdown file with a short description; Claude reads those descriptions and automatically picks the right skill for whatever you ask.

---

## Claude Code Skill Catalog

This is a lookup table for each EvenHub Claude Code skill — what it automates, representative prompts, and how skills chain together.

Skill definitions ship from the open-source [even-realities/everything-evenhub](https://github.com/even-realities/everything-evenhub) repository.

### Tier 1 — One-Click Skills

**`quickstart`**
Scaffold a blank Even G2 app from scratch (Vite + TypeScript + SDK). Creates a fresh Vite project and wires the SDK.
- Trigger: `/quickstart my-weather-app` or _"Build me a new Even G2 app called stopwatch."_
- Related: `template`, `build-and-deploy`, `glasses-ui`

**`template`**
Scaffold from a curated starter in `even-realities/evenhub-templates` via degit. Pulls `minimal`, `asr`, `image`, or `text-heavy` template; renames `package.json`/`app.json`; runs `npm install`.
- Trigger: `/template my-reader --text-heavy`, `/template --asr my-transcription-app`
- Related: `quickstart`, `build-and-deploy`, `font-measurement`

**`build-and-deploy`**
Package and publish your app to Even Hub using the Even Hub CLI.
- Trigger: `/build-and-deploy` or _"Package my app and upload it to the dev portal."_
- Related: `quickstart`, `template`, `cli-reference`

### Tier 2 — Core Development

**`glasses-ui`**
Build glasses display UI — containers, text, images, lists — for the Even G2 screen.
- Trigger: `/glasses-ui "show a 3-item menu with a title bar"`
- Related: `handle-input`, `font-measurement`, `design-guidelines`

**`handle-input`**
Handle touchpad gestures, ring input, and lifecycle-related events.
- Trigger: `/handle-input "single press cycles screens, double press exits"`
- Related: `glasses-ui`, `background-state`

**`device-features`**
Use hardware-facing capabilities — audio capture, IMU, device info, local storage.
- Trigger: `/device-features "toggle microphone recording on click"`
- Related: `sdk-reference`

**`background-state`**
Persist plugin state across phone background/foreground when the host uses headless WebView migration.
- Trigger: `/background-state src/main.ts` or _"My app resets when the phone comes back from background."_
- Related: `sdk-reference`, `handle-input`

**`test-with-simulator`**
Run and debug the app in the Even Hub Simulator.
- Trigger: `/test-with-simulator "debug my app with glow effect"`
- Related: `simulator-automation`

**`simulator-automation`**
Drive the simulator over its HTTP API — screenshots, input injection, console logs.
- Trigger: `/simulator-automation "take a screenshot and verify text is displayed"`
- Related: `test-with-simulator`

**`font-measurement`**
Pixel-accurate text and list measurement aligned with LVGL firmware rendering.
- Trigger: `/font-measurement "size a text container for a long paragraph with 8px padding"`
- Related: `glasses-ui`

### Tier 3 — Reference Skills

**`sdk-reference`**
Look up Even Hub SDK APIs, types, and patterns.
- Trigger: `/sdk-reference createStartUpPageContainer`

**`cli-reference`**
Look up Even Hub CLI commands and flags.
- Trigger: `/cli-reference evenhub qr`

**`design-guidelines`**
Even G2 display design constraints and UX best practices.
- Trigger: `/design-guidelines settings screen with 5 options`

---

## Simulator Reference

The simulator (v0.7.2) lets you preview UI layouts and test logic without physical hardware. It is a supplement to — not a replacement for — hardware testing.

### Installation

```bash
npm install -g @evenrealities/evenhub-simulator
```

Cross-platform: macOS, Linux, Windows.

### Usage

```bash
evenhub-simulator [OPTIONS] [targetUrl]
```

### Options

| Option | Description |
|---|---|
| `-c, --config <path>` | Path to config file |
| `-g, --glow` | Enable glow effect on glasses display |
| `--no-glow` | Disable glow effect (overrides config) |
| `-b, --bounce <type>` | Bounce animation type: `default` or `spring` |
| `--list-audio-input-devices` | List available audio input devices |
| `--aid <device>` | Choose a specific audio input device |
| `--no-aid` | Use default audio device (overrides config) |
| `--print-config-path` | Print the default config file path and exit |
| `--completions <shell>` | Generate shell completions: bash, elvish, fish, powershell, zsh |
| `-V, --version` | Print version |
| `-h, --help` | Print help |

### Default Config File Paths

| Platform | Location |
|---|---|
| Linux | `$XDG_CONFIG_HOME` or `$HOME/.config` |
| macOS | `$HOME/Library/Application Support` |
| Windows | `{FOLDERID_RoamingAppData}` (e.g., `C:\Users\<user>\AppData\Roaming`) |

### Audio

The simulator emits `audioEvents` with:
- Sample rate: 16,000 Hz
- Format: signed 16-bit little-endian PCM
- 100ms of data per event (3,200 bytes / 1,600 samples)

### Screenshot (v0.5.0+)

Supports exporting the glasses display as an RGBA PNG file via the screenshot button. Exports to the current working directory with a timestamp-based filename. The screenshot is not affected by the `--glow` flag.

### Headless Automation (v0.7.0+)

```bash
evenhub-simulator <url> --automation-port 9898
# → control plane on http://127.0.0.1:9898
```

**Endpoints:**

| Endpoint | Purpose |
|---|---|
| `GET /api/ping` | Health check — returns `pong` |
| `GET /api/screenshot/glasses` | 576×288 RGBA PNG of the LVGL framebuffer |
| `GET /api/screenshot/webview` | PNG of the host webview |
| `GET /api/console[?since_id=N]` | Returns `{ entries, total }` — console output |
| `DELETE /api/console` | Clears the buffer |
| `POST /api/input` | Body: `{ "action": "up" \| "down" \| "click" \| "double_click" }` |

### Tips

- **Screenshot polling:** treat any pixel with `alpha > 0` as lit — comparing RGB channels alone collapses background and foreground (both pure green).
- **Console buffer:** poll `/api/console?since_id=N` and bump N to the last `entries[i].id` you received.
- **Input warm-up:** the simulator silently drops input until the first event-capturing container exists.

### Caveats

- Display rendering may not perfectly match hardware (font rendering, greyscale levels).
- List scrolling behavior can differ from real glasses.
- Image processing is faster and does not enforce hardware size limits.
- Status events are not emitted (user/device profiles are hardcoded).
- Error handling may differ from hardware under abnormal conditions.

Always validate on actual hardware before deployment.

---

## Packaging & Deployment

Shipping an Even Hub build means validating an `app.json` manifest, bundling assets into an `.ehpk`, and uploading through the developer portal.

### The `app.json` Manifest

Generate a starter file with:

```bash
evenhub init
```

Template:

```json
{
  "package_id": "com.example.g2demo",
  "edition": "202601",
  "name": "G2 Demo",
  "version": "0.1.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.7",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "This app needs to access the network in order to ...",
      "whitelist": ["https://example.com"]
    }
  ],
  "supported_languages": ["en"]
}
```

### Field Reference

| Field | Type | Required | Rules |
|---|---|---|---|
| `package_id` | string | Yes | Reverse-domain, lowercase, no hyphens, ≥2 segments |
| `edition` | string | Yes | Must be `"202601"` |
| `name` | string | Yes | ≤20 characters |
| `version` | string | Yes | Semver `x.y.z` |
| `min_app_version` | string | Yes | Minimum Even Realities App version |
| `min_sdk_version` | string | Yes | Minimum SDK version |
| `entrypoint` | string | Yes | Path to HTML entry file relative to build folder |
| `permissions` | array | Yes | Array of permission objects (can be empty `[]`) |
| `supported_languages` | array | Yes | Language codes: `en`, `de`, `fr`, `es`, `it`, `zh`, `ja`, `ko` |

### Permissions Format

Each permission object:

| Key | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | One of: `network`, `location`, `g2-microphone`, `phone-microphone`, `album`, `camera` |
| `desc` | string | Yes | Human-readable reason, 1–300 characters |
| `whitelist` | string[] | `network` only | List of allowed domains |

> **Common mistake:** The `permissions` field must be an array of objects — not a key-value map.

### Building and Packing

**Step 1: Build your web app**

```bash
npm run build
```

**Step 2: Pack into .ehpk**

```bash
evenhub pack app.json dist -o myapp.ehpk
```

| Argument | Description |
|---|---|
| `app.json` | Path to your manifest file |
| `dist` | Path to your built output folder |
| `-o myapp.ehpk` | Output filename (defaults to `out.ehpk`) |
| `--no-ignore` | Include hidden files (dotfiles) |
| `-c, --check` | Check if your `package_id` is available on Even Hub |

### Common Validation Errors

**Invalid package id:** Use lowercase reverse-domain format with ≥2 segments. No hyphens, no uppercase, no leading numbers in any segment.

**name: must be 20 characters or fewer:** Shorten your app name.

**version: must be in x.y.z format:** Use three-part semver — `"1.0.0"`, not `"1.0"` or `"v1.0.0"`.

**min_app_version / min_sdk_version: expected string, received undefined:** Both fields are required.

**permissions: each permission must be an object:** Must be an array of objects with `name` and `desc` keys.

**supported_languages: invalid language:** Use lowercase ISO codes from the supported set: `en`, `de`, `fr`, `es`, `it`, `zh`, `ja`, `ko`.

**Entrypoint file not found:** Ensure the file referenced by `entrypoint` exists inside your build folder.

**Project folder not found:** Run your build step first (`npm run build`).

---

## CLI Reference

The CLI (v0.1.12) handles authentication, QR sideloading, and app packaging.

### Installation

```bash
# Global install (recommended)
npm install -g @evenrealities/evenhub-cli

# Per-repo install
npm install -D @evenrealities/evenhub-cli
```

### The `eh` Shortcut

The CLI also installs a shorter `eh` binary as an alias for `evenhub`. Both commands are interchangeable:

```bash
eh login    # same as: evenhub login
eh qr --url ...  # same as: evenhub qr --url ...
```

### Commands

**`evenhub login`** — Authenticate with your Even Hub developer account.

```bash
evenhub login
evenhub login -e your@email.com
```

| Option | Description |
|---|---|
| `-e, --email <email>` | Your account email |

---

**`evenhub init`** — Generate a starter `app.json` manifest.

```bash
evenhub init
evenhub init -d ./my-project
evenhub init -o ./config/app.json
```

| Option | Description |
|---|---|
| `-d, --directory <dir>` | Directory to create the file in (default: `./`) |
| `-o, --output <path>` | Output file path (overrides `--directory`) |

---

**`evenhub qr`** — Generate a QR code for sideloading your app during development.

```bash
evenhub qr --url "http://192.168.1.100:5173"
evenhub qr -i 192.168.1.100 -p 5173 --path /my-app
evenhub qr --url "http://192.168.1.100:5173" -e
```

| Option | Description |
|---|---|
| `-u, --url <url>` | Full URL (ignores other URL options) |
| `-i, --ip <ip>` | IP address or hostname |
| `-p, --port <port>` | Port number |
| `--path <path>` | URL path |
| `--https` | Use HTTPS instead of HTTP |
| `--http` | Use HTTP (default) |
| `-e, --external` | Open QR in external program instead of terminal |
| `-s, --scale <n>` | Scale factor for file output (default: 4) |
| `--clear` | Clear cached scheme, IP, port, and path |

---

**`evenhub pack`** — Package your built app into an `.ehpk` file for distribution.

```bash
evenhub pack app.json dist -o myapp.ehpk
```

| Argument / Option | Description |
|---|---|
| `<json>` | Path to your `app.json` manifest |
| `<project>` | Path to your built output folder |
| `-o, --output <file>` | Output filename (default: `out.ehpk`) |
| `--no-ignore` | Include hidden files (dotfiles) |
| `-c, --check` | Check if the `package_id` is available on Even Hub |

---

### Shell Completions

```bash
evenhub --completion-bash   # Bash
evenhub --completion-zsh    # Zsh
evenhub --completion-fish   # Fish
```

---

## App Submission & QA Guidelines

_Last updated: 2026-04-22_

Every app submitted to Even Hub goes through a manual review. Anything that fails the checklist below is returned to the developer with a rejection note. Running through this list before you submit is the fastest way to clear review on the first pass.

### Manifest (`app.json`)

- `package_id` — reverse-domain, lowercase, no hyphens, no underscores, ≥2 segments. Every segment must start with a lowercase letter.
- `edition` — exactly `"202601"` (current edition as of April 22, 2026).
- `name` — ≤20 characters and must not contain `"Even"` (case-insensitive). Names like "EvenDoc Reader" are auto-rejected as first-party impersonation. Exception: officially affiliated apps with written approval.
- `version` — three-part semver `x.y.z`. No `v` prefix, no pre-release suffix.
- `min_app_version` and `min_sdk_version` — both required. Current SDK floor: `"0.0.10"`.
- `entrypoint` — must resolve to a real file inside the build output folder.
- `permissions` — array of objects with `name` + `desc` (1–300 chars). `network` entries also need `whitelist`. Not a key-value map.
- Every requested permission must actually be used in app code.
- New version submissions need a non-empty changelog.

### Store Listing & Visual Assets

- Icon is legible — no "black scribble" or noisy patterns.
- Both foreground and background are supplied (neither null nor empty).
- Icon and background image are monochrome/greyscale only. Color assets are rejected.
- Screenshots match what the app actually renders on device.
- Display name matches `app.json` name and the on-glasses display name.
- No impersonation of existing apps, no unauthorized brand logos, no keyword stuffing.

### Privacy

- Privacy policy covers every permission the app requests.
- Backend service domains are documented and traceable to the developer.

### First-Run Experience (No Black Screens)

- First launch when setup is needed → on-glasses message explains what to do. Never a black screen.
- Setup is remembered across launches (use the `localStorage` API) — never re-prompt the same setup.
- CORS headers correctly configured on any third-party API the app calls.

### Locked-Phone Operation

The Even G2 is designed to be useful while the phone is in your pocket. The review team specifically tests with the phone locked and the Even Realities App backgrounded.

- Phone locked + Even App backgrounded → glasses-launched app renders within reasonable time.
- Core flow runs end-to-end on glasses + ring input alone.
- Long-running single-shot tasks continue and complete correctly while the phone stays locked.
- After 2 minutes idle the app is still alive and responsive.
- Unlock → use another phone app → re-lock — the glasses session is unaffected.

### Exit & Lifecycle

- Root-page double-tap calls `bridge.shutDownPageContainer(1)` — the system exit confirmation dialog. Mode `0` (immediate exit) is not acceptable on the root page.
- After the user confirms exit on glasses, the phone-side WebView page also closes automatically.
- After exit, glasses can launch other apps and first-party apps without restart.
- Lifecycle handlers wired correctly:
  - Cleanup on `ABNORMAL_EXIT_EVENT` (6) and `SYSTEM_EXIT_EVENT` (7)
  - Pause/flush on `FOREGROUND_EXIT_EVENT` (5)
  - Resume on `FOREGROUND_ENTER_EVENT` (4)

### Content & Safety

- No medical diagnosis, financial advice, or emergency-routing functionality.
- No offensive, explicit, NSFW, or hateful content.

### Final Pre-Submission Sanity Check

1. `evenhub pack app.json dist -o myapp.ehpk -c` — confirm `package_id` is available and the manifest validates.
2. Sideload via QR with the phone locked for 5 minutes — does the app stay alive and responsive?
3. Trigger a root-page double-tap — does the system exit dialog appear and the WebView close?
4. Re-launch a first-party app (Conversate) — does it start without restarting glasses?
5. Re-read your privacy policy — does it cover every permission in `app.json`?

---

## Community Resources

The Even Realities developer community has produced valuable resources that complement the official tooling.

### Even G2 Development Notes

A comprehensive, independently maintained reference covering architecture deep-dives, full Unicode glyph tables, SDK quirks, error codes, and annotated examples from real apps.

[even-g2-notes on GitHub](https://github.com/even-realities/even-g2-notes)

Includes reference implementations for: chess, reddit, weather, tesla vehicle status, pong, and snake — each demonstrating different patterns (modular architecture, API proxies, image-based rendering, canvas games, settings UI).

### Even Toolkit

A community-built component library for building companion web UIs (settings pages, configuration screens) alongside your glasses app.

[even-toolkit on GitHub](https://github.com/even-realities/even-toolkit)

Install:

```bash
npm install even-toolkit
```

**Key features:**
- **Web components:** Button, Card, NavBar, ListItem, Toggle, Dialog, Toast, BottomSheet, Charts, Calendar, and more (55+ React components, 191 pixel-art icons)
- **Glasses bridge utilities:** `useGlasses` hook, `buildActionBar`, `mapGlassEvent`, canvas renderer, PNG utils, pagination helpers
- **Design tokens:** CSS custom properties for colors, spacing, radii, and fonts. Light and dark themes.
- **Typography:** Classes from `.text-vlarge-title` (24px) down to `.text-detail` (11px)

### Discord

Join the Even Realities developer community for support, bug reports, and discussion.

[Join the Discord](https://discord.gg/Y4jHMCU4sv)
