# AnkGuru ASR

AnkGuru is a React Native (Expo) mobile application featuring **100% offline, on-device Automatic Speech Recognition (ASR)**. It uses `whisper.rn` with the `ggml-base` Whisper model to capture and transcribe Marathi speech natively on Android devices.

---

## 🛠️ Prerequisites & Environment Setup

Before running the project, ensure you have the following installed:
- **Node.js** (v18+)
- **Java Development Kit (JDK) 17**
- **Android SDK & NDK**

### Setting Environment Variables (Windows PowerShell)
If your build fails due to SDK path issues, run these commands in your terminal before building:

```powershell
$env:ANDROID_HOME="E:\AndroidSDK"
$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```
*(Adjust the paths above if your SDKs are installed in different locations).*

---

## 🚀 Running the App (Development)

### 1. Run on a physical device via USB Debugging
1. Connect your Android phone via USB.
2. Ensure **USB Debugging** is enabled in your phone's Developer Options.
3. Verify your device is connected by running:
   ```powershell
   adb devices
   ```
4. Build and install the native development client:
   ```powershell
   npx expo run:android
   ```

### 2. Run on an Android Emulator
1. Open Android Studio and start your emulator (AVD).
2. Build and install the app:
   ```powershell
   npx expo run:android
   ```

### 3. Restarting the Metro Bundler
If the app is already installed on your phone/emulator and you just made JavaScript changes, you **do not** need to rebuild the entire app. Just start the Metro bundler:

```powershell
npx expo start --dev-client -c
```
- The `-c` flag clears the cache (highly recommended to avoid stale code).
- Press **`r`** in this terminal to reload the app on your phone.

---

## 📦 Building an APK (Release)

To generate a standalone `.apk` file that you can share and install on any Android device without a computer:

### Option 1: Using Expo CLI (Local Build)
This command compiles a release-optimized version of the app natively on your machine:
```powershell
npx expo run:android --variant release
```
Once finished, you can find the generated APK at:
`android/app/build/outputs/apk/release/app-release.apk`

### Option 2: Using standard Gradle
If you have already generated the `android` folder (via `npx expo prebuild`), you can use standard Android build commands:
```powershell
cd android
./gradlew assembleRelease
```
The APK will be located in the same `outputs/apk/release` folder.

---

## 🐛 Troubleshooting & Important Commands

**Clear Watchman/Metro Cache** (Fixes most weird JS bugs)
```powershell
npx expo start -c
```

**Uninstall the App via ADB** (If you get downgrade/version conflict errors)
```powershell
adb uninstall com.thunder25beast.ankguru
```

**Check ADB Logs (Logcat)** (To see native crashes or Whisper C++ logs)
```powershell
adb logcat *:S ReactNative:V whisper:V
```
