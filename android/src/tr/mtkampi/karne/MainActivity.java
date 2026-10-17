package tr.mtkampi.karne;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * PWA'yı (assets/www) çevrimdışı çalıştıran WebView kabuğu.
 * Dosyalar https://appassets.androidplatform.net/ adresinden sunulur; böylece
 * sayfa "güvenli kaynak" sayılır ve GPS, IndexedDB normal çalışır.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int REQ_PERMS = 1, REQ_FILE = 2, REQ_SAVE = 3;

    private WebView web;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private byte[] pendingSave;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open("www" + path);
                    return new WebResourceResponse(mime(path), mime(path).startsWith("text") || path.endsWith(".js") || path.endsWith(".webmanifest") ? "utf-8" : null, in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !HOST.equals(Uri.parse(url).getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (hasLocation()) { cb.invoke(origin, true, false); return; }
                geoOrigin = origin; geoCallback = cb;
                askPermissions();
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent pick = params.createIntent();
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                boolean image = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image")) image = true;
                Intent chooser = Intent.createChooser(pick, image ? "Fotoğraf" : "Dosya seç");
                cameraUri = null;
                if (image) {
                    Intent cam = cameraIntent();
                    if (cam != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                }
                try {
                    startActivityForResult(chooser, REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "Android");
        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
        if (!hasLocation()) askPermissions();
    }

    private Intent cameraIntent() {
        try {
            if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
                return null;
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, "mt_karne_" + System.currentTimeMillis() + ".jpg");
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            if (Build.VERSION.SDK_INT >= 29) v.put("relative_path", "Pictures/MT Karne");
            cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (cameraUri == null) return null;
            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return cam;
        } catch (Exception e) {
            cameraUri = null;
            return null;
        }
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void askPermissions() {
        List<String> p = new ArrayList<>();
        p.add(Manifest.permission.ACCESS_FINE_LOCATION);
        p.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT < 29) p.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        requestPermissions(p.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_PERMS && geoCallback != null) {
            geoCallback.invoke(geoOrigin, hasLocation(), false);
            geoCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILE) {
            Uri[] uris = null;
            if (result == RESULT_OK) {
                if (data != null && data.getClipData() != null) {
                    uris = new Uri[data.getClipData().getItemCount()];
                    for (int i = 0; i < uris.length; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data != null && data.getData() != null) {
                    uris = new Uri[]{data.getData()};
                } else if (cameraUri != null) {
                    uris = new Uri[]{cameraUri};
                }
            }
            if (uris == null && cameraUri != null) {
                try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) { }
            }
            if (fileCallback != null) fileCallback.onReceiveValue(uris);
            fileCallback = null;
            cameraUri = null;
        } else if (code == REQ_SAVE) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    out.write(pendingSave);
                    toast("Kaydedildi");
                } catch (Exception e) {
                    toast("Kaydedilemedi: " + e.getMessage());
                }
            }
            pendingSave = null;
        }
    }

    /** Android'in "farklı kaydet" ekranını açar (İndirilenler, Drive vb.). */
    private void createDocument(String name, String type, byte[] bytes) {
        pendingSave = bytes;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(type == null || type.isEmpty() ? "application/octet-stream" : type);
        i.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(i, REQ_SAVE);
        } catch (Exception e) {
            pendingSave = null;
            toast("Dosya kaydetme açılamadı");
        }
    }

    private void toast(String t) { Toast.makeText(this, t, Toast.LENGTH_LONG).show(); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    /** Sayfadan çağrılan yardımcılar: window.Android.saveFile(...), window.Android.print(...) */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String type, final String content) {
            final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            runOnUiThread(new Runnable() { @Override public void run() {
                createDocument(name, type, bytes);
            }});
        }

        @JavascriptInterface
        public void saveBase64(final String name, final String type, final String b64) {
            final byte[] bytes;
            try {
                bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            } catch (Exception e) {
                runOnUiThread(new Runnable() { @Override public void run() { toast("Dosya hazırlanamadı"); }});
                return;
            }
            runOnUiThread(new Runnable() { @Override public void run() {
                createDocument(name, type, bytes);
            }});
        }

        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(new Runnable() { @Override public void run() {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String job = (title == null || title.isEmpty()) ? "MT Karne" : title;
                pm.print(job, web.createPrintDocumentAdapter(job),
                        new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            }});
        }
    }
}
