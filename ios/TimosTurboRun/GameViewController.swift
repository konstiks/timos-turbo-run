import UIKit
import WebKit
import UniformTypeIdentifiers

/// Zeigt das HTML5-Spiel aus dem App-Bundle (Ordner "www") im Vollbild an.
/// Die Dateien werden über ein eigenes Schema (app://localhost/...) ausgeliefert,
/// damit fetch() für die Sounds funktioniert und localStorage (Bestenliste,
/// Kroketten, Upgrades) dauerhaft gespeichert wird.
final class GameViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    static let scheme = "app"
    static let startURL = URL(string: "app://localhost/index.html")!
    private static let background = UIColor(red: 0x0D / 255, green: 0x16 / 255, blue: 0x26 / 255, alpha: 1)

    private var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: Self.scheme)
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Pixel-Schrift aus dem Bundle, damit sie auch ohne Internet da ist.
        let fontCSS = "@font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url('app://localhost/fonts/PressStart2P-Regular.ttf') format('truetype');}"
        let js = """
        (function(){var s=document.createElement('style');s.textContent=\"\(fontCSS)\";(document.head||document.documentElement).appendChild(s);})();
        """
        config.userContentController.addUserScript(
            WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: Self.startURL))
    }

    // Vollbild: keine Statusleiste, Home-Balken ausblenden, Wischgesten am Rand zuerst ans Spiel geben.
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    // Kippen-Steuerung: Bewegungssensoren ohne Rückfrage freigeben.
    func webView(_ webView: WKWebView,
                 requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    // Externe Links (falls es mal welche gibt) in Safari öffnen statt im Spiel.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, navigationAction.targetFrame?.isMainFrame ?? true,
           url.scheme != Self.scheme, url.scheme != "about" {
            if navigationAction.navigationType == .linkActivated { UIApplication.shared.open(url) }
            decisionHandler(navigationAction.navigationType == .linkActivated ? .cancel : .allow)
            return
        }
        decisionHandler(.allow)
    }

    // Falls iOS den Web-Prozess im Hintergrund beendet: neu laden statt schwarzem Bildschirm.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.startURL))
    }

    // JS-Dialoge (alert/confirm) nativ anzeigen.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}

/// Liefert Dateien aus dem App-Bundle aus: /fonts/... aus "Fonts", alles andere aus "www".
/// Query-Strings wie "?v=10" werden ignoriert.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let www = Bundle.main.resourceURL!.appendingPathComponent("www", isDirectory: true)
    private let fonts = Bundle.main.resourceURL!.appendingPathComponent("Fonts", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return fail(task) }
        var path = url.path.removingPercentEncoding ?? url.path
        if path.isEmpty || path == "/" { path = "/index.html" }

        let base: URL
        if path.hasPrefix("/fonts/") { base = fonts; path.removeFirst("/fonts".count) } else { base = www }
        let file = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(base.standardizedFileURL.path),
              let data = try? Data(contentsOf: file) else { return fail(task, status: 404, url: url) }

        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let headers = ["Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func fail(_ task: WKURLSchemeTask, status: Int = 400, url: URL? = nil) {
        if let url, let r = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: nil) {
            task.didReceive(r); task.didReceive(Data()); task.didFinish()
        } else {
            task.didFailWithError(URLError(.badURL))
        }
    }
}
