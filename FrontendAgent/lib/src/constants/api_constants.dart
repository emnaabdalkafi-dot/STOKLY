class ApiConstants {
  static const String serverUrl = "https://stokly-production.up.railway.app";
  static const String baseUrl   = "$serverUrl/api";

  // Laravel Reverb (WebSocket) config
  static const String reverbHost   = "stokly-production.up.railway.app";
  static const int    reverbPort   = 443;
  static const String reverbAppKey = "p4gucxacg2eug5fsjcpr";
  static const String reverbScheme = "wss"; // ws for http, wss for https
}
