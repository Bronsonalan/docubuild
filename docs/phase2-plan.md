# Phase 2: Render Pipeline — Systematic Game Plan

## What Already Exists (from Phase 2 agent)
- `src/remotion/index.ts` — registerRoot entry point ✅
- `src/app/api/render/route.ts` — full render route with bundle + selectComposition + renderMedia ✅
- `next.config.mjs` — experimental.serverComponentsExternalPackages ✅
- `@remotion/bundler` — installed ✅
- Chrome headless shell — downloaded via `npx remotion browser ensure` ✅
- FFmpeg — available at /opt/homebrew/bin/ffmpeg ✅
- Remotion Studio — launches and builds the composition successfully ✅

## What Needs Fixing (5 items)

### Issue 1: Caption timing mismatch in Remotion composition
**File:** `src/remotion/DocuBuildShort.tsx:242-246`
**Problem:** `CaptionBar` receives `timeInSeconds = frame / fps` which is the composition's timeline (0, 1, 2...). But `edl.captions` have timestamps from the *original* video (e.g., word at 45.3s). After dead space removal and segment stitching, composition time 0 maps to the first segment's start time, not 0.
**Fix:** Map composition time back to original video time. For a given composition frame, figure out which segment we're in and what the corresponding original timestamp is. Use that to look up captions.
**Risk:** HIGH — without this, captions will be blank or wrong for the entire video.

### Issue 2: ActionBar has no error feedback or render progress
**File:** `src/components/ActionBar.tsx:34-35`
**Problem:** Errors are silently swallowed (`catch { // stub }`). No elapsed time indicator. A render takes 30-120 seconds — the user won't know if it's working or dead.
**Fix:** Add statusMessage state, elapsed timer, error display. (This was in my earlier write that got blocked.)
**Risk:** MEDIUM — demo-breaking if render fails with no feedback.

### Issue 3: HookSelector still hardcoded to 3 seconds
**File:** `src/components/HookSelector.tsx:47-48`
**Problem:** Agent accepted `edlDuration` prop but ignores it — still `startTime: 0, endTime: 3`.
**Fix:** Use `edlDuration` to compute proportional hook timing.
**Risk:** LOW — hook overlay just won't scale to video length.

### Issue 4: Video URL brittleness
**File:** `src/app/api/render/route.ts:52-53`
**Problem:** `http://localhost:${process.env.PORT || 3000}${project.videoUrl}` — if Next.js dev server runs on 3001 (port conflict), or behind a proxy, this breaks. OffthreadVideo in Remotion needs an HTTP URL.
**Fix:** Use the request's own origin header as the base URL, falling back to localhost. This self-heals across port changes.
**Risk:** MEDIUM — render will fail silently if video URL can't be fetched.

### Issue 5: `maxDuration = 300` may not work in Next.js dev mode
**File:** `src/app/api/render/route.ts:8`
**Problem:** `maxDuration` is a Vercel-specific config. In local Next.js, API routes have no timeout by default. On Railway, this needs the Docker CMD to set `--timeout`.
**Fix:** Not blocking for local dev. Note for Railway deployment.
**Risk:** NONE for local, LOW for Railway.

## Execution Steps (in order)

### Step 1: Fix caption timing in Remotion composition (15 min)
- Add a `compositionTimeToOriginalTime()` function that maps frame-based composition time to original video timestamps using the EDL segments
- Use this mapped time in both `CaptionBar` and `HookOverlay`
- File: `src/remotion/DocuBuildShort.tsx`

### Step 2: Fix video URL resolution in render route (5 min)
- Extract origin from request headers: `const origin = request.headers.get('origin') || request.headers.get('host') || 'localhost:3000'`
- Construct: `http://${origin}${project.videoUrl}`
- File: `src/app/api/render/route.ts`

### Step 3: Fix ActionBar with error handling + elapsed timer (10 min)
- Add statusMessage, elapsed timer, error display
- Parse error responses from render route
- Show "Download MP4" button on success
- File: `src/components/ActionBar.tsx`

### Step 4: Fix HookSelector timing (5 min)
- Use edlDuration prop: `endTime: Math.min(5, Math.max(2, edlDuration * 0.15))`
- File: `src/components/HookSelector.tsx`

### Step 5: Type check + build (5 min)
- `npx tsc --noEmit`
- `npm run build`

### Step 6: End-to-end test (15 min)
- `npm run dev`
- Upload a short video (15-30 seconds)
- Wait for transcription + dead space removal
- Verify video player works with EDL
- Click "Export"
- Watch terminal for render logs
- Verify MP4 appears and downloads

## Total estimated time: 55 minutes
(+ debug buffer: 20 min = 75 min worst case)

## Verification
Terminal should show these log lines in order:
```
[render] Starting render for project {id}
[render] Total duration: Xs (Y frames)
[render] Bundling Remotion project...
[render] Bundle complete, selecting composition...
[render] Rendering to public/renders/{id}.mp4...
[render] Render complete for project {id}
```
Browser should show: "Download MP4" button in ActionBar. Clicking it downloads a 1080x1920 MP4 with letterboxed video, animated captions, and hook overlay.
