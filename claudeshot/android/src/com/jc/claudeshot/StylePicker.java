package com.jc.claudeshot;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * The "Button style" card: a live preview plus rows of choices. Choices are saved straight to the
 * settings, which the running floating button follows, so it changes on screen as you pick.
 */
final class StylePicker {
    private static final float CHOICE_DP = 40;
    private static final float SIZE_STEP_DP = 2;
    private static final int[] IDLE_BODIES = {R.string.idle_solid_body, R.string.idle_fade_body, R.string.idle_tuck_body};

    private final Activity activity;
    private final SharedPreferences prefs;
    private final float dp;
    private final BubbleView preview;
    private final List<BubbleView> colorChoices = new ArrayList<>();
    private final List<BubbleView> iconChoices = new ArrayList<>();
    private final SeekBar size;
    private final List<TextView> idleChoices = new ArrayList<>();
    private final EditText letters;
    private final TextView idleBody;
    private boolean refreshing;

    StylePicker(Activity activity) {
        this.activity = activity;
        prefs = Prefs.of(activity);
        dp = activity.getResources().getDisplayMetrics().density;

        FrameLayout previewFrame = activity.findViewById(R.id.style_preview);
        previewFrame.setClipToOutline(true); // a tucked-in preview is cut at the rounded edge
        preview = new BubbleView(activity, -1);
        preview.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        previewFrame.addView(preview);

        LinearLayout colors = activity.findViewById(R.id.style_colors);
        for (int i = 0; i < BubbleStyle.COLOR_NAMES.length; i++) {
            BubbleView v = choiceBubble(BubbleStyle.COLOR_NAMES[i], Prefs.STYLE_COLOR, i);
            addCell(colors, v);
            colorChoices.add(v);
        }
        LinearLayout icons = activity.findViewById(R.id.style_icons);
        for (int i = 0; i < BubbleStyle.ICON_NAMES.length; i++) {
            BubbleView v = choiceBubble(BubbleStyle.ICON_NAMES[i], Prefs.STYLE_ICON, i);
            addCell(icons, v);
            iconChoices.add(v);
        }
        size = activity.findViewById(R.id.style_size);
        size.setMax(Math.round((BubbleStyle.MAX_SIZE_DP - BubbleStyle.MIN_SIZE_DP) / SIZE_STEP_DP));
        size.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                if (!fromUser || refreshing) return;
                // Saved as it moves, so the button on screen resizes while dragging too.
                float dpValue = BubbleStyle.MIN_SIZE_DP + progress * SIZE_STEP_DP;
                prefs.edit().putFloat(Prefs.STYLE_SIZE_DP, dpValue).apply();
                refresh();
            }

            @Override
            public void onStartTrackingTouch(SeekBar bar) {}

            @Override
            public void onStopTrackingTouch(SeekBar bar) {}
        });
        LinearLayout idles = activity.findViewById(R.id.style_idle);
        for (int i = 0; i < BubbleStyle.IDLE_NAMES.length; i++) {
            idleChoices.add(chip(idles, BubbleStyle.IDLE_NAMES[i], Prefs.STYLE_IDLE, i));
        }
        idleBody = activity.findViewById(R.id.style_idle_body);

        letters = activity.findViewById(R.id.style_letters);
        letters.setText(BubbleStyle.load(activity).letters);
        letters.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {}

            @Override
            public void afterTextChanged(Editable s) {
                if (refreshing) return;
                prefs.edit().putString(Prefs.STYLE_LETTERS, s.toString()).apply();
                refresh();
            }
        });
        refresh();
    }

    void refresh() {
        refreshing = true;
        BubbleStyle style = BubbleStyle.load(activity);

        // The preview sits at the right edge like the real button, at its real size, and shows
        // what it looks like while not in use.
        preview.setStyle(style);
        int px = Math.round(style.windowDp() * dp);
        int edge = Math.round(8 * dp);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(px, px, Gravity.END | Gravity.CENTER_VERTICAL);
        lp.rightMargin = edge;
        preview.setLayoutParams(lp);
        preview.setAlpha(style.idle == BubbleStyle.IDLE_SOLID ? 1f : 0.6f);
        preview.setTranslationX(style.idle == BubbleStyle.IDLE_TUCK ? px / 2f + edge : 0f);

        for (int i = 0; i < colorChoices.size(); i++) {
            colorChoices.get(i).setStyle(style.withColor(i));
            colorChoices.get(i).setSelected(i == style.color);
        }
        for (int i = 0; i < iconChoices.size(); i++) {
            iconChoices.get(i).setStyle(style.withIcon(i));
            iconChoices.get(i).setSelected(i == style.icon);
        }
        size.setProgress(Math.round((style.sizeDp - BubbleStyle.MIN_SIZE_DP) / SIZE_STEP_DP));
        for (int i = 0; i < idleChoices.size(); i++) idleChoices.get(i).setSelected(i == style.idle);
        idleBody.setText(IDLE_BODIES[style.idle]);
        letters.setVisibility(style.icon == BubbleStyle.ICON_LETTERS ? View.VISIBLE : View.GONE);
        refreshing = false;
    }

    private BubbleView choiceBubble(int name, final String key, final int value) {
        BubbleView v = new BubbleView(activity, 4 * dp);
        v.setBackgroundResource(R.drawable.choice_ring);
        v.setContentDescription(activity.getString(name));
        v.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                save(key, value);
            }
        });
        return v;
    }

    private void addCell(LinearLayout row, View v) {
        int px = Math.round(CHOICE_DP * dp);
        FrameLayout cell = new FrameLayout(activity);
        cell.addView(v, new FrameLayout.LayoutParams(px, px, Gravity.CENTER));
        row.addView(cell, new LinearLayout.LayoutParams(0, px, 1f));
    }

    private TextView chip(LinearLayout row, int text, final String key, final int value) {
        TextView t = new TextView(activity);
        t.setText(text);
        t.setGravity(Gravity.CENTER);
        t.setSingleLine(true);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setTextColor(activity.getColorStateList(R.color.choice_text));
        t.setBackgroundResource(R.drawable.choice_chip);
        t.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                save(key, value);
            }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, Math.round(36 * dp), 1f);
        lp.setMargins(Math.round(3 * dp), 0, Math.round(3 * dp), 0);
        row.addView(t, lp);
        return t;
    }

    private void save(String key, int value) {
        prefs.edit().putInt(key, value).apply();
        refresh();
    }
}
