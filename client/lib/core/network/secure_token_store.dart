import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessKey = 'omran.access_token';
  static const _refreshKey = 'omran.refresh_token';
  static const _mustChangeKey = 'omran.must_change_password';

  Future<String?> readAccessToken() async {
    try {
      return await _storage.read(key: _accessKey);
    } catch (_) {
      return null;
    }
  }

  Future<String?> readRefreshToken() async {
    try {
      return await _storage.read(key: _refreshKey);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required bool mustChangePassword,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
    await _storage.write(
      key: _mustChangeKey,
      value: mustChangePassword ? 'true' : 'false',
    );
  }

  Future<bool> readMustChangePassword() async {
    try {
      return (await _storage.read(key: _mustChangeKey)) == 'true';
    } catch (_) {
      return false;
    }
  }

  Future<void> clear() async {
    try {
      await _storage.delete(key: _accessKey);
      await _storage.delete(key: _refreshKey);
      await _storage.delete(key: _mustChangeKey);
    } catch (_) {
      // Platform storage may be unavailable in a browser privacy context or widget test.
    }
  }
}
