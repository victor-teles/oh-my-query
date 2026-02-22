cask "oh-my-query" do
  version "0.1.0"

  on_arm do
    url "https://github.com/victor-teles/oh-my-query/releases/download/v#{version}/oh-my-query_#{version}_aarch64.dmg"
    sha256 "PLACEHOLDER"
  end

  on_intel do
    url "https://github.com/victor-teles/oh-my-query/releases/download/v#{version}/oh-my-query_#{version}_x64.dmg"
    sha256 "PLACEHOLDER"
  end

  name "oh-my-query"
  desc "Desktop app for querying databases with AI"
  homepage "https://github.com/victor-teles/oh-my-query"

  app "oh-my-query.app"

  postflight do
    system_command "/usr/bin/xattr",
      args: ["-dr", "com.apple.quarantine", "#{appdir}/oh-my-query.app"],
      sudo: false
  end

  uninstall quit: "dev.ohmyquery.app"

  zap trash: [
    "~/Library/Application Support/dev.ohmyquery.app",
    "~/Library/Caches/dev.ohmyquery.app",
    "~/Library/Logs/dev.ohmyquery.app",
  ]
end
