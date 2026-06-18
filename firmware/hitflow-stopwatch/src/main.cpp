// Hit Flow — M5Stack Stopwatch firmware
//
// Flow:
//   1. Connect to WiFi.
//   2. If we have no saved device token, call the API's `pair` action to get
//      one, then show a QR code. The user scans it (it opens
//      hitflow.xyz/link-device?code=...) and confirms in the web app.
//   3. Poll `status` until the device is linked; cache the user's exercise list.
//   4. Main loop: pick an exercise, set the weight, run the time-under-load
//      timer, then upload the set via the `session` action.
//
// Auth is an opaque token ("hf_dev_..."), kept in NVS and sent as a Bearer
// header. See firmware/README.md and netlify/functions/device-api.ts.
//
// UI: a Jaeger-LeCoultre Memovox-inspired dial (warm-white face, steel bezel,
// royal-blue numerals/hands, vermilion batons + minute track, red triangle at
// 12). The time-under-load timer is a live analog watch face. See the "Memovox
// dial theme" section below.

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#include "config.h"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
enum AppState {
  ST_WIFI,
  ST_PAIRING,   // showing QR + polling status
  ST_PICK,      // choose exercise
  ST_WEIGHT,    // set weight
  ST_TIMER,     // run time-under-load
  ST_CONFIRM,   // ready to submit
  ST_SENDING,
  ST_DONE,
};

static AppState state = ST_WIFI;

static Preferences prefs;
static String deviceToken;         // "hf_dev_..."
static String pairUrl;             // URL encoded in the QR
static String pairCode;            // short human code

static const int MAX_EXERCISES = 32;
static String exerciseIds[MAX_EXERCISES];
static String exerciseNames[MAX_EXERCISES];
static int    exerciseCount = 0;
static int    exerciseIdx = 0;

static int    weight = DEFAULT_WEIGHT;
static uint32_t timerStartMs = 0;
static uint32_t timerElapsedMs = 0;
static bool   timerRunning = false;

static uint32_t lastPollMs = 0;
static uint32_t doneShownMs = 0;
static int      lastHttpCode = 0;  // last apiRequest result, for on-screen diagnostics

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

// Performs a request to `${API_BASE}?action=<action>`.
// Returns the HTTP status code (or a negative HTTPClient error) and fills
// `responseOut` with the body. Picks a plain or TLS client based on the URL
// scheme so the same firmware works against local `netlify dev` (http://...:8888)
// and production (https://hitflow.xyz).
static int apiRequest(const char* method, const String& action,
                      const String& body, bool withAuth, String& responseOut) {
  String url = String(API_BASE) + "?action=" + action;
  const bool secure = url.startsWith("https");

  WiFiClient plain;
  WiFiClientSecure tls;
  HTTPClient http;
  bool begun;
  if (secure) {
    tls.setInsecure();  // No cert pinning — fine for a hobby device. See README.
    begun = http.begin(tls, url);
  } else {
    begun = http.begin(plain, url);
  }
  if (!begun) {
    Serial.printf("[api] begin failed for %s\n", url.c_str());
    lastHttpCode = -1000;
    return -1000;
  }

  http.addHeader("Content-Type", "application/json");
  if (withAuth && deviceToken.length()) {
    http.addHeader("Authorization", "Bearer " + deviceToken);
  }

  int code = (strcmp(method, "POST") == 0) ? http.POST(body) : http.GET();
  responseOut = http.getString();
  http.end();
  lastHttpCode = code;
  Serial.printf("[api] %s action=%s -> %d\n", method, action.c_str(), code);
  return code;
}

// ---------------------------------------------------------------------------
// Display — "Memovox" dial theme
//
// Mimics the Jaeger-LeCoultre Memovox table clock: warm-white dial, brushed
// steel bezel, royal-blue Arabic numerals + hands, vermilion baton markers and
// minute track, and the signature red triangle at 12. Everything is rendered
// into a PSRAM-backed canvas so the analog time-under-load face animates without
// flicker. The round 466x466 panel means we keep content inside the circle.
// ---------------------------------------------------------------------------
#define RGB565(r, g, b) \
  ((uint16_t)((((r)&0xF8) << 8) | (((g)&0xFC) << 3) | ((b) >> 3)))

static const uint16_t COL_OFF      = RGB565(10, 10, 12);     // outside the round dial
static const uint16_t COL_DIAL     = RGB565(247, 246, 242);  // warm white
static const uint16_t COL_BLUE     = RGB565(20, 52, 140);    // numerals + hands
static const uint16_t COL_RED      = RGB565(222, 78, 40);    // batons + accents
static const uint16_t COL_STEEL    = RGB565(178, 180, 184);  // bezel
static const uint16_t COL_STEEL_DK = RGB565(120, 122, 126);  // bezel edge
static const uint16_t COL_TRACK    = RGB565(120, 122, 130);  // minute-track text

static M5Canvas canvas(&M5.Display);
static bool canvasReady = false;
static int CX = 233, CY = 233, RAD = 233;  // set once the canvas exists

static void beep() {
  M5.Speaker.tone(1760, 120);
}

// The Stopwatch's vibration motor sits behind the M5IOE1 expander; M5Unified
// drives it via Power_Class::setVibration (0-255). This is the primary haptic
// feedback (the speaker amp also needs the expander to be enabled).
static void vibrate(uint32_t ms = 150) {
  M5.Power.setVibration(180);
  delay(ms);
  M5.Power.setVibration(0);
}

// ---- dial drawing primitives ----------------------------------------------

// Point on a circle, angle in degrees measured clockwise from 12 o'clock.
static void polar(float r, float deg, float& x, float& y) {
  float a = (deg - 90.0f) * DEG_TO_RAD;
  x = CX + r * cosf(a);
  y = CY + r * sinf(a);
}

static void gText(const String& text, int y, const lgfx::IFont* font,
                  uint16_t color, textdatum_t datum = middle_center, int x = -1) {
  canvas.setFont(font);
  canvas.setTextDatum(datum);
  canvas.setTextColor(color);
  canvas.drawString(text, x < 0 ? CX : x, y);
}

// Brushed-steel bezel + warm-white dial + red triangle + "HIT FLOW" wordmark.
// Shared backdrop for every screen so the device keeps the Memovox identity.
static void drawBezelFace() {
  canvas.fillSprite(COL_OFF);            // corners outside the round panel
  canvas.fillCircle(CX, CY, RAD - 1, COL_STEEL_DK);
  canvas.fillCircle(CX, CY, RAD - 7, COL_STEEL);
  canvas.fillCircle(CX, CY, RAD - 22, COL_DIAL);

  // Signature red alarm triangle near 12.
  float tx, ty;
  polar(RAD * 0.30f, 0, tx, ty);
  canvas.fillTriangle(tx, ty - 10, tx - 9, ty + 7, tx + 9, ty + 7, COL_RED);

  gText("HIT FLOW", CY - RAD * 0.18f, &fonts::FreeSansBold9pt7b, COL_BLUE);
  gText("MEMOVOX STYLE", CY - RAD * 0.10f, &fonts::Font0, COL_TRACK);
}

// Full Memovox dial: blue numerals, red batons, blue/red minute track.
static void drawFullDial() {
  drawBezelFace();

  const float rNum = RAD * 0.74f;
  const float rBatIn = RAD * 0.86f, rBatOut = RAD * 0.95f;
  const float rTrack = RAD * 0.55f;

  // Minute track: 60 blue ticks, red dots every 5.
  for (int i = 0; i < 60; i++) {
    float x0, y0, x1, y1;
    polar(rTrack, i * 6.0f, x0, y0);
    if (i % 5 == 0) {
      canvas.fillCircle(x0, y0, 3, COL_RED);
    } else {
      polar(rTrack - 6, i * 6.0f, x1, y1);
      canvas.drawWideLine(x0, y0, x1, y1, 2, COL_BLUE);
    }
  }

  // Hour batons (vermilion) + blue Arabic numerals.
  canvas.setFont(&fonts::FreeSansBold12pt7b);
  canvas.setTextDatum(middle_center);
  canvas.setTextColor(COL_BLUE);
  for (int h = 1; h <= 12; h++) {
    float deg = h * 30.0f;
    float x0, y0, x1, y1;
    polar(rBatIn, deg, x0, y0);
    polar(rBatOut, deg, x1, y1);
    canvas.drawWideLine(x0, y0, x1, y1, 9, COL_RED);

    float nx, ny;
    polar(rNum, deg, nx, ny);
    canvas.drawString(String(h), nx, ny);
  }
}

// A single blued hand from the center outward (with a short counterweight tail).
static void drawHand(float deg, float lenFrac, float width, uint16_t color,
                     float tailFrac = 0.10f) {
  float tx, ty, bx, by;
  polar(RAD * lenFrac, deg, tx, ty);
  polar(RAD * tailFrac, deg + 180.0f, bx, by);
  canvas.drawWideLine(bx, by, tx, ty, width, color);
}

static void present() {
  canvas.pushSprite(0, 0);
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------
static bool connectWifi() {
  drawBezelFace();
  gText("Connecting WiFi", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
  present();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
  }
  bool ok = WiFi.status() == WL_CONNECTED;
  Serial.printf("[wifi] %s, ip=%s\n", ok ? "connected" : "FAILED",
                WiFi.localIP().toString().c_str());
  return ok;
}

// Register the device and obtain a token + QR pairing URL.
static bool requestPairing() {
  JsonDocument req;
  req["device_name"] = DEVICE_NAME;
  String body;
  serializeJson(req, body);

  String resp;
  int code = apiRequest("POST", "pair", body, false, resp);
  if (code != 200) return false;

  JsonDocument doc;
  if (deserializeJson(doc, resp)) return false;

  deviceToken = doc["token"].as<String>();
  pairUrl = doc["pair_url"].as<String>();
  pairCode = doc["pairing_code"].as<String>();
  if (deviceToken.isEmpty()) return false;

  prefs.putString("token", deviceToken);
  return true;
}

static void drawPairingScreen() {
  drawBezelFace();
  // Round panel: keep the QR inside the inscribed circle (~width/sqrt(2)).
  int dim = 2 * RAD;
  int qrSize = (int)(dim * 0.54f);
  int qrX = CX - qrSize / 2;
  int qrY = CY - qrSize / 2 + 6;
  gText("Scan to link", qrY - 26, &fonts::FreeSansBold12pt7b, COL_BLUE);
  // QR drawn straight to the canvas (dark modules on the white dial).
  canvas.qrcode(pairUrl, qrX, qrY, qrSize, 6);
  gText("Code: " + pairCode, qrY + qrSize + 24, &fonts::FreeSansBold9pt7b, COL_RED);
  present();
}

// Returns true once the device is linked. Refreshes the cached exercise list.
static bool pollStatus() {
  String resp;
  int code = apiRequest("GET", "status", "", true, resp);
  if (code != 200) return false;

  JsonDocument doc;
  if (deserializeJson(doc, resp)) return false;

  if (String(doc["status"].as<const char*>()) != "active") return false;

  exerciseCount = 0;
  for (JsonObject ex : doc["exercises"].as<JsonArray>()) {
    if (exerciseCount >= MAX_EXERCISES) break;
    exerciseIds[exerciseCount] = ex["id"].as<String>();
    exerciseNames[exerciseCount] = ex["name"].as<String>();
    exerciseCount++;
  }
  if (exerciseCount == 0) {
    // Account has no exercises yet; offer a sensible default.
    exerciseNames[0] = "Stopwatch Set";
    exerciseIds[0] = "";
    exerciseCount = 1;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Session upload
// ---------------------------------------------------------------------------
static bool submitSession() {
  JsonDocument req;
  if (exerciseIds[exerciseIdx].length()) {
    req["exercise_id"] = exerciseIds[exerciseIdx];
  } else {
    req["exercise_name"] = exerciseNames[exerciseIdx];
  }
  req["weight"] = weight;
  req["time_under_load"] = (int)round(timerElapsedMs / 1000.0);
  String body;
  serializeJson(req, body);

  String resp;
  int code = apiRequest("POST", "session", body, true, resp);
  return code == 200;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
static void drawPick() {
  drawBezelFace();
  gText("EXERCISE", CY - RAD * 0.42f, &fonts::Font0, COL_RED);
  gText(exerciseNames[exerciseIdx], CY, &fonts::FreeSansBold18pt7b, COL_BLUE);
  gText(String(exerciseIdx + 1) + " / " + String(exerciseCount),
        CY + RAD * 0.30f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  gText("A: next   hold A: prev   B: select",
        CY + RAD * 0.62f, &fonts::Font0, COL_TRACK);
  present();
}

static void drawWeight() {
  drawBezelFace();
  gText("WEIGHT", CY - RAD * 0.42f, &fonts::Font0, COL_RED);
  gText(String(weight), CY, &fonts::FreeSansBold24pt7b, COL_BLUE);
  gText("A: +   hold A: -   B: ok",
        CY + RAD * 0.62f, &fonts::Font0, COL_TRACK);
  present();
}

// The showpiece: time-under-load shown as a live Memovox watch face. Blue hands
// sweep while running; the digital readout sits in the lower half of the dial.
static void drawTimer() {
  uint32_t shown = timerRunning ? (millis() - timerStartMs) : timerElapsedMs;
  float totalSec = shown / 1000.0f;

  drawFullDial();

  float secDeg = fmodf(totalSec, 60.0f) * 6.0f;
  float minDeg = fmodf(totalSec / 60.0f, 60.0f) * 6.0f;
  float hrDeg = fmodf(totalSec / 3600.0f, 12.0f) * 30.0f;

  drawHand(hrDeg, 0.46f, 13, COL_BLUE);
  drawHand(minDeg, 0.66f, 8, COL_BLUE);
  drawHand(secDeg, 0.72f, 3, COL_RED);  // sweep / running indicator
  canvas.fillCircle(CX, CY, 9, COL_BLUE);
  canvas.fillCircle(CX, CY, 3, COL_STEEL);

  char buf[16];
  snprintf(buf, sizeof(buf), "%lu:%02lu.%lu", (unsigned long)(totalSec) / 60,
           (unsigned long)(totalSec) % 60, (shown % 1000) / 100);
  gText(buf, CY + RAD * 0.30f, &fonts::FreeSansBold12pt7b,
        timerRunning ? COL_RED : COL_BLUE);
  gText(timerRunning ? "A: stop" : "A: start   B: save",
        CY + RAD * 0.62f, &fonts::Font0, COL_TRACK);
  present();
}

static void drawDone(bool ok) {
  drawBezelFace();
  gText(ok ? "SAVED" : "UPLOAD FAILED", CY - RAD * 0.18f,
        &fonts::FreeSansBold18pt7b, ok ? COL_BLUE : COL_RED);
  if (ok) {
    gText(exerciseNames[exerciseIdx], CY + RAD * 0.10f,
          &fonts::FreeSansBold9pt7b, COL_TRACK);
    gText(String(weight) + " x " + String((int)round(timerElapsedMs / 1000.0)) + "s",
          CY + RAD * 0.26f, &fonts::FreeSansBold12pt7b, COL_RED);
  }
  present();
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------
void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  M5.Display.setBrightness(180);
  M5.Speaker.begin();

  // Full-screen drawing canvas in PSRAM (the S3R8 has 8MB) for flicker-free
  // rendering of the animated dial.
  CX = M5.Display.width() / 2;
  CY = M5.Display.height() / 2;
  RAD = min(CX, CY);
  canvas.setPsram(true);
  canvas.setColorDepth(16);
  canvasReady = canvas.createSprite(M5.Display.width(), M5.Display.height());
  if (!canvasReady) {
    // Fall back to a tiny direct message; the dial helpers need the canvas.
    M5.Display.fillScreen(TFT_BLACK);
    M5.Display.setTextDatum(middle_center);
    M5.Display.drawString("Canvas alloc failed", CX, CY);
    return;
  }

  prefs.begin("hitflow", false);
  deviceToken = prefs.getString("token", "");

  if (!connectWifi()) {
    drawBezelFace();
    gText("WiFi failed", CY - 14, &fonts::FreeSansBold12pt7b, COL_RED);
    gText("Check WIFI_SSID / WIFI_PASS", CY + 18, &fonts::Font0, COL_TRACK);
    present();
    return;
  }

  if (deviceToken.isEmpty()) {
    if (requestPairing()) {
      drawPairingScreen();
      state = ST_PAIRING;
    } else {
      drawBezelFace();
      gText("Pairing failed", CY - 20, &fonts::FreeSansBold12pt7b, COL_RED);
      gText("API " + String(lastHttpCode), CY + 8, &fonts::FreeSansBold9pt7b, COL_TRACK);
      gText("Restart to retry", CY + 30, &fonts::Font0, COL_TRACK);
      present();
    }
  } else {
    state = ST_PAIRING;  // re-validate token / refresh exercises before use
    drawPairingScreen();
  }
}

void loop() {
  M5.update();

  switch (state) {
    case ST_PAIRING: {
      if (millis() - lastPollMs > 3000) {
        lastPollMs = millis();
        if (pollStatus()) {
          vibrate();
          exerciseIdx = 0;
          state = ST_PICK;
          drawPick();
        } else if (!deviceToken.isEmpty() && pairUrl.isEmpty()) {
          // Returning device with a saved token but not yet linked/online: keep
          // a simple waiting screen.
          drawBezelFace();
          gText("Waiting for link", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
          present();
        }
      }
      break;
    }

    case ST_PICK:
      if (M5.BtnA.wasClicked()) {
        exerciseIdx = (exerciseIdx + 1) % exerciseCount;
        drawPick();
      } else if (M5.BtnA.wasHold()) {
        exerciseIdx = (exerciseIdx - 1 + exerciseCount) % exerciseCount;
        drawPick();
      } else if (M5.BtnB.wasClicked()) {
        weight = DEFAULT_WEIGHT;
        state = ST_WEIGHT;
        drawWeight();
      }
      break;

    case ST_WEIGHT:
      if (M5.BtnA.wasClicked()) {
        weight += WEIGHT_STEP;
        drawWeight();
      } else if (M5.BtnA.wasHold()) {
        weight = max(0, weight - WEIGHT_STEP);
        drawWeight();
      } else if (M5.BtnB.wasClicked()) {
        timerElapsedMs = 0;
        timerRunning = false;
        state = ST_TIMER;
        drawTimer();
      }
      break;

    case ST_TIMER:
      if (M5.BtnA.wasClicked()) {
        if (timerRunning) {
          timerElapsedMs = millis() - timerStartMs;
          timerRunning = false;
          beep();
        } else {
          timerStartMs = millis();
          timerRunning = true;
          beep();
        }
        drawTimer();
      } else if (M5.BtnB.wasClicked() && !timerRunning && timerElapsedMs > 0) {
        state = ST_SENDING;
        drawBezelFace();
        gText("Saving...", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
        present();
      } else if (timerRunning) {
        static uint32_t lastTick = 0;
        if (millis() - lastTick > 100) {  // live-update the running clock
          lastTick = millis();
          drawTimer();
        }
      }
      break;

    case ST_SENDING: {
      bool ok = submitSession();
      drawDone(ok);
      if (ok) vibrate();
      doneShownMs = millis();
      state = ST_DONE;
      break;
    }

    case ST_DONE:
      if (millis() - doneShownMs > 2000 ||
          M5.BtnA.wasClicked() || M5.BtnB.wasClicked()) {
        state = ST_PICK;
        drawPick();
      }
      break;

    default:
      break;
  }

  delay(10);
}
