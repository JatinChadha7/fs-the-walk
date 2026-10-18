package com.jc.claudeshot;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

/** Settings shared by the screens and the floating-button service. */
final class Prefs {
    static final String BUBBLE_ON = "bubble_on";
    static final String WATCH_SCREENSHOTS = "watch_screenshots";
    static final String KEEP_READY = "keep_ready";
    static final String BUBBLE_RIGHT = "bubble_right";
    static final String BUBBLE_Y = "bubble_y";
    static final String ASKED_NOTIFICATIONS = "asked_notifications";
    static final String STYLE_COLOR = "style_color";
    static final String STYLE_ICON = "style_icon";
    static final String STYLE_SIZE = "style_size"; // 1.3 and older: 0, 1, 2 for small, medium, large
    static final String STYLE_SIZE_DP = "style_size_dp";
    static final String STYLE_IDLE = "style_idle";
    static final String STYLE_LETTERS = "style_letters";
    static final String TOOL = "tool";
    static final String COLOR = "color";
    static final String SIZE = "size";

    private Prefs() {}

    static SharedPreferences of(Context context) {
        return context.getSharedPreferences("claudeshot", Context.MODE_PRIVATE);
    }

    /** The floating button is wanted (it also needs the overlay permission to show). */
    static boolean bubbleOn(Context context) {
        return of(context).getBoolean(BUBBLE_ON, true);
    }

    /** The floating button is wanted and allowed. */
    static boolean bubbleReady(Context context) {
        return bubbleOn(context) && Settings.canDrawOverlays(context);
    }

    /** Screenshots taken with the phone's own buttons open in the editor. */
    static boolean watchScreenshots(Context context) {
        return of(context).getBoolean(WATCH_SCREENSHOTS, false);
    }

    /** Whether the screen-capture session stays open between screenshots. */
    static boolean keepReady(Context context) {
        return of(context).getBoolean(KEEP_READY, true);
    }
}
