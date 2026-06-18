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
