package com.jc.claudeshot;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.view.View;

/**
 * The floating button's look: a gradient disc with a soft shadow and an icon or letters, drawn
 * in the middle of the view with {@code margin} left around it for the shadow. Used on screen and
 * for the previews in the settings.
 */
final class BubbleView extends View {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float margin;
    private final float dp;
    private BubbleStyle style;
    private Drawable icon;
    private boolean hidden;
    private boolean poked;
    private final Paint pokePaint = new Paint();

    BubbleView(Context context, float margin) {
        super(context);
        this.margin = margin;
        dp = context.getResources().getDisplayMetrics().density;
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(1.5f * dp);
        text.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        text.setTextAlign(Paint.Align.CENTER);
        setStyle(BubbleStyle.load(context));
    }

    void setStyle(BubbleStyle style) {
        this.style = style;
        if (style.icon == BubbleStyle.ICON_LETTERS) {
            icon = null;
        } else {
            icon = getContext().getDrawable(style.iconRes()).mutate();
            icon.setTint(style.iconColor());
        }
        text.setColor(style.iconColor());
        ring.setColor(style.lightButton() ? 0x1F000000 : 0x4DFFFFFF);
        updateShaders();
        invalidate();
    }

    /**
     * Changes one pixel by a single step of transparency, invisible to the eye: enough for Android
     * to draw and compose a new frame. Used while the button is hidden for a screenshot.
     */
    void poke() {
        poked = !poked;
        invalidate();
    }

    void setHidden(boolean hidden) {
        if (this.hidden == hidden) return;
        this.hidden = hidden;
        invalidate();
    }

    void press(boolean pressed) {
        float s = pressed ? 0.88f : 1f;
        animate().scaleX(s).scaleY(s).setDuration(pressed ? 80 : 160).start();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        updateShaders();
    }

    private void updateShaders() {
        int w = getWidth();
        if (w == 0) return;
        float r = w / 2f;
        float button = r - margin;
        fill.setShader(new LinearGradient(margin, margin, w - margin, w - margin,
                style.topColor(), style.bottomColor(), Shader.TileMode.CLAMP));
        shadow.setShader(new RadialGradient(r, r, r,
                new int[] {0x66000000, 0x33000000, 0x00000000},
                new float[] {Math.max(0f, (button - 2 * dp) / r), button / r, 1f},
                Shader.TileMode.CLAMP));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (hidden) {
            if (poked) {
                pokePaint.setColor(0x01000000);
                canvas.drawRect(0, 0, 1, 1, pokePaint);
            }
            return;
        }
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float button = Math.min(cx, cy) - margin;
        canvas.save();
        canvas.translate(0, 1.5f * dp);
        canvas.drawCircle(cx, cy, Math.min(cx, cy), shadow);
        canvas.restore();
        canvas.drawCircle(cx, cy, button, fill);
        canvas.drawCircle(cx, cy, button - ring.getStrokeWidth() / 2f, ring);
        if (icon != null) {
            int half = Math.round(button * 0.48f);
            int x = Math.round(cx);
            int y = Math.round(cy);
            icon.setBounds(x - half, y - half, x + half, y + half);
            icon.draw(canvas);
        } else {
            String s = style.letters;
            text.setTextSize(button * (s.codePointCount(0, s.length()) > 1 ? 0.78f : 0.95f));
            Paint.FontMetrics fm = text.getFontMetrics();
            canvas.drawText(s, cx, cy - (fm.ascent + fm.descent) / 2f, text);
        }
    }
}
