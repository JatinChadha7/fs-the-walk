package com.jc.claudeshot;

import android.content.Context;
import android.content.SharedPreferences;

/** How the floating button looks: colour, icon, size, and what it does while not in use. */
final class BubbleStyle {
    static final int[] COLOR_NAMES = {
            R.string.color_violet, R.string.color_blue, R.string.color_green, R.string.color_coral,
            R.string.color_orange, R.string.color_black, R.string.color_white};
    // Top-left and bottom-right of each button's gradient.
    private static final int[][] GRADIENTS = {
            {0xFF9B7EFF, 0xFF5530E0},
            {0xFF64B0FF, 0xFF1E63E9},
            {0xFF52D98C, 0xFF149A45},
            {0xFFFF8A7A, 0xFFE0344A},
            {0xFFFFB955, 0xFFF07800},
            {0xFF4A4A52, 0xFF141418},
            {0xFFFFFFFF, 0xFFE4E2EC}};
    private static final int WHITE = 6;
    private static final int DEFAULT_COLOR = 1; // blue

    static final int ICON_VIEWFINDER = 0;
    static final int ICON_CAMERA = 1;
    static final int ICON_SCISSORS = 2;
    static final int ICON_PENCIL = 3;
    static final int ICON_LETTERS = 4;
    static final int[] ICON_NAMES = {
            R.string.icon_viewfinder, R.string.icon_camera, R.string.icon_scissors, R.string.icon_pencil,
            R.string.icon_letters};
    private static final int[] ICON_RES = {
            R.drawable.ic_glyph, R.drawable.ic_camera, R.drawable.ic_scissors, R.drawable.ic_pen, 0};

    static final float MIN_SIZE_DP = 24;
    static final float MAX_SIZE_DP = 64;
    private static final float DEFAULT_SIZE_DP = 44;
    private static final float[] OLD_SIZE_DP = {DEFAULT_SIZE_DP, 52, 60}; // small / medium / large of 1.3

    static final int IDLE_SOLID = 0;
    static final int IDLE_FADE = 1;
    static final int IDLE_TUCK = 2;
    static final int[] IDLE_NAMES = {R.string.idle_solid, R.string.idle_fade, R.string.idle_tuck};

    static final String DEFAULT_LETTERS = "JC";

    final int color;
    final int icon;
    final float sizeDp; // diameter of the button
    final int idle;
    final String letters;

    BubbleStyle(int color, int icon, float sizeDp, int idle, String letters) {
        this.color = clamp(color, GRADIENTS.length);
        this.icon = clamp(icon, ICON_NAMES.length);
        this.sizeDp = Math.max(MIN_SIZE_DP, Math.min(MAX_SIZE_DP, sizeDp));
        this.idle = clamp(idle, IDLE_NAMES.length);
        this.letters = cleanLetters(letters);
    }

    static BubbleStyle load(Context context) {
        SharedPreferences p = Prefs.of(context);
        return new BubbleStyle(
                p.getInt(Prefs.STYLE_COLOR, DEFAULT_COLOR),
                p.getInt(Prefs.STYLE_ICON, ICON_LETTERS),
                p.getFloat(Prefs.STYLE_SIZE_DP, OLD_SIZE_DP[clamp(p.getInt(Prefs.STYLE_SIZE, 0), OLD_SIZE_DP.length)]),
                p.getInt(Prefs.STYLE_IDLE, IDLE_FADE),
                p.getString(Prefs.STYLE_LETTERS, DEFAULT_LETTERS));
    }

    BubbleStyle withIcon(int newIcon) {
        return new BubbleStyle(color, newIcon, sizeDp, idle, letters);
    }

    BubbleStyle withColor(int newColor) {
        return new BubbleStyle(newColor, icon, sizeDp, idle, letters);
    }

    static String cleanLetters(String s) {
        if (s == null) return DEFAULT_LETTERS;
        String t = s.trim();
        if (t.isEmpty()) return DEFAULT_LETTERS;
        int end = t.offsetByCodePoints(0, Math.min(2, t.codePointCount(0, t.length())));
        return t.substring(0, end).toUpperCase(java.util.Locale.getDefault());
    }

    int topColor() {
        return GRADIENTS[color][0];
    }

    int bottomColor() {
        return GRADIENTS[color][1];
    }

    boolean lightButton() {
        return color == WHITE;
    }

    /** White on coloured buttons, near-black on the white one. */
    int iconColor() {
        return lightButton() ? 0xFF26232E : 0xFFFFFFFF;
    }

    int iconRes() {
        return ICON_RES[icon];
    }

    float buttonDp() {
        return sizeDp;
    }

    /** Room around the button for its soft shadow: less on small buttons, so it isn't a halo. */
    float shadowDp() {
        return Math.max(4f, Math.min(7f, sizeDp * 0.135f));
    }

    /** The whole window: the button plus its shadow on every side. */
    float windowDp() {
        return sizeDp + 2 * shadowDp();
    }

    private static int clamp(int v, int count) {
        return v < 0 || v >= count ? 0 : v;
    }
}
