package com.jc.claudeshot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.widget.CompoundButton;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

/** Settings: the overlay permission, the floating button and its style, and the phone-button screenshots. */
public class MainActivity extends Activity {
    private static final int REQUEST_NOTIFICATIONS = 1;
    private static final int REQUEST_PHOTOS = 2;
    private static final String POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS"; // API 33

    private TextView overlayChip;
    private TextView overlayBody;
    private View overlayButton;
    private View restrictedHint;
    private View overlayAppInfo;
    private TextView bubbleBody;
    private Switch bubbleSwitch;
    private Switch watchSwitch;
    private TextView watchHint;
    private View watchAppInfo;
    private Switch keepReady;
    private StylePicker stylePicker;
    private boolean refreshing;

    private final Runnable onServiceChanged = new Runnable() {
        @Override
        public void run() {
            refresh();
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setDecorFitsSystemWindows(false);
        setContentView(R.layout.activity_main);

        final View content = findViewById(R.id.content);
        final int pad = content.getPaddingLeft();
        findViewById(R.id.scroll).setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                content.setPadding(pad + i.left, pad + i.top, pad + i.right, pad + i.bottom);
                return WindowInsets.CONSUMED;
            }
        });

        overlayChip = findViewById(R.id.overlay_chip);
        overlayBody = findViewById(R.id.overlay_body);
        overlayButton = findViewById(R.id.overlay_button);
        restrictedHint = findViewById(R.id.restricted_hint);
        overlayAppInfo = findViewById(R.id.overlay_app_info);
        bubbleBody = findViewById(R.id.bubble_body);
        bubbleSwitch = findViewById(R.id.bubble_switch);
        watchSwitch = findViewById(R.id.watch_switch);
        watchHint = findViewById(R.id.watch_hint);
        watchAppInfo = findViewById(R.id.watch_app_info);
        keepReady = findViewById(R.id.keep_ready);
        stylePicker = new StylePicker(this);

        overlayButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openOverlaySettings();
            }
        });
        View.OnClickListener appInfo = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openAppInfo();
            }
        };
        overlayAppInfo.setOnClickListener(appInfo);
        watchAppInfo.setOnClickListener(appInfo);
        findViewById(R.id.battery_app_info).setOnClickListener(appInfo);

        bubbleSwitch.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                if (!refreshing) setBubbleOn(checked);
            }
        });
        watchSwitch.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                if (!refreshing) setWatchOn(checked);
            }
        });
        keepReady.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                if (!refreshing) Prefs.of(MainActivity.this).edit().putBoolean(Prefs.KEEP_READY, checked).apply();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        BubbleService.setStateListener(onServiceChanged);
        // Back from the overlay settings, after a restart the phone blocked, and so on.
        startOrSync();
        refresh();
    }

    @Override
    protected void onPause() {
        BubbleService.setStateListener(null);
        super.onPause();
    }

    private void refresh() {
        refreshing = true;
        boolean overlay = Settings.canDrawOverlays(this);

        chip(overlayChip, overlay ? R.string.status_done : R.string.status_needed,
                overlay ? R.color.chip_ok_bg : R.color.chip_wait_bg, overlay ? R.color.chip_ok_text : R.color.chip_wait_text);
        overlayBody.setText(overlay ? R.string.step1_done : R.string.step1_body);
        int setupVisibility = overlay ? View.GONE : View.VISIBLE;
        overlayButton.setVisibility(setupVisibility);
        restrictedHint.setVisibility(setupVisibility);
        overlayAppInfo.setVisibility(setupVisibility);

        boolean bubbleOn = Prefs.bubbleReady(this);
        bubbleSwitch.setEnabled(overlay);
        bubbleSwitch.setChecked(bubbleOn);
        bubbleBody.setText(!overlay ? R.string.bubble_locked : bubbleOn ? R.string.bubble_on : R.string.bubble_off);

        boolean watchWanted = Prefs.watchScreenshots(this);
        boolean canRead = ScreenshotWatcher.canRead(this);
        watchSwitch.setChecked(watchWanted && canRead);
        int hint = ScreenshotWatcher.hasPartialAccess(this) ? R.string.watch_partial
                : watchWanted && !canRead ? R.string.watch_needs_photos : 0;
        watchHint.setVisibility(hint != 0 ? View.VISIBLE : View.GONE);
        watchAppInfo.setVisibility(hint != 0 ? View.VISIBLE : View.GONE);
        if (hint != 0) watchHint.setText(hint);

        keepReady.setChecked(Prefs.keepReady(this));
        stylePicker.refresh();
        refreshing = false;
    }

    private void chip(TextView chip, int text, int bg, int fg) {
        chip.setText(text);
        chip.setBackgroundTintList(ColorStateList.valueOf(getColor(bg)));
        chip.setTextColor(getColor(fg));
    }

    // ---- switches

    private void setBubbleOn(boolean on) {
        if (on && !Settings.canDrawOverlays(this)) {
            openOverlaySettings();
            refresh();
            return;
        }
        Prefs.of(this).edit().putBoolean(Prefs.BUBBLE_ON, on).apply();
        startOrSync();
        refresh();
    }

    private void setWatchOn(boolean on) {
        if (on && !ScreenshotWatcher.canRead(this)) {
            String[] wanted = Build.VERSION.SDK_INT >= 34
                    ? new String[] {ScreenshotWatcher.READ_MEDIA_IMAGES, ScreenshotWatcher.READ_MEDIA_PARTIAL}
                    : Build.VERSION.SDK_INT >= 33
                    ? new String[] {ScreenshotWatcher.READ_MEDIA_IMAGES}
                    : new String[] {ScreenshotWatcher.READ_STORAGE};
            requestPermissions(wanted, REQUEST_PHOTOS);
            return;
        }
        Prefs.of(this).edit().putBoolean(Prefs.WATCH_SCREENSHOTS, on).apply();
        startOrSync();
        refresh();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQUEST_PHOTOS) {
            if (ScreenshotWatcher.canRead(this)) {
                Prefs.of(this).edit().putBoolean(Prefs.WATCH_SCREENSHOTS, true).apply();
            } else {
                Toast.makeText(this, R.string.photos_denied, Toast.LENGTH_LONG).show();
            }
        }
        // Notifications are optional: ClaudeShot works either way.
        startOrSync();
        refresh();
    }

    /**
     * Starts or updates ClaudeShot to match the switches. The first time something is on, asks
     * once for notifications so the "ClaudeShot is on" notice with its Stop button can show.
     */
    private void startOrSync() {
        boolean wanted = Prefs.bubbleReady(this) || Prefs.watchScreenshots(this);
        if (wanted && Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !Prefs.of(this).getBoolean(Prefs.ASKED_NOTIFICATIONS, false)) {
            Prefs.of(this).edit().putBoolean(Prefs.ASKED_NOTIFICATIONS, true).apply();
            requestPermissions(new String[] {POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            return; // continues in onRequestPermissionsResult
        }
        try {
            BubbleService.sync(this);
        } catch (RuntimeException e) {
            Toast.makeText(this, R.string.start_failed, Toast.LENGTH_LONG).show();
        }
    }

    private void openOverlaySettings() {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            openAppInfo();
        }
    }

    private void openAppInfo() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }
}
