package com.ihyatafsir.raziapp

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var insetsController: WindowInsetsControllerCompat
    private lateinit var prefs: SharedPreferences

    private val TAG = "RaziApp"
    private val PREFS_NAME = "raziapp_prefs"
    private val KEY_API_BASE = "key_api_base"
    private val DEFAULT_API_BASE = ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Ensure proper window insets so content is never obscured by status or nav bars
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.parseColor("#0A0C10")
        window.navigationBarColor = Color.parseColor("#0A0C10")

        insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        // Initialize WebView
        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0A0C10"))
        }
        setContentView(webView)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        configureWebSettings()
        setupClients()
        setupBridge()
        setupBackNavigation()

        // Load local bundled assets via secure asset loader
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            textZoom = 100
        }
    }

    private fun setupClients() {
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request != null) {
                    val intercept = assetLoader.shouldInterceptRequest(request.url)
                    if (intercept != null) {
                        return intercept
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage != null) {
                    Log.d(TAG, "[JS Console] ${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})")
                }
                return true
            }
        }
    }

    private fun setupBridge() {
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false") { result ->
                    val handled = result == "true"
                    if (!handled) {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun vibrate(durationMs: Long) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    val vibrator = vibratorManager.defaultVibrator
                    vibrator.vibrate(VibrationEffect.createOneShot(durationMs.coerceIn(5, 500), VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(durationMs.coerceIn(5, 500), VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(durationMs.coerceIn(5, 500))
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Vibration failed: ${e.message}")
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun isAndroidApp(): Boolean = true

        @JavascriptInterface
        fun getApiBase(): String {
            return prefs.getString(KEY_API_BASE, DEFAULT_API_BASE) ?: DEFAULT_API_BASE
        }

        @JavascriptInterface
        fun setApiBase(url: String) {
            prefs.edit().putString(KEY_API_BASE, url.trim()).apply()
        }

        @JavascriptInterface
        fun toggleFullscreen(enable: Boolean) {
            runOnUiThread {
                if (enable) {
                    insetsController.hide(WindowInsetsCompat.Type.systemBars())
                    insetsController.systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                } else {
                    insetsController.show(WindowInsetsCompat.Type.systemBars())
                }
            }
        }

        @JavascriptInterface
        fun executeDeepSeekCall(systemPrompt: String, userPrompt: String, apiKey: String, model: String): String {
            return executeLlmCall(systemPrompt, userPrompt, apiKey, model, "https://api.deepseek.com/chat/completions")
        }

        @JavascriptInterface
        fun executeLlmCall(systemPrompt: String, userPrompt: String, apiKey: String, model: String, endpointUrl: String): String {
            val callThread = java.util.concurrent.Executors.newSingleThreadExecutor()
            val future = callThread.submit(java.util.concurrent.Callable<String> {
                try {
                    val activeKey = apiKey.trim()
                    val targetUrl = if (endpointUrl.isNotBlank()) endpointUrl.trim() else "https://api.deepseek.com/chat/completions"

                    if (activeKey.isBlank()) {
                        return@Callable org.json.JSONObject().apply {
                            put("success", false)
                            put("error", "API key required for selected cloud provider")
                        }.toString()
                    }

                    val activeModel = if (model.isNotBlank()) model.trim() else "deepseek-chat"
                    val url = java.net.URL(targetUrl)
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    if (activeKey.isNotBlank()) {
                        conn.setRequestProperty("Authorization", "Bearer $activeKey")
                    }
                    conn.connectTimeout = 15000
                    conn.readTimeout = 60000
                    conn.doOutput = true

                    val jsonBody = org.json.JSONObject().apply {
                        put("model", activeModel)
                        put("messages", org.json.JSONArray().apply {
                            put(org.json.JSONObject().apply {
                                put("role", "system")
                                put("content", systemPrompt)
                            })
                            put(org.json.JSONObject().apply {
                                put("role", "user")
                                put("content", userPrompt)
                            })
                        })
                        put("temperature", 0.1)
                        put("max_tokens", 4096)
                    }

                    conn.outputStream.use { os ->
                        os.write(jsonBody.toString().toByteArray(Charsets.UTF_8))
                    }

                    if (conn.responseCode in 200..299) {
                        val responseText = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                        val respJson = org.json.JSONObject(responseText)
                        val content = respJson.getJSONArray("choices")
                            .getJSONObject(0)
                            .getJSONObject("message")
                            .getString("content")
                        org.json.JSONObject().apply {
                            put("success", true)
                            put("content", content)
                        }.toString()
                    } else {
                        val errText = conn.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                        org.json.JSONObject().apply {
                            put("success", false)
                            put("error", "HTTP ${conn.responseCode}: $errText")
                        }.toString()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Native LLM call failed: ${e.message}", e)
                    org.json.JSONObject().apply {
                        put("success", false)
                        put("error", e.message ?: "Connection error")
                    }.toString()
                }
            })

            return try {
                future.get(65, java.util.concurrent.TimeUnit.SECONDS)
            } catch (e: Exception) {
                org.json.JSONObject().apply {
                    put("success", false)
                    put("error", "Request timeout: ${e.message}")
                }.toString()
            } finally {
                callThread.shutdown()
            }
        }

        @JavascriptInterface
        fun shareEpubFile(title: String, filename: String, base64Content: String) {
            runOnUiThread {
                try {
                    val rawB64 = if (base64Content.contains(",")) base64Content.substringAfter(",") else base64Content
                    val bytes = android.util.Base64.decode(rawB64, android.util.Base64.DEFAULT)
                    val shareDir = java.io.File(cacheDir, "shared_epubs").apply { mkdirs() }
                    val cleanFilename = if (filename.endsWith(".epub")) filename else "${filename}.epub" 
                    val file = java.io.File(shareDir, cleanFilename).apply { writeBytes(bytes) }

                    val uri = androidx.core.content.FileProvider.getUriForFile(
                        this@MainActivity,
                        "${applicationContext.packageName}.fileprovider",
                        file
                    )

                    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "application/epub+zip"
                        putExtra(android.content.Intent.EXTRA_STREAM, uri)
                        putExtra(android.content.Intent.EXTRA_SUBJECT, title)
                        putExtra(android.content.Intent.EXTRA_TEXT, "${title} - Classical Islamic Masterwork (RaziApp)")
                        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(android.content.Intent.createChooser(intent, "Share Classical EPUB"))
                } catch (e: Exception) {
                    Log.e(TAG, "Share failed: ${e.message}", e)
                    Toast.makeText(this@MainActivity, "Share failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
