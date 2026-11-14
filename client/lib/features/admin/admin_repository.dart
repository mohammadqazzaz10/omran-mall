import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../features/auth/auth_controller.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(apiClientProvider));
});

class AdminRepository {
  AdminRepository(this.client);
  final ApiClient client;

  Future<List<Map<String, dynamic>>> listBranches() async {
    final response = await client.dio.get<dynamic>('admin/branches');
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>> createBranch({
    required String code,
    required String nameAr,
  }) async {
    final response = await client.dio.post<dynamic>(
      'admin/branches',
      data: {'code': code, 'nameAr': nameAr},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> updateBranch(
    String branchId,
    Map<String, dynamic> changes,
  ) async {
    final response = await client.dio.patch<dynamic>(
      'admin/branches/' + branchId,
      data: changes,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> listUsers({
    String? search,
    String? active,
    int page = 1,
    int limit = 25,
  }) async {
    final response = await client.dio.get<dynamic>(
      'admin/users',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (active != null) 'active': active,
        'page': page,
        'limit': limit,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> createUser({
    required String username,
    required String roleCode,
    required List<String> branchIds,
    String? employeeId,
    String? primaryBranchId,
  }) async {
    final response = await client.dio.post<dynamic>(
      'admin/users',
      data: {
        'username': username,
        'roleCode': roleCode,
        'branchIds': branchIds,
        if (employeeId != null && employeeId.isNotEmpty)
          'employeeId': employeeId,
        if (primaryBranchId != null && primaryBranchId.isNotEmpty)
          'primaryBranchId': primaryBranchId,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<Map<String, dynamic>>> listRoles() async {
    final response = await client.dio.get<dynamic>('admin/roles');
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<List<Map<String, dynamic>>> listPermissions() async {
    final response = await client.dio.get<dynamic>('admin/permissions');
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }
}
