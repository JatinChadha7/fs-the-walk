package com.jc.claudeshot;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Insets;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.Rect;
import android.graphics.Shader;
import android.hardware.display.DisplayManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;

/** The draggable floating button, plus the ✕ target shown at the bottom while it is dragged. */
final class Bubble {
    interface Listener {
        void onTap();

        void onDismiss();
    }

    private static final String TAG = "ClaudeShot";
    private static final long IDLE_DELAY_MS = 2500;
    private static final float IDLE_ALPHA = 0.6f;
    private static final float SHADOW_DP = 7;

    private final Context context;
    private final WindowManager wm;
    private final Listener listener;
    private final SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final float dp;
    private final int touchSlop;
    private final BubbleView view;
    private final WindowManager.LayoutParams lp;

    private BubbleStyle style;
    private int size; // window size: the button plus room for its shadow
    private TargetView target;
    private boolean shown;
    private boolean captureHidden;
    private boolean dragging;
    private boolean overTarget;
    private boolean tucked;
    private boolean wasTucked;
    private float downRawX;
    private float downRawY;
    private int downX;
    private int downY;
    private Rect screen; // full screen, cached while dragging
    private int targetX;
    private int targetY;
    private ValueAnimator slide;

    private final Runnable idle = new Runnable() {
        @Override
        public void run() {
            if (dragging || !shown || style.idle == BubbleStyle.IDLE_SOLID) return;
            view.animate().alpha(IDLE_ALPHA).setDuration(400).start();
            if (style.idle == BubbleStyle.IDLE_TUCK) tuck();
        }
    };

    Bubble(Context context, Listener listener) {
        this.context = context;
        this.listener = listener;
        wm = context.getSystemService(WindowManager.class);
        prefs = Prefs.of(context);
        dp = context.getResources().getDisplayMetrics().density;
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();

        view = new BubbleView(context, SHADOW_DP * dp);
        view.setContentDescription(context.getString(R.string.bubble_description));
        view.setOnTouchListener(touch);
        view.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                Bubble.this.listener.onTap();
            }
        });

        lp = overlayParams(0, 0, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        lp.gravity = Gravity.TOP | Gravity.LEFT;
        lp.setTitle("ClaudeShot button");
        setStyle(BubbleStyle.load(context));
    }

    /** Applies a new look; resizes and re-places the button if its size changed. */
    void setStyle(BubbleStyle newStyle) {
        style = newStyle;
        view.setStyle(newStyle);
        int newSize = Math.round((newStyle.buttonDp() + 2 * SHADOW_DP) * dp);
        if (newSize != size) {
            size = newSize;
            lp.width = size;
            lp.height = size;
        }
        if (shown && !dragging) {
            if (slide != null) slide.cancel();
            tucked = false;
            placeFromPrefs();
            update();
            view.animate().cancel();
            view.setAlpha(1f);
            scheduleIdle();
        }
    }

    void setShown(boolean show) {
        if (show == shown) return;
        if (show) {
            if (!Settings.canDrawOverlays(context)) return;
            tucked = false;
            placeFromPrefs();
            try {
                wm.addView(view, lp);
            } catch (RuntimeException e) {
                Log.w(TAG, "addView", e);
                return;
            }
            shown = true;
            view.setAlpha(1f);
            scheduleIdle();
        } else {
            endDrag(false);
            if (slide != null) slide.cancel();
            handler.removeCallbacks(idle);
            try {
                wm.removeViewImmediate(view);
            } catch (RuntimeException ignored) {
                // Already gone.
            }
            shown = false;
        }
    }

    /**
     * Hides the button while a screenshot is taken. The window stays on screen (only its content is
     * cleared) because Android lets an app open screens from the background only while one of its
     * overlay windows is visible.
     */
    void setCaptureHidden(boolean hidden) {
        captureHidden = hidden;
        view.setHidden(hidden);
    }

    /** Redraws the (hidden) button so Android composes a fresh frame of the screen. */
    void poke() {
        view.poke();
    }

    void onScreenChanged() {
        if (!shown || dragging) return;
        if (slide != null) slide.cancel();
        tucked = false;
        placeFromPrefs();
        update();
        scheduleIdle();
    }

    void destroy() {
        setShown(false);
        handler.removeCallbacksAndMessages(null);
    }

    // ---- touch

    private final View.OnTouchListener touch = new View.OnTouchListener() {
        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    handler.removeCallbacks(idle);
                    if (slide != null) slide.cancel();
                    view.animate().cancel();
                    view.setAlpha(1f);
                    view.press(true);
                    wasTucked = tucked;
                    downRawX = e.getRawX();
                    downRawY = e.getRawY();
                    downX = lp.x;
                    downY = lp.y;
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = e.getRawX() - downRawX;
                    float dy = e.getRawY() - downRawY;
                    if (!dragging && dx * dx + dy * dy > touchSlop * touchSlop) startDrag();
                    if (dragging) dragTo(downX + Math.round(dx), downY + Math.round(dy));
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    view.press(false);
                    if (dragging) {
                        endDrag(true);
                    } else if (wasTucked) {
                        snapToEdge(); // first tap on a tucked button only brings it out
                    } else {
                        v.performClick();
                    }
                    scheduleIdle();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    // Only a real release over ✕ turns the button off.
                    view.press(false);
                    overTarget = false;
                    if (dragging) endDrag(true);
                    else if (wasTucked) snapToEdge();
                    scheduleIdle();
                    return true;
                default:
                    return false;
            }
        }
    };

    private void startDrag() {
        dragging = true;
        tucked = false;
        view.press(false);
        screen = screenSize();
        Insets bars = systemBars();
        targetX = screen.width() / 2;
        targetY = screen.height() - bars.bottom - Math.round(TargetView.CENTER_FROM_BOTTOM_DP * dp);
        showTarget(bars.bottom);
    }

    private void dragTo(int x, int y) {
        x = clamp(x, 0, screen.width() - size);
        y = clamp(y, 0, screen.height() - size);
        float cx = x + size / 2f;
        float cy = y + size / 2f;
        boolean near = target != null && Math.hypot(cx - targetX, cy - targetY) < 80 * dp;
        if (near) {
            // Snap onto the target; the target itself shows the "release to remove" state.
            x = targetX - size / 2;
            y = targetY - size / 2;
        }
        if (near != overTarget) {
            overTarget = near;
            if (target != null) target.setActive(near);
            view.setHidden(near || captureHidden);
            if (near) view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
        }
        lp.x = x;
        lp.y = y;
        update();
    }

    private void endDrag(boolean commit) {
        if (!dragging) return;
        dragging = false;
        boolean dismiss = commit && overTarget;
        overTarget = false;
        hideTarget();
        view.setHidden(captureHidden);
        if (dismiss) {
            placeFromPrefs(); // next time it comes back where it was before this drag
            listener.onDismiss();
        } else if (commit) {
            snapToEdge();
        }
    }

    /** Slides to the nearest side edge, fully on screen, and remembers the spot. */
    private void snapToEdge() {
        Rect a = area();
        boolean right = lp.x + size / 2 > (a.left + a.right + size) / 2;
        tucked = false;
        slideTo(right ? a.right : a.left, clamp(lp.y, a.top, a.bottom), true);
    }

    /** Slides half the button off the edge it is resting on. */
    private void tuck() {
        Rect s = screenSize();
        boolean right = lp.x + size / 2 > s.width() / 2;
        tucked = true;
        slideTo(right ? s.width() - size / 2 : -size / 2, lp.y, false);
    }

    private void slideTo(final int toX, final int toY, final boolean save) {
        if (slide != null) slide.cancel();
        final int fromX = lp.x;
        final int fromY = lp.y;
        slide = ValueAnimator.ofFloat(0f, 1f);
        slide.setDuration(260);
        slide.setInterpolator(new DecelerateInterpolator(1.5f));
        slide.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator animation) {
                float t = (Float) animation.getAnimatedValue();
                lp.x = Math.round(fromX + (toX - fromX) * t);
                lp.y = Math.round(fromY + (toY - fromY) * t);
                update();
            }
        });
        slide.addListener(new AnimatorListenerAdapter() {
            private boolean cancelled;

            @Override
            public void onAnimationCancel(Animator animation) {
                cancelled = true;
            }

            @Override
            public void onAnimationEnd(Animator animation) {
                if (save && !cancelled) savePosition();
            }
        });
        slide.start();
    }

    private void scheduleIdle() {
        handler.removeCallbacks(idle);
        if (shown) handler.postDelayed(idle, IDLE_DELAY_MS);
    }

    // ---- the ✕ target

    private void showTarget(int bottomInset) {
        if (target == null) target = new TargetView(context);
        target.setBottomInset(bottomInset);
        target.setActive(false);
        target.setAlpha(0f);
        WindowManager.LayoutParams tlp = overlayParams(WindowManager.LayoutParams.MATCH_PARENT,
                Math.round(TargetView.HEIGHT_DP * dp) + bottomInset,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE);
        tlp.gravity = Gravity.BOTTOM | Gravity.LEFT;
        tlp.setTitle("ClaudeShot remove target");
        try {
            // Added only for the length of a drag: Android blocks touches that pass through an
            // opaque overlay of another app, so it must not stay on screen.
            wm.addView(target, tlp);
            target.animate().alpha(1f).setDuration(150).start();
        } catch (RuntimeException e) {
            Log.w(TAG, "target", e);
            target = null;
        }
    }

    private void hideTarget() {
        if (target == null) return;
        try {
            wm.removeViewImmediate(target);
        } catch (RuntimeException ignored) {
            // Already gone.
        }
        target = null;
    }

    // ---- geometry

    private static WindowManager.LayoutParams overlayParams(int width, int height, int flags) {
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(width, height,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                flags | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        // Position relative to the whole screen, not the area between the system bars.
        p.setFitInsetsTypes(0);
        p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        p.windowAnimations = 0;
        return p;
    }

    private Rect screenSize() {
        Point p = new Point();
        Display d = context.getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
        d.getRealSize(p);
        return new Rect(0, 0, p.x, p.y);
    }

    /** Status bar, navigation bar and camera cutout sizes, with sane defaults if Android won't say. */
    private Insets systemBars() {
        Rect s = screenSize();
        try {
            Insets i = wm.getCurrentWindowMetrics().getWindowInsets().getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            int limitX = s.width() / 4;
            int limitY = s.height() / 4;
            if (i.left <= limitX && i.right <= limitX && i.top <= limitY && i.bottom <= limitY) return i;
        } catch (RuntimeException e) {
            Log.w(TAG, "insets", e);
        }
        return Insets.of(0, Math.round(24 * dp), 0, Math.round(24 * dp));
    }

    /** Where the button's window may rest: top-left positions that keep it clear of the system bars. */
    private Rect area() {
        Rect s = screenSize();
        Insets i = systemBars();
        int left = i.left;
        int top = i.top;
        int right = Math.max(left, s.width() - i.right - size);
        int bottom = Math.max(top, s.height() - i.bottom - size);
        return new Rect(left, top, right, bottom);
    }

    private void placeFromPrefs() {
        Rect a = area();
        boolean right = prefs.getBoolean(Prefs.BUBBLE_RIGHT, true);
        float y = prefs.getFloat(Prefs.BUBBLE_Y, 0.4f);
        lp.x = right ? a.right : a.left;
        lp.y = a.top + Math.round(Math.max(0f, Math.min(1f, y)) * a.height());
    }

    private void savePosition() {
        Rect a = area();
        float y = a.height() > 0 ? (lp.y - a.top) / (float) a.height() : 0f;
        prefs.edit()
                .putBoolean(Prefs.BUBBLE_RIGHT, lp.x > (a.left + a.right) / 2)
                .putFloat(Prefs.BUBBLE_Y, y)
                .apply();
    }

    private void update() {
        if (!shown) return;
        try {
            wm.updateViewLayout(view, lp);
        } catch (RuntimeException ignored) {
            // Removed meanwhile.
        }
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    /** Dark fade along the bottom edge with a round ✕ that turns red when the button is over it. */
    private static final class TargetView extends View {
        static final float HEIGHT_DP = 170;
        static final float CENTER_FROM_BOTTOM_DP = 72;

        private final Paint scrim = new Paint();
        private final Paint circle = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint cross = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float dp;
        private int bottomInset;
        private boolean active;

        TargetView(Context context) {
            super(context);
            dp = context.getResources().getDisplayMetrics().density;
            cross.setStyle(Paint.Style.STROKE);
            cross.setStrokeCap(Paint.Cap.ROUND);
            cross.setStrokeWidth(2.5f * dp);
            cross.setColor(0xFFFFFFFF);
        }

        void setBottomInset(int inset) {
            bottomInset = inset;
            invalidate();
        }

        void setActive(boolean active) {
            if (this.active == active) return;
            this.active = active;
            invalidate();
        }

        @Override
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            scrim.setShader(new LinearGradient(0, 0, 0, h, 0x00000000, 0x99000000, Shader.TileMode.CLAMP));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            canvas.drawRect(0, 0, getWidth(), getHeight(), scrim);
            float cx = getWidth() / 2f;
            float cy = getHeight() - bottomInset - CENTER_FROM_BOTTOM_DP * dp;
            float r = (active ? 36 : 28) * dp;
            circle.setColor(active ? 0xFFE5484D : 0xE62A2930);
            canvas.drawCircle(cx, cy, r, circle);
            float arm = 7 * dp;
            canvas.drawLine(cx - arm, cy - arm, cx + arm, cy + arm, cross);
            canvas.drawLine(cx - arm, cy + arm, cx + arm, cy - arm, cross);
        }
    }
}
