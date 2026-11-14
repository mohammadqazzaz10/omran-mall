import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../auth/auth_controller.dart';

final breaksRepositoryProvider = Provider<BreaksRepository>((ref) {
  return BreaksRepository(ref.watch(apiClientProvider));
});

class BreaksRepository {
  BreaksRepository(this.client);

  final ApiClient client;

  Future<List<Map<String, dynamic>>> listTypes(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/breaks/types',
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> myStatus(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/breaks/me',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> live(String branchId) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/breaks/live',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<Map<String, dynamic>>> listRequests(
    String branchId, {
    String? status,
  }) async {
    final response = await client.dio.get<dynamic>(
      'branches/$branchId/breaks/requests',
      queryParameters: {if (status != null) 'status': status},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> requestBreak({
    required String branchId,
    required String breakTypeId,
    int? durationMinutes,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/breaks/requests',
      data: {
        'breakTypeId': breakTypeId,
        if (durationMinutes != null) 'requestedDurationMinutes': durationMinutes,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> endSession({
    required String branchId,
    required String sessionId,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/breaks/sessions/$sessionId/end',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> approveRequest({
    required String branchId,
    required String requestId,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/breaks/requests/$requestId/approve',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> rejectRequest({
    required String branchId,
    required String requestId,
    required String reason,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/breaks/requests/$requestId/reject',
      data: {'reason': reason},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> createType({
    required String branchId,
    required Map<String, dynamic> data,
  }) async {
    final response = await client.dio.post<dynamic>(
      'branches/$branchId/breaks/types',
      data: data,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> updateType({
    required String branchId,
    required String typeId,
    required Map<String, dynamic> data,
  }) async {
    final response = await client.dio.patch<dynamic>(
      'branches/$branchId/breaks/types/$typeId',
      data: data,
    );
    return Map<String, dynamic>.from(response.data as Map);
  }
}
