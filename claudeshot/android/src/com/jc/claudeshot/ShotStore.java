package com.jc.claudeshot;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hands a fresh screenshot from the service to the editor. The bitmap is passed in memory; a PNG
 * copy is written in the background so the editor can reopen it if Android closes the app while
 * the editor is in the background.
 */
final class ShotStore {
    private static final long MAX_AGE_MS = 24L * 60 * 60 * 1000;
    private static final ExecutorService DISK = Executors.newSingleThreadExecutor();

    private static String waitingId;
    private static Bitmap waitingShot;

    private ShotStore() {}

    static String put(Context context, final Bitmap shot) {
        final String id = "shot_" + System.currentTimeMillis();
        waitingId = id;
        waitingShot = shot;
        final File dir = dir(context);
        DISK.execute(new Runnable() {
            @Override
            public void run() {
                purge(dir);
                File tmp = new File(dir, id + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    shot.compress(Bitmap.CompressFormat.PNG, 100, out);
                } catch (IOException e) {
                    Log.w("ClaudeShot", "backup", e);
                    tmp.delete();
                    return;
                }
                if (!tmp.renameTo(new File(dir, id + ".png"))) tmp.delete();
            }
        });
        return id;
    }

    /** True until the editor has taken the screenshot. */
    static boolean isWaiting(String id) {
        return waitingShot != null && id.equals(waitingId);
    }

    static Bitmap take(Context context, String id) {
        if (!isValid(id)) return null;
        if (isWaiting(id)) {
            Bitmap shot = waitingShot;
            waitingShot = null;
            waitingId = null;
            return shot;
        }
        File f = new File(dir(context), id + ".png");
        return f.isFile() ? BitmapFactory.decodeFile(f.getPath()) : null;
    }

    static void delete(Context context, final String id) {
        if (!isValid(id)) return;
        final File f = new File(dir(context), id + ".png");
        DISK.execute(new Runnable() {
            @Override
            public void run() {
                f.delete();
            }
        });
    }

    private static boolean isValid(String id) {
        return id != null && id.matches("shot_\\d+");
    }

    private static File dir(Context context) {
        File d = new File(context.getCacheDir(), "shots");
        d.mkdirs();
        return d;
    }

    static void purge(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        for (File f : files) {
            if (f.lastModified() < cutoff) f.delete();
        }
    }
}
