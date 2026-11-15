# Omran Mall — Local Preview Mode

The unauthenticated preview is intentionally available only in Flutter debug builds.

## Run on Android

1. Build/install the debug APK from the `android-debug-apk` GitHub Actions artifact.
2. Open Omran Mall.
3. On the sign-in screen, choose **استعراض التطبيق دون تسجيل الدخول** (Preview app without signing in).
4. Browse the sample dashboard and modules.

## Safety and scope

- Preview content is fictional and read-only.
- The preview screens do not use API repositories, network clients, or persistent storage.
- Real attendance, employee changes, approvals, and other operations are not available in preview.
- The preview route and button are guarded by Flutter's `kDebugMode`; release builds continue to require normal authentication.
- This preview is intended to review navigation and UI progress. It does not represent live business data or prove backend integration.
