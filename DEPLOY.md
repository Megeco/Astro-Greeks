# Publish this baseline on your existing Vercel app

1. Extract this ZIP and open the `astro-greeks` folder.
2. In https://github.com/Megeco/Astro-Greeks choose **Add file → Upload files**. Upload the contents of that folder at the repository root, replacing matching files. The root should contain `package.json`, `app`, `lib`, and the other source files—not an extra enclosing `astro-greeks` directory. Commit the upload.
3. Your connected Vercel project should build and deploy that commit. If it does not, open the existing project and redeploy the latest main-branch commit.

Keep the framework **Next.js**, root directory the repository root, build command `npm run build`, and the default output directory. No API keys, broker tokens, paid market-data service, or new database are needed.

The homepage says **MACRO NOTEBOOK** and **v0.5.0** after the new deployment is active. It automatically loads the latest retrievable published Nifty close and 75 macro dates starting today in IST. Partial progress is labelled; wait for75/75 for the complete window. You can choose a different start date. Monthly readings describe score changes and maxima; they are not validated Nifty forecasts. The historical date selector changes macro calculations, not the current dated Nifty reference.

The previous workspace remains at `/options`, and tests/data at `/research`. Notes save in your browser and can be exported with the reading.

This source package is tested but has not been published by the assistant: GitHub's connection rejected repository writes with403. Uploading it with your own GitHub account is the remaining deployment step.
