type SimpleWebAuthnBrowser = typeof import('@simplewebauthn/browser');

let simpleWebAuthnBrowserPromise: Promise<SimpleWebAuthnBrowser> | null = null;

function loadSimpleWebAuthnBrowser(): Promise<SimpleWebAuthnBrowser> {
  simpleWebAuthnBrowserPromise ??= import('@simplewebauthn/browser');
  return simpleWebAuthnBrowserPromise;
}

export async function browserSupportsAccessKeys(): Promise<boolean> {
  const { browserSupportsWebAuthn } = await loadSimpleWebAuthnBrowser();
  return browserSupportsWebAuthn();
}

export async function startAccessKeyAuthentication(
  options: Parameters<SimpleWebAuthnBrowser['startAuthentication']>[0]['optionsJSON']
): Promise<Awaited<ReturnType<SimpleWebAuthnBrowser['startAuthentication']>>> {
  const { startAuthentication } = await loadSimpleWebAuthnBrowser();
  return startAuthentication({ optionsJSON: options });
}

export async function startAccessKeyRegistration(
  options: Parameters<SimpleWebAuthnBrowser['startRegistration']>[0]['optionsJSON']
): Promise<Awaited<ReturnType<SimpleWebAuthnBrowser['startRegistration']>>> {
  const { startRegistration } = await loadSimpleWebAuthnBrowser();
  return startRegistration({ optionsJSON: options });
}