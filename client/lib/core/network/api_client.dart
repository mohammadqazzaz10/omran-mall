import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'secure_token_store.dart';

class ApiClient {
  ApiClient({
    SecureTokenStore? tokenStore,
    String? baseUrl,
  })  : tokenStore = tokenStore ?? SecureTokenStore(),
        baseUrl = baseUrl ?? _defaultBaseUrl() {
    dio = Dio(
      BaseOptions(
        baseUrl: this.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 25),
        sendTimeout: const Duration(seconds: 25),
        headers: const {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await this.tokenStore.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer ' + token;
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final path = error.requestOptions.path;
          final isAuthEndpoint = path.contains('/auth/login') ||
              path.contains('/auth/refresh') ||
              path.contains('/auth/change-password');
          final alreadyRetried =
              error.requestOptions.extra['authRetry'] == true;
          if (error.response?.statusCode != 401 ||
              isAuthEndpoint ||
              alreadyRetried) {
            handler.next(error);
            return;
          }

          final nextToken = await _rotateRefreshToken();
          if (nextToken == null) {
            handler.next(error);
            return;
          }

          final request = error.requestOptions;
          final retryOptions = request.copyWith(
            headers: {
              ...request.headers,
              'Authorization': 'Bearer ' + nextToken,
            },
            extra: {...request.extra, 'authRetry': true},
          );
          try {
            final response = await dio.fetch<dynamic>(retryOptions);
            handler.resolve(response);
          } on DioException catch (retryError) {
            handler.next(retryError);
          } catch (_) {
            handler.next(error);
          }
        },
      ),
    );
  }

  final SecureTokenStore tokenStore;
  final String baseUrl;
  late final Dio dio;
  Future<String?>? _refreshInFlight;

  static String _defaultBaseUrl() {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    if (kIsWeb) return 'http://localhost:4000/api/v1';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }

  Future<String?> _rotateRefreshToken() {
    if (_refreshInFlight != null) return _refreshInFlight!;
    _refreshInFlight = _performRefresh();
    return _refreshInFlight!.whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _performRefresh() async {
    try {
      final refreshToken = await tokenStore.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        await tokenStore.clear();
        return null;
      }
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data ?? <String, dynamic>{};
      final access = data['accessToken'] as String?;
      final rotatedRefresh = data['refreshToken'] as String?;
      if (access == null || rotatedRefresh == null) {
        await tokenStore.clear();
        return null;
      }
      await tokenStore.saveTokens(
        accessToken: access,
        refreshToken: rotatedRefresh,
        mustChangePassword: data['mustChangePassword'] == true,
      );
      return access;
    } catch (_) {
      await tokenStore.clear();
      return null;
    }
  }
}
