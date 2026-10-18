package com.jc.floatshot;

import android.content.Context;
import android.content.SharedPreferences;

/** Settings shared by the screens and the floating-button service. */
final class Prefs {
    static final String KEEP_READY = "keep_ready";
    static final String BUBBLE_RIGHT = "bubble_right";
    static final String BUBBLE_Y = "bubble_y";
    static final String ASKED_NOTIFICATIONS = "asked_notifications";
    static final String TOOL = "tool";
    static final String COLOR = "color";
    static final String SIZE = "size";

    private Prefs() {}

    static SharedPreferences of(Context context) {
        return context.getSharedPreferences("floatshot", Context.MODE_PRIVATE);
    }

    /** Whether the screen-capture session stays open between screenshots. */
    static boolean keepReady(Context context) {
        return of(context).getBoolean(KEEP_READY, true);
    }
}
