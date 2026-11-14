import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../auth/auth_controller.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(ref.watch(apiClientProvider));
});

class AttendanceRepository {
  AttendanceRepository(this.client);

  final ApiClient client;

  Future<List<Map<String, dynamic>>> myRecords(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/attendance/me',
      queryParameters: const {'limit': 30},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> checkIn(String branchId) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/check-in',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> checkOut(String branchId) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/check-out',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
}
