package com.jc.claudeshot;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.provider.MediaStore;
import android.util.Log;

import java.io.InputStream;
import java.util.Locale;

/**
 * Notices screenshots the phone itself takes (Power + Volume down, or its own screenshot
 * gesture) and hands them over, so they open in ClaudeShot's editor.
 *
 * Android doesn't let apps take over the screenshot buttons, but every screenshot lands in the
 * photo library, in a Screenshots folder. This watches the library for new images there.
 */
final class ScreenshotWatcher extends ContentObserver {
    interface Listener {
        /** A new screenshot, on the main thread. */
        void onScreenshot(Bitmap shot);
    }

    static final String READ_MEDIA_IMAGES = "android.permission.READ_MEDIA_IMAGES"; // API 33
    static final String READ_MEDIA_PARTIAL = "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"; // API 34
    static final String READ_STORAGE = "android.permission.READ_EXTERNAL_STORAGE"; // up to API 32

    private static final String TAG = "ClaudeShot";
    // Change notifications come in bursts while a picture is written; act once it settles.
    // Kept short: the phone's own preview already costs seconds before the picture is saved.
    private static final long SETTLE_MS = 150;
    // Only screenshots this fresh count; older pictures can be touched by other apps any time.
    private static final long MAX_AGE_S = 20;
    // Taller than this is a scrolling ("long") screenshot; those stay with the phone's own editor.
    private static final int MAX_SIDE = 4096;
    private static final Uri IMAGES = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;

    private final Context context;
    private final Handler worker;
    private final Handler main;
    private final Listener listener;
    private long lastId = Long.MAX_VALUE; // nothing counts until the current newest is known

    private final Runnable check = new Runnable() {
        @Override
        public void run() {
            checkNewest();
        }
    };

    ScreenshotWatcher(Context context, Handler worker, Handler main, Listener listener) {
        super(worker);
        this.context = context;
        this.worker = worker;
        this.main = main;
        this.listener = listener;
    }

    /** Full photo access: needed to see new screenshots ("selected photos only" isn't enough). */
    static boolean canRead(Context context) {
        String permission = Build.VERSION.SDK_INT >= 33 ? READ_MEDIA_IMAGES : READ_STORAGE;
        return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    /** Android 14+: the user allowed only some photos. */
    static boolean hasPartialAccess(Context context) {
        return Build.VERSION.SDK_INT >= 34 && !canRead(context)
                && context.checkSelfPermission(READ_MEDIA_PARTIAL) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean looksLikeScreenshot(String path, String name) {
        String p = ((path == null ? "" : path) + "/" + (name == null ? "" : name)).toLowerCase(Locale.ROOT);
        return p.contains("screenshot") && !p.contains("claudeshot");
    }

    void start() {
        worker.post(new Runnable() {
            @Override
            public void run() {
                lastId = newestId();
            }
        });
        context.getContentResolver().registerContentObserver(IMAGES, true, this);
    }

    void stop() {
        context.getContentResolver().unregisterContentObserver(this);
        worker.removeCallbacks(check);
    }

    @Override
    public void onChange(boolean selfChange) {
        worker.removeCallbacks(check);
        worker.postDelayed(check, SETTLE_MS);
    }

    private long newestId() {
        if (!canRead(context)) return Long.MAX_VALUE;
        Bundle args = new Bundle();
        args.putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, MediaStore.MediaColumns._ID + " DESC");
        args.putInt(ContentResolver.QUERY_ARG_LIMIT, 1);
        try (Cursor c = context.getContentResolver().query(IMAGES, new String[] {MediaStore.MediaColumns._ID}, args, null)) {
            return c != null && c.moveToFirst() ? c.getLong(0) : 0;
        } catch (RuntimeException e) {
            Log.w(TAG, "newestId", e);
            return Long.MAX_VALUE;
        }
    }

    private void checkNewest() {
        if (!canRead(context)) return;
        if (lastId == Long.MAX_VALUE) {
            // Permission came after start(): begin from what's there now.
            lastId = newestId();
            return;
        }
        String[] columns = {
                MediaStore.MediaColumns._ID, MediaStore.MediaColumns.RELATIVE_PATH,
                MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.DATE_ADDED};
        Bundle args = new Bundle();
        args.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, MediaStore.MediaColumns._ID + " > ?");
        args.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] {Long.toString(lastId)});
        args.putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, MediaStore.MediaColumns._ID + " DESC");
        args.putInt(ContentResolver.QUERY_ARG_LIMIT, 5);
        Uri found = null;
        long now = System.currentTimeMillis() / 1000;
        try (Cursor c = context.getContentResolver().query(IMAGES, columns, args, null)) {
            while (c != null && c.moveToNext()) {
                long id = c.getLong(0);
                if (id > lastId) lastId = id;
                if (found == null && looksLikeScreenshot(c.getString(1), c.getString(2))
                        && now - c.getLong(3) <= MAX_AGE_S) {
                    found = ContentUris.withAppendedId(IMAGES, id);
                }
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "query", e);
            return;
        }
        if (found == null) return;
        final Bitmap shot = decode(found);
        if (shot == null) return;
        main.post(new Runnable() {
            @Override
            public void run() {
                listener.onScreenshot(shot);
            }
        });
    }

    private Bitmap decode(Uri uri) {
        ContentResolver resolver = context.getContentResolver();
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = resolver.openInputStream(uri)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            if (bounds.outWidth > MAX_SIDE || bounds.outHeight > MAX_SIDE) return null;
            try (InputStream in = resolver.openInputStream(uri)) {
                return BitmapFactory.decodeStream(in);
            }
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "decode", e);
            return null;
        }
    }
}
