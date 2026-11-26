import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebPlayerViewModel()
    @State private var showGuide = false
    @State private var showToolbar = false

    private let youtubeDarkBackground = Color(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0)

    var body: some View {
        ZStack(alignment: .bottom) {
            youtubeDarkBackground
                .ignoresSafeArea()

            // Keep top below Dynamic Island/status bar while extending seamlessly to bottom edge
            WebPlayerView(viewModel: viewModel)
                .ignoresSafeArea(.container, edges: .bottom)

            if showToolbar {
                floatingToolbar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else {
                handlePill
                    .transition(.opacity)
            }
        }
        .preferredColorScheme(.dark)
        .gesture(
            DragGesture(minimumDistance: 20)
                .onEnded { value in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if value.translation.height < -20 {
                            showToolbar = true
                        } else if value.translation.height > 20 {
                            showToolbar = false
                        }
                    }
                }
        )
        .sheet(isPresented: $showGuide) {
            safariExtensionGuide
        }
    }

    private var handlePill: some View {
        RoundedRectangle(cornerRadius: 3)
            .fill(.white.opacity(0.35))
            .frame(width: 36, height: 5)
            .padding(.bottom, 6)
            .allowsHitTesting(false)
    }

    private var floatingToolbar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Button { viewModel.webView?.goBack() } label: {
                    Image(systemName: "chevron.left").frame(width: 30, height: 36)
                }
                Button { viewModel.webView?.goForward() } label: {
                    Image(systemName: "chevron.right").frame(width: 30, height: 36)
                }

                TextField("輸入網址", text: $viewModel.urlString)
                    .textFieldStyle(.roundedBorder)
                    .font(.subheadline)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { viewModel.loadCurrentURL() }

                Button { viewModel.reload() } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 30, height: 36)
                }
                Button { viewModel.togglePictureInPicture() } label: {
                    Image(systemName: "pip.enter").frame(width: 30, height: 36)
                }
                Button { showGuide = true } label: {
                    Image(systemName: "info.circle").frame(width: 30, height: 36)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 10)

            HStack(spacing: 8) {
                Toggle("廣告過濾", isOn: $viewModel.adFilterEnabled)
                    .toggleStyle(.button)
                    .controlSize(.mini)
                    .onChange(of: viewModel.adFilterEnabled) { _, _ in
                        viewModel.syncSettingsToPage()
                    }

                Toggle("背景播放", isOn: $viewModel.backgroundPlayEnabled)
                    .toggleStyle(.button)
                    .controlSize(.mini)
                    .onChange(of: viewModel.backgroundPlayEnabled) { _, _ in
                        viewModel.syncSettingsToPage()
                    }

                Spacer()

                Text(viewModel.isPlaying ? "▶ 播放中" : "待命中")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showToolbar = false
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 10)
        }
        .background(
            .ultraThinMaterial,
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .padding(.horizontal, 10)
        .padding(.bottom, 16)
        .shadow(color: .black.opacity(0.4), radius: 12, x: 0, y: 4)
    }

    private var safariExtensionGuide: some View {
        NavigationStack {
            List {
                Section("使用方式") {
                    Text("• 從螢幕下方往上滑 → 顯示工具列（網址列、前進後退、子母畫面）。")
                    Text("• 在工具列往下滑 / 點「∨」→ 收起工具列，恢復完整全螢幕視野。")
                }
                Section("功能說明") {
                    Text("• 廣告過濾：已整合網路層封鎖與網頁層動態跳過，過濾首頁贊助廣告與播放清單影片廣告。")
                    Text("• 背景播放：鎖屏或切換 App 後繼續播放，鎖屏畫面可操作。")
                    Text("• 子母畫面（PiP）：點工具列中的 PiP 按鈕，影片縮小浮動顯示。")
                }
            }
            .navigationTitle("影音增強瀏覽器")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { showGuide = false }
                }
            }
        }
    }
}
