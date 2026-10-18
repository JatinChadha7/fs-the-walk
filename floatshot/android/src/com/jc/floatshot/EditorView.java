package com.jc.floatshot;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/**
 * Shows a screenshot and lets the user mark it up, blur parts of it and crop it.
 *
 * Marks are kept as shapes in screenshot pixels and drawn on top of the image, so undo just drops
 * the last shape. Cropping flattens the marks into a new, smaller image.
 */
public final class EditorView extends View {
    static final int PEN = 0;
    static final int MARKER = 1;
    static final int ARROW = 2;
    static final int BOX = 3;
    static final int TEXT = 4;
    static final int BLUR = 5;
    static final int CROP = 6;

    interface Listener {
        /** Something was added, undone, redone or cropped. */
        void onEdited();

        /** The user tapped with the Text tool at this point of the screenshot. */
        void onTextRequested(float x, float y);
    }

    // Sizes in units of 1/360 of the screenshot's shorter side, so marks look alike on any phone.
    private static final float[] PEN_WIDTH = {1.5f, 3f, 5.5f};
    private static final float[] MARKER_WIDTH = {9f, 15f, 24f};
    private static final float[] LINE_WIDTH = {2f, 3.5f, 6f};
    private static final float[] TEXT_SIZE = {14f, 20f, 30f};
    private static final float BLUR_BLOCK = 6f;
    private static final int MARKER_ALPHA = 110;

    private static final int GRAB_LEFT = 1;
    private static final int GRAB_TOP = 2;
    private static final int GRAB_RIGHT = 4;
    private static final int GRAB_BOTTOM = 8;
    private static final int GRAB_MOVE = 16;

    private final float dp;
    private final Matrix toView = new Matrix();
    private final Matrix toImage = new Matrix();
    private final RectF imageInView = new RectF();
    private final float[] point = new float[2];
    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Paint frame = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dim = new Paint();
    private final Paint cropLine = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cropGuide = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cropHandle = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float scale = 1f;

    private Bitmap image;
    private float unit = 1f;
    private final List<Shape> shapes = new ArrayList<>();
    private final ArrayDeque<Edit> undoStack = new ArrayDeque<>();
    private final ArrayDeque<Edit> redoStack = new ArrayDeque<>();
    private int version;

    private int tool = PEN;
    private int color = 0xFFFF3B30;
    private int size = 1;
    private Listener listener;

    private Shape drawing;
    private float downX;
    private float downY;
    private float lastViewX;
    private float lastViewY;
    private float travel;
    private boolean ignoreGesture;

    private boolean cropping;
    private final RectF crop = new RectF();
    private final RectF cropAtDown = new RectF();
    private final RectF cropView = new RectF();
    private int cropGrab;
    private float cropDownX;
    private float cropDownY;

    public EditorView(Context context, AttributeSet attrs) {
        super(context, attrs);
        dp = getResources().getDisplayMetrics().density;
        frame.setStyle(Paint.Style.STROKE);
        frame.setStrokeWidth(dp);
        frame.setColor(0x33FFFFFF);
        dim.setColor(0xB3000000);
        cropLine.setStyle(Paint.Style.STROKE);
        cropLine.setStrokeWidth(1.5f * dp);
        cropLine.setColor(Color.WHITE);
        cropGuide.setStyle(Paint.Style.STROKE);
        cropGuide.setStrokeWidth(dp);
        cropGuide.setColor(0x66FFFFFF);
        cropHandle.setStyle(Paint.Style.STROKE);
        cropHandle.setStrokeWidth(4 * dp);
        cropHandle.setStrokeCap(Paint.Cap.ROUND);
        cropHandle.setColor(Color.WHITE);
        setContentDescription(context.getString(R.string.clip_label));
    }

    // ---- state

    void setListener(Listener listener) {
        this.listener = listener;
    }

    void setImage(Bitmap bitmap) {
        image = bitmap;
        unit = Math.min(bitmap.getWidth(), bitmap.getHeight()) / 360f;
        shapes.clear();
        undoStack.clear();
        redoStack.clear();
        updateMatrix();
        invalidate();
    }

    int getTool() {
        return tool;
    }

    void setTool(int tool) {
        this.tool = tool;
    }

    int getColor() {
        return color;
    }

    void setColor(int color) {
        this.color = color;
    }

    int getSize() {
        return size;
    }

    void setSize(int size) {
        this.size = Math.max(0, Math.min(2, size));
    }

    /** Changes with every edit, so callers can tell whether what they saved is still current. */
    int getVersion() {
        return version;
    }

    boolean canUndo() {
        return !cropping && !undoStack.isEmpty();
    }

    boolean canRedo() {
        return !cropping && !redoStack.isEmpty();
    }

    boolean isCropping() {
        return cropping;
    }

    void undo() {
        if (!canUndo() || drawing != null) return;
        Edit e = undoStack.pop();
        if (e.added != null) {
            shapes.remove(e.added);
        } else {
            image = e.before;
            shapes.clear();
            shapes.addAll(e.shapesBefore);
            updateMatrix();
        }
        redoStack.push(e);
        changed();
    }

    void redo() {
        if (!canRedo() || drawing != null) return;
        Edit e = redoStack.pop();
        if (e.added != null) {
            shapes.add(e.added);
        } else {
            image = e.after;
            shapes.clear();
            updateMatrix();
        }
        undoStack.push(e);
        changed();
    }

    void addText(String text, float x, float y) {
        if (image == null) return;
        add(new TextShape(text, color, TEXT_SIZE[size] * unit, x, y, image.getWidth()));
    }

    /** The screenshot with every mark drawn in, at full resolution. */
    Bitmap render() {
        Bitmap out = Bitmap.createBitmap(image.getWidth(), image.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        canvas.drawBitmap(image, 0, 0, null);
        for (Shape s : shapes) s.draw(canvas);
        out.setHasAlpha(false);
        return out;
    }

    private void add(Shape shape) {
        shapes.add(shape);
        undoStack.push(new Edit(shape));
        redoStack.clear();
        changed();
    }

    private void changed() {
        version++;
        invalidate();
        if (listener != null) listener.onEdited();
    }

    // ---- crop

    void startCrop() {
        if (image == null) return;
        drawing = null;
        cropping = true;
        crop.set(0, 0, image.getWidth(), image.getHeight());
        updateExclusion();
        invalidate();
    }

    void cancelCrop() {
        cropping = false;
        updateExclusion();
        invalidate();
    }

    void applyCrop() {
        if (!cropping) return;
        cropping = false;
        updateExclusion();
        Rect r = new Rect(Math.round(crop.left), Math.round(crop.top), Math.round(crop.right), Math.round(crop.bottom));
        boolean whole = r.left <= 0 && r.top <= 0 && r.right >= image.getWidth() && r.bottom >= image.getHeight();
        if (whole || !r.intersect(0, 0, image.getWidth(), image.getHeight()) || r.width() < 2 || r.height() < 2) {
            invalidate();
            return;
        }
        Bitmap flat = render();
        Bitmap cut = Bitmap.createBitmap(flat, r.left, r.top, r.width(), r.height());
        if (cut != flat) flat.recycle();
        Edit edit = new Edit(image, new ArrayList<>(shapes), cut);
        image = cut;
        shapes.clear();
        updateMatrix();
        undoStack.push(edit);
        redoStack.clear();
        changed();
    }

    /** Keeps Android's back gesture from stealing drags that start on a crop corner near the edge. */
    private void updateExclusion() {
        List<Rect> rects = new ArrayList<>();
        if (cropping) {
            toView.mapRect(cropView, crop);
            int r = Math.round(32 * dp);
            float[] xs = {cropView.left, cropView.right};
            float[] ys = {cropView.top, cropView.bottom};
            for (float x : xs) {
                for (float y : ys) {
                    rects.add(new Rect(Math.round(x) - r, Math.round(y) - r, Math.round(x) + r, Math.round(y) + r));
                }
            }
        }
        setSystemGestureExclusionRects(rects);
    }

    // ---- layout and drawing

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        updateMatrix();
    }

    private void updateMatrix() {
        if (image == null || getWidth() == 0 || getHeight() == 0) return;
        float pad = 14 * dp;
        float availW = getWidth() - 2 * pad;
        float availH = getHeight() - 2 * pad;
        scale = Math.min(availW / image.getWidth(), availH / image.getHeight());
        float w = image.getWidth() * scale;
        float h = image.getHeight() * scale;
        float left = (getWidth() - w) / 2f;
        float top = (getHeight() - h) / 2f;
        toView.setScale(scale, scale);
        toView.postTranslate(left, top);
        toView.invert(toImage);
        imageInView.set(left, top, left + w, top + h);
        if (cropping) updateExclusion();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (image == null) return;
        // A hairline frame so a dark screenshot doesn't melt into the dark background.
        canvas.drawRect(imageInView.left - dp / 2, imageInView.top - dp / 2,
                imageInView.right + dp / 2, imageInView.bottom + dp / 2, frame);
        int save = canvas.save();
        canvas.concat(toView);
        canvas.clipRect(0, 0, image.getWidth(), image.getHeight());
        canvas.drawBitmap(image, 0, 0, bitmapPaint);
        for (Shape s : shapes) s.draw(canvas);
        if (drawing != null) drawing.draw(canvas);
        canvas.restoreToCount(save);
        if (cropping) drawCrop(canvas);
    }

    private void drawCrop(Canvas canvas) {
        toView.mapRect(cropView, crop);
        float l = cropView.left;
        float t = cropView.top;
        float r = cropView.right;
        float b = cropView.bottom;
        canvas.save();
        canvas.clipOutRect(cropView);
        canvas.drawRect(imageInView, dim);
        canvas.restore();
        for (int i = 1; i <= 2; i++) {
            float x = l + cropView.width() * i / 3f;
            float y = t + cropView.height() * i / 3f;
            canvas.drawLine(x, t, x, b, cropGuide);
            canvas.drawLine(l, y, r, y, cropGuide);
        }
        canvas.drawRect(cropView, cropLine);
        float len = 18 * dp;
        canvas.drawLine(l, t, l + len, t, cropHandle);
        canvas.drawLine(l, t, l, t + len, cropHandle);
        canvas.drawLine(r, t, r - len, t, cropHandle);
        canvas.drawLine(r, t, r, t + len, cropHandle);
        canvas.drawLine(l, b, l + len, b, cropHandle);
        canvas.drawLine(l, b, l, b - len, cropHandle);
        canvas.drawLine(r, b, r - len, b, cropHandle);
        canvas.drawLine(r, b, r, b - len, cropHandle);
        // Short bars mid-edge show that the sides can be dragged too.
        float cx = (l + r) / 2f;
        float cy = (t + b) / 2f;
        float bar = 10 * dp;
        canvas.drawLine(cx - bar, t, cx + bar, t, cropHandle);
        canvas.drawLine(cx - bar, b, cx + bar, b, cropHandle);
        canvas.drawLine(l, cy - bar, l, cy + bar, cropHandle);
        canvas.drawLine(r, cy - bar, r, cy + bar, cropHandle);
    }

    // ---- touch

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        if (image == null) return false;
        if (cropping) return onCropTouch(e);
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                ignoreGesture = false;
                travel = 0;
                lastViewX = e.getX();
                lastViewY = e.getY();
                toImage(e.getX(), e.getY());
                begin(point[0], point[1]);
                invalidate();
                return true;
            case MotionEvent.ACTION_POINTER_DOWN:
                // A second finger: drop the half-drawn mark rather than guess what was meant.
                ignoreGesture = true;
                drawing = null;
                invalidate();
                return true;
            case MotionEvent.ACTION_MOVE:
                if (ignoreGesture) return true;
                for (int i = 0; i < e.getHistorySize(); i++) move(e.getHistoricalX(i), e.getHistoricalY(i));
                move(e.getX(), e.getY());
                invalidate();
                return true;
            case MotionEvent.ACTION_UP:
                if (!ignoreGesture) {
                    move(e.getX(), e.getY());
                    finish();
                }
                drawing = null;
                invalidate();
                return true;
            case MotionEvent.ACTION_CANCEL:
                drawing = null;
                invalidate();
                return true;
            default:
                return true;
        }
    }

    private void begin(float x, float y) {
        downX = x;
        downY = y;
        switch (tool) {
            case PEN:
                drawing = new StrokeShape(stroke(color, PEN_WIDTH[size] * unit), x, y);
                break;
            case MARKER: {
                Paint p = stroke(color, MARKER_WIDTH[size] * unit);
                p.setAlpha(MARKER_ALPHA);
                drawing = new StrokeShape(p, x, y);
                break;
            }
            case ARROW:
                drawing = new ArrowShape(color, LINE_WIDTH[size] * unit, clampX(x), clampY(y));
                break;
            case BOX:
                drawing = new BoxShape(color, LINE_WIDTH[size] * unit, clampX(x), clampY(y));
                break;
            case BLUR:
                drawing = new BlurDraft(unit, clampX(x), clampY(y));
                break;
            default:
                drawing = null; // Text waits for the finger to lift.
        }
    }

    private void move(float viewX, float viewY) {
        travel += (float) Math.hypot(viewX - lastViewX, viewY - lastViewY);
        lastViewX = viewX;
        lastViewY = viewY;
        if (drawing == null) return;
        toImage(viewX, viewY);
        if (drawing instanceof StrokeShape) drawing.moveTo(point[0], point[1]);
        else drawing.moveTo(clampX(point[0]), clampY(point[1]));
    }

    private void finish() {
        boolean tap = travel < 8 * dp;
        switch (tool) {
            case PEN:
            case MARKER:
                if (drawing != null) {
                    ((StrokeShape) drawing).end();
                    add(drawing);
                }
                break;
            case ARROW:
            case BOX:
                if (!tap && drawing != null) add(drawing);
                break;
            case BLUR:
                if (!tap && drawing != null) {
                    Rect r = new Rect();
                    ((BlurDraft) drawing).rect.round(r);
                    if (r.intersect(0, 0, image.getWidth(), image.getHeight()) && r.width() >= 2 && r.height() >= 2) {
                        add(new BlurShape(image, r, Math.max(2, Math.round(BLUR_BLOCK * unit))));
                    }
                }
                break;
            case TEXT:
                if (tap && listener != null) listener.onTextRequested(clampX(downX), clampY(downY));
                break;
            default:
                break;
        }
    }

    private boolean onCropTouch(MotionEvent e) {
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN: {
                toView.mapRect(cropView, crop);
                float x = e.getX();
                float y = e.getY();
                float reach = 28 * dp;
                int grab = 0;
                if (x > cropView.left - reach && x < cropView.right + reach
                        && y > cropView.top - reach && y < cropView.bottom + reach) {
                    float dl = Math.abs(x - cropView.left);
                    float dr = Math.abs(x - cropView.right);
                    float dt = Math.abs(y - cropView.top);
                    float db = Math.abs(y - cropView.bottom);
                    if (Math.min(dl, dr) < reach) grab |= dl <= dr ? GRAB_LEFT : GRAB_RIGHT;
                    if (Math.min(dt, db) < reach) grab |= dt <= db ? GRAB_TOP : GRAB_BOTTOM;
                    if (grab == 0 && cropView.contains(x, y)) grab = GRAB_MOVE;
                }
                cropGrab = grab;
                cropDownX = x;
                cropDownY = y;
                cropAtDown.set(crop);
                return true;
            }
            case MotionEvent.ACTION_MOVE: {
                if (cropGrab == 0) return true;
                float dx = (e.getX() - cropDownX) / scale;
                float dy = (e.getY() - cropDownY) / scale;
                float w = image.getWidth();
                float h = image.getHeight();
                float min = Math.min(48 * dp / scale, Math.min(w, h));
                crop.set(cropAtDown);
                if (cropGrab == GRAB_MOVE) {
                    crop.offset(clamp(dx, -crop.left, w - crop.right), clamp(dy, -crop.top, h - crop.bottom));
                } else {
                    if ((cropGrab & GRAB_LEFT) != 0) crop.left = clamp(crop.left + dx, 0, crop.right - min);
                    if ((cropGrab & GRAB_RIGHT) != 0) crop.right = clamp(crop.right + dx, crop.left + min, w);
                    if ((cropGrab & GRAB_TOP) != 0) crop.top = clamp(crop.top + dy, 0, crop.bottom - min);
                    if ((cropGrab & GRAB_BOTTOM) != 0) crop.bottom = clamp(crop.bottom + dy, crop.top + min, h);
                }
                updateExclusion();
                invalidate();
                return true;
            }
            default:
                return true;
        }
    }

    private void toImage(float viewX, float viewY) {
        point[0] = viewX;
        point[1] = viewY;
        toImage.mapPoints(point);
    }

    private float clampX(float x) {
        return clamp(x, 0, image.getWidth());
    }

    private float clampY(float y) {
        return clamp(y, 0, image.getHeight());
    }

    private static float clamp(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }

    private static Paint stroke(int color, float width) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(width);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        p.setColor(color);
        return p;
    }

    // ---- history

    private static final class Edit {
        final Shape added;
        final Bitmap before;
        final Bitmap after;
        final List<Shape> shapesBefore;

        Edit(Shape added) {
            this.added = added;
            this.before = null;
            this.after = null;
            this.shapesBefore = null;
        }

        Edit(Bitmap before, List<Shape> shapesBefore, Bitmap after) {
            this.added = null;
            this.before = before;
            this.after = after;
            this.shapesBefore = shapesBefore;
        }
    }

    // ---- marks, all in screenshot pixels

    abstract static class Shape {
        abstract void draw(Canvas canvas);

        void moveTo(float x, float y) {}
    }

    /** Pen and marker: a smoothed freehand line. */
    static final class StrokeShape extends Shape {
        private final Path path = new Path();
        private final Paint paint;
        private final float startX;
        private final float startY;
        private float lastX;
        private float lastY;
        private boolean moved;

        StrokeShape(Paint paint, float x, float y) {
            this.paint = paint;
            startX = lastX = x;
            startY = lastY = y;
            path.moveTo(x, y);
        }

        @Override
        void moveTo(float x, float y) {
            if (x == lastX && y == lastY) return;
            path.quadTo(lastX, lastY, (lastX + x) / 2f, (lastY + y) / 2f);
            lastX = x;
            lastY = y;
            moved = true;
        }

        void end() {
            if (moved) path.lineTo(lastX, lastY);
            else path.lineTo(startX + 0.1f, startY); // a tap leaves a dot
        }

        @Override
        void draw(Canvas canvas) {
            canvas.drawPath(path, paint);
        }
    }

    static final class ArrowShape extends Shape {
        private final Paint line;
        private final Paint head;
        private final Path headPath = new Path();
        private final float width;
        private final float x1;
        private final float y1;
        private float x2;
        private float y2;

        ArrowShape(int color, float width, float x, float y) {
            this.width = width;
            line = stroke(color, width);
            head = new Paint(Paint.ANTI_ALIAS_FLAG);
            head.setStyle(Paint.Style.FILL_AND_STROKE);
            head.setStrokeJoin(Paint.Join.ROUND);
            head.setStrokeWidth(width * 0.5f);
            head.setColor(color);
            x1 = x2 = x;
            y1 = y2 = y;
        }

        @Override
        void moveTo(float x, float y) {
            x2 = x;
            y2 = y;
        }

        @Override
        void draw(Canvas canvas) {
            float dx = x2 - x1;
            float dy = y2 - y1;
            float len = (float) Math.hypot(dx, dy);
            if (len < 1f) return;
            float ux = dx / len;
            float uy = dy / len;
            float headLen = Math.min(width * 4.5f, len * 0.6f);
            float headHalf = headLen * 0.6f;
            float bx = x2 - ux * headLen;
            float by = y2 - uy * headLen;
            canvas.drawLine(x1, y1, x2 - ux * headLen * 0.6f, y2 - uy * headLen * 0.6f, line);
            headPath.reset();
            headPath.moveTo(x2, y2);
            headPath.lineTo(bx - uy * headHalf, by + ux * headHalf);
            headPath.lineTo(bx + uy * headHalf, by - ux * headHalf);
            headPath.close();
            canvas.drawPath(headPath, head);
        }
    }

    static final class BoxShape extends Shape {
        private final Paint paint;
        private final RectF rect = new RectF();
        private final float radius;
        private final float x1;
        private final float y1;

        BoxShape(int color, float width, float x, float y) {
            paint = stroke(color, width);
            radius = width * 1.2f;
            x1 = x;
            y1 = y;
            rect.set(x, y, x, y);
        }

        @Override
        void moveTo(float x, float y) {
            rect.set(Math.min(x1, x), Math.min(y1, y), Math.max(x1, x), Math.max(y1, y));
        }

        @Override
        void draw(Canvas canvas) {
            canvas.drawRoundRect(rect, radius, radius, paint);
        }
    }

    /** The dashed box shown while dragging out a blur area. */
    static final class BlurDraft extends Shape {
        final RectF rect = new RectF();
        private final Paint fill = new Paint();
        private final Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float x1;
        private final float y1;

        BlurDraft(float unit, float x, float y) {
            x1 = x;
            y1 = y;
            rect.set(x, y, x, y);
            fill.setColor(0x40FFFFFF);
            border.setStyle(Paint.Style.STROKE);
            border.setStrokeWidth(1.5f * unit);
            border.setColor(0xCCFFFFFF);
            border.setPathEffect(new DashPathEffect(new float[] {6 * unit, 4 * unit}, 0));
        }

        @Override
        void moveTo(float x, float y) {
            rect.set(Math.min(x1, x), Math.min(y1, y), Math.max(x1, x), Math.max(y1, y));
        }

        @Override
        void draw(Canvas canvas) {
            canvas.drawRect(rect, fill);
            canvas.drawRect(rect, border);
        }
    }

    /**
     * Blurs part of the image. The area is shrunk to coarse blocks, each the average of the pixels
     * under it, then stretched back with smoothing: it reads as a blur, and the detail is gone for
     * good rather than just softened.
     */
    static final class BlurShape extends Shape {
        private final Rect rect;
        private final Bitmap blocks;
        private final Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG);

        BlurShape(Bitmap source, Rect rect, int block) {
            this.rect = new Rect(rect);
            Bitmap region = Bitmap.createBitmap(source, rect.left, rect.top, rect.width(), rect.height());
            blocks = shrink(region, Math.max(1, rect.width() / block), Math.max(1, rect.height() / block));
            if (region != source && region != blocks) region.recycle();
        }

        @Override
        void draw(Canvas canvas) {
            canvas.drawBitmap(blocks, null, rect, paint);
        }

        /** Halves the size step by step so every block averages all of its pixels, not a few. */
        private static Bitmap shrink(Bitmap src, int w, int h) {
            Bitmap cur = src;
            while (cur.getWidth() / 2 >= w && cur.getHeight() / 2 >= h) {
                Bitmap half = Bitmap.createScaledBitmap(cur, cur.getWidth() / 2, cur.getHeight() / 2, true);
                if (cur != src) cur.recycle();
                cur = half;
            }
            Bitmap out = Bitmap.createScaledBitmap(cur, w, h, true);
            if (cur != src && cur != out) cur.recycle();
            return out;
        }
    }

    /** Bold text with a contrasting outline, readable on any background. */
    static final class TextShape extends Shape {
        private final String[] lines;
        private final Paint fill;
        private final Paint outline;
        private final float x;
        private final float baseline;
        private final float lineHeight;

        TextShape(String text, int color, float size, float tapX, float tapY, int imageWidth) {
            fill = new Paint(Paint.ANTI_ALIAS_FLAG);
            fill.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
            fill.setTextSize(size);
            fill.setColor(color);
            outline = new Paint(fill);
            outline.setStyle(Paint.Style.STROKE);
            outline.setStrokeJoin(Paint.Join.ROUND);
            outline.setStrokeWidth(size * 0.18f);
            outline.setColor(isLight(color) ? 0xCC000000 : 0xF2FFFFFF);
            lines = text.split("\n");
            Paint.FontMetrics fm = fill.getFontMetrics();
            lineHeight = fm.descent - fm.ascent;
            float widest = 0;
            for (String l : lines) widest = Math.max(widest, fill.measureText(l));
            // Start at the tap, but shift left if the text would run off the right edge.
            float margin = size * 0.3f;
            x = Math.max(margin, Math.min(tapX, imageWidth - widest - margin));
            // The tap marks the middle of the first line.
            baseline = tapY - (fm.ascent + fm.descent) / 2f;
        }

        private static boolean isLight(int color) {
            return 0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color) > 150;
        }

        @Override
        void draw(Canvas canvas) {
            for (int i = 0; i < lines.length; i++) {
                float y = baseline + i * lineHeight;
                canvas.drawText(lines[i], x, y, outline);
                canvas.drawText(lines[i], x, y, fill);
            }
        }
    }
}
