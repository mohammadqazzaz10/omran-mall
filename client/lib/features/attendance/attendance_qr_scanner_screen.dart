import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../auth/auth_controller.dart';
import 'attendance_repository.dart';

class AttendanceQrScannerScreen extends ConsumerStatefulWidget {
  const AttendanceQrScannerScreen({super.key});

  @override
  ConsumerState<AttendanceQrScannerScreen> createState() =>
      _AttendanceQrScannerScreenState();
}

class _AttendanceQrScannerScreenState
    extends ConsumerState<AttendanceQrScannerScreen> {
  bool _busy = false;
  final Set<String> _attemptedTokens = <String>{};

  String? get _branchId {
    final user = ref.read(authProvider).user ?? {};
    final primary = user['primaryBranchId']?.toString();
    if (primary != null && primary.isNotEmpty) return primary;
    final roles = (user['roles'] as List? ?? const []).whereType<Map>();
    for (final role in roles) {
      final branch = role['branchId']?.toString();
      if (branch != null && branch.isNotEmpty) return branch;
    }
    return null;
  }

  bool get _isArabic => Localizations.localeOf(context).languageCode == 'ar';
  String _t(String ar, String en) => _isArabic ? ar : en;

  Future<Position?> _currentPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy) return;
    String? token;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value != null && value.isNotEmpty) {
        token = value;
        break;
      }
    }
    if (token == null || token.split('.').length != 2) return;
    if (_attemptedTokens.contains(token)) return;

    final branch = _branchId;
    if (branch == null) {
      _showMessage(_t('لا يوجد فرع مرتبط بحسابك', 'No branch is linked to your account'));
      return;
    }

    setState(() {
      _busy = true;
      _attemptedTokens.add(token!);
    });
    try {
      final geofence = await ref
          .read(attendanceRepositoryProvider)
          .geofenceStatus(branch);
      final position = geofence['enabled'] == true
          ? await _currentPosition()
          : null;
      if (geofence['enabled'] == true && position == null) {
        throw StateError(
          _t(
            'يلزم تفعيل خدمة الموقع والسماح للتطبيق بالوصول إليه لتسجيل الحضور في هذا الفرع.',
            'Enable location services and grant location permission to check in at this branch.',
          ),
        );
      }
      await ref.read(attendanceRepositoryProvider).checkInWithQr(
            branch,
            token,
            latitude: position?.latitude,
            longitude: position?.longitude,
            accuracyMeters: position?.accuracy,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('تم تسجيل الحضور والتحقق من الرمز', 'Check-in verified and recorded')),
        ),
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      _attemptedTokens.remove(token);
      if (!mounted) return;
      final offline = error is DioException &&
          (error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout);
      _showMessage(
        offline
            ? _t(
                'لا يمكن تسجيل الحضور دون اتصال. رمز QR صالح لمدة 45 ثانية ولا يُحفظ لإعادة الإرسال. اتصل بالإنترنت ثم امسح الرمز الحالي من جديد.',
                'Attendance cannot be recorded offline. QR codes expire after 45 seconds and are not queued for replay. Reconnect and scan the currently displayed code again.',
              )
            : error.toString(),
      );
      setState(() => _busy = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_t('مسح رمز الحضور', 'Scan attendance QR')),
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(onDetect: _onDetect),
                Center(
                  child: Container(
                    width: 260,
                    height: 260,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 3),
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                ),
                if (_busy)
                  Container(
                    color: Colors.black54,
                    child: const Center(child: CircularProgressIndicator()),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _t(
                    'وجّه الكاميرا إلى رمز الفرع. سيُطلب الموقع عند الحاجة للتحقق الجغرافي.',
                    'Point the camera at the branch QR. Location is requested when geofence verification is required.',
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () => setState(() => _attemptedTokens.clear()),
                  icon: const Icon(Icons.refresh),
                  label: Text(_t('إعادة المحاولة', 'Scan again')),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
