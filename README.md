# wa-replay

A local Next.js application for revisiting WhatsApp chat exports: messages, images, videos, voice notes, and attachments in a scrollable conversation. A popup calendar jumps to the first message on a selected day.

## Getting started

Requires Node.js 20.9 or newer and npm. Dependencies are installed in this checkout; on another machine run `npm ci` first.

1. In WhatsApp, open a conversation and choose **Export chat → Include media**. Save the resulting ZIP file.
2. Put the ZIP directly inside this project's **`data/`** folder. Do not unzip it. Multiple ZIPs are supported. The app creates the folder if it is missing.
3. Start the application:

   ```sh
   npm run dev
   ```

4. Open **http://127.0.0.1:3000**. Choose an export from the library. Use **Refresh library** after adding, replacing, or removing ZIPs.

## Browsing

- **Messages:** scroll through the conversation in its original export order. Choose the right-side sender to change the chat perspective. Group chats are supported.
- **Media:** images appear inline and open in a larger popup when clicked. Video and audio use browser playback controls. Other files can be downloaded. If a browser cannot display a format, download the original instead.
- **Calendar:** click the date above the chat. Browse months with the arrows or choose a month and year directly. Days with messages are highlighted; selecting one positions the beginning of that day's messages at the top of the history.
- **Search:** type a phrase, then press Enter or use the arrows to visit matches. Shift+Enter goes to the previous match.
- **Navigation:** previous/next day buttons step through active days; up/down arrows jump to the first/latest message.
- **Export dates:** automatic detection handles day-first, month-first, and year-first numeric dates. When every date is ambiguous, the default is **day/month/year** and a hint appears. Use the date-format selector to override it.
- **Multiple transcripts:** when a ZIP contains more than one `.txt` file, use the transcript selector. `_chat.txt` is preferred automatically.

The parser supports common iPhone (`[31/12/2024, 10:30:00] Person: …`) and Android (`12/31/24, 10:30 AM - Person: …`) exports, multiline messages, system notices, Unicode text, UTF-8 and BOM-marked UTF-16. Export timestamps are displayed as written, without timezone conversion. Numeric dates and English AM/PM markers are supported; localized month-name timestamp formats are not currently supported. Missing media remains visible as text; WhatsApp cannot restore media omitted from an export.

## Privacy and Git

**The entire `data/` directory and all `*.zip` files are ignored by Git.** Chat text and media are read locally from the archive by the Next.js server; nothing is uploaded to an external service. The app does not extract files to `public/` or write chat content into the source tree. Chat and attachment responses use `Cache-Control: no-store`.

The server binds to `127.0.0.1` by default. This is a local tool without user authentication; keep it local when working with private conversations. Git ignore rules do not untrack files already committed or override `git add -f`.

The server keeps one compressed ZIP in memory, decompresses media on request, and the browser renders a moving window of messages for long chats. Text transcripts have a 64 MB limit and individual media files a 512 MB limit. Total archive and message data must fit in available memory.

## Debugging in VS Code

Open this folder in VS Code, open **Run and Debug**, select a configuration from `.vscode/launch.json`, and press **F5**:

- **wa-replay: full stack (Edge)** starts Next.js with the Node debugger and launches Edge when the server is ready. Set breakpoints in React components, parsing code, and route handlers.
- **wa-replay: server** starts the development server in a debug terminal.
- **wa-replay: browser (running server)** launches Edge against an already-running development server.

The full-stack configuration follows the [Next.js debugging guide](https://nextjs.org/docs/app/guides/debugging). On Linux/WSL, Node must be available in the VS Code environment and Edge must be accessible to the browser debugger. Opening the folder in Windows VS Code uses the Windows Node installation. To use Chrome for full-stack debugging, change `debugWithEdge` to `debugWithChrome`.

## Commands and verification

```sh
npm run dev        # Local development
npm run typecheck  # TypeScript
npm test           # Export parser tests using synthetic messages
npm run build      # Production build
npm start          # Run the production build locally
```

Browser tests verify calendar positioning, search, image previews, mobile layout, transcript recovery, and media delivery. Install the test browser once, then run:

```sh
npx playwright install chromium
npm run test:e2e
```

The tests create a synthetic `data/__wa-replay-test__.zip` and remove it afterward. They do not commit or inspect personal conversations. Stop an existing server on port 3000 before testing if it belongs to another project.
