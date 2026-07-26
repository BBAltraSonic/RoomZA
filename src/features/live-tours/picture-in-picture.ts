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
) {
  const parent = element.parentNode;
  if (!parent) throw new Error("picture_in_picture_parent_missing");

  const placeholder = document.createComment("live-tour-picture-in-picture");
  parent.insertBefore(placeholder, element);
  const pipWindow = await api.requestWindow({ width: 480, height: 320 });
  const pipDocument = pipWindow.document;
  pipDocument.documentElement.style.background = "rgb(11 20 17)";
  pipDocument.body.style.margin = "0";
  pipDocument.body.style.width = "100vw";
  pipDocument.body.style.height = "100vh";
  element.style.width = "100%";
  element.style.height = "100%";
  pipDocument.body.appendChild(element);

  const restore = () => {
    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.remove();
    }
    element.style.width = "";
    element.style.height = "";
  };
  pipWindow.addEventListener("pagehide", restore, { once: true });

  return { pipWindow, restore };
}
