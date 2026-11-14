import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessKey = 'omran.access_token';
  static const _refreshKey = 'omran.refresh_token';
  static const _mustChangeKey = 'omran.must_change_password';

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

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
    return (await _storage.read(key: _mustChangeKey)) == 'true';
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _mustChangeKey);
  }
}
