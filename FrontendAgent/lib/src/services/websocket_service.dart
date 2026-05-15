import 'dart:convert';
import 'dart:async';
import 'package:dart_pusher_channels/dart_pusher_channels.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';
import '../constants/api_constants.dart';
import 'notification_service.dart';

typedef OnInventaireStatusChanged = void Function(Map<String, dynamic> data);
typedef OnScanReceived            = void Function(Map<String, dynamic> data);
typedef OnInventaireAssigned      = void Function(Map<String, dynamic> data);

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  PusherChannelsClient? _pusher;
  bool _connected = false;
  final Map<String, Channel> _channels = {};
  StreamSubscription? _connectionSubscription;

  // Completer to signal when the connection is ready
  Completer<void>? _connectionCompleter;

  Future<void> connect() async {
    // Already connected — nothing to do
    if (_connected && _pusher != null) return;

    // Connection already in progress — wait for it
    if (_connectionCompleter != null && !_connectionCompleter!.isCompleted) {
      return _connectionCompleter!.future;
    }

    _connectionCompleter = Completer<void>();

    final options = PusherChannelsOptions.fromHost(
      host: ApiConstants.reverbHost,
      port: ApiConstants.reverbPort,
      scheme: ApiConstants.reverbScheme,
      key: ApiConstants.reverbAppKey,
      shouldSupplyMetadataQueries: true,
    );

    try {
      _pusher = PusherChannelsClient.websocket(
        options: options,
        connectionErrorHandler: (error, trace, refresh) {
          debugPrint('Pusher connection error: $error');
          _connected = false;
          // Retry after 5 seconds
          Future.delayed(const Duration(seconds: 5), refresh);
        },
      );

      _connectionSubscription = _pusher!.onConnectionEstablished.listen((_) {
        debugPrint('✅ WebSocket connected to Reverb');
        _connected = true;
        if (!(_connectionCompleter?.isCompleted ?? true)) {
          _connectionCompleter!.complete();
        }
      });

      _pusher!.connect();

      // Timeout after 10 seconds to avoid hanging forever
      await _connectionCompleter!.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('⚠️ WebSocket connection timed out');
          if (!(_connectionCompleter?.isCompleted ?? true)) {
            _connectionCompleter!.complete(); // continue anyway
          }
        },
      );
    } catch (e) {
      debugPrint('❌ Error creating WebSocket client: $e');
      _connected = false;
      if (!(_connectionCompleter?.isCompleted ?? true)) {
        _connectionCompleter!.complete();
      }
    }
  }

  Future<void> disconnect() async {
    _channels.clear();
    await _connectionSubscription?.cancel();
    _pusher?.disconnect();
    _pusher = null;
    _connected = false;
    _connectionCompleter = null;
  }

  Future<EndpointAuthorizableChannelTokenAuthorizationDelegate<PrivateChannelAuthorizationData>> _getAuthDelegate() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    return EndpointAuthorizableChannelTokenAuthorizationDelegate.forPrivateChannel(
      authorizationEndpoint: Uri.parse('${ApiConstants.baseUrl}/broadcasting/auth'),
      headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      },
    );
  }

  Future<void> subscribeToAgentChannel(
    int agentId, {
    OnInventaireStatusChanged? onStatusChanged,
    OnInventaireAssigned? onAssigned,
  }) async {
    await connect();

    final channelName = 'private-agent.$agentId';
    if (_channels.containsKey(channelName)) return;
    if (_pusher == null) return;

    try {
      final channel = _pusher!.privateChannel(
        channelName,
        authorizationDelegate: await _getAuthDelegate(),
      );

      channel.bind('inventaire.status.updated').listen((event) {
        if (event.data != null) onStatusChanged?.call(json.decode(event.data!));
      });

      channel.bind('inventaire.assigned').listen((event) {
        if (event.data != null) {
          final data = json.decode(event.data!);
          onAssigned?.call(data);
          
          final inv = data['inventaire'];
          NotificationService().showNotification(
            id: (inv['id_inventaire'] ?? DateTime.now().millisecond) as int,
            title: 'Nouvel Inventaire',
            body: 'Vous avez été assigné à: ${inv['titre'] ?? inv['site']}',
            payload: 'inventaire_${inv['id_inventaire']}',
          );
        }
      });

      channel.subscribe();
      _channels[channelName] = channel;
      debugPrint('📡 Subscribed to $channelName');
    } catch (e) {
      debugPrint('❌ Failed to subscribe to $channelName: $e');
    }
  }

  Future<void> subscribeToInventaireChannel(
    int inventaireId, {
    OnScanReceived? onScan,
    Function(Map<String, dynamic>)? onAgentStatus,
    Function(Map<String, dynamic>)? onNoteReceived,
    Function(Map<String, dynamic>)? onNoteUpdated,
    Function(Map<String, dynamic>)? onNoteDeleted,
  }) async {
    await connect();

    final channelName = 'private-inventaire.$inventaireId';
    if (_channels.containsKey(channelName)) return;
    if (_pusher == null) return;

    try {
      final channel = _pusher!.privateChannel(
        channelName,
        authorizationDelegate: await _getAuthDelegate(),
      );

      channel.bind('scan.enregistre').listen((event) {
        debugPrint('🔔 WebSocket: scan.enregistre received: ${event.data}');
        if (event.data != null) onScan?.call(json.decode(event.data!));
      });

      channel.bind('agent.status.updated').listen((event) {
        debugPrint('👥 WebSocket: agent.status.updated received: ${event.data}');
        if (event.data != null) onAgentStatus?.call(json.decode(event.data!));
      });

      channel.bind('note.added').listen((event) {
        debugPrint('📝 WebSocket: note.added received: ${event.data}');
        if (event.data != null) {
          final data = json.decode(event.data!);
          onNoteReceived?.call(data);

          final note = data['note'];
          final sender = note['user'];
          NotificationService().showNotification(
            id: (note['id_note'] ?? DateTime.now().millisecond) as int,
            title: 'Nouvelle Note',
            body: '${sender['nom']}: ${note['contenu']}',
            payload: 'note_${note['id_inventaire']}',
          );
        }
      });

      channel.bind('note.updated').listen((event) {
        debugPrint('📝 WebSocket: note.updated received: ${event.data}');
        if (event.data != null) onNoteUpdated?.call(json.decode(event.data!));
      });

      channel.bind('note.deleted').listen((event) {
        debugPrint('📝 WebSocket: note.deleted received: ${event.data}');
        if (event.data != null) onNoteDeleted?.call(json.decode(event.data!));
      });

      channel.subscribe();
      _channels[channelName] = channel;
      debugPrint('📡 Subscribed to $channelName');
    } catch (e) {
      debugPrint('❌ Failed to subscribe to $channelName: $e');
    }
  }

  void unsubscribe(String channelName) {
    _channels[channelName]?.unsubscribe();
    _channels.remove(channelName);
  }

  bool get isConnected => _connected;
}
