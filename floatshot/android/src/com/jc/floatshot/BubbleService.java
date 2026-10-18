package com.jc.floatshot;

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
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

/**
 * Keeps the floating button on screen and owns the screen-capture session it uses.
 *
 * Android lets an app capture the screen only from a foreground service of type mediaProjection,
 * and only after the user agrees in the system prompt (shown by {@link CaptureActivity}). The
 * service runs as a specialUse foreground service while it just shows the button, and adds the
 * mediaProjection type while a capture session is open.
 */
public class BubbleService extends Service implements SharedPreferences.OnSharedPreferenceChangeListener {
    private static final String TAG = "FloatShot";

    static final String ACTION_STOP = "com.jc.floatshot.action.STOP";
    static final String ACTION_CAPTURE_ALLOWED = "com.jc.floatshot.action.CAPTURE_ALLOWED";
    static final String ACTION_CAPTURE_REFUSED = "com.jc.floatshot.action.CAPTURE_REFUSED";
    static final String EXTRA_RESULT_CODE = "result_code";
    static final String EXTRA_RESULT_DATA = "result_data";
    static final int SHOT_NOTIFICATION_ID = 2;

    private static final String CHANNEL_BUBBLE = "bubble";
    private static final String CHANNEL_SHOTS = "shots";
    private static final int NOTIFICATION_ID = 1;
    // ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE, added in API 34 (the app compiles against 30).
    private static final int FGS_TYPE_SPECIAL_USE = 1 << 30;
    // Lets the "start screen capture?" prompt animate away before the first screenshot.
    private static final long AFTER_CONSENT_MS = 600;
    // If the editor hasn't picked the screenshot up by then, it probably wasn't allowed to open.
    private static final long EDITOR_CHECK_MS = 2500;
    private static final long CONSENT_TIMEOUT_MS = 60_000;

    private static BubbleService running;
    private static int editorsOnScreen;
    private static Runnable stateListener;

    private final Handler main = new Handler(Looper.getMainLooper());
    private HandlerThread captureThread;
    private Bubble bubble;
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

    static void start(Context context) {
        context.startForegroundService(new Intent(context, BubbleService.class));
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, BubbleService.class));
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
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, R.string.no_overlay, Toast.LENGTH_LONG).show();
            stopSelf();
            return;
        }
        running = this;
        captureThread = new HandlerThread("FloatShot capture");
        captureThread.start();
        bubble = new Bubble(this, new Bubble.Listener() {
            @Override
            public void onTap() {
                capture();
            }

            @Override
            public void onDismiss() {
                Toast.makeText(BubbleService.this, R.string.bubble_stopped, Toast.LENGTH_LONG).show();
                stopSelf();
            }
        });
        Prefs.of(this).registerOnSharedPreferenceChangeListener(this);
        updateBubble();
        notifyState();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
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
        if (Prefs.KEEP_READY.equals(key) && !Prefs.keepReady(this) && !busy) stopProjection();
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
            public void onShot(Bitmap shot) {
                onCaptured(shot);
            }

            @Override
            public void onFailed() {
                onCaptured(null);
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
        final String id = ShotStore.put(this, shot);
        try {
            startActivity(EditorActivity.intent(this, id));
        } catch (RuntimeException e) {
            Log.w(TAG, "editor", e);
        }
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                // Normally done when the editor appears; this covers an editor that never did.
                if (bubble != null) bubble.setCaptureHidden(false);
                if (ShotStore.isWaiting(id)) offerShot(id);
            }
        }, EDITOR_CHECK_MS);
        if (!Prefs.keepReady(this)) stopProjection();
    }

    /** Fallback when Android didn't let the editor open by itself: a notification that opens it. */
    private void offerShot(String id) {
        PendingIntent open = PendingIntent.getActivity(this, 2, EditorActivity.intent(this, id),
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
        return new Notification.Builder(this, CHANNEL_BUBBLE)
                .setSmallIcon(R.drawable.ic_glyph)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(getString(R.string.notif_text))
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
