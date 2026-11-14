import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../features/auth/auth_controller.dart';

final employeeRecordsRepositoryProvider =
    Provider<EmployeeRecordsRepository>((ref) {
  return EmployeeRecordsRepository(ref.watch(apiClientProvider));
});

class EmployeeRecordsRepository {
  EmployeeRecordsRepository(this.client);

  final ApiClient client;

  String _path(String branchId, String employeeId) =>
      'branches/$branchId/employees/$employeeId/records';

  Future<Map<String, dynamic>> getProfile(
    String branchId,
    String employeeId,
  ) async {
    final response = await client.dio.get<dynamic>(
      '${_path(branchId, employeeId)}/profile',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> upsertProfile(
    String branchId,
    String employeeId,
    Map<String, dynamic> changes,
  ) async {
    final response = await client.dio.post<dynamic>(
      '${_path(branchId, employeeId)}/profile',
      data: changes,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<Map<String, dynamic>>> listDocuments(
    String branchId,
    String employeeId,
  ) async {
    final response = await client.dio.get<dynamic>(
      '${_path(branchId, employeeId)}/documents',
    );
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<List<Map<String, dynamic>>> listContracts(
    String branchId,
    String employeeId,
  ) async {
    final response = await client.dio.get<dynamic>(
      '${_path(branchId, employeeId)}/contracts',
    );
    final data = response.data;
    if (data is! List) return const [];
    return data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<Map<String, dynamic>> createContract(
    String branchId,
    String employeeId,
    Map<String, dynamic> contract,
  ) async {
    final response = await client.dio.post<dynamic>(
      '${_path(branchId, employeeId)}/contracts',
      data: contract,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<Map<String, dynamic>>> listHistory(
    String branchId,
    String employeeId,
  ) async {
    final response = await client.dio.get<dynamic>(
      '${_path(branchId, employeeId)}/history',
      queryParameters: {'page': 1, 'limit': 100},
    );
    final data = response.data;
    if (data is! Map || data['items'] is! List) return const [];
    return (data['items'] as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }
}
