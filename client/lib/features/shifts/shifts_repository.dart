import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../auth/auth_controller.dart';

final shiftsRepositoryProvider = Provider<ShiftsRepository>((ref) {
  return ShiftsRepository(ref.watch(apiClientProvider));
});

class ShiftsRepository {
  ShiftsRepository(this.client);

  final ApiClient client;

  Future<List<Map<String, dynamic>>> listTemplates(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/shifts/templates',
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>> listSchedule(
    String branchId, {
    required String from,
    required String to,
  }) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/shifts/schedule',
      queryParameters: {'from': from, 'to': to},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>> mySchedule(
    String branchId, {
    required String from,
    required String to,
  }) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/shifts/me',
      queryParameters: {'from': from, 'to': to},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>> listEmployees(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/employees',
      queryParameters: {'page': 1, 'limit': 100, 'status': 'active'},
    );
    final data = response.data;
    if (data is! Map || data['items'] is! List) return const [];
    return (data['items'] as List)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> createTemplate(
    String branchId, {
    required String code,
    required String nameAr,
    required String startTime,
    required String endTime,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/shifts/templates',
      data: {
        'code': code,
        'nameAr': nameAr,
        'startTime': startTime,
        'endTime': endTime,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> createAssignment(
    String branchId, {
    required String employeeId,
    required String shiftId,
    required String workDate,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/shifts/assignments',
      data: {
        'employeeId': employeeId,
        'shiftId': shiftId,
        'workDate': workDate,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> publish(
    String branchId, {
    required String from,
    required String to,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/shifts/publish',
      data: {'from': from, 'to': to},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
}
