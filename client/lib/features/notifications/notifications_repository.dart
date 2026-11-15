import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.watch(apiClientProvider));
});

class NotificationsRepository {
  NotificationsRepository(this.client);

  final ApiClient client;

  Future<List<Map<String, dynamic>>> listMine() async {
    final response = await client.dio.get<dynamic>(
      'notifications/me',
      queryParameters: const {'limit': 50, 'offset': 0},
    );
    final data = response.data;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: true);
  }

  Future<void> markRead(String id) async {
    await client.dio.patch<dynamic>('notifications/me/$id/read');
  }

  Future<void> markAllRead() async {
    await client.dio.post<dynamic>('notifications/me/read-all');
  }
}
