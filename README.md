# InternPilot AI

InternPilot AI is a browser-based internship search and application-tracking app. The frontend works locally with its clearly labeled fictional sample dataset. The optional FastAPI backend enables Tavily web search and Nebius Token Factory draft/explanation generation.

## Run the frontend

1. Install Node.js 20.19+ or 22.12+.
2. From the project root, run `npm install`.
3. Start the app with `npm run dev`.
4. Open the local URL printed by Vite.

The app supports direct links to its sections and internship details. When deploying the frontend, configure the static host to serve `index.html` for app routes so refreshes and shared links reach the client-side router. Unknown paths display an in-app 404 page; configure your host separately if it must return an HTTP 404 status.

The app does not set tracking or advertising cookies. Profile, application, and preference data are saved in browser local storage on this device. Use **Settings & Integrations → Delete all local data** to remove the saved app data.

## Run the backend

In PowerShell, from the project root:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and add your provider keys:

- `TAVILY_API_KEY` enables live web search.
- `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL` enable Nemotron draft and match-explanation generation. Use the exact endpoint and model ID shown in your Nebius account/docs; the app intentionally does not guess them.
- `FRONTEND_ORIGINS` is optional; configure it only if using frontend origins outside the default local Vite dev/preview ports.

Start the API from the project root:

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The default frontend backend URL is `http://127.0.0.1:8000`. Visit **Settings & Integrations** and click **Check status** after starting the backend. The app also checks the default backend when it loads. Restart the backend after changing `backend\.env`. Keys stay in `backend\.env` and are never sent to the browser; do not commit that file or paste keys into frontend code.

Without Tavily, search uses the fictional bundled sample data. With Tavily configured, results link to their source pages; verify each posting on its source before applying. **Apply with AI** offers a live search action when a sample role is selected, and fetched live results are retained in this browser so they remain selectable after refresh. An **Official apply** link appears only when the posting URL matches the named employer's domain or a supported company-hosted hiring platform (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, or Breezy) and the employer is identified in the posting. Other job-board results show the original listing instead; they are not labeled as official application links. Resume PDF text extraction runs locally in the browser, reads all pages, and keeps the complete extracted text plus detected or inferred sections editable in the profile. Text-only extraction does not work for scanned/image-only PDFs. Both AI drafting screens use the same Nebius generation endpoint; application-material requests use JSON mode to keep Nemotron output parseable. A configured status only confirms settings are present; it does not test credentials, model access, or quota. Both screens ask for explicit consent before sending profile and job data to Nebius.

**Application Studio** is the focused writing workspace: generate, edit, copy, and save all application drafts. **Apply with AI** is the guided application workflow: select a resume-matched role, prepare a packet, review each item, and continue to a verified employer listing. It does not fill or submit third-party forms; you complete and submit there yourself. Resume PDFs are extracted locally and are not retained for upload; attach your resume on the employer's site when requested.

This backend is intended for local development. Do not expose it to the public internet as-is: it has no user authentication, and configured API keys can incur provider usage costs.

The API exposes `GET /health`, `GET /api/integrations/status`, `POST /api/search`, `POST /api/generate/materials`, and `POST /api/generate/explanation`. Provider actions return explicit errors when credentials are missing or a provider request fails. Run backend tests with:

```powershell
python -m unittest discover -s backend\tests -t backend -v
```

## Build

Run `npm run build` for the production frontend in `dist/`, or `npm run preview` to serve the build locally.
