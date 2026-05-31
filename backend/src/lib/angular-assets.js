import fs from 'node:fs/promises';

const defaultAngularAssets = {
  mainJs: '/public/angular/browser/main.js',
  primaryStylesCss: '/public/angular/browser/styles.css',
  secondaryStylesCss: '/public/angular/browser/styles-secondary.css'
};

function toPublicAngularPath(assetPath, fallback) {
  if (!assetPath || typeof assetPath !== 'string') {
    return fallback;
  }

  if (assetPath.startsWith('/public/')) {
    return assetPath;
  }

  if (assetPath.startsWith('/')) {
    return `/public/angular/browser${assetPath}`;
  }

  return `/public/angular/browser/${assetPath}`;
}

function findAngularStylesheet(indexHtml) {
  return indexHtml.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i)?.[1];
}

function findAngularModuleScript(indexHtml) {
  return (
    indexHtml.match(/<script[^>]+src=["']([^"']+)["'][^>]*type=["']module["'][^>]*><\/script>/i)?.[1]
    ?? indexHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i)?.[1]
  );
}

export function createAngularAssetResolver({ angularBrowserPath, angularIndexPath }) {
  let cachedAngularAssets = { ...defaultAngularAssets };
  let cachedAngularAssetsMtimeMs = 0;

  return async function getAngularAssets() {
    try {
      const stats = await fs.stat(angularIndexPath);
      if (cachedAngularAssetsMtimeMs === stats.mtimeMs) {
        return cachedAngularAssets;
      }

      const [indexHtml, browserFiles] = await Promise.all([
        fs.readFile(angularIndexPath, 'utf8'),
        fs.readdir(angularBrowserPath)
      ]);
      const secondaryStyleFile = browserFiles.find((filename) => /^styles-secondary(?:-[^/]+)?\.css$/i.test(filename));

      cachedAngularAssets = {
        primaryStylesCss: toPublicAngularPath(findAngularStylesheet(indexHtml), defaultAngularAssets.primaryStylesCss),
        secondaryStylesCss: secondaryStyleFile
          ? `/public/angular/browser/${secondaryStyleFile}`
          : defaultAngularAssets.secondaryStylesCss,
        mainJs: toPublicAngularPath(findAngularModuleScript(indexHtml), defaultAngularAssets.mainJs)
      };
      cachedAngularAssetsMtimeMs = stats.mtimeMs;
    } catch {
      // Use static fallback if Angular build artifacts are unavailable.
    }

    return cachedAngularAssets;
  };
}