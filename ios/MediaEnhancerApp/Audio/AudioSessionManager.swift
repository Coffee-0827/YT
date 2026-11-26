import AVFoundation
import Foundation
import UIKit

/// Configures and maintains AVAudioSession so HTML5 media continues playing
/// when the app moves to the background or the screen is locked, and holds a
/// short background task during playlist track transitions so WebKit isn't suspended.
final class AudioSessionManager {
    static let shared = AudioSessionManager()

    private(set) var isConfigured = false
    var onInterruptionEndedShouldResume: (() -> Void)?

    private var transitionTaskId: UIBackgroundTaskIdentifier = .invalid

    private init() {
        registerNotifications()
    }

    func configureForBackgroundPlayback() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            isConfigured = true
        } catch {
            print("[AudioSessionManager] Failed to configure session: \(error.localizedDescription)")
        }
    }

    /// Keeps WebKit alive briefly between tracks (when audio temporarily stops)
    /// so the next song in a playlist can load and start without freezing.
    func beginTransitionBackgroundTask() {
        DispatchQueue.main.async {
            if self.transitionTaskId != .invalid {
                return
            }
            self.transitionTaskId = UIApplication.shared.beginBackgroundTask(
                withName: "MediaTrackTransition"
            ) { [weak self] in
                self?.endTransitionBackgroundTask()
            }
        }
    }

    func endTransitionBackgroundTask() {
        DispatchQueue.main.async {
            guard self.transitionTaskId != .invalid else { return }
            UIApplication.shared.endBackgroundTask(self.transitionTaskId)
            self.transitionTaskId = .invalid
        }
    }

    private func registerNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let rawType = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else {
            return
        }

        if type == .ended {
            let optionsRaw = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
            if options.contains(.shouldResume) {
                configureForBackgroundPlayback()
                onInterruptionEndedShouldResume?()
            }
        }
    }
}
