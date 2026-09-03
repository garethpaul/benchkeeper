# Third-party notices

The application includes seven direct production packages, React DOM’s transitive scheduler package, and a build-generated module-preload helper from the Vite/Rolldown pipeline. Their license texts ship in `public/licenses/` and the production build. Build and test dependencies retain their licenses in their packages. Research/template links are credited in the research document; this is an original implementation.

| Package                      | Installed version | License | Text                                                                               |
| ---------------------------- | ----------------- | ------- | ---------------------------------------------------------------------------------- |
| react                        | 19.2.8            | MIT     | [react.txt](public/licenses/react.txt)                                             |
| react-dom                    | 19.2.8            | MIT     | [react-dom.txt](public/licenses/react-dom.txt)                                     |
| scheduler (via react-dom)    | 0.27.0            | MIT     | [Identical React license text](public/licenses/react.txt)                          |
| zod                          | 4.5.4             | MIT     | [zod.txt](public/licenses/zod.txt)                                                 |
| csv-parse                    | 7.0.2             | MIT     | [csv-parse.txt](public/licenses/csv-parse.txt)                                     |
| lucide-react                 | 1.39.0            | ISC     | [lucide-react.txt](public/licenses/lucide-react.txt)                               |
| @fontsource/ibm-plex-sans    | 5.3.0             | OFL-1.1 | [fontsource-ibm-plex-sans.txt](public/licenses/fontsource-ibm-plex-sans.txt)       |
| @fontsource/dm-serif-display | 5.3.0             | OFL-1.1 | [fontsource-dm-serif-display.txt](public/licenses/fontsource-dm-serif-display.txt) |

The installed scheduler license is byte-identical to the React license already shipped above. All eight installed production-package license texts were compared with their distributed copies; this inventory check is not a legal opinion about every possible use or redistribution.

## Build-generated browser helper

Vite 8.2.2 delegates its module-preload helper to Rolldown 1.2.4. The generated entry contains that helper even though these packages are installed as build dependencies. Their notices are included here as well: [Vite core MIT notice](public/licenses/vite-core.txt), [Rolldown MIT and its upstream third-party notices](public/licenses/rolldown.txt). The first file is the unchanged core-license section of the installed Vite license; the second preserves the complete installed Rolldown license and third-party notices.

This is a module-loading compatibility helper, **not a WebMCP polyfill**. No WebMCP implementation is injected or simulated. The build-tool binaries are not part of the browser app. Including these notices is an attribution inventory, not a legal opinion about all redistribution scenarios. [Vite module-preload behavior](https://vite.dev/config/build-options.html#build-modulepreload) · [Rolldown helper source](https://github.com/rolldown/rolldown/blob/v1.2.4/crates/rolldown_plugin_vite_module_preload_polyfill/src/module-preload-polyfill.js)

## Optional demo-production tools

The local video workflow additionally uses Python, eSpeak NG 1.51, FFmpeg/ffprobe 6.1.1 with libass 0.17.1, and DejaVu Sans. These are separate, locally installed or extracted tools; their binaries, voice data and fonts are not included in the app bundle or source export. The app does not load or call them.

Their upstream licensing is separate from this project's MIT license: [eSpeak NG](https://github.com/espeak-ng/espeak-ng/blob/1.51/COPYING), [FFmpeg](https://ffmpeg.org/legal.html), [libass](https://github.com/libass/libass/blob/0.17.1/COPYING), [DejaVu fonts](https://dejavu-fonts.github.io/License.html) and [Python](https://docs.python.org/3/license.html). FFmpeg's applicable license depends on build options and linked libraries; the project's isolated media build enables GPL components. Consult the notices in the actual packages before redistributing those tools. The original application source remains separate from these optional media executables.
