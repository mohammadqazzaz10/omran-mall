import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/secure_token_store.dart';

class AuthRepository {
  AuthRepository(this.client) : tokenStore = client.tokenStore;

  final ApiClient client;
  final SecureTokenStore tokenStore;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await client.dio.post<dynamic>(
      '/auth/login',
      data: {'username': username, 'password': password},
    );
    final data = _map(response.data);
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    if (accessToken == null || refreshToken == null) {
      throw StateError('The server returned an incomplete login response');
    }
    final user = _map(data['user']);
    final mustChange = user['mustChangePassword'] == true;
    await tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      mustChangePassword: mustChange,
    );
    return data;
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) async {
    final response = await client.dio.post<dynamic>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = _map(response.data);
    final accessToken = data['accessToken'] as String?;
    final rotatedRefresh = data['refreshToken'] as String?;
    if (accessToken == null || rotatedRefresh == null) {
      throw StateError('The server returned an incomplete refresh response');
    }
    await tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: rotatedRefresh,
      mustChangePassword: data['mustChangePassword'] == true,
    );
    return data;
  }

  Future<Map<String, dynamic>> me() async {
    final response = await client.dio.get<dynamic>('/auth/me');
    return _map(response.data);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await client.dio.post<dynamic>(
      '/auth/change-password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
    await tokenStore.saveTokens(
      accessToken: (await tokenStore.readAccessToken()) ?? '',
      refreshToken: (await tokenStore.readRefreshToken()) ?? '',
      mustChangePassword: false,
    );
  }

  Future<void> logout() async {
    try {
      await client.dio.post<dynamic>('/auth/logout');
    } on DioException {
      // Local credentials are always cleared, even when the server is offline.
    } finally {
      await tokenStore.clear();
    }
  }

  Future<List<Map<String, dynamic>>> sessions() async {
    final response = await client.dio.get<dynamic>('/auth/sessions');
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => _map(item)).toList(growable: false);
  }

  Future<void> revokeSession(String sessionId) async {
    await client.dio.post<dynamic>('/auth/sessions/' + sessionId + '/revoke');
  }

  Future<String?> readRefreshToken() => tokenStore.readRefreshToken();
  Future<void> clearTokens() => tokenStore.clear();
}
