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
import android.os.SystemClock;
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
 *
 * Right after the user allows screen capture, some phones send blank (all black) frames for a
 * moment. A blank frame is kept only as a last resort: the grabber asks for a fresh frame (the
 * caller redraws the hidden button, which makes Android compose the screen again) until a real
 * one arrives or it gives up.
 */
final class ScreenGrabber {
    interface Callback {
        /** @param blank the screen came out all black even after retrying */
        void onShot(Bitmap shot, boolean blank);

        void onFailed();
    }

    interface StopListener {
        void onStopped(ScreenGrabber grabber);
    }

    private static final String TAG = "ClaudeShot";
    // Frames composed this long after the reader is attached no longer show the floating button,
    // which the service hides right after calling grab().
    private static final long SETTLE_MS = 250;
    // While frames are blank (or none came), ask for a fresh one this often...
    private static final long RETRY_MS = 250;
    // ...for this long after grab() before settling for a blank one, which may be genuine
    // (apps that block screenshots show up black).
    private static final long BLANK_GIVE_UP_MS = 4000;
    private static final long TIMEOUT_MS = 5000;

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

    /**
     * Captures the screen as it looks a moment from now. The callback runs on the main thread.
     *
     * @param redraw run on the main thread to make Android compose a fresh frame
     */
    void grab(final Callback callback, Runnable redraw) {
        VirtualDisplay d = display;
        if (d == null) {
            postResult(callback, null, false);
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
            reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 4);
        } catch (RuntimeException e) {
            Log.w(TAG, "ImageReader", e);
            postResult(callback, null, false);
            return;
        }
        Grab grab = new Grab(reader, callback, redraw);
        reader.setOnImageAvailableListener(grab, worker);
        try {
            d.setSurface(reader.getSurface());
        } catch (RuntimeException e) {
            Log.w(TAG, "setSurface", e);
            reader.close();
            postResult(callback, null, false);
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

    private void postResult(final Callback callback, final Bitmap shot, final boolean blank) {
        main.post(new Runnable() {
            @Override
            public void run() {
                if (shot != null) callback.onShot(shot, blank);
                else callback.onFailed();
            }
        });
    }

    /** One screenshot in progress. Everything here runs on the worker thread. */
    private final class Grab implements ImageReader.OnImageAvailableListener {
        private final ImageReader reader;
        private final Callback callback;
        private final Runnable redraw;
        private final long started = SystemClock.uptimeMillis();
        private Image latest;
        private Image blank; // the newest blank frame, used only if nothing better comes
        private boolean settled;
        private boolean retrying;
        private boolean done;

        final Runnable settle = new Runnable() {
            @Override
            public void run() {
                settled = true;
                if (latest != null) finish(false);
                else startRetrying(); // no frame yet: the screen hasn't changed since attaching
            }
        };

        final Runnable retry = new Runnable() {
            @Override
            public void run() {
                if (done) return;
                main.post(redraw);
                worker.postDelayed(this, RETRY_MS);
            }
        };

        final Runnable timeout = new Runnable() {
            @Override
            public void run() {
                if (!done) finish(true);
            }
        };

        Grab(ImageReader reader, Callback callback, Runnable redraw) {
            this.reader = reader;
            this.callback = callback;
            this.redraw = redraw;
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
            if (settled) finish(false);
        }

        private void startRetrying() {
            if (retrying) return;
            retrying = true;
            worker.post(retry);
        }

        private void finish(boolean force) {
            if (!force && latest != null && isBlank(latest)
                    && SystemClock.uptimeMillis() - started < BLANK_GIVE_UP_MS) {
                if (blank != null) blank.close();
                blank = latest;
                latest = null;
                startRetrying();
                return;
            }
            done = true;
            worker.removeCallbacks(settle);
            worker.removeCallbacks(retry);
            worker.removeCallbacks(timeout);
            Image use = latest != null ? latest : blank;
            Bitmap shot = null;
            boolean wasBlank = false;
            if (use != null) {
                wasBlank = isBlank(use);
                try {
                    shot = toBitmap(use);
                } catch (RuntimeException | OutOfMemoryError e) {
                    Log.w(TAG, "toBitmap", e);
                }
            }
            if (latest != null) latest.close();
            if (blank != null) blank.close();
            latest = null;
            blank = null;
            VirtualDisplay d = display;
            if (d != null) {
                try {
                    d.setSurface(null);
                } catch (RuntimeException ignored) {
                    // Released in the meantime.
                }
            }
            reader.close();
            postResult(callback, shot, wasBlank);
        }
    }

    /** True if every sampled pixel is black: what some phones send while screen capture starts up. */
    static boolean isBlank(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer pixels = plane.getBuffer();
        int w = image.getWidth();
        int h = image.getHeight();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        for (int gy = 0; gy < 64; gy++) {
            int y = (int) ((gy + 0.5f) * h / 64);
            for (int gx = 0; gx < 32; gx++) {
                int x = (int) ((gx + 0.5f) * w / 32);
                int i = y * rowStride + x * pixelStride;
                if ((pixels.get(i) & 0xFF) > 8 || (pixels.get(i + 1) & 0xFF) > 8 || (pixels.get(i + 2) & 0xFF) > 8) {
                    return false;
                }
            }
        }
        return true;
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
