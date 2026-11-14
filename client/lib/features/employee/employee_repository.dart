import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';

final employeeRepositoryProvider = Provider<EmployeeRepository>((ref) {
  return EmployeeRepository(ref.watch(apiClientProvider));
});

class EmployeeRepository {
  EmployeeRepository(this.client);
  final dynamic client;

  Future<Map<String, dynamic>> getOwnProfile() async {
    final response = await client.dio.get<dynamic>('/me/employee');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> updateOwnProfile(
    Map<String, dynamic> changes,
  ) async {
    final response = await client.dio.patch<dynamic>(
      '/me/employee',
      data: changes,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
}
