import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import 'auth_repository.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  ref.onDispose(() => client.dio.close(force: true));
  return client;
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.watch(authRepositoryProvider));
});

class AuthState {
  const AuthState({
    required this.isLoading,
    required this.isAuthenticated,
    this.mustChangePassword = false,
    this.user,
    this.error,
  });

  const AuthState.loading()
      : isLoading = true,
        isAuthenticated = false,
        mustChangePassword = false,
        user = null,
        error = null;

  const AuthState.signedOut({String? error})
      : isLoading = false,
        isAuthenticated = false,
        mustChangePassword = false,
        user = null,
        error = error;

  final bool isLoading;
  final bool isAuthenticated;
  final bool mustChangePassword;
  final Map<String, dynamic>? user;
  final String? error;

  AuthState copyWith({
    bool? isLoading,
    bool? isAuthenticated,
    bool? mustChangePassword,
    Map<String, dynamic>? user,
    bool clearUser = false,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      user: clearUser ? null : (user ?? this.user),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this.repository) : super(const AuthState.loading()) {
    restoreSession();
  }

  final AuthRepository repository;

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        final message = data['message'];
        if (message is List) return message.join('\n');
        return message.toString();
      }
      if (error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout) {
        return 'تعذر الاتصال بالخادم. تحقق من عنوان API والاتصال.';
      }
    }
    return error.toString();
  }

  Future<void> restoreSession() async {
    try {
      final refreshToken = await repository.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        state = const AuthState.signedOut();
        return;
      }
      final refreshed = await repository.refresh(refreshToken);
      final mustChange = refreshed['mustChangePassword'] == true;
      if (mustChange) {
        state = const AuthState(
          isLoading: false,
          isAuthenticated: true,
          mustChangePassword: true,
        );
        return;
      }
      final user = await repository.me();
      state = AuthState(
        isLoading: false,
        isAuthenticated: true,
        user: user,
      );
    } catch (error) {
      await repository.clearTokens();
      state = AuthState.signedOut(error: _errorMessage(error));
    }
  }

  Future<void> login(String username, String password) async {
    state = const AuthState.loading();
    try {
      final response = await repository.login(
        username: username.trim(),
        password: password,
      );
      final user = response['user'] is Map
          ? Map<String, dynamic>.from(response['user'] as Map)
          : <String, dynamic>{};
      final mustChange = user['mustChangePassword'] == true;
      if (mustChange) {
        state = AuthState(
          isLoading: false,
          isAuthenticated: true,
          mustChangePassword: true,
          user: user,
        );
        return;
      }
      final profile = await repository.me();
      state = AuthState(
        isLoading: false,
        isAuthenticated: true,
        user: profile,
      );
    } catch (error) {
      state = AuthState.signedOut(error: _errorMessage(error));
    }
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await repository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      final profile = await repository.me();
      state = AuthState(
        isLoading: false,
        isAuthenticated: true,
        user: profile,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        error: _errorMessage(error),
      );
    }
  }

  Future<void> logout() async {
    await repository.logout();
    state = const AuthState.signedOut();
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}
