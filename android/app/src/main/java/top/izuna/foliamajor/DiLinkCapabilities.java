package top.izuna.foliamajor;

import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import com.getcapacitor.JSObject;
import java.lang.reflect.*;

// Read-only OEM capability evidence: never impersonate a stock app, write CAN feature IDs, or bypass permissions.
final class DiLinkCapabilities {
    static boolean isByd(Context context) {
        if (android.os.Build.MANUFACTURER.toLowerCase(java.util.Locale.ROOT).contains("byd")) return true;
        try { context.getPackageManager().getPackageInfo("com.byd.mediacenter", 0); return true; }
        catch (PackageManager.NameNotFoundException ignored) { return false; }
    }
    static JSObject inspect(Context context) {
        JSObject result = new JSObject().put("byd", isByd(context));
        String name = "android.hardware.bydauto.multimedia.BYDAutoMultimediaDevice";
        try {
            Class<?> type = Class.forName(name);
            Object device = type.getMethod("getInstance", Context.class).invoke(null, context);
            result.put("multimediaApi", "available");
            for (String method : new String[]{"getMediaType", "getPlayState"}) {
                try { result.put(method, type.getMethod(method).invoke(device)); }
                catch (ReflectiveOperationException error) { result.put(method, cause(error)); }
            }
        } catch (ClassNotFoundException error) { result.put("multimediaApi", "not_present"); }
        catch (LinkageError error) { result.put("multimediaApi", error.getClass().getSimpleName()); }
        catch (Exception error) { result.put("multimediaApi", cause(error)); }
        ProviderInfo provider = context.getPackageManager().resolveContentProvider("com.byd.mediacenter.provider", 0);
        if (provider != null) {
            result.put("mediaProvider", provider.packageName).put("providerExported", provider.exported)
                .put("providerReadPermission", provider.readPermission).put("providerWritePermission", provider.writePermission);
            if (provider.writePermission != null) result.put("providerWriteGranted",
                context.checkSelfPermission(provider.writePermission) == PackageManager.PERMISSION_GRANTED);
        } else result.put("mediaProvider", "not_visible_or_absent");
        result.put("cardStatus", "OEM launcher registration has not been verified on this vehicle");
        return result;
    }
    private static String cause(Exception error) {
        Throwable actual = error instanceof InvocationTargetException && error.getCause() != null ? error.getCause() : error;
        return actual.getClass().getSimpleName();
    }
}
