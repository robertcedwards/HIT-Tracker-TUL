# Hit Flow — M5Stack Stopwatch firmware

Firmware that turns an [M5Stack Stopwatch Dev Kit (ESP32-S3)](https://shop.m5stack.com/products/m5stack-stopwatch-dev-kit-esp32-s3)
into a Hit Flow workout logger. It pairs to your account with a QR code, then
lets you log a set (exercise + weight + time-under-load) straight from the
device — no phone needed once paired.

## How it works

```
device                          Hit Flow API                web app
  │  POST ?action=pair ───────────▶ creates pending device
  │  ◀── token + pair_url ─────────┘
  │  show QR of pair_url
  │                                                  user scans QR
  │                                          opens /link-device?code=…
  │                                          POST ?action=claim (user JWT)
  │  GET ?action=status (token) ──▶ status:active + exercises
  │  POST ?action=session (token) ▶ inserts a workout session
```

The device authenticates with an opaque token (`hf_dev_…`) stored in NVS and
sent as a `Bearer` header. The API validates it server-side and writes with the
Supabase service-role key. See [`netlify/functions/device-api.ts`](../../netlify/functions/device-api.ts).

## Dial design

The UI mimics a **Jaeger-LeCoultre Memovox** table clock: a warm-white dial in a
brushed-steel bezel, royal-blue Arabic numerals and hands, vermilion baton hour
markers and a blue/red minute track, and the signature red alarm triangle at 12.
The time-under-load timer is rendered as a **live analog watch face** — blue hour
and minute hands plus a red sweep hand, with a digital `M:SS.t` readout in the
lower half of the dial. Everything is drawn into a PSRAM-backed `M5Canvas` so the
sweep animates without flicker. The palette and dial primitives live in the
"Memovox dial theme" section of [`src/main.cpp`](src/main.cpp).

## Requirements

Per the [M5Stack StopWatch Arduino docs](https://docs.m5stack.com/en/arduino/stopwatch/program),
this board needs recent tooling — older versions won't drive the QSPI AMOLED:

- **[M5Unified](https://github.com/m5stack/M5Unified) ≥ 0.2.15** — the unified
  M5Stack hardware API (display, buttons, `M5.Power.setVibration`, speaker, IMU).
  It bundles **M5GFX ≥ 0.2.21** (the LovyanGFX-based graphics layer used for the
  canvas, `drawWideLine`, `qrcode`, and the GFX fonts).
- Board reference / pinouts: [M5Stack StopWatch hardware docs](https://docs.m5stack.com/en/core/StopWatch).
- Arduino IDE path: M5Stack Board Manager **≥ 3.3.7**, Board option **`M5StopWatch`**.

`platformio.ini` pins those library versions and sets `-DARDUINO_M5STACK_STOPWATCH`
to mirror the Arduino board option so M5Unified configures the panel, buttons,
and vibration motor (which sits behind the M5IOE1 I²C expander) correctly.

## Build & flash (PlatformIO)

1. Install [PlatformIO](https://platformio.org/install) (CLI or the VS Code extension).
2. Configure your secrets:
   ```bash
   cp include/config.example.h include/config.h
   # edit include/config.h: WIFI_SSID, WIFI_PASS, API_BASE
   ```
   `config.h` is git-ignored.
3. Put the device in **download mode**: hold the power/reset button ~2 s until the
   internal green LED lights, then release.
4. Build and upload (device connected via USB-C):
   ```bash
   pio run -t upload
   pio device monitor      # 115200 baud
   ```

> **If the build fails or the screen stays black:** PlatformIO board support for
> this very new board can lag the official tooling. The M5Stack-validated path is
> the **Arduino IDE** (Board Manager ≥ 3.3.7, Board = `M5StopWatch`, libraries
> M5Unified/M5GFX) — `src/main.cpp` compiles there too once you add a `config.h`.
> Alternatively try the [pioarduino](https://github.com/pioarduino/platform-espressif32)
> platform fork for a newer arduino-esp32 core.

> **Power:** single-press the power button to turn on; double-press quickly to
> power off (per the M5Stack hardware docs).

## Using the device

1. **First boot** — it connects to WiFi and shows a QR code + a short code.
2. **Pair** — scan the QR with your phone (it opens `hitflow.xyz/link-device?code=…`).
   Sign in if needed; the device links to your account automatically.
3. **Log a set** (`BtnA` = yellow KEYA, `BtnB` = blue KEYB):
   - **Exercise** — `BtnA` next, hold `BtnA` previous, `BtnB` to select.
   - **Weight** — `BtnA` +step, hold `BtnA` −step, `BtnB` to confirm.
   - **Timer** — `BtnA` start/stop the time-under-load, then `BtnB` to save.
   - The set uploads and appears in your Hit Flow history immediately.

To unlink, open **Profile → Connected Devices** in the web app and tap **Revoke**.
The device's token stops working immediately (it'll show "Upload failed"); reflash
or clear NVS to re-pair.

## Configuration

All in `include/config.h` (see `config.example.h`):

| Macro | Meaning |
|-------|---------|
| `WIFI_SSID` / `WIFI_PASS` | WiFi credentials |
| `API_BASE` | device-api URL (prod: `https://hitflow.xyz/.netlify/functions/device-api`) |
| `DEVICE_NAME` | Name shown in Profile → Connected Devices |
| `DEFAULT_WEIGHT` / `WEIGHT_STEP` | Starting weight and +/- increment |

## Security notes

- The token is never shown in the QR — only the short, single-use pairing code is.
  The token lives only on the device and in the API (stored as a SHA-256 hash).
- TLS uses `setInsecure()` (no certificate pinning). Acceptable for a personal
  device on a trusted network; for hardening, pin the Netlify/Let's Encrypt root
  CA in `apiRequest()`.
