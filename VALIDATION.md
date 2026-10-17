# Sprout validation

## Verified

- TypeScript strict type checking and production renderer/main/preload/worker builds.
- Motion and rig tests: direction and blink hysteresis, audio gating, simultaneous-expression priority, smoothing, calibration offsets, 250 ms loss hold and 300 ms neutral recovery, pose fallback, independent layered features.
- Continuity-lock tests: maintain the selected face when another face is larger, require reacquisition after loss, and retain a continuously detected face during slow inference.
- Storage/server tests: profile round-trip, relocation with relative copied PNGs, path/schema rejection, authenticated endpoints, read-only output, initial state, and WebSocket reconnection. There are **57 passing automated tests** across artwork, head-pose conversion, motion, locking, storage, output, installer generation, and input permissions/discovery.
- Camera monitor tests: normalized skeleton coordinates, invalid landmark handling, stale/lost skeleton clearing, and rejection of webcam/diagnostic fields from OBS packets.
- Electron smoke test: studio opens, both rig modes render, PNG imports copy into managed assets, profile changes persist, local overlay draws an avatar with transparent corner pixels, bundled MediaPipe detects a test portrait, and the synthetic webcam pipeline completes neutral calibration. Mocked microphone and camera permission denials show the expected recovery messages. No renderer JavaScript errors were recorded.
- A Windows x64 NSIS installer was generated. The packaged executable also passed the same Electron smoke checks against its ASAR-bundled model, worker, artwork, and renderer. Installation into the user's regular application directory has not been performed by the development session.

The smoke test uses an isolated test profile directory, software rendering, synthetic camera input, and `--no-sandbox` because Chromium subprocesses fail under this development sandbox. The production application retains `sandbox: true`, context isolation, and disabled Node integration. The normal production sandbox launch must still be checked outside this restricted development environment.

## v0.2.0 camera monitor checks (2026-10-05)

All 21 automated tests, strict TypeScript checking, production builds, and the expanded Electron smoke suite passed. The updated packaged executable passed the same suite with zero renderer JavaScript errors. Synthetic camera checks cover real video element playback, feed visibility without stopping inference, independent skeleton/mirror/size controls, local diagnostics, face-loss clearing/recovery, and calibration. The OBS page contains no video element or camera monitor. A PNG import timing race discovered during visual review was fixed; the imported simple pose renders without an artwork alert.

The v0.2.0 NSIS installer uses the previously packaged Windows Electron runtime with a freshly bundled application ASAR. The camera monitor is checked using a public MediaPipe portrait fixture rather than physical webcam footage. Display toggles start off each session (preview mirroring defaults on). Live hardware acceptance requirements below remain outstanding.

## v0.2.1 centered layer scaling (2026-10-05)

The Scale slider now preserves the geometric center of each PNG layer by compensating its saved top-left coordinates. Existing profile placement and normalized pivot settings remain compatible. The available scale range accounts for the existing coordinate bounds, rather than shifting the center or saving an invalid profile.

All 26 automated tests and strict TypeScript/production builds passed. New regression tests cover non-square artwork, growing/shrinking, repeated scrubbing, custom pivots, unaffected sibling layers, large PNGs, coordinate limits, and profile serialization. The packaged v0.2.1 executable passed the focused scaling smoke test: the real slider preserves the center, the profile retains its scale and center across an application restart, studio/OBS pixels match at equal canvas dimensions, and output transparency is retained. No renderer JavaScript errors were recorded. The Windows installer was regenerated from the same checked application archive.

## v0.3.0 facing states (2026-10-06)

Both rig modes expose Center, Left, and Right artwork banks and a saved Directional sprite states switch. With the switch off, facial animation continues using centered artwork. PNG poses support each facing's expressions and combined talking/blinking poses; layered rigs support each facing's resting art and independent eye, mouth, and brow variants. Missing side variants prefer that side's resting art before centered fallbacks. Existing profile alignment and legacy head-direction assignments remain compatible.

All 34 automated tests, strict TypeScript checking, and production builds passed. New tests cover the centered-only switch, yaw hysteresis, side-specific feature combinations, simultaneous expressions, fallbacks, and legacy profile loading. Source and packaged Electron checks exercise native PNG assignment, synthetic yaw switching in the studio and local OBS renderer, combined smile/talk/blink poses, layered side art and blinks, studio-only artwork previews, and save/restart persistence. No renderer JavaScript errors were recorded. These checks use synthetic signals rather than a new physical webcam trial.

The v0.3.0 NSIS installer uses the previously packaged Windows Electron runtime with a freshly bundled application ASAR. Hardware and normal production sandbox acceptance requirements below remain outstanding.

## v0.3.1 Sprout rename (2026-10-06)

The desktop UI, window/output titles, support messages, package name, executable filename, installer name, and repository use Sprout. The original application ID (`studio.luma.pngtuber`) and production data path (`%APPDATA%\luma-pngtuber`) are retained for upgrade compatibility. Earlier releases were distributed under the Luma name.

All 34 automated tests, strict TypeScript checking, and production builds passed. The packaged Sprout executable passed a branding/profile compatibility check using isolated data created by the earlier Luma executable: the full active profile and persistent OBS token were retained, the app and output titles use Sprout, and transparent avatar output remains intact. No renderer JavaScript errors were recorded. The Sprout v0.3.1 NSIS installer was regenerated from that checked application archive. Physical installer upgrade testing remains outstanding.

## v0.3.2 complete sample facing artwork (2026-10-09)

The sample now includes angled left/right head and facial components, with an anchored body. Each facing supports neutral, smile, and surprise expressions with talking and blinking combinations: 36 whole-image poses and 40 layered component PNGs, all on aligned transparent 1024 × 1024 canvases. The source drawings and a generated contact sheet are checked in. Existing profiles with unchanged stock artwork gain missing stock assignments on load; customized or reassigned artwork is preserved, along with positioning, settings, and calibration.

All 39 automated tests, strict TypeScript checking, and production builds passed. Artwork checks decode all 76 assigned PNGs, verify dimensions, visible content, alpha and transparent corners, and verify that all 36 whole-image poses are distinct. Mapping tests cover every facing/expression/talk/blink combination in both rig modes. Storage tests cover stock-profile backfilling, repeated loads, persistence, and preservation of custom artwork and existing settings.

The packaged executable passed the old-profile/OBS-token compatibility and facing-state smoke checks, with transparent output and zero renderer JavaScript errors. Facing checks cover native imports, combined smile/talk/blink poses, synthetic yaw in studio and output, the centered-only switch, studio-only previews, layered side/blink variants, and save/restart persistence. These use synthetic signals rather than physical webcam trials.

The v0.3.2 NSIS installer was generated from the checked application archive. This environment rejected the legacy NSIS compiler and generated helper executable with Windows DLL relocation errors. Packaging used the official NSIS toolset bundle 2.0.1 (NSIS 3.12) and electron-builder's uninstaller extraction reader, extended to accept the newer compiler's ordinary `.idata`, `.reloc`, and `.ndata` PE sections. This changes only build-time extraction; executable bytes and installer behavior are not patched. Physical installation and normal production sandbox acceptance requirements below remain outstanding.

## v0.3.3 side-facing tilt and avatar mirroring (2026-10-09)

Corrected the camera transform conversion to read MediaPipe's column-major rotation consistently. Yaw selects the facing using the same screen coordinates as the projected head-up axis; pitch moves downward for a downward nod. The projected up axis retains visible up/down tilt while facing sideways, without reversing it at facing thresholds. Recalibrate neutral pose after upgrading so old offsets match the corrected coordinate conventions. The matrix format follows [MediaPipe's matrix serialization](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix_data.proto).

The saved **Mirror avatar** switch reflects the entire shared renderer, independently of **Mirror movement** and webcam preview mirroring. It defaults off in old and new profiles. Canvas dragging and Shift-click pivot placement convert reflected screen coordinates back to artwork coordinates.

All 45 automated tests, strict TypeScript checking, and production builds passed. New tests independently compose scaled camera rotations and cover left/right up/down nods with both motion-mirror settings, projected lean, missing/invalid matrices, old profile defaults, independent mirror serialization, and mirrored editing coordinates.

The packaged executable passed the focused motion check in both rig modes. Synthetic camera input uses signals derived from composed camera matrices; colored nose/pivot markers verify rendered nod direction in the studio and OBS. Pixel checks verify that the avatar switch produces a horizontal reflection, studio/output pixels match, and transparency is retained. The actual UI drag and pivot interactions and mirror settings survive save/restart. Old-profile settings, geometry, assignments, and OBS token compatibility also pass. No renderer JavaScript errors were recorded.

The v0.3.3 NSIS installer uses the same build-time toolset/extraction workaround as v0.3.2. Extracting its embedded application archive yields an exact SHA-256 match to the tested packaged runtime. Physical installation, live webcam verification of the corrected angles, normal production sandbox checks, and the hardware acceptance work below remain outstanding.

## v0.3.4 installer repair (2026-10-09)

The v0.3.3 upgrade was reported to show both "Sprout cannot be closed" and old-uninstaller exit code 2. Read-only inspection found an installed v0.3.2 application, while v0.3.3 remained an installer download. The builder's retry loop reuses the close-app message after any nonzero old-uninstaller result. Its old update cleanup aborts on a failed rename into the temporary directory. The specific locked file or Windows error on the user's machine has not been established.

The new packaging entry point replaces that old-uninstaller invocation with a guarded in-place update. It rejects installation-folder changes during upgrades, preserves app data, leaves uninstall registration intact until standard new-version registration, and retains the standard new uninstaller. A generated manifest checks write access to each shipped file plus legacy launchers before extraction. Checks use Win32 CreateFileW with OPEN_EXISTING, without changing file contents or terminating processes. The error names the inaccessible file and allows Retry or Cancel; silent mode cancels. Obsolete Luma launchers alone are removed after installation.

All 47 tests and TypeScript/production builds pass. Installer-generation tests use the actual pinned builder template, ensure the replacement cannot execute the old uninstaller or remove data/registration, reject incompatible template changes, cover nested payload files, and reject unsafe manifest paths. These tests validate generated code, not a physical Windows installation. A portable runtime is supplied as a separate fallback; it shares the existing profile storage but does not update the installed copy.

The generated Windows x64 installer compiled successfully. Its extracted application ASAR has the exact same SHA-256 as the tested packaged runtime (`20fef5daa5c994d8bab6623745925e73a8a82638043dccaeaaed8eacae583a1f`). Packaged motion/mirroring checks passed in both rig modes with matching transparent output and no renderer errors. The old-profile compatibility check retained settings, geometry, assignments and the persistent OBS token. The portable ZIP passed archive integrity checking. These runs use isolated test data and the existing test-only sandbox/software-rendering flags.

The development sandbox cannot execute the generated NSIS stubs (Windows reports an illegal system DLL relocation). A real v0.3.2-to-v0.3.4 upgrade, locked-file Retry/Cancel, new-install/uninstall behavior, all-user installations, antivirus interactions, disk-full/interrupted extraction, and installation-folder relocation remain manual acceptance checks. In-place extraction is not transactional: on interruption, rerun the installer. The prior build-time NSIS toolset and uninstaller-extraction workaround remains required in this environment.

## v0.4.0 cartoon motion (2026-10-12)

Cartoon motion adds bounded damped springs for head lag/overshoot, slower facial overlap and accessory swing, plus reciprocal body squash/stretch, speech/blink compression, surprise stretch, and restrained feature exaggeration. The rig inherits body deformation around a foot anchor; head features share a parent transform. Accessories choose head/body attachment and use their saved pivot. Whole-image sprites receive whole-image deformation. Cartoon intensity is saved, defaults to 65% in new and legacy profiles, and zero restores classic motion. Edit mode stays still. The new preview loop never changes the streamed state.

All 54 unit tests pass. Seven new tests cover turn lag and stop overshoot, speech/blink/surprise accents, frame-rate stability and repeated timestamps, 5,000 jitter/extreme/loss frames, long-gap bounds, settling, disable/reset, area preservation, scaled/positioned foot anchoring, legacy defaults, attachment persistence, and schema bounds. The initial output-server test process lacked localhost network permission; all six server tests passed after permission was granted. Strict TypeScript and production renderer/main/preload/worker builds passed.

The packaged v0.4.0 executable passed the new cartoon smoke check with zero renderer errors. The real UI exposes the toggle/intensity, animates the camera-free preview, saves the intensity and accessory attachment, and reloads them on restart. Forty-eight frozen animation frames match the shared renderer against the actual local OBS page pixel-for-pixel across simple/layered modes, body/head accessory attachment, and both avatar mirror settings. The overlay retains transparent corners and contains no video element. The check freezes publication through the existing IPC handler only in the test process; production behavior is not patched. A classic/cartoon GIF comparison is generated from the shared renderer for visual review.

Spring state is computed once in the studio at animation cadence, then included in validated animation packets. OBS renders the received state rather than integrating its own clock-dependent springs. Existing tracking, expression arbitration, calibration and asset selection remain unchanged. Physical webcam/OBS trials and installed upgrade validation remain outstanding; these checks use synthetic movement and isolated profiles with the documented test-only sandbox/software-rendering settings.

The Windows x64 installer compiled with the v0.3.4 upgrade repair retained. Its extracted application ASAR exactly matches the tested runtime (`c82b4a6052762c23daa533be9fa46a8c1ec11e8a4a62bd1b6b62ea90d68c2475`). The portable ZIP passed archive integrity checking. The packaged legacy-profile smoke test retained existing artwork assignments, layer geometry, previous settings and the OBS access token while applying the new default cartoon intensity. The existing packaged motion regression suite also passed: sideways nods in both rigs, both movement mirror settings, complete avatar reflection, mirrored layer dragging/pivots, transparent output, and saved geometry/settings after restart.

## v0.4.1 camera/microphone selection (2026-10-17)

Reproduced [issue #1](https://github.com/wxyz404/sprout-pngtuber/issues/1) against the packaged v0.4.0 runtime using three Chromium fake cameras. Permission checks received `http://127.0.0.1:18743/` while Sprout compared against `http://127.0.0.1:18743`. Enumeration therefore returned only empty-ID/empty-label default placeholders, even during otherwise successful capture. The fix compares parsed origins and also requires the exact authenticated studio URL and main frame, with the existing studio-WebContents check retained.

The input list now removes hidden placeholders and duplicate IDs, preserves distinct devices with identical names, refreshes on demand/hotplug/capture changes, and reports discovery failures. A disconnected selected ID is shown explicitly. Microphones can be selected before enabling capture. Stale selected-device capture errors direct the user to refresh/reselect. No capture is initiated by refreshing or selecting an inactive input.

All 57 tests, strict TypeScript checking, and renderer/main/preload/worker production builds passed. New permission tests cover origin slash normalization and rejection of different schemes, hosts, ports, tokens, subframes, OBS URLs, malformed origins and non-media permissions. Input-list tests cover hidden/default placeholders, duplicates, and same-name distinct devices.

The packaged v0.4.1 executable passed `scripts/devices-smoke.cjs`: three cameras and three microphone inputs enumerate with IDs and names before capture; nondefault video/audio selections open the exact requested IDs; refresh starts no streams; injected discovery failure recovers; simulated removal preserves the selected ID; and the actual OBS page cannot enumerate named devices or acquire a camera. No renderer errors were recorded. The test uses Chromium's fake-hardware flag, real enumerateDevices/getUserMedia and production permission handlers, without the fake-permission-UI flag or permissive handler overrides. Only failure/removal conditions wrap the native enumerator. Capture and profile data remain isolated from the user's application.

Actual Windows 11 capture-card/USB/virtual-camera hardware confirmation by the reporter is still needed. These are native API regression checks against simulated devices, not a claim that every Windows driver has been tested. The previously documented physical installer and hardware acceptance limits remain.

The Windows installer compiled successfully and its extracted ASAR exactly matches the tested packaged runtime (`06db39fe5023280206ffe6e7daa00a446911dadd1cf0e0e88c20f4b7763a4686`). The portable ZIP passed archive integrity checking. The packaged old-profile/OBS-token compatibility check passed with no renderer errors. Physical installer execution remains unverified in this development environment.

## Performance evidence and limits

Cold CPU inference on one bundled-model test portrait took approximately **161–242 ms** across smoke runs in the constrained software-rendering test environment; the final packaged-executable run measured **161 ms**. These are individual inference measurements, not a motion-to-output percentile, steady-state webcam benchmark, or claim that the 150 ms latency target has been met.

For v0.2.0, individual cold portrait probes measured 109–276 ms during source checks and **214 ms** in the final packaged smoke check. These remain fixture measurements, not motion-to-output latency or a 95th percentile.

Capture targets 640 × 480 at 30 FPS. The application drops stale capture opportunities, allows only one frame in flight, and lowers inference frequency with workload. Rendering runs separately at the display's animation cadence, up to 60 FPS, while output state is published at approximately 30 Hz.

## Hardware acceptance still required

OBS was not found in its standard installation location in this environment. No physical webcam session or real OBS capture was used. Before treating this as a production release, perform:

1. Install and launch the packaged application with its normal sandbox settings on a Windows 11 laptop.
2. Test camera permission denial/recovery, physical unplug/reconnect, a busy camera, and microphone permissions/disconnection.
3. Validate turn direction, expression sensitivity, and neutral calibration under normal and dim lighting, glasses, varied faces, and partial occlusion. Check a second person entering the frame and deliberate reacquisition.
4. Import custom PNG art, align and pivot layered rigs, save, restart, and verify the saved avatar appears in OBS.
5. Run a **30-minute OBS streaming soak** with 1024 × 1024 transparent Browser Source output at 60 FPS; check memory, reconnection, CPU use, animation stability, and absence of raw camera frames.
6. Measure capture-to-visible-output latency across at least 1,000 transitions on the reference laptop. Report median and 95th percentile; compare the latter with the 150 ms target. Tune model input, inference cadence, and smoothing from measured results.

The application does not provide biometric identity verification, reconstructed profile artwork, automatic PNG segmentation, or phoneme lip-sync. Facial signals describe visible movements rather than emotional state.
