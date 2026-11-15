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

  Future<List<Map<String, dynamic>>> branchRecords(
    String branchId,
    String workDate,
  ) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/attendance',
      queryParameters: {'workDate': workDate},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> geofenceStatus(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/attendance/qr/geofence',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
  Future<Map<String, dynamic>> createQrChallenge(String branchId) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/qr/challenges',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> checkInWithQr(
    String branchId,
    String qrToken, {
    double? latitude,
    double? longitude,
    double? accuracyMeters,
  }) async {
    final payload = <String, dynamic>{'qrToken': qrToken};
    if (latitude != null && longitude != null && accuracyMeters != null) {
      payload
        ..['latitude'] = latitude
        ..['longitude'] = longitude
        ..['accuracyMeters'] = accuracyMeters;
    }
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/check-in/qr',
      data: payload,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> checkIn(String branchId) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/check-in',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> checkOut(
    String branchId, {
    double? latitude,
    double? longitude,
    double? accuracyMeters,
  }) async {
    final payload = <String, dynamic>{};
    if (latitude != null && longitude != null && accuracyMeters != null) {
      payload
        ..['latitude'] = latitude
        ..['longitude'] = longitude
        ..['accuracyMeters'] = accuracyMeters;
    }
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/attendance/check-out',
      data: payload,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
}
