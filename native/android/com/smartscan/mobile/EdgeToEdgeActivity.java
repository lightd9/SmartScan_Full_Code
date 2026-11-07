package com.smartscan.mobile;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/** Shared by both installed apps. Backgrounds fill the window; CSS protects controls. */
public class EdgeToEdgeActivity extends BridgeActivity {
    private Insets safeArea = Insets.NONE;
    private boolean keyboardVisible;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before Capacitor starts loading the bundled page.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                publishSafeArea(webView);
                ViewCompat.requestApplyInsets(webView);
            }
        });
        super.onCreate(savedInstanceState);
        configureSystemBars();
        if (bridge == null) return;

        WebView webView = bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            safeArea = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            // On Android 11+, handle IME resizing explicitly. Older Android uses adjustResize.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int keyboardBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
                ViewGroup.MarginLayoutParams layout = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
                if (layout.bottomMargin != keyboardBottom) {
                    layout.bottomMargin = keyboardBottom;
                    view.setLayoutParams(layout);
                }
            }
            publishSafeArea(webView);
            // CSS owns system-bar clearance, including on older Android WebViews
            // that always report zero for env(safe-area-inset-*).
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    @Override
    public void onResume() {
        super.onResume();
        configureSystemBars();
        if (bridge != null) ViewCompat.requestApplyInsets(bridge.getWebView());
    }

    @SuppressWarnings("deprecation")
    private void configureSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        // Android 6/7 cannot draw dark navigation icons on our light surfaces.
        window.setNavigationBarColor(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? Color.TRANSPARENT : Color.rgb(0, 3, 54));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        window.setSoftInputMode(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
            : WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void publishSafeArea(WebView webView) {
        int bottom = keyboardVisible ? 0 : safeArea.bottom;
        // Insets are physical pixels; devicePixelRatio also accounts for WebView scaling.
        webView.evaluateJavascript("(() => { const root = document.documentElement;"
            + "if (!root) return; root.classList.add('native-android');"
            + "const d = window.devicePixelRatio || 1;"
            + "const values = [" + safeArea.top + "," + safeArea.right + "," + bottom + "," + safeArea.left + "];"
            + "['top','right','bottom','left'].forEach((side,i) => root.style.setProperty('--safe-area-inset-' + side, (values[i] / d) + 'px'));"
            + "})()", null);
    }
}
