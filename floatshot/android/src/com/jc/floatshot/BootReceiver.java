package com.jc.floatshot;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Turns FloatShot back on after the phone restarts or the app is updated. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }
        try {
            BubbleService.sync(context);
        } catch (RuntimeException e) {
            Log.w("FloatShot", "start after " + action, e);
        }
    }
}
