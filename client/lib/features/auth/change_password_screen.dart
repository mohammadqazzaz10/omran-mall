import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import 'auth_controller.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).changePassword(
          _current.text,
          _next.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final auth = ref.watch(authProvider);
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(title: Text(strings.changePasswordTitle)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(Icons.password_rounded, size: 48),
                        const SizedBox(height: 16),
                        Text(
                          strings.temporaryPasswordNotice,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 22),
                        TextFormField(
                          controller: _current,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: strings.currentPasswordLabel,
                            border: const OutlineInputBorder(),
                          ),
                          validator: (value) =>
                              value == null || value.isEmpty
                                  ? (isArabic
                                      ? 'أدخل كلمة المرور الحالية'
                                      : 'Enter the current password')
                                  : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _next,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: strings.newPasswordLabel,
                            border: const OutlineInputBorder(),
                            helperText: isArabic
                                ? '14 خانة على الأقل، أحرف كبيرة وصغيرة ورقم ورمز'
                                : 'At least 14 characters, upper/lowercase, a number and a symbol',
                          ),
                          validator: (value) {
                            if (value == null || value.length < 14) {
                              return isArabic
                                  ? 'كلمة المرور يجب ألا تقل عن 14 خانة'
                                  : 'Use at least 14 characters';
                            }
                            if (!RegExp(r'[a-z]').hasMatch(value) ||
                                !RegExp(r'[A-Z]').hasMatch(value) ||
                                !RegExp(r'[0-9]').hasMatch(value) ||
                                !RegExp(r'[^A-Za-z0-9]').hasMatch(value)) {
                              return isArabic
                                  ? 'استخدم أحرفاً كبيرة وصغيرة ورقماً ورمزاً'
                                  : 'Include uppercase, lowercase, a number and a symbol';
                            }
                            if (value.length > 72) {
                              return isArabic
                                  ? 'كلمة المرور طويلة أكثر من المسموح'
                                  : 'Password is too long';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _confirm,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: strings.confirmPasswordLabel,
                            border: const OutlineInputBorder(),
                            suffixIcon: IconButton(
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) => value != _next.text
                              ? strings.passwordsDoNotMatch
                              : null,
                        ),
                        if (auth.error != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            auth.error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: auth.isLoading ? null : _save,
                          child: auth.isLoading
                              ? const CircularProgressIndicator()
                              : Text(strings.savePasswordButton),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
