import 'package:flutter_test/flutter_test.dart';

import '../lib/core/network/api_client.dart';
import '../lib/features/auth/auth_controller.dart';
import '../lib/features/auth/auth_repository.dart';

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository() : super(ApiClient(baseUrl: 'http://localhost/api/v1/'));

  String? refreshToken = 'refresh-token';
  bool forcePasswordChange = false;
  Map<String, dynamic> profile = {
    'id': 'user-1',
    'username': 'employee',
    'roles': [
      {'code': 'EMPLOYEE', 'branchId': 'branch-1'},
    ],
  };
  bool passwordChanged = false;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<Map<String, dynamic>> refresh(String token) async {
    return {'mustChangePassword': forcePasswordChange};
  }

  @override
  Future<Map<String, dynamic>> me() async => profile;

  @override
  Future<void> clearTokens() async {
    refreshToken = null;
  }

  @override
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    return {
      'accessToken': 'access-token',
      'refreshToken': 'refresh-token',
      'user': {'id': 'user-1', 'username': username, 'mustChangePassword': forcePasswordChange},
    };
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    passwordChanged = true;
    forcePasswordChange = false;
  }

  @override
  Future<void> logout() async {
    refreshToken = null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restores a valid session and role profile', () async {
    final repository = FakeAuthRepository();
    final controller = AuthController(repository);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(controller.state.isAuthenticated, isTrue);
    expect(controller.state.user?['username'], 'employee');
    expect(controller.state.mustChangePassword, isFalse);
    controller.dispose();
  });

  test('routes a restored temporary-password account to password rotation', () async {
    final repository = FakeAuthRepository()..forcePasswordChange = true;
    final controller = AuthController(repository);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(controller.state.isAuthenticated, isTrue);
    expect(controller.state.mustChangePassword, isTrue);
    controller.dispose();
  });

  test('successful password rotation loads the authenticated profile', () async {
    final repository = FakeAuthRepository()..forcePasswordChange = true;
    final controller = AuthController(repository);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    await controller.changePassword('TemporaryA1!', 'NewPasswordA1!');

    expect(repository.passwordChanged, isTrue);
    expect(controller.state.mustChangePassword, isFalse);
    expect(controller.state.user?['username'], 'employee');
    controller.dispose();
  });

  test('failed session restoration clears local credentials', () async {
    final repository = FakeAuthRepository()..refreshToken = null;
    final controller = AuthController(repository);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(controller.state.isAuthenticated, isFalse);
    expect(repository.refreshToken, isNull);
    controller.dispose();
  });
}
