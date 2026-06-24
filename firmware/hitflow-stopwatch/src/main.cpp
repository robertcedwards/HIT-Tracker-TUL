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
//
// Easter egg: triple-tap button A on the exercise-select screen for a hidden
// clock — full Memovox dial with hour/minute/second hands and "HitFlow.xyz",
// kept accurate by the hardware RTC + occasional NTP sync. Any tap exits.

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

#include "config.h"

// NTP / timezone for the hidden clock mode. Override in config.h; defaults to US
// Eastern. TZ_INFO is a POSIX TZ string (handles DST automatically).
#ifndef NTP_SERVER
#define NTP_SERVER "pool.ntp.org"
#endif
#ifndef TZ_INFO
#define TZ_INFO "EST5EDT,M3.2.0,M11.1.0"
#endif

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
  ST_CLOCK,     // hidden NTP clock (triple-tap A)
};

static AppState state = ST_WIFI;

static Preferences prefs;
static String deviceToken;         // "hf_dev_..."
static String pairUrl;             // URL encoded in the QR
static String pairCode;            // short human code

static const int MAX_EXERCISES = 32;
static String exerciseIds[MAX_EXERCISES];
static String exerciseNames[MAX_EXERCISES];
static int    exerciseLastWeight[MAX_EXERCISES];  // last logged weight, -1 if none
static int    exerciseLastTime[MAX_EXERCISES];    // last logged time-under-load (s)
static int    exerciseCount = 0;
static int    exerciseIdx = 0;

static int    weight = DEFAULT_WEIGHT;
static uint32_t timerStartMs = 0;
static uint32_t timerElapsedMs = 0;
static bool   timerRunning = false;
static bool   passedPrevBeeped = false;  // beeped once when we beat last time

static uint32_t lastPollMs = 0;
static uint32_t doneShownMs = 0;
static int      lastHttpCode = 0;  // last apiRequest result, for on-screen diagnostics

static bool     ntpDone = false;       // NTP has synced the RTC at least once
static uint32_t lastNtpMs = 0;         // millis() of last successful NTP sync
static uint32_t aTaps[3] = {0, 0, 0};  // recent BtnA click times (triple-tap easter egg)

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
static const uint16_t COL_YELLOW   = RGB565(240, 190, 20);   // physical A button (yellow)

static M5Canvas canvas(&M5.Display);
static bool canvasReady = false;
static int CX = 233, CY = 233, RAD = 233;  // set once the canvas exists

static void beep() {
  M5.Speaker.tone(1760, 120);
}

// Distinct rising double-beep played once when the live time passes the previous
// session's time-under-load.
static void beepPassedPrev() {
  M5.Speaker.tone(2349, 110);
  delay(130);
  M5.Speaker.tone(3136, 180);
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
                  uint16_t color, textdatum_t datum = middle_center, int x = -1,
                  uint8_t size = 1) {
  canvas.setFont(font);
  canvas.setTextSize(size);  // reset each call so a scaled value can't leak
  canvas.setTextDatum(datum);
  canvas.setTextColor(color);
  canvas.drawString(text, x < 0 ? CX : x, y);
}

// Just the brushed-steel bezel + warm-white dial (no text). Building block for
// every screen's backdrop.
static void drawBareBezel() {
  canvas.fillSprite(COL_OFF);            // corners outside the round panel
  canvas.fillCircle(CX, CY, RAD - 1, COL_STEEL_DK);
  canvas.fillCircle(CX, CY, RAD - 7, COL_STEEL);
  canvas.fillCircle(CX, CY, RAD - 22, COL_DIAL);
}

// Signature red alarm triangle just inside 12.
static void drawAlarmTriangle() {
  float tx, ty;
  polar(RAD * 0.30f, 0, tx, ty);
  canvas.fillTriangle(tx, ty - 10, tx - 9, ty + 7, tx + 9, ty + 7, COL_RED);
}

// Bezel + dial + triangle + centered "HIT FLOW" wordmark (used by the QR screen;
// its center gets covered by the QR anyway).
static void drawBezelFace() {
  drawBareBezel();
  drawAlarmTriangle();
  gText("HIT FLOW", CY - RAD * 0.18f, &fonts::FreeSansBold9pt7b, COL_BLUE);
  gText("MEMOVOX STYLE", CY - RAD * 0.10f, &fonts::Font0, COL_TRACK);
}

// Clean backdrop for the menu/status screens: bezel + white dial with the
// "HIT FLOW" brand near the top — center is free for content.
static void drawMenuBg() {
  drawBareBezel();
  gText("HIT FLOW", CY - RAD * 0.62f, &fonts::FreeSansBold12pt7b, COL_BLUE);
}

// Key-cap geometry: yellow A sits between the 10 and 11 o'clock ticks, blue B
// between 1 and 2 — inset angularly so the red batons stay clear.
static const float KEY_A_DEG = 315.0f;  // center of 10-11 o'clock
static const float KEY_B_DEG = 45.0f;   // center of 1-2 o'clock
static const float KEY_HALF = 11.0f;    // angular half-width
static const float KEY_R_IN = 0.76f;    // inner edge (near numerals)
static const float KEY_R_OUT = 0.95f;   // outer edge (up to the rim)
static const float KEY_LABEL_R = 0.85f; // label radius (toward the outer edge)

// A filled "key cap" between the ticks: domed toward the rim and tapered at the
// ends — mimicking the physical button. Drawn as a fan of radial segments whose
// length shrinks toward the angular ends (t^2 taper) so it comes to rounded
// points, leaving the dial's tick marks clear.
static void drawKeyCap(float center, uint16_t color) {
  for (float d = center - KEY_HALF; d <= center + KEY_HALF + 0.01f; d += 0.4f) {
    float t = (d - center) / KEY_HALF;                 // -1..1 across the cap
    float ro = RAD * (KEY_R_OUT - 0.09f * t * t);      // domed outer edge
    float ri = RAD * (KEY_R_IN + 0.06f * t * t);       // tapered inner edge
    float ix, iy, ox, oy;
    polar(ri, d, ix, iy);
    polar(ro, d, ox, oy);
    canvas.drawWideLine(ix, iy, ox, oy, 3, color);
  }
}

static void drawKeyCaps() {
  drawKeyCap(KEY_A_DEG, COL_YELLOW);
  drawKeyCap(KEY_B_DEG, COL_BLUE);
}

// One primary label on a key cap, out toward the wide outer edge.
static void drawKeyLabel(float deg, const String& label, uint16_t color) {
  float x, y;
  polar(RAD * KEY_LABEL_R, deg, x, y);
  gText(label, (int)y, &fonts::FreeSansBold9pt7b, color, middle_center, (int)x);
}

// Both caps with their primary labels (dark on yellow A, white on blue B).
static void drawKeys(const String& aLabel, const String& bLabel) {
  drawKeyCaps();
  drawKeyLabel(KEY_A_DEG, aLabel, COL_BLUE);
  drawKeyLabel(KEY_B_DEG, bLabel, COL_DIAL);
}

// Full Memovox dial: blue numerals, red batons, blue/red minute track, and the
// signature triangle — but no centered wordmark, so the timer can place the
// exercise / weight / time in the middle.
static void drawFullDial() {
  drawBareBezel();
  drawAlarmTriangle();

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
  canvas.setTextSize(1);  // guard against a scaled size leaking in from a menu
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

// A Memovox-style hand: a blue body with a white lume inlay running most of its
// length (inset from tip and hub), plus a short counterweight tail.
static void drawLumeHand(float deg, float lenFrac, float bodyW) {
  float tx, ty, bx, by;
  polar(RAD * lenFrac, deg, tx, ty);
  polar(RAD * 0.13f, deg + 180.0f, bx, by);
  canvas.drawWideLine(bx, by, tx, ty, bodyW, COL_BLUE);  // blue body + tail

  float ix, iy, ox, oy;
  polar(RAD * lenFrac * 0.20f, deg, ix, iy);
  polar(RAD * lenFrac * 0.82f, deg, ox, oy);
  canvas.drawWideLine(ix, iy, ox, oy, bodyW - 4, COL_DIAL);  // white lume inlay
}

// Digital readout in a small framed window so the hands don't blend into it.
static void drawReadout(int y, const String& text, uint16_t color) {
  canvas.fillRoundRect(CX - 74, y - 21, 148, 42, 8, COL_DIAL);
  canvas.drawRoundRect(CX - 74, y - 21, 148, 42, 8, COL_STEEL);
  gText(text, y, &fonts::FreeSansBold18pt7b, color);
}

static void present() {
  canvas.pushSprite(0, 0);
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------
static bool connectWifi() {
  drawMenuBg();
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
    exerciseLastWeight[exerciseCount] = ex["last_weight"] | -1;  // -1 if null
    exerciseLastTime[exerciseCount] = ex["last_time"] | -1;
    exerciseCount++;
  }
  if (exerciseCount == 0) {
    // Account has no exercises yet; offer a sensible default.
    exerciseNames[0] = "Stopwatch Set";
    exerciseIds[0] = "";
    exerciseLastWeight[0] = -1;
    exerciseLastTime[0] = -1;
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
  drawMenuBg();
  gText("Select Exercise", CY - RAD * 0.40f, &fonts::FreeSansBold9pt7b, COL_RED);
  gText(exerciseNames[exerciseIdx], CY, &fonts::FreeSansBold18pt7b, COL_BLUE);
  gText(String(exerciseIdx + 1) + " / " + String(exerciseCount),
        CY + RAD * 0.34f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  gText("hold A: prev", CY + RAD * 0.56f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  drawKeys("next", "select");
  present();
}

static void drawWeight() {
  drawMenuBg();
  gText("WEIGHT", CY - RAD * 0.40f, &fonts::FreeSansBold9pt7b, COL_RED);
  gText(String(weight), CY, &fonts::FreeSansBold24pt7b, COL_BLUE,
        middle_center, -1, 2);
  gText("hold A: minus", CY + RAD * 0.56f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  drawKeys("+", "OK");
  present();
}

// Time-under-load as a live Memovox watch face: a single red sweep (second) hand
// plus the digital stopwatch readout, with the set's exercise + weight on the dial.
static void drawTimer() {
  uint32_t shown = timerRunning ? (millis() - timerStartMs) : timerElapsedMs;
  float totalSec = shown / 1000.0f;

  drawFullDial();

  // Exercise name — sits halfway between the triangle and the dial center,
  // echoing the MEMOVOX line on the real watch.
  gText(exerciseNames[exerciseIdx], CY - RAD * 0.15f, &fonts::FreeSansBold12pt7b,
        COL_BLUE);

  // Only the second / sweep hand (no hour or minute hands).
  float secDeg = fmodf(totalSec, 60.0f) * 6.0f;
  drawHand(secDeg, 0.72f, 3, COL_RED);
  canvas.fillCircle(CX, CY, 8, COL_BLUE);
  canvas.fillCircle(CX, CY, 3, COL_STEEL);

  // Digital stopwatch readout (hero), in a framed window so the sweep hand
  // doesn't blend into it.
  char buf[16];
  snprintf(buf, sizeof(buf), "%lu:%02lu.%lu", (unsigned long)(totalSec) / 60,
           (unsigned long)(totalSec) % 60, (shown % 1000) / 100);
  drawReadout(CY + RAD * 0.20f, buf, timerRunning ? COL_RED : COL_BLUE);

  // Last logged session for this exercise (the target to beat).
  int lw = exerciseLastWeight[exerciseIdx], lt = exerciseLastTime[exerciseIdx];
  String prev = (lw >= 0) ? ("Last " + String(lw) + " x " + String(lt) + "s")
                          : "No history yet";
  gText(prev, CY + RAD * 0.40f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  gText("hold A: back", CY + RAD * 0.56f, &fonts::FreeSansBold9pt7b, COL_TRACK);

  // Keys with labels on the caps.
  drawKeys(timerRunning ? "stop" : "start", "save");
  present();
}

static void drawDone(bool ok) {
  drawMenuBg();
  gText(ok ? "SAVED" : "UPLOAD FAILED", CY - RAD * 0.20f,
        &fonts::FreeSansBold18pt7b, ok ? COL_BLUE : COL_RED);
  if (ok) {
    gText(exerciseNames[exerciseIdx], CY + RAD * 0.06f,
          &fonts::FreeSansBold12pt7b, COL_TRACK);
    gText(String(weight) + " x " + String((int)round(timerElapsedMs / 1000.0)) + "s",
          CY + RAD * 0.28f, &fonts::FreeSansBold18pt7b, COL_RED);
  }
  present();
}

// ---------------------------------------------------------------------------
// Hidden clock (easter egg) — RTC kept accurate by occasional NTP sync.
// ---------------------------------------------------------------------------
static void syncNtp() {
  if (WiFi.status() != WL_CONNECTED) return;
  configTzTime(TZ_INFO, NTP_SERVER);  // sets TZ + starts SNTP -> ESP32 system time
  struct tm ti;
  if (getLocalTime(&ti, 6000)) {
    // Persist to the hardware RTC (as UTC) so time survives a power cycle. This
    // is best-effort: if M5Unified doesn't drive this board's RTC it's a no-op,
    // and the clock still works from NTP-synced system time.
    time_t now = time(nullptr);
    M5.Rtc.setDateTime(gmtime(&now));
    ntpDone = true;
    lastNtpMs = millis();
    Serial.println("[ntp] synced");
  } else {
    Serial.println("[ntp] sync failed");
  }
}

// Full Memovox dial as a real clock: hour + minute + second hands from the
// (NTP-synced) system clock, "HitFlow.xyz" where the exercise sat, and the
// digital time below.
static void drawClock() {
  drawFullDial();
  gText("HitFlow.xyz", CY - RAD * 0.15f, &fonts::FreeSansBold12pt7b, COL_BLUE);

  struct tm ti;
  bool haveTime = getLocalTime(&ti, 50);
  int hh = haveTime ? ti.tm_hour : 0;
  int mm = haveTime ? ti.tm_min : 0;
  int ss = haveTime ? ti.tm_sec : 0;
  float hrDeg = ((hh % 12) + mm / 60.0f) * 30.0f;
  float minDeg = (mm + ss / 60.0f) * 6.0f;
  float secDeg = ss * 6.0f;

  drawLumeHand(hrDeg, 0.50f, 9);   // hour
  drawLumeHand(minDeg, 0.72f, 7);  // minute
  drawHand(secDeg, 0.78f, 2, COL_RED);  // thin second
  canvas.fillCircle(CX, CY, 8, COL_BLUE);
  canvas.fillCircle(CX, CY, 3, COL_STEEL);

  // Framed readout drawn last so its window masks the hands behind it.
  char buf[16];
  if (haveTime)
    snprintf(buf, sizeof(buf), "%2d:%02d:%02d", hh, mm, ss);
  else
    snprintf(buf, sizeof(buf), "--:--:--");
  drawReadout(CY + RAD * 0.20f, buf, COL_BLUE);

  gText("tap to exit", CY + RAD * 0.40f, &fonts::FreeSansBold9pt7b, COL_TRACK);
  present();
}

static void enterClock() {
  // Sync on first entry, or if it's been over an hour.
  if (!ntpDone || millis() - lastNtpMs > 3600000UL) {
    drawMenuBg();
    gText("Syncing time...", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
    present();
    syncNtp();
  }
  state = ST_CLOCK;
  drawClock();
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
    drawMenuBg();
    gText("WiFi failed", CY - 16, &fonts::FreeSansBold18pt7b, COL_RED);
    gText("Check WIFI_SSID / WIFI_PASS", CY + 20, &fonts::FreeSansBold9pt7b, COL_TRACK);
    present();
    return;
  }

  // Set the timezone, start background NTP, and seed system time from the
  // hardware RTC so the hidden clock has time even before its first sync.
  configTzTime(TZ_INFO, NTP_SERVER);
  M5.Rtc.setSystemTimeFromRtc();

  if (deviceToken.isEmpty()) {
    if (requestPairing()) {
      drawPairingScreen();
      state = ST_PAIRING;
    } else {
      drawMenuBg();
      gText("Pairing failed", CY - 24, &fonts::FreeSansBold18pt7b, COL_RED);
      gText("API " + String(lastHttpCode), CY + 8, &fonts::FreeSansBold12pt7b, COL_TRACK);
      gText("Restart to retry", CY + 34, &fonts::FreeSansBold9pt7b, COL_TRACK);
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
          drawMenuBg();
          gText("Waiting for link", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
          present();
        }
      }
      break;
    }

    case ST_PICK:
      if (M5.BtnA.wasClicked()) {
        // Track the last three A taps; three within 700ms opens the clock.
        aTaps[0] = aTaps[1];
        aTaps[1] = aTaps[2];
        aTaps[2] = millis();
        if (aTaps[0] && aTaps[2] - aTaps[0] < 700) {
          aTaps[0] = aTaps[1] = aTaps[2] = 0;
          enterClock();
        } else {
          exerciseIdx = (exerciseIdx + 1) % exerciseCount;
          drawPick();
        }
      } else if (M5.BtnA.wasHold()) {
        exerciseIdx = (exerciseIdx - 1 + exerciseCount) % exerciseCount;
        drawPick();
      } else if (M5.BtnB.wasClicked()) {
        weight = DEFAULT_WEIGHT;
        state = ST_WEIGHT;
        drawWeight();
      }
      break;

    case ST_CLOCK:
      if (M5.BtnA.wasClicked() || M5.BtnB.wasClicked()) {
        state = ST_PICK;
        drawPick();
      } else {
        static uint32_t lastClk = 0;
        if (millis() - lastClk > 250) {  // tick the second hand
          lastClk = millis();
          drawClock();
        }
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
      if (M5.BtnA.wasHold()) {
        // Hold A: abandon this set and go back to exercise select.
        timerRunning = false;
        timerElapsedMs = 0;
        state = ST_PICK;
        drawPick();
      } else if (M5.BtnA.wasClicked()) {
        if (timerRunning) {
          timerElapsedMs = millis() - timerStartMs;
          timerRunning = false;
          beep();  // stop
        } else {
          timerStartMs = millis();
          timerRunning = true;
          passedPrevBeeped = false;  // arm the "beat last time" beep
          beep();  // start
        }
        drawTimer();
      } else if (M5.BtnB.wasClicked() && !timerRunning && timerElapsedMs > 0) {
        state = ST_SENDING;
        drawMenuBg();
        gText("Saving...", CY, &fonts::FreeSansBold12pt7b, COL_BLUE);
        present();
      } else if (timerRunning) {
        // Distinct beep the moment we pass the previous session's time.
        int lastT = exerciseLastTime[exerciseIdx];
        if (!passedPrevBeeped && lastT > 0 &&
            (millis() - timerStartMs) >= (uint32_t)lastT * 1000) {
          passedPrevBeeped = true;
          beepPassedPrev();
        }
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
