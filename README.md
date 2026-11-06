# Rx Studio — Medical Prescription Generator

Modern, browser-only prescription writing app for **Dr. Muhammad Shafi K**. Designed after the user-supplied "Medical Prescription – Modern Style.pdf".

## Features

- Consultation date/time (auto-filled with local computer time, editable), online/offline consultation mode
- Patient name, age, gender, weight, height, BP, pulse, oxygen saturation, temperature, clinical history, diagnosis
- **252,751 deduplicated medicine/formulation records**, transformed from the uploaded 256,476-row Indian medicine dataset
- Search medicine **brand** or **generic (short_composition1 + short_composition2)** without a paid service, server or D1 configuration
- Medicine results show brand, generic ingredients with strengths, pack and manufacturer; discontinued entries are hidden by default
- Prescribe multiple drugs, amend brand/composition/formulation, remove or duplicate medicines
- Clickable **dosage/volume/frequency** suggestions for tablets, liquids, eye/ear drops, inhalers, injections and topical drugs
- Type a number such as `3` for **3 days / 3 weeks / 3 months** duration suggestions
- Clickable special instruction suggestions, with multiple instructions supported
- Investigations, advice, follow-up, optional review date
- Live preview styled like the provided A4 sample; **Print / Save PDF** opens the browser print dialogue (choose **Save as PDF**)
- Editable doctor profile saved only in this browser
- Encrypted `.rxp` export/import using AES-256-GCM and password-derived keys
- No account, no runtime dependency, no patient data sent to the application server, no third-party scripts

## Easy GitHub → Cloudflare Pages deployment

1. **Extract the ZIP** on your computer. Make a **new GitHub repository** and initialize it with a README (or use a suitable existing repository). To upload the application, open PowerShell in the extracted directory and run:

   ```powershell
   .\PUSH_TO_GITHUB.ps1 -RepositoryUrl "https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git"
   ```

   Git for Windows must be installed and authenticated. The script clones your main branch, copies the application files, commits, and pushes them without force-pushing. Existing files with identical names, including `index.html`, will be replaced in the destination repo. It never deletes unrelated repository files.

2. In [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/), create a **Pages** project and connect the GitHub repository. Choose **no framework**; **build command**: `exit 0` (or leave empty); **build output directory**: `.`; **root directory**: `/` (repository root); production branch: `main`.

3. After the deployment succeeds, open the Cloudflare `*.pages.dev` URL. On subsequent GitHub pushes, Cloudflare should deploy automatically if the project uses Git integration.

If the target Cloudflare Pages project is **already connected to this GitHub repository**, you only need step 1: pushing a commit triggers a rebuild automatically. GitHub does **not** extract a ZIP uploaded as a file: extract it first and upload its contents or use the bundled PowerShell script.

### Alternative: Cloudflare direct upload (without Git)

For a *new project* using **Direct Upload**, upload the extracted website folder in Cloudflare Pages. This does **not** connect a Git repository. Git-connected and Direct Upload projects are different project creation modes.

## Project layout

```text
index.html                    app layout and print document
assets/styles.css             responsive design and A4 print styles
assets/app.js                 logic, prescription preview and encrypted drafts
assets/icon.svg               site icon
data/manifest.json            original/deduplicated catalogue counts
data/xx.json                  865 token-prefix search buckets
_headers                      Cloudflare security headers
robots.txt                    no search-engine indexing
PUSH_TO_GITHUB.ps1            simple upload from PowerShell
README.md                     these instructions
```

No NPM install or build step is necessary. The `data` directory **must** be deployed with the HTML and JavaScript files. Running index.html via a local `file://` URL won't allow medicine search; use a local web server or deployed HTTPS site.

## How catalogue search works

The included source dataset contains 256,476 rows. Identical `(name, composition1, composition2, pack label)` entries were deduplicated to **252,751 records**; some duplicate brand names are intentionally retained when strengths or packaging differ. 865 static JSON buckets index the first two characters of every meaningful brand/ingredient token. When typing `amoxy`, `allegra`, `montelukast`, or `clavulanic`, the app downloads only the matching prefix bucket then performs an in-browser prefix search. Display results are capped at 35 for responsiveness. The catalogue is a reference, not a clinically validated dosing guide; entries may be outdated.

## Clinical safety and privacy

**Clinician-use prototype, not a certified clinical information system.** Verify medication, formulation, strength, dosage, route, frequency, duration, patient identity, allergies, contraindications, pregnancy/renal/hepatic considerations, interactions, and instructions before issuing. Autosuggestions are input shortcuts only; they are **not** patient-specific dosing decisions. No digital signature or telemedicine workflow compliance is implied by the online/offline selector.

- The static site has **no patient data server, API, login, database or automated prescription history**. Patient details are held in page memory and are erased on refresh/new prescription unless explicitly exported as an encrypted `.rxp` file.
- The optional doctor's profile is stored in `localStorage`, never patient content.
- The `.rxp` export is encrypted in the browser; its password is essential for recovery. Use secure devices, strong passwords and secure document storage; treat exported PDFs as sensitive, **unencrypted** patient files.
- Printing uses the browser's native A4 output. For PDFs, select "Save as PDF" and ensure A4 with background graphics enabled. Multi-page prescriptions may paginate automatically.
- The site can be publicly reached on Cloudflare Pages, even though it does not transmit patient data. Production clinical deployment should be assessed for organisational access controls, privacy policy, audit, role-based permissions, formal clinical safety checks, and applicable local medical-record/telemedicine rules before patient use.
- Do not publish an actual patient's prescription or medical data in the GitHub repository. The optional demo record is based on the supplied sample layout only.
