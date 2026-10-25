export type DocumentPictureInPictureApi = {
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<Window>;
};

export function getDocumentPictureInPicture(
  value: unknown,
): DocumentPictureInPictureApi | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DocumentPictureInPictureApi>;
  return typeof candidate.requestWindow === "function"
    ? candidate as DocumentPictureInPictureApi
    : null;
}

export async function moveElementToPictureInPicture(
  element: HTMLElement,
  api: DocumentPictureInPictureApi,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const parent = element.parentNode;
  if (!parent?.isConnected) throw new Error("picture_in_picture_parent_missing");

  const placeholder = document.createComment("live-tour-picture-in-picture");
  const originalStyles = ["width", "height"].map(property => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
  parent.insertBefore(placeholder, element);
  let pipWindow: Window | undefined;
  let moved = false;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    signal?.removeEventListener("abort", restore);
    pipWindow?.removeEventListener("pagehide", restore);
    if (moved && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(element, placeholder);
    }
    placeholder.remove();
    for (const { property, value, priority } of originalStyles) {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
    try { if (pipWindow && !pipWindow.closed) pipWindow.close(); } catch { /* The frame is restored even if the browser has already closed its window. */ }
  };
  try {
    pipWindow = await api.requestWindow({ width: 480, height: 320 });
    if (signal?.aborted || !parent.isConnected || element.parentNode !== parent) throw new DOMException("The video surface changed.", "AbortError");
    const pipDocument = pipWindow.document;
    pipDocument.documentElement.style.background = "rgb(11 20 17)";
    pipDocument.body.style.margin = "0";
    pipDocument.body.style.width = "100vw";
    pipDocument.body.style.height = "100vh";
    element.style.width = "100%";
    element.style.height = "100%";
    pipDocument.body.appendChild(element);
    moved = true;
    pipWindow.addEventListener("pagehide", restore, { once: true });
    signal?.addEventListener("abort", restore, { once: true });
    return { pipWindow, restore };
  } catch (error) {
    restore();
    throw error;
  }
}
