// Copy this file to `config.h` and fill in your values.
// `config.h` is git-ignored so your WiFi credentials never get committed.
#pragma once

// --- WiFi -------------------------------------------------------------------
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASS "your-wifi-password"

// --- Hit Flow API -----------------------------------------------------------
// Base URL of the device-api Netlify function. Actions are appended as
// ?action=pair|status|session. For local testing against `netlify dev`, point
// this at your machine's LAN IP, e.g. "http://192.168.1.50:8888/.netlify/functions/device-api".
#define API_BASE "https://hitflow.xyz/.netlify/functions/device-api"

// Name shown for this device in the web app's Profile > Connected Devices list.
#define DEVICE_NAME "M5 Stopwatch"

// Starting weight (in whatever unit you log in the app) and the +/- step size.
#define DEFAULT_WEIGHT 50
#define WEIGHT_STEP 5

// Auto-progression: when a set's time-under-load reaches this many seconds, the
// next default weight is bumped by WEIGHT_STEP.
#define TARGET_TUL 90

// --- Clock (hidden mode: triple-tap A) --------------------------------------
// NTP server and POSIX timezone string for the clock's periodic time sync.
// Examples: US Eastern "EST5EDT,M3.2.0,M11.1.0", US Pacific "PST8PDT,M3.2.0,M11.1.0",
// UK "GMT0BST,M3.5.0/1,M10.5.0", Central Europe "CET-1CEST,M3.5.0,M10.5.0/3".
#define NTP_SERVER "pool.ntp.org"
#define TZ_INFO "EST5EDT,M3.2.0,M11.1.0"
