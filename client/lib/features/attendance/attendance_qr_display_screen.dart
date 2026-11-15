import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../auth/auth_controller.dart';
import 'attendance_repository.dart';

class AttendanceQrDisplayScreen extends ConsumerStatefulWidget {
  const AttendanceQrDisplayScreen({super.key});

  @override
  ConsumerState<AttendanceQrDisplayScreen> createState() =>
      _AttendanceQrDisplayScreenState();
}

class _AttendanceQrDisplayScreenState
    extends ConsumerState<AttendanceQrDisplayScreen> {
  String? _token;
  DateTime? _expiresAt;
  String? _error;
  bool _loading = false;
  Timer? _ticker;
  Timer? _refreshTimer;

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

  @override
  void initState() {
    super.initState();
    _issueChallenge();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _issueChallenge() async {
    final branch = _branchId;
    if (branch == null || _loading) return;
    _refreshTimer?.cancel();
    setState(() {
      _loading = true;
      _token = null;
      _expiresAt = null;
      _error = null;
    });
    try {
      final result =
          await ref.read(attendanceRepositoryProvider).createQrChallenge(branch);
      final token = result['token']?.toString();
      final expiresAt = DateTime.tryParse(result['expiresAt']?.toString() ?? '');
      if (token == null || token.isEmpty || expiresAt == null) {
        throw StateError('The attendance QR challenge response is incomplete.');
      }
      if (!mounted) return;
      setState(() {
        _token = token;
        _expiresAt = expiresAt.toUtc();
      });
      final delay = expiresAt.toUtc().difference(DateTime.now().toUtc());
      _refreshTimer = Timer(
        delay.isNegative ? Duration.zero : delay,
        _issueChallenge,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _secondsRemaining {
    final expiry = _expiresAt;
    if (expiry == null) return 0;
    final seconds = expiry.difference(DateTime.now().toUtc()).inSeconds;
    return seconds < 0 ? 0 : seconds;
  }

  @override
  Widget build(BuildContext context) {
    final branch = _branchId;
    final seconds = _secondsRemaining;
    final token = seconds > 0 ? _token : null;
    return Scaffold(
      appBar: AppBar(
        title: Text(_t('رمز حضور الفرع', 'Branch attendance QR')),
      ),
      body: branch == null
          ? Center(
              child: Text(_t(
                'لا يوجد فرع مرتبط بحسابك',
                'No branch is linked to your account',
              )),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        Text(
                          _t(
                            'اعرض الرمز للموظفين عند تسجيل الحضور',
                            'Display this code for employees checking in',
                          ),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 18),
                        if (token != null)
                          Container(
                            color: Colors.white,
                            padding: const EdgeInsets.all(12),
                            child: QrImageView(
                              data: token,
                              version: QrVersions.auto,
                              size: 260,
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black,
                            ),
                          )
                        else if (_loading)
                          const SizedBox(
                            height: 260,
                            child: Center(child: CircularProgressIndicator()),
                          )
                        else
                          SizedBox(
                            height: 260,
                            child: Center(
                              child: Text(
                                _error ?? _t('انتهت صلاحية الرمز', 'The QR code has expired'),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        const SizedBox(height: 18),
                        Text(
                          token == null
                              ? _t('لا يوجد رمز صالح حالياً', 'No active QR code')
                              : _t('يتجدد الرمز خلال $seconds ثانية', 'Code refreshes in $seconds seconds'),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _t(
                            'الرمز موقّع من الخادم وصالح لمدة 45 ثانية فقط. لا تشارك صورة الرمز خارج الفرع.',
                            'The token is server-signed and valid for only 45 seconds. Do not share the QR image outside the branch.',
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : _issueChallenge,
                  icon: const Icon(Icons.refresh),
                  label: Text(_t('إنشاء رمز جديد الآن', 'Generate a new code now')),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ),
              ],
            ),
    );
  }
}
