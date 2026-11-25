import AVFoundation
import Foundation

/// Configures and maintains AVAudioSession so HTML5 media continues playing
/// when the app moves to the background or the screen is locked.
final class AudioSessionManager {
    static let shared = AudioSessionManager()

    private(set) var isConfigured = false
    var onInterruptionEndedShouldResume: (() -> Void)?

    private init() {
        registerNotifications()
    }

    func configureForBackgroundPlayback() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [])
            try session.setActive(true)
            isConfigured = true
        } catch {
            print("[AudioSessionManager] Failed to configure session: \(error.localizedDescription)")
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
