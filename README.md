# BeadPattern
Creates bead patterns from images

## Development

Install dependencies:
```bash
npm install
```

Run the app in development mode:
```bash
npm start
```

## Building a Portable Distribution

To build a self-contained folder that can run on another PC without installing anything:

```bash
npm run pack
```

This produces an unpacked, portable build in the `dist/` directory (e.g. `dist/win-unpacked/` on Windows, `dist/mac/` on macOS, or `dist/linux-unpacked/` on Linux). Copy the entire folder to the target machine and run the executable directly.

To build a distributable installer/package instead:
```bash
npm run dist
```
