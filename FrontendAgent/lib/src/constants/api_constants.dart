class ApiConstants {
  static const String serverUrl = "https://tinnipax.api.azartech.io";
  static const String baseUrl   = "$serverUrl/api";

  // Laravel Reverb (WebSocket) config
  static const String reverbHost   = "tinnipax.api.azartech.io";
  static const int    reverbPort   = 443;
  static const String reverbAppKey = "p4gucxacg2eug5fsjcpr";
  static const String reverbScheme = "wss"; // ws for http, wss for https
}
