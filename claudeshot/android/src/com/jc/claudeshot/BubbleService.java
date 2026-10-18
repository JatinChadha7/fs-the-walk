package com.jc.claudeshot;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.drawable.Icon;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

/**
 * Runs whatever the user switched on: the floating button (with the screen-capture session it
 * uses) and the watcher that opens screenshots taken with the phone's own buttons.
 *
 * Android lets an app capture the screen only from a foreground service of type mediaProjection,
 * and only after the user agrees in the system prompt (shown by {@link CaptureActivity}). The
 * service runs as a specialUse foreground service while it just shows the button, and adds the
 * mediaProjection type while a capture session is open.
 */
public class BubbleService extends Service implements SharedPreferences.OnSharedPreferenceChangeListener {
    private static final String TAG = "ClaudeShot";

    static final String ACTION_STOP = "com.jc.claudeshot.action.STOP";
    static final String ACTION_CAPTURE_ALLOWED = "com.jc.claudeshot.action.CAPTURE_ALLOWED";
    static final String ACTION_CAPTURE_REFUSED = "com.jc.claudeshot.action.CAPTURE_REFUSED";
    static final String EXTRA_RESULT_CODE = "result_code";
    static final String EXTRA_RESULT_DATA = "result_data";
    static final int SHOT_NOTIFICATION_ID = 2;

    private static final String CHANNEL_BUBBLE = "bubble";
    private static final String CHANNEL_SHOTS = "shots";
    private static final int NOTIFICATION_ID = 1;
    // ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE, added in API 34 (the app compiles against 30).
    private static final int FGS_TYPE_SPECIAL_USE = 1 << 30;
    // Lets the "start screen capture?" prompt animate away before the first screenshot.
    private static final long AFTER_CONSENT_MS = 900;
    // If the editor hasn't picked the screenshot up by then, it probably wasn't allowed to open.
    private static final long EDITOR_CHECK_MS = 2500;
    private static final long CONSENT_TIMEOUT_MS = 60_000;

    private static BubbleService running;
    private static int editorsOnScreen;
    private static Runnable stateListener;

    private final Handler main = new Handler(Looper.getMainLooper());
    private HandlerThread captureThread;
    private Bubble bubble;
    private ScreenshotWatcher watcher;
    private ScreenGrabber grabber;
    private boolean busy;
    private boolean awaitingConsent;

    private final Runnable consentTimeout = new Runnable() {
        @Override
        public void run() {
            awaitingConsent = false;
        }
    };

    static boolean isRunning() {
        return running != null;
    }

    /**
     * Starts, updates or stops the service to match the settings. Call it from a screen the user
     * is looking at, or at boot: Android doesn't let apps start it from the background otherwise.
     */
    static void sync(Context context) {
        boolean wanted = Prefs.bubbleReady(context) || Prefs.watchScreenshots(context);
        if (running != null) {
            running.applySettings(); // also picks up a newly granted overlay permission
        } else if (wanted) {
            context.startForegroundService(new Intent(context, BubbleService.class));
        }
    }

    /** True while the floating button is on screen or would be if no editor were open. */
    static boolean bubbleActive() {
        return running != null && running.bubble != null;
    }

    static boolean watching() {
        return running != null && running.watcher != null;
    }

    /** Called on the main thread whenever the service starts or stops. */
    static void setStateListener(Runnable listener) {
        stateListener = listener;
    }

    /** The editor hides the floating button while it is on screen. */
    static void editorShown(boolean shown) {
        editorsOnScreen = Math.max(0, editorsOnScreen + (shown ? 1 : -1));
        if (running != null) running.updateBubble();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
        // A started foreground service must call startForeground() even if it is about to stop.
        if (!goForeground(false)) {
            stopSelf();
            return;
        }
        running = this;
        captureThread = new HandlerThread("ClaudeShot capture");
        captureThread.start();
        Prefs.of(this).registerOnSharedPreferenceChangeListener(this);
        applySettings();
    }

    private final Bubble.Listener bubbleListener = new Bubble.Listener() {
        @Override
        public void onTap() {
            capture();
        }

        @Override
        public void onDismiss() {
            // Posted: turning the button off removes it, and this runs inside its touch handling.
            main.post(new Runnable() {
                @Override
                public void run() {
                    boolean watch = Prefs.watchScreenshots(BubbleService.this);
                    Toast.makeText(BubbleService.this, watch ? R.string.bubble_off_watching : R.string.bubble_stopped,
                            Toast.LENGTH_LONG).show();
                    Prefs.of(BubbleService.this).edit().putBoolean(Prefs.BUBBLE_ON, false).apply();
                }
            });
        }
    };

    private final ScreenshotWatcher.Listener watchListener = new ScreenshotWatcher.Listener() {
        @Override
        public void onScreenshot(Bitmap shot) {
            if (running == BubbleService.this) openEditor(shot, true);
        }
    };

    /** Shows or hides the button and starts or stops the watcher to match the settings. */
    private void applySettings() {
        if (running != this) return;
        boolean wantBubble = Prefs.bubbleReady(this);
        boolean wantWatcher = Prefs.watchScreenshots(this);
        if (!wantBubble && !wantWatcher) {
            stopSelf();
            return;
        }
        if (wantBubble && bubble == null) {
            bubble = new Bubble(this, bubbleListener);
        } else if (!wantBubble && bubble != null) {
            bubble.destroy();
            bubble = null;
            stopProjection();
        }
        if (bubble != null) bubble.setStyle(BubbleStyle.load(this));
        updateBubble();
        if (wantWatcher && watcher == null) {
            watcher = new ScreenshotWatcher(this, new Handler(captureThread.getLooper()), main, watchListener);
            watcher.start();
        } else if (!wantWatcher && watcher != null) {
            watcher.stop();
            watcher = null;
        }
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
        notifyState();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            // Turns both features off; the settings listener then stops the service.
            Prefs.of(this).edit().putBoolean(Prefs.BUBBLE_ON, false).putBoolean(Prefs.WATCH_SCREENSHOTS, false).apply();
            stopSelf();
        } else if (ACTION_CAPTURE_ALLOWED.equals(action)) {
            consentDone();
            Intent data = intent.getParcelableExtra(EXTRA_RESULT_DATA);
            if (startProjection(intent.getIntExtra(EXTRA_RESULT_CODE, 0), data)) {
                main.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        capture();
                    }
                }, AFTER_CONSENT_MS);
            }
        } else if (ACTION_CAPTURE_REFUSED.equals(action)) {
            consentDone();
            Toast.makeText(this, R.string.capture_refused, Toast.LENGTH_LONG).show();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (running == this) running = null;
        Prefs.of(this).unregisterOnSharedPreferenceChangeListener(this);
        main.removeCallbacksAndMessages(null);
        stopProjection();
        if (bubble != null) {
            bubble.destroy();
            bubble = null;
        }
        if (watcher != null) {
            watcher.stop();
            watcher = null;
        }
        if (captureThread != null) {
            captureThread.quitSafely();
            captureThread = null;
        }
        notifyState();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (bubble != null) bubble.onScreenChanged();
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences prefs, String key) {
        if (key == null) return;
        if (Prefs.KEEP_READY.equals(key)) {
            if (!Prefs.keepReady(this) && !busy) stopProjection();
        } else if (Prefs.BUBBLE_ON.equals(key) || Prefs.WATCH_SCREENSHOTS.equals(key) || key.startsWith("style_")) {
            applySettings();
        }
    }

    private void updateBubble() {
        if (bubble == null) return;
        boolean show = editorsOnScreen == 0;
        bubble.setShown(show);
        // The editor has taken over from the capture; the button comes back visible after it.
        if (!show && !busy) bubble.setCaptureHidden(false);
    }

    private static void notifyState() {
        if (stateListener != null) stateListener.run();
    }

    // ---- taking a screenshot

    private void capture() {
        if (busy || bubble == null) return;
        if (grabber == null) {
            askForConsent();
            return;
        }
        busy = true;
        // Attach the reader first, then hide the button: the frame drawn for the hide is then
        // guaranteed to reach the reader.
        grabber.grab(new ScreenGrabber.Callback() {
            @Override
            public void onShot(Bitmap shot, boolean blank) {
                onCaptured(shot);
                if (blank) Toast.makeText(BubbleService.this, R.string.capture_blank, Toast.LENGTH_LONG).show();
            }

            @Override
            public void onFailed() {
                onCaptured(null);
            }
        }, new Runnable() {
            @Override
            public void run() {
                if (bubble != null) bubble.poke();
            }
        });
        bubble.setCaptureHidden(true);
    }

    private void onCaptured(Bitmap shot) {
        busy = false;
        if (bubble == null) return; // stopped meanwhile
        if (shot == null) {
            bubble.setCaptureHidden(false);
            Toast.makeText(this, R.string.capture_failed, Toast.LENGTH_SHORT).show();
            return;
        }
        openEditor(shot, false);
        if (!Prefs.keepReady(this)) stopProjection();
    }

    /** @param savedByPhone the phone already saved this screenshot to its gallery */
    private void openEditor(Bitmap shot, final boolean savedByPhone) {
        final String id = ShotStore.put(this, shot);
        try {
            startActivity(EditorActivity.intent(this, id, savedByPhone));
        } catch (RuntimeException e) {
            Log.w(TAG, "editor", e);
        }
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                // Normally done when the editor appears; this covers an editor that never did.
                if (bubble != null) bubble.setCaptureHidden(false);
                if (ShotStore.isWaiting(id)) offerShot(id, savedByPhone);
            }
        }, EDITOR_CHECK_MS);
    }

    /** Fallback when Android didn't let the editor open by itself: a notification that opens it. */
    private void offerShot(String id, boolean savedByPhone) {
        PendingIntent open = PendingIntent.getActivity(this, 2, EditorActivity.intent(this, id, savedByPhone),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, CHANNEL_SHOTS)
                .setSmallIcon(R.drawable.ic_glyph)
                .setContentTitle(getString(R.string.shot_ready_title))
                .setContentText(getString(R.string.shot_ready_text))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
        getSystemService(NotificationManager.class).notify(SHOT_NOTIFICATION_ID, n);
    }

    // ---- the capture session

    private void askForConsent() {
        if (awaitingConsent) return;
        awaitingConsent = true;
        main.postDelayed(consentTimeout, CONSENT_TIMEOUT_MS);
        Intent ask = new Intent(this, CaptureActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        try {
            startActivity(ask);
        } catch (RuntimeException e) {
            Log.w(TAG, "consent", e);
            consentDone();
            Toast.makeText(this, R.string.capture_failed, Toast.LENGTH_SHORT).show();
        }
    }

    private void consentDone() {
        awaitingConsent = false;
        main.removeCallbacks(consentTimeout);
    }

    private boolean startProjection(int resultCode, Intent data) {
        if (data == null || captureThread == null) return false;
        stopProjection();
        MediaProjection projection = null;
        // getMediaProjection() needs the mediaProjection foreground type to be in place already.
        if (goForeground(true)) {
            try {
                MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
                projection = mpm.getMediaProjection(resultCode, data);
            } catch (RuntimeException e) {
                Log.w(TAG, "getMediaProjection", e);
            }
        }
        if (projection != null) {
            grabber = new ScreenGrabber(this, projection, new Handler(captureThread.getLooper()), main,
                    new ScreenGrabber.StopListener() {
                        @Override
                        public void onStopped(ScreenGrabber stopped) {
                            // Android ended the session (screen locked, or "stop sharing" tapped).
                            if (stopped == grabber) stopProjection();
                        }
                    });
            if (grabber.start()) return true;
            stopProjection();
        } else {
            goForeground(false);
        }
        Toast.makeText(this, R.string.capture_failed, Toast.LENGTH_SHORT).show();
        return false;
    }

    private void stopProjection() {
        if (grabber == null) return;
        ScreenGrabber g = grabber;
        grabber = null;
        g.release();
        if (running == this) goForeground(false);
    }

    // ---- foreground service plumbing

    private boolean goForeground(boolean capturing) {
        Notification n = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                int type = FGS_TYPE_SPECIAL_USE;
                if (capturing) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
                startForeground(NOTIFICATION_ID, n, type);
            } else if (capturing) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
            return true;
        } catch (RuntimeException e) {
            Log.w(TAG, "startForeground", e);
            return false;
        }
    }

    private Notification buildNotification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, BubbleService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        Notification.Action stopAction = new Notification.Action.Builder(
                Icon.createWithResource(this, R.drawable.ic_close), getString(R.string.notif_stop), stop).build();
        boolean button = bubble != null;
        boolean phone = watcher != null;
        int text = button && phone ? R.string.notif_text_both : phone ? R.string.notif_text_watch : R.string.notif_text;
        return new Notification.Builder(this, CHANNEL_BUBBLE)
                .setSmallIcon(R.drawable.ic_glyph)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(getString(text))
                .setContentIntent(open)
                .setOngoing(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(stopAction)
                .build();
    }

    private void createChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel bubbleChannel = new NotificationChannel(CHANNEL_BUBBLE,
                getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW);
        bubbleChannel.setShowBadge(false);
        nm.createNotificationChannel(bubbleChannel);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL_SHOTS,
                getString(R.string.shots_channel), NotificationManager.IMPORTANCE_HIGH));
    }
}
