class ApiConstants {
  static const String serverUrl = "http://192.168.1.181:8000";
  static const String baseUrl   = "$serverUrl/api";

  // Laravel Reverb (WebSocket) config
  static const String reverbHost   = "192.168.1.181";
  static const int    reverbPort   = 8080;
  static const String reverbAppKey = "p4gucxacg2eug5fsjcpr";
  static const String reverbScheme = "ws"; // ws for http, wss for https
}
