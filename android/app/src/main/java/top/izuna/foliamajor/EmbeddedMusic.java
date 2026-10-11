package top.izuna.foliamajor;

import android.content.Context;
import android.content.pm.PackageInfo;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

// One embedded runtime per process; lifecycle recreation never starts Node twice.
public final class EmbeddedMusic {
    private static final CompletableFuture<Integer> ready = new CompletableFuture<>();
    private static final String token = UUID.randomUUID().toString();
    private static boolean started;
    private static native int startNode(String[] arguments);

    public static synchronized void start(Context context) {
        if (started) return;
        started = true;
        Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                System.loadLibrary("node");
                System.loadLibrary("folia-runtime");
                PackageInfo info = app.getPackageManager().getPackageInfo(app.getPackageName(), 0);
                File root = new File(app.getFilesDir(), "music-runtime");
                File marker = new File(root, ".version");
                String version = Long.toString(info.lastUpdateTime);
                if (!marker.isFile() || !new String(Files.readAllBytes(marker.toPath()), StandardCharsets.UTF_8).equals(version)) {
                    deleteTree(root);
                    root.mkdirs();
                    unpack(app, root);
                    Files.write(marker.toPath(), version.getBytes(StandardCharsets.UTF_8));
                }
                File state = new File(app.getFilesDir(), "music-state");
                state.mkdirs();
                File portFile = new File(state, "port");
                Files.deleteIfExists(portFile.toPath());
                new Thread(() -> {
                    try {
                        for (int i = 0; i < 600 && !ready.isDone(); i++) {
                            if (portFile.isFile()) {
                                int port = Integer.parseInt(new String(Files.readAllBytes(portFile.toPath()), StandardCharsets.UTF_8));
                                JSONObject health = exchange(port, "/health", null);
                                if (health.optBoolean("ready")) { ready.complete(port); return; }
                            }
                            Thread.sleep(100);
                        }
                        ready.completeExceptionally(new IOException("Music runtime startup timed out"));
                    } catch (Exception e) { ready.completeExceptionally(e); }
                }, "MusicReadiness").start();
                int result = startNode(new String[]{"node", new File(root, "main.cjs").getAbsolutePath(), state.getAbsolutePath(), token});
                ready.completeExceptionally(new IOException("Music runtime exited: " + result));
            } catch (Throwable e) { android.util.Log.e("FoliaMusic", "Embedded runtime startup failed", e); ready.completeExceptionally(e); }
        }, "FoliaMusicRuntime").start();
    }

    public static JSONObject request(JSONObject request) throws Exception {
        return exchange(ready.get(75, TimeUnit.SECONDS), "/request", request);
    }

    private static JSONObject exchange(int port, String path, JSONObject request) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL("http://127.0.0.1:" + port + path).openConnection();
        try {
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("X-Folia-Token", token);
            if (request != null) {
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = connection.getOutputStream()) { out.write(request.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            if (connection.getResponseCode() != 200) throw new IOException("Music service request failed");
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) {
                    if (out.size() + count > 16000000) throw new IOException("Music response too large");
                    out.write(buffer, 0, count);
                }
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { connection.disconnect(); }
    }

    private static void unpack(Context context, File root) throws IOException {
        String prefix = root.getCanonicalPath() + File.separator;
        try (ZipInputStream zip = new ZipInputStream(context.getAssets().open("music-runtime.zip"))) {
            ZipEntry entry; byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                File file = new File(root, entry.getName());
                if (!file.getCanonicalPath().startsWith(prefix)) throw new IOException("Invalid runtime asset path");
                if (entry.isDirectory()) { file.mkdirs(); continue; }
                file.getParentFile().mkdirs();
                try (OutputStream out = new FileOutputStream(file)) {
                    int count; while ((count = zip.read(buffer)) != -1) out.write(buffer, 0, count);
                }
            }
        }
    }

    private static void deleteTree(File file) throws IOException {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        Files.deleteIfExists(file.toPath());
    }
}
