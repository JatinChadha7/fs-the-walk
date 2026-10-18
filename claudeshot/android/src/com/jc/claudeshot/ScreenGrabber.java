package com.jc.claudeshot;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.os.Handler;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;

import java.nio.ByteBuffer;

/**
 * Turns a MediaProjection into screenshots.
 *
 * The projection mirrors the screen into a virtual display. Between screenshots that display has
 * no surface, so nothing is rendered; {@link #grab} attaches an ImageReader, keeps the newest
 * frame for a moment (long enough for the hidden floating button to be gone from it) and detaches
 * the reader again.
 */
final class ScreenGrabber {
    interface Callback {
        void onShot(Bitmap shot);

        void onFailed();
    }

    interface StopListener {
        void onStopped(ScreenGrabber grabber);
    }

    private static final String TAG = "ClaudeShot";
    // Frames composed this long after the reader is attached no longer show the floating button,
    // which the service hides right after calling grab().
    private static final long SETTLE_MS = 250;
    private static final long TIMEOUT_MS = 2500;

    private final Context context;
    private final MediaProjection projection;
    private final Handler worker;
    private final Handler main;
    private final StopListener stopListener;
    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onStop() {
            stopListener.onStopped(ScreenGrabber.this);
        }
    };
    private volatile VirtualDisplay display;
    private int width;
    private int height;
    private int dpi;

    ScreenGrabber(Context context, MediaProjection projection, Handler worker, Handler main, StopListener stopListener) {
        this.context = context;
        this.projection = projection;
        this.worker = worker;
        this.main = main;
        this.stopListener = stopListener;
    }

    /** Creates the virtual display. Returns false if Android refused. */
    boolean start() {
        DisplayMetrics m = realMetrics();
        width = m.widthPixels;
        height = m.heightPixels;
        dpi = m.densityDpi;
        try {
            // Android 14 requires the callback before the virtual display.
            projection.registerCallback(projectionCallback, main);
            display = projection.createVirtualDisplay("ClaudeShot", width, height, dpi,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, null, null, null);
        } catch (RuntimeException e) {
            Log.w(TAG, "createVirtualDisplay", e);
            return false;
        }
        return display != null;
    }

    /** Ends the capture session. Safe to call more than once. */
    void release() {
        projection.unregisterCallback(projectionCallback);
        VirtualDisplay d = display;
        display = null;
        if (d != null) d.release();
        projection.stop();
    }

    /** Captures the screen as it looks a moment from now. The callback runs on the main thread. */
    void grab(final Callback callback) {
        VirtualDisplay d = display;
        if (d == null) {
            postResult(callback, null);
            return;
        }
        DisplayMetrics m = realMetrics();
        if (m.widthPixels != width || m.heightPixels != height || m.densityDpi != dpi) {
            // The phone was rotated since the session started.
            width = m.widthPixels;
            height = m.heightPixels;
            dpi = m.densityDpi;
            d.resize(width, height, dpi);
        }
        ImageReader reader;
        try {
            reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3);
        } catch (RuntimeException e) {
            Log.w(TAG, "ImageReader", e);
            postResult(callback, null);
            return;
        }
        Grab grab = new Grab(reader, callback);
        reader.setOnImageAvailableListener(grab, worker);
        try {
            d.setSurface(reader.getSurface());
        } catch (RuntimeException e) {
            Log.w(TAG, "setSurface", e);
            reader.close();
            postResult(callback, null);
            return;
        }
        worker.postDelayed(grab.settle, SETTLE_MS);
        worker.postDelayed(grab.timeout, TIMEOUT_MS);
    }

    private DisplayMetrics realMetrics() {
        DisplayMetrics m = new DisplayMetrics();
        DisplayManager dm = context.getSystemService(DisplayManager.class);
        dm.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(m);
        return m;
    }

    private void postResult(final Callback callback, final Bitmap shot) {
        main.post(new Runnable() {
            @Override
            public void run() {
                if (shot != null) callback.onShot(shot);
                else callback.onFailed();
            }
        });
    }

    /** One screenshot in progress. Everything here runs on the worker thread. */
    private final class Grab implements ImageReader.OnImageAvailableListener {
        private final ImageReader reader;
        private final Callback callback;
        private Image latest;
        private boolean settled;
        private boolean done;

        final Runnable settle = new Runnable() {
            @Override
            public void run() {
                settled = true;
                if (latest != null) finish();
            }
        };

        final Runnable timeout = new Runnable() {
            @Override
            public void run() {
                if (!done) finish();
            }
        };

        Grab(ImageReader reader, Callback callback) {
            this.reader = reader;
            this.callback = callback;
        }

        @Override
        public void onImageAvailable(ImageReader r) {
            if (done) return;
            Image image;
            try {
                image = r.acquireLatestImage();
            } catch (RuntimeException e) {
                return;
            }
            if (image == null) return;
            if (latest != null) latest.close();
            latest = image;
            if (settled) finish();
        }

        private void finish() {
            done = true;
            worker.removeCallbacks(settle);
            worker.removeCallbacks(timeout);
            Bitmap shot = null;
            if (latest != null) {
                try {
                    shot = toBitmap(latest);
                } catch (RuntimeException | OutOfMemoryError e) {
                    Log.w(TAG, "toBitmap", e);
                }
                latest.close();
                latest = null;
            }
            VirtualDisplay d = display;
            if (d != null) {
                try {
                    d.setSurface(null);
                } catch (RuntimeException ignored) {
                    // Released in the meantime.
                }
            }
            reader.close();
            postResult(callback, shot);
        }
    }

    private static Bitmap toBitmap(Image image) {
        int w = image.getWidth();
        int h = image.getHeight();
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer pixels = plane.getBuffer();
        int rowBytes = w * plane.getPixelStride();
        int stride = plane.getRowStride();
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        if (stride == rowBytes) {
            bitmap.copyPixelsFromBuffer(pixels);
        } else {
            // Rows are padded; pack them before copying.
            ByteBuffer packed = ByteBuffer.allocateDirect(rowBytes * h);
            for (int y = 0; y < h; y++) {
                pixels.limit(y * stride + rowBytes);
                pixels.position(y * stride);
                packed.put(pixels);
            }
            packed.rewind();
            bitmap.copyPixelsFromBuffer(packed);
        }
        bitmap.setHasAlpha(false);
        return bitmap;
    }
}
