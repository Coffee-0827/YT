import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebPlayerViewModel()
    @State private var showGuide = false
    @State private var showControlsBar = true

    var body: some View {
        VStack(spacing: 0) {
            if showControlsBar {
                compactToolbar
                statusStrip
            }

            ZStack(alignment: .topTrailing) {
                WebPlayerView(viewModel: viewModel)
                    .ignoresSafeArea(edges: .bottom)

                if !showControlsBar {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showControlsBar = true
                        }
                    } label: {
                        Image(systemName: "chevron.down.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.85))
                            .padding(8)
                    }
                }
            }
        }
        .sheet(isPresented: $showGuide) {
            safariExtensionGuide
        }
    }

    private var compactToolbar: some View {
        HStack(spacing: 6) {
            Button {
                viewModel.webView?.goBack()
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 28, height: 32)
            }

            Button {
                viewModel.webView?.goForward()
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 28, height: 32)
            }

            TextField("輸入網址", text: $viewModel.urlString)
                .textFieldStyle(.roundedBorder)
                .font(.subheadline)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onSubmit {
                    viewModel.loadCurrentURL()
                }

            Button {
                viewModel.reload()
            } label: {
                Image(systemName: "arrow.clockwise")
                    .frame(width: 28, height: 32)
            }

            Button {
                viewModel.togglePictureInPicture()
            } label: {
                Image(systemName: "pip.enter")
                    .frame(width: 28, height: 32)
            }
            .accessibilityLabel("子母畫面")

            Button {
                showGuide = true
            } label: {
                Image(systemName: "info.circle")
                    .frame(width: 28, height: 32)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }

    private var statusStrip: some View {
        HStack(spacing: 8) {
            Toggle("過濾廣告", isOn: $viewModel.adFilterEnabled)
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

            Text(viewModel.isPlaying ? "背景音訊就緒" : "待命中")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showControlsBar = false
                }
            } label: {
                Image(systemName: "chevron.up")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    private var safariExtensionGuide: some View {
        NavigationStack {
            List {
                Section("功能說明") {
                    Text("• 網頁廣告過濾：自動隱藏常見影音廣告容器並嘗試略過廣告按鈕。")
                    Text("• 背景音訊播放：按電源鍵鎖屏或切換到其他 App 時會保持聲音播放。")
                    Text("• 鎖屏控制：可在鎖定畫面與控制中心操作播放、暫停與快轉 10 秒。")
                    Text("• 收起工具列：點選狀態列右側「▲」可隱藏上方網址列，獲得更大觀看空間。")
                }
            }
            .navigationTitle("影音增強瀏覽器")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        showGuide = false
                    }
                }
            }
        }
    }
}
