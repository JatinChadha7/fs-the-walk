package com.jc.claudeshot;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Writes finished screenshots to the gallery or to a file other apps can read. */
final class Exporter {
    private Exporter() {}

    private static String fileName() {
        return "ClaudeShot_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".png";
    }

    /** Saves to Pictures/ClaudeShot. Needs no storage permission on Android 10 and newer. */
    static Uri saveToGallery(Context context, Bitmap image) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName());
        values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ClaudeShot");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
        if (uri == null) throw new IOException("MediaStore refused the new image");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null || !image.compress(Bitmap.CompressFormat.PNG, 100, out)) {
                throw new IOException("could not write the image");
            }
        } catch (IOException | RuntimeException e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return uri;
    }

    /** Writes a PNG that {@link ShareProvider} serves, for sharing and copying. */
    static Uri writeShareFile(Context context, Bitmap image) throws IOException {
        File dir = ShareProvider.dir(context);
        ShotStore.purge(dir);
        File file = new File(dir, fileName());
        try (FileOutputStream out = new FileOutputStream(file)) {
            if (!image.compress(Bitmap.CompressFormat.PNG, 100, out)) throw new IOException("could not write the image");
        }
        return ShareProvider.uriFor(file);
    }
}
