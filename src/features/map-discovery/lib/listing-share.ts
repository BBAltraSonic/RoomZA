export type ListingShareOutcome =
  | "shared"
  | "copied"
  | "cancelled"
  | "manual-copy-required";

export type ListingSharePayload = {
  title: string;
  text: string;
  url: string;
};

type ShareNavigator = {
  share?: Navigator["share"];
  canShare?: Navigator["canShare"];
  clipboard?: Pick<Clipboard, "writeText">;
};

type ListingShareEnvironment = {
  navigator?: ShareNavigator;
  document?: Document;
};

export function buildListingShareUrl(origin: string, listingId: string) {
  return new URL(`/listing/${encodeURIComponent(listingId)}`, origin).toString();
}

export function isShareCancellation(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
  );
}

function canUseNativeShare(navigatorApi: Partial<ShareNavigator>, payload: ListingSharePayload) {
  if (typeof navigatorApi.share !== "function") return false;
  if (typeof navigatorApi.canShare !== "function") return true;

  try {
    return navigatorApi.canShare(payload);
  } catch {
    return false;
  }
}

export function copyWithDomFallback(documentApi: Document, value: string) {
  if (typeof documentApi.execCommand !== "function") return false;

  const activeElement = documentApi.activeElement;
  const textarea = documentApi.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";

  try {
    documentApi.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return documentApi.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) activeElement.focus();
  }
}

export async function shareListing(
  payload: ListingSharePayload,
  environment: ListingShareEnvironment = {},
): Promise<ListingShareOutcome> {
  const navigatorApi = environment.navigator ?? (typeof navigator === "undefined" ? undefined : navigator);
  const documentApi = environment.document ?? (typeof document === "undefined" ? undefined : document);

  if (navigatorApi && canUseNativeShare(navigatorApi, payload)) {
    try {
      await navigatorApi.share?.(payload);
      return "shared";
    } catch (error) {
      if (isShareCancellation(error)) return "cancelled";
    }
  }

  if (navigatorApi?.clipboard?.writeText) {
    try {
      await navigatorApi.clipboard.writeText(payload.url);
      return "copied";
    } catch {
      // Continue to the legacy DOM copy path.
    }
  }

  if (documentApi && copyWithDomFallback(documentApi, payload.url)) return "copied";

  return "manual-copy-required";
}
