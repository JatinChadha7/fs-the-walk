package com.jc.claudeshot;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Marks up a fresh screenshot, then copies, saves or shares it. */
public class EditorActivity extends Activity implements EditorView.Listener {
    static final String EXTRA_SHOT = "shot";
    static final String EXTRA_SAVED_BY_PHONE = "saved_by_phone";

    private static final int SAVE = 0;
    private static final int COPY = 1;
    private static final int SHARE = 2;

    private static final int[] TOOLS = {
            EditorView.PEN, EditorView.MARKER, EditorView.ARROW, EditorView.BOX,
            EditorView.TEXT, EditorView.BLUR, EditorView.CROP};
    private static final int[] TOOL_ICONS = {
            R.drawable.ic_pen, R.drawable.ic_marker, R.drawable.ic_arrow, R.drawable.ic_box,
            R.drawable.ic_text, R.drawable.ic_blur, R.drawable.ic_crop};
    private static final int[] TOOL_NAMES = {
            R.string.tool_pen, R.string.tool_marker, R.string.tool_arrow, R.string.tool_box,
            R.string.tool_text, R.string.tool_blur, R.string.tool_crop};
    private static final int[] COLORS = {
            0xFFFF3B30, 0xFFFF9500, 0xFFFFCC00, 0xFF34C759, 0xFF0A84FF, 0xFFAF52DE, 0xFFFFFFFF, 0xFF000000};
    private static final int[] SIZE_NAMES = {R.string.size_small, R.string.size_medium, R.string.size_large};

    private EditorView editor;
    private View toolPanel;
    private View cropBar;
    private View undoButton;
    private View redoButton;
    private View copyButton;
    private View saveButton;
    private View shareButton;
    private final List<View> toolButtons = new ArrayList<>();
    private final List<Swatch> swatches = new ArrayList<>();
    private SizeButton sizeButton;
    private SharedPreferences prefs;
    private ExecutorService io;
    private String shotId;
    private int exportedVersion = -1; // editor version last saved, copied or shared
    private boolean savedByPhone;
    private boolean exporting;
    private boolean closeAfterSave;

    /** @param savedByPhone the phone already saved the screenshot, so closing it unedited loses nothing */
    static Intent intent(Context context, String shotId, boolean savedByPhone) {
        // A task of its own, so closing the editor returns to whatever app the screenshot was of.
        return new Intent(context, EditorActivity.class)
                .putExtra(EXTRA_SHOT, shotId)
                .putExtra(EXTRA_SAVED_BY_PHONE, savedByPhone)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        shotId = getIntent().getStringExtra(EXTRA_SHOT);
        Bitmap shot = ShotStore.take(this, shotId);
        if (shot == null) {
            Toast.makeText(this, R.string.shot_missing, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        getSystemService(NotificationManager.class).cancel(BubbleService.SHOT_NOTIFICATION_ID);
        savedByPhone = getIntent().getBooleanExtra(EXTRA_SAVED_BY_PHONE, false);
        if (savedByPhone) exportedVersion = 0; // the unedited original is already in the gallery
        prefs = Prefs.of(this);
        io = Executors.newSingleThreadExecutor();

        getWindow().setDecorFitsSystemWindows(false);
        setContentView(R.layout.activity_editor);
        findViewById(R.id.root).setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            }
        });

        editor = findViewById(R.id.editor);
        toolPanel = findViewById(R.id.tool_panel);
        cropBar = findViewById(R.id.crop_bar);
        undoButton = findViewById(R.id.undo);
        redoButton = findViewById(R.id.redo);
        copyButton = findViewById(R.id.copy);
        saveButton = findViewById(R.id.save);
        shareButton = findViewById(R.id.share);

        editor.setImage(shot);
        editor.setListener(this);
        int tool = prefs.getInt(Prefs.TOOL, EditorView.PEN);
        editor.setTool(tool == EditorView.CROP ? EditorView.PEN : tool);
        editor.setColor(prefs.getInt(Prefs.COLOR, COLORS[0]));
        editor.setSize(prefs.getInt(Prefs.SIZE, 1));

        LinearLayout tools = findViewById(R.id.tools);
        LinearLayout colors = findViewById(R.id.colors);
        buildToolRow(tools);
        buildColorRow(colors);
        bindTopBar();
        refresh();
    }

    @Override
    protected void onStart() {
        super.onStart();
        BubbleService.editorShown(true);
    }

    @Override
    protected void onStop() {
        BubbleService.editorShown(false);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (io != null) io.shutdown();
        if (isFinishing()) ShotStore.delete(this, shotId);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        close();
    }

    // ---- UI

    private void bindTopBar() {
        findViewById(R.id.close).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                close();
            }
        });
        undoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                editor.undo();
            }
        });
        redoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                editor.redo();
            }
        });
        copyButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                export(COPY);
            }
        });
        saveButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                export(SAVE);
            }
        });
        shareButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                export(SHARE);
            }
        });
        findViewById(R.id.crop_cancel).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                editor.cancelCrop();
                refresh();
            }
        });
        findViewById(R.id.crop_apply).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                editor.applyCrop();
                refresh();
            }
        });
    }

    private void buildToolRow(LinearLayout row) {
        for (int i = 0; i < TOOLS.length; i++) {
            final int tool = TOOLS[i];
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER);
            item.setBackgroundResource(R.drawable.tool_bg);
            item.setContentDescription(getString(TOOL_NAMES[i]));

            ImageView icon = new ImageView(this);
            icon.setImageResource(TOOL_ICONS[i]);
            icon.setImageTintList(getColorStateList(R.color.tool_tint));
            icon.setDuplicateParentStateEnabled(true);
            icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            item.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));

            TextView label = new TextView(this);
            label.setText(TOOL_NAMES[i]);
            label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            label.setTextColor(getColorStateList(R.color.tool_tint));
            label.setDuplicateParentStateEnabled(true);
            label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            label.setSingleLine(true);
            LinearLayout.LayoutParams labelLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            labelLp.topMargin = dp(3);
            item.addView(label, labelLp);

            item.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    selectTool(tool);
                }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(58), 1f);
            lp.setMargins(dp(2), dp(4), dp(2), dp(2));
            row.addView(item, lp);
            toolButtons.add(item);
        }
    }

    private void buildColorRow(LinearLayout row) {
        for (int i = 0; i < COLORS.length; i++) {
            final Swatch swatch = new Swatch(this, COLORS[i]);
            swatch.setContentDescription(getString(R.string.color_label, i + 1));
            swatch.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    editor.setColor(swatch.color);
                    prefs.edit().putInt(Prefs.COLOR, swatch.color).apply();
                    refresh();
                }
            });
            row.addView(swatch, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));
            swatches.add(swatch);
        }
        sizeButton = new SizeButton(this);
        sizeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int size = (editor.getSize() + 1) % 3;
                editor.setSize(size);
                prefs.edit().putInt(Prefs.SIZE, size).apply();
                refresh();
            }
        });
        row.addView(sizeButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));
    }

    private void selectTool(int tool) {
        if (tool == EditorView.CROP) {
            editor.startCrop();
        } else {
            editor.setTool(tool);
            prefs.edit().putInt(Prefs.TOOL, tool).apply();
        }
        refresh();
    }

    private void refresh() {
        boolean cropping = editor.isCropping();
        toolPanel.setVisibility(cropping ? View.GONE : View.VISIBLE);
        cropBar.setVisibility(cropping ? View.VISIBLE : View.GONE);
        undoButton.setEnabled(editor.canUndo());
        redoButton.setEnabled(editor.canRedo());
        boolean canExport = !cropping && !exporting;
        copyButton.setEnabled(canExport);
        saveButton.setEnabled(canExport);
        shareButton.setEnabled(canExport);
        for (int i = 0; i < toolButtons.size(); i++) {
            toolButtons.get(i).setSelected(TOOLS[i] == editor.getTool());
        }
        for (Swatch s : swatches) s.setChosen(s.color == editor.getColor());
        sizeButton.set(editor.getSize(), editor.getColor());
        sizeButton.setContentDescription(getString(SIZE_NAMES[editor.getSize()]));
    }

    @Override
    public void onEdited() {
        refresh();
    }

    @Override
    public void onTextRequested(final float x, final float y) {
        final EditText input = new EditText(this);
        input.setHint(R.string.text_hint);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setMaxLines(5);
        FrameLayout box = new FrameLayout(this);
        box.setPadding(dp(22), dp(8), dp(22), 0);
        box.addView(input);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.text_title)
                .setView(box)
                .setPositiveButton(R.string.text_add, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        String text = input.getText().toString().trim();
                        if (!text.isEmpty()) editor.addText(text, x, y);
                    }
                })
                .setNegativeButton(R.string.cancel, null)
                .create();
        dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        dialog.show();
        input.requestFocus();
    }

    // ---- closing

    private void close() {
        if (editor.isCropping()) {
            editor.cancelCrop();
            refresh();
            return;
        }
        if (editor.getVersion() == exportedVersion) {
            finish();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(savedByPhone ? R.string.discard_changes_title : R.string.discard_title)
                .setMessage(savedByPhone ? R.string.discard_changes_body : R.string.discard_body)
                .setPositiveButton(R.string.save, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        closeAfterSave = true;
                        export(SAVE);
                    }
                })
                .setNegativeButton(R.string.discard, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        finish();
                    }
                })
                .setNeutralButton(R.string.keep_editing, null)
                .show();
    }

    // ---- export

    private void export(final int mode) {
        if (exporting || editor.isCropping()) return;
        final Bitmap image;
        try {
            image = editor.render();
        } catch (OutOfMemoryError e) {
            Toast.makeText(this, R.string.export_failed, Toast.LENGTH_SHORT).show();
            return;
        }
        exporting = true;
        refresh();
        final int version = editor.getVersion();
        final Context app = getApplicationContext();
        io.execute(new Runnable() {
            @Override
            public void run() {
                Uri uri = null;
                try {
                    uri = mode == SAVE ? Exporter.saveToGallery(app, image) : Exporter.writeShareFile(app, image);
                } catch (IOException | RuntimeException e) {
                    Log.w("ClaudeShot", "export", e);
                }
                image.recycle();
                final Uri result = uri;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        onExported(mode, result, version);
                    }
                });
            }
        });
    }

    private void onExported(int mode, Uri uri, int version) {
        exporting = false;
        if (isDestroyed()) return;
        refresh();
        if (uri == null) {
            closeAfterSave = false;
            Toast.makeText(this, R.string.export_failed, Toast.LENGTH_SHORT).show();
            return;
        }
        exportedVersion = version;
        if (mode == SAVE) {
            Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show();
            if (closeAfterSave) finish();
        } else if (mode == COPY) {
            ClipboardManager clipboard = getSystemService(ClipboardManager.class);
            clipboard.setPrimaryClip(ClipData.newUri(getContentResolver(), getString(R.string.clip_label), uri));
            // Android 13+ confirms copies itself.
            if (Build.VERSION.SDK_INT < 33) Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show();
        } else {
            Intent send = new Intent(Intent.ACTION_SEND)
                    .setType("image/png")
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            send.setClipData(ClipData.newRawUri(null, uri));
            startActivity(Intent.createChooser(send, getString(R.string.share_title)));
        }
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    // ---- small custom views for the colour row

    /** A colour dot; the chosen one gets a ring. */
    private static final class Swatch extends View {
        final int color;
        private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float dp;
        private boolean chosen;

        Swatch(Context context, int color) {
            super(context);
            this.color = color;
            dp = context.getResources().getDisplayMetrics().density;
            fill.setColor(color);
            ring.setStyle(Paint.Style.STROKE);
            ring.setStrokeWidth(2 * dp);
            ring.setColor(Color.WHITE);
            edge.setStyle(Paint.Style.STROKE);
            edge.setStrokeWidth(dp);
            edge.setColor(0x59FFFFFF);
            setBackgroundResource(R.drawable.tool_bg);
        }

        void setChosen(boolean chosen) {
            if (this.chosen == chosen) return;
            this.chosen = chosen;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float cx = getWidth() / 2f;
            float cy = getHeight() / 2f;
            float r = 10 * dp;
            if (chosen) canvas.drawCircle(cx, cy, r + 4 * dp, ring);
            canvas.drawCircle(cx, cy, r, fill);
            if (color == Color.BLACK) canvas.drawCircle(cx, cy, r, edge);
        }
    }

    /** Cycles small / medium / large; shows a stroke of the current size in the current colour. */
    private static final class SizeButton extends View {
        private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final float dp;
        private int size;

        SizeButton(Context context) {
            super(context);
            dp = context.getResources().getDisplayMetrics().density;
            line.setStyle(Paint.Style.STROKE);
            line.setStrokeCap(Paint.Cap.ROUND);
            halo.setStyle(Paint.Style.STROKE);
            halo.setStrokeCap(Paint.Cap.ROUND);
            halo.setColor(0x40FFFFFF);
            setBackgroundResource(R.drawable.tool_bg);
        }

        void set(int size, int color) {
            this.size = size;
            line.setColor(color);
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float cx = getWidth() / 2f;
            float cy = getHeight() / 2f;
            float half = 9 * dp;
            float width = (2 + 2.5f * size) * dp;
            line.setStrokeWidth(width);
            // A faint halo keeps a black stroke visible on the dark bar.
            halo.setStrokeWidth(width + 2 * dp);
            canvas.drawLine(cx - half, cy + half * 0.6f, cx + half, cy - half * 0.6f, halo);
            canvas.drawLine(cx - half, cy + half * 0.6f, cx + half, cy - half * 0.6f, line);
        }
    }
}
