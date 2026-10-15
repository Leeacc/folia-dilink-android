package top.izuna.foliamajor;

import android.content.*;
import android.view.KeyEvent;

// Legacy OEM media-center broadcasts are separate from MediaSession callbacks.
public class CarMediaButtonReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction()) || !NativeAudioPlugin.ownsFocus()) return;
        KeyEvent key = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
        if (key != null && CarMediaService.handleKey(key) && isOrderedBroadcast()) abortBroadcast();
    }
}
