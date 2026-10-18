package com.jc.floatshot;

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
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

/** Setup screen: grant the overlay permission, start or stop the floating button, settings. */
public class MainActivity extends Activity {
    private static final int REQUEST_NOTIFICATIONS = 1;
    private static final String POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS"; // API 33

    private TextView overlayChip;
    private TextView overlayBody;
    private View overlayButton;
    private View restrictedHint;
    private View overlayAppInfo;
    private TextView bubbleChip;
    private TextView bubbleBody;
    private Button bubbleButton;
    private Switch keepReady;

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
        bubbleChip = findViewById(R.id.bubble_chip);
        bubbleBody = findViewById(R.id.bubble_body);
        bubbleButton = findViewById(R.id.bubble_button);
        keepReady = findViewById(R.id.keep_ready);

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
        findViewById(R.id.battery_app_info).setOnClickListener(appInfo);
        bubbleButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleBubble();
            }
        });
        keepReady.setChecked(Prefs.keepReady(this));
        keepReady.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                Prefs.of(MainActivity.this).edit().putBoolean(Prefs.KEEP_READY, checked).apply();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        BubbleService.setStateListener(onServiceChanged);
        refresh();
    }

    @Override
    protected void onPause() {
        BubbleService.setStateListener(null);
        super.onPause();
    }

    private void refresh() {
        boolean overlay = Settings.canDrawOverlays(this);
        boolean running = BubbleService.isRunning();

        chip(overlayChip, overlay ? R.string.status_done : R.string.status_needed,
                overlay ? R.color.chip_ok_bg : R.color.chip_wait_bg, overlay ? R.color.chip_ok_text : R.color.chip_wait_text);
        overlayBody.setText(overlay ? R.string.step1_done : R.string.step1_body);
        int setupVisibility = overlay ? View.GONE : View.VISIBLE;
        overlayButton.setVisibility(setupVisibility);
        restrictedHint.setVisibility(setupVisibility);
        overlayAppInfo.setVisibility(setupVisibility);

        chip(bubbleChip, running ? R.string.status_on : R.string.status_off,
                running ? R.color.chip_ok_bg : R.color.chip_off_bg, running ? R.color.chip_ok_text : R.color.chip_off_text);
        bubbleBody.setText(!overlay ? R.string.step2_locked : running ? R.string.step2_on : R.string.step2_off);
        bubbleButton.setEnabled(overlay);
        bubbleButton.setText(running ? R.string.stop_bubble : R.string.start_bubble);
        bubbleButton.setBackgroundResource(running ? R.drawable.btn_outlined : R.drawable.btn_filled);
        bubbleButton.setTextColor(getColorStateList(running ? R.color.accent : R.color.btn_filled_text));
    }

    private void chip(TextView chip, int text, int bg, int fg) {
        chip.setText(text);
        chip.setBackgroundTintList(ColorStateList.valueOf(getColor(bg)));
        chip.setTextColor(getColor(fg));
    }

    private void toggleBubble() {
        if (BubbleService.isRunning()) {
            BubbleService.stop(this);
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            openOverlaySettings();
            return;
        }
        // Ask once for notifications so the "FloatShot is on" notification with its Stop button shows.
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !Prefs.of(this).getBoolean(Prefs.ASKED_NOTIFICATIONS, false)) {
            Prefs.of(this).edit().putBoolean(Prefs.ASKED_NOTIFICATIONS, true).apply();
            requestPermissions(new String[] {POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            return;
        }
        startBubble();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQUEST_NOTIFICATIONS) startBubble(); // the button works either way
    }

    private void startBubble() {
        try {
            BubbleService.start(this);
            Toast.makeText(this, R.string.bubble_started, Toast.LENGTH_LONG).show();
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
