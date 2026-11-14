import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

import '../../core/network/api_client.dart';
import '../auth/auth_controller.dart';

final breaksRealtimeProvider = Provider<BreaksRealtimeService>((ref) {
  final service = BreaksRealtimeService(ref.watch(apiClientProvider));
  ref.onDispose(service.dispose);
  return service;
});

class BreaksRealtimeService {
  BreaksRealtimeService(this.client);

  final ApiClient client;
  final StreamController<Map<String, dynamic>> _events =
      StreamController<Map<String, dynamic>>.broadcast();

  IO.Socket? _socket;
  Timer? _refreshTimer;
  String? _connectedToken;

  Stream<Map<String, dynamic>> get events => _events.stream;

  Future<void> connect() async {
    if (_socket?.connected == true) return;

    try {
      // This request refreshes an expired access token through ApiClient's
      // interceptor before the socket handshake is attempted.
      await client.dio.get<dynamic>('auth/me');
    } catch (_) {
      return;
    }

    final token = await client.tokenStore.readAccessToken();
    if (token == null || token.isEmpty) return;

    final apiUri = Uri.parse(client.baseUrl);
    final origin = Uri(
      scheme: apiUri.scheme,
      host: apiUri.host,
      port: apiUri.hasPort ? apiUri.port : null,
    ).toString();

    _connectedToken = token;
    _socket?.dispose();
    _socket = IO.io(
      '$origin/breaks',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .build(),
    );

    for (final event in [
      'break_started',
      'break_ended',
      'break_alert',
    ]) {
      _socket!.on(event, (data) {
        if (data is Map) {
          _events.add(Map<String, dynamic>.from(data));
        }
      });
    }

    _socket!.onConnectError((_) {
      unawaited(_refreshSocketToken());
    });
    _socket!.connect();

    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(
      const Duration(minutes: 10),
      (_) => unawaited(_refreshSocketToken()),
    );
  }

  Future<void> _refreshSocketToken() async {
    try {
      await client.dio.get<dynamic>('auth/me');
      final token = await client.tokenStore.readAccessToken();
      if (token == null || token.isEmpty || token == _connectedToken) return;
      final socket = _socket;
      if (socket == null) return;
      _connectedToken = token;
      socket.auth = {'token': token};
      socket.disconnect();
      socket.connect();
    } catch (_) {
      // API authentication owns token expiry and local logout behavior.
    }
  }

  void dispose() {
    _refreshTimer?.cancel();
    _socket?.dispose();
    _socket = null;
    _events.close();
  }
}
