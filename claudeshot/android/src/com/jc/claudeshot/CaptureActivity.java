package com.jc.claudeshot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

/** An invisible screen that shows Android's "start screen capture?" prompt and reports the answer. */
public class CaptureActivity extends Activity {
    private static final int REQUEST_CAPTURE = 1;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) return; // recreated while the prompt is up; the answer still arrives
        try {
            startActivityForResult(consentIntent(), REQUEST_CAPTURE);
        } catch (ActivityNotFoundException | SecurityException e) {
            Log.w("ClaudeShot", "consent", e);
            report(false, 0, null);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CAPTURE) return;
        report(resultCode == RESULT_OK && data != null, resultCode, data);
    }

    private void report(boolean allowed, int resultCode, Intent data) {
        Intent i = new Intent(this, BubbleService.class);
        if (allowed) {
            i.setAction(BubbleService.ACTION_CAPTURE_ALLOWED)
                    .putExtra(BubbleService.EXTRA_RESULT_CODE, resultCode)
                    .putExtra(BubbleService.EXTRA_RESULT_DATA, data);
        } else {
            i.setAction(BubbleService.ACTION_CAPTURE_REFUSED);
        }
        try {
            startService(i);
        } catch (RuntimeException e) {
            Log.w("ClaudeShot", "report", e);
        }
        finish();
        overridePendingTransition(0, 0);
    }

    /**
     * On Android 14+ the prompt can offer "a single app"; screenshots need the whole screen, so ask
     * for that only. MediaProjectionConfig is API 34 and this app compiles against 30, hence the
     * reflection.
     */
    private Intent consentIntent() {
        MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Class<?> config = Class.forName("android.media.projection.MediaProjectionConfig");
                Object wholeScreen = config.getMethod("createConfigForDefaultDisplay").invoke(null);
                return (Intent) MediaProjectionManager.class.getMethod("createScreenCaptureIntent", config)
                        .invoke(mpm, wholeScreen);
            } catch (ReflectiveOperationException | RuntimeException e) {
                Log.w("ClaudeShot", "MediaProjectionConfig", e);
            }
        }
        return mpm.createScreenCaptureIntent();
    }
}
