# Summary

Tauri iOS support is experimental (as of early 2026).
It is not as simple as just adding a build option—there are extra steps and limitations.
You’ll need to adapt your project for Xcode, handle iOS-specific permissions, and test thoroughly.

## Key Points:

- ### Tauri iOS Support

Tauri supports iOS, but it’s still in beta/experimental.
You need a Mac with Xcode to build and run iOS apps.

- ### Project Setup

You must run tauri commands to generate an iOS project (e.g., tauri ios init).
This creates an Xcode project you’ll open and build in Xcode.

- ### UI Integration

If your mobile UI is web-based (React, etc.), it should work in the Tauri WebView.
Native iOS features (camera, notifications, etc.) require Tauri plugins or custom Swift code.

- ### Build & Deploy

Not just a build flag: you must handle provisioning profiles, signing, and App Store requirements.
Testing on real devices is essential.

- ### Limitations

Some Tauri APIs/plugins may not be available or stable on iOS.
Performance and compatibility may differ from desktop.