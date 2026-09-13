# DESKTOP_ANDROID_POST_PUBLISH_EDITING_V1

Isolated Android port of owner post + video edit from web `ab4a243` + `153f0ef`.

## Isolation

- New worktree from phone/Watch V3 SHA `da449c9` (lineage `1a4b0f8`).
- Branch `desktop/android-post-publish-editing-v1`.
- Watch V3 worktree and dirty mobile parent were not reset or rewritten.
- Watch 3-video window / Media3 cache files were not changed.

## Capabilities

- Owner-only Edit on Watch rail (visible `✎ تعديل`) and own Profile video cards.
- Same Post ID. RLS `.eq("user_id", userId)`. Cancel/failed save leaves live media.
- Caption, hashtags, article title/body, cover, video replace, IN/OUT trim with preview.
- Watch reads `media_pipeline.playback.inMs/outMs` (web computer trim) after pull-to-refresh or reopen. Realtime is not required.

## How to open Edit (Arabic)

1. افتح تطبيق أم توبا على الهاتف.
2. اذهب إلى **شاهد**.
3. اعرض فيديو **أنت صاحبه**.
4. على الشريط الأيمن اضغط **تعديل** (أيقونة القلم ✎) — فوق حذف.
5. أو من **ملفك**: افتح فيديوك واضغط **تعديل** تحت البطاقة.

## Watch IN/OUT

Pull-to-refresh or leave Watch and reopen the post. The mounted 3-video window is patched on return from Edit when the same item is still listed.

## Device

Fold6 `RFCX718LVHK` / SM-F956B was attached. Installed package at inspect time: `com.umtuba.app` `1.0.0` versionCode **20** (Watch V3 preview `6bc060ed` / `da449c9`). New candidate versionCode **22**. APK install pending local/EAS binary.
