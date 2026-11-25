import Combine
import Foundation
import WebKit

/// Holds browser navigation state, script injection settings, and JS-to-Swift media bridge.
final class WebPlayerViewModel: NSObject, ObservableObject {
    @Published var urlString: String = "https://m.youtube.com"
    @Published var adFilterEnabled: Bool = true
    @Published var backgroundPlayEnabled: Bool = true
    @Published var nowPlayingTitle: String = "尚未播放影音"
    @Published var isPlaying: Bool = false

    weak var webView: WKWebView?

    override init() {
        super.init()
        NowPlayingManager.shared.setupRemoteCommands()
        NowPlayingManager.shared.onRemoteCommand = { [weak self] command in
            self?.dispatchMediaCommand(command)
        }
        AudioSessionManager.shared.onInterruptionEndedShouldResume = { [weak self] in
            self?.dispatchMediaCommand("play")
        }
    }

    func loadCurrentURL() {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://")
            ? trimmed
            : "https://\(trimmed)"

        guard let url = URL(string: normalized) else { return }
        urlString = normalized
        webView?.load(URLRequest(url: url))
    }

    func reload() {
        webView?.reload()
    }

    func togglePictureInPicture() {
        let js = "window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.requestPictureInPicture?.();"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func syncSettingsToPage() {
        let js = """
        (function() {
          const settings = {
            adFilterEnabled: \(adFilterEnabled ? "true" : "false"),
            autoSkipEnabled: \(adFilterEnabled ? "true" : "false"),
            backgroundPlayEnabled: \(backgroundPlayEnabled ? "true" : "false"),
            pipEnabled: true
          };
          const ctrl = window.__WebMediaEnhancer?.controllers;
          ctrl?.adFilter?.updateOptions(settings);
          ctrl?.mediaEnhancer?.updateOptions(settings);
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    private func dispatchMediaCommand(_ command: String) {
        let js: String
        switch command {
        case "play":
            js = "window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.getActiveMedia()?.play();"
        case "pause":
            js = "window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.getActiveMedia()?.pause();"
        case "toggle":
            js = """
            (function() {
              const m = window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.getActiveMedia();
              if (!m) return;
              if (m.paused) { m.play(); } else { m.pause(); }
            })();
            """
        case "seekBackward":
            js = """
            (function() {
              const m = window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.getActiveMedia();
              if (m) m.currentTime = Math.max(0, m.currentTime - 10);
            })();
            """
        case "seekForward":
            js = """
            (function() {
              const m = window.__WebMediaEnhancer?.controllers?.mediaEnhancer?.getActiveMedia();
              if (m) m.currentTime = m.currentTime + 10;
            })();
            """
        default:
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

extension WebPlayerViewModel: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "mediaState",
              let body = message.body as? [String: Any] else {
            return
        }

        let title = body["title"] as? String ?? "網頁影音"
        let artist = body["artist"] as? String ?? "Web Media"
        let playing = body["isPlaying"] as? Bool ?? false
        let currentTime = body["currentTime"] as? Double ?? 0
        let duration = body["duration"] as? Double ?? 0

        DispatchQueue.main.async {
            self.nowPlayingTitle = title
            self.isPlaying = playing
            if playing {
                AudioSessionManager.shared.configureForBackgroundPlayback()
            }
            NowPlayingManager.shared.updateNowPlaying(
                title: title,
                artist: artist,
                isPlaying: playing,
                currentTime: currentTime,
                duration: duration
            )
        }
    }
}
