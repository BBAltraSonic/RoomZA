// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
const calls = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("./actions", () => ({ uploadListingImage: calls.upload, deleteListingImage: calls.remove }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- Image transport is outside this component state test.
  <img src={src} alt={alt} />
) }));
import { ImageUploader } from "./image-uploader";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const versions = ["2026-10-24T19:00:00.000001+00:00", "2026-10-24T19:00:00.000002+00:00", "2026-10-24T19:00:00.000003+00:00"];
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
function setup(disabled = false, withImage = false) {
  let current = versions[0];
  const version = vi.fn((next: string) => { current = next; });
  const pending = vi.fn();
  const { container } = render(<ImageUploader listingId={id} getExpectedUpdatedAt={() => current}
    onVersionChange={version} onPendingChange={pending} disabled={disabled}
    defaultImages={withImage ? [{ id, public_url: "http://localhost/photo.png", sort_order: 0 }] : []} />);
  return { version, pending, container };
}
function files() { return [new File(["declared image bytes"], "first.png", { type: "image/png" }), new File(["declared image bytes"], "second.png", { type: "image/png" })]; }

it("uses the returned listing version for each consecutive selected photo", async () => {
  let count = 0;
  calls.upload.mockImplementation(async () => ({ success: true, data: { image: { id: String(++count), public_url: "http://localhost/" + count + ".png", sort_order: count - 1 }, updatedAt: versions[count] } }));
  const result = setup();
  await act(async () => { fireEvent.change(screen.getByLabelText("Listing photos"), { target: { files: files() } }); });
  expect(calls.upload.mock.calls.map(call => call[2])).toEqual([versions[0], versions[1]]);
  expect(result.version.mock.calls.map(call => call[0])).toEqual([versions[1], versions[2]]);
  expect(result.pending.mock.calls.map(call => call[0])).toEqual([true, false]);
  expect(result.container.querySelectorAll("img")).toHaveLength(2);
});

it("stops after an uncertain acknowledgement and leaves the version and gallery intact", async () => {
  calls.upload.mockRejectedValue(new TypeError("Failed to fetch"));
  const result = setup(false, true);
  await act(async () => { fireEvent.change(screen.getByLabelText("Listing photos"), { target: { files: files() } }); });
  expect(calls.upload).toHaveBeenCalledTimes(1);
  expect(result.version).not.toHaveBeenCalled();
  expect(result.container.querySelectorAll("img")).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toContain("Reload the listing before retrying");
  expect(result.pending.mock.calls.map(call => call[0])).toEqual([true, false]);
});

it("does not start photo mutations during a parent save", async () => {
  const result = setup(true, true);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Listing photos"), { target: { files: files() } });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  });
  expect(calls.upload).not.toHaveBeenCalled();
  expect(calls.remove).not.toHaveBeenCalled();
  expect(result.pending).not.toHaveBeenCalled();
});

it("supplies the loaded version when removing a photo and returns its new version to the form", async () => {
  calls.remove.mockResolvedValue({ success: true, data: { updatedAt: versions[1] } });
  const result = setup(false, true);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" })); });
  expect(calls.remove).toHaveBeenCalledWith(id, versions[0]);
  expect(result.version).toHaveBeenCalledWith(versions[1]);
  expect(result.container.querySelectorAll("img")).toHaveLength(0);
  expect(result.pending.mock.calls.map(call => call[0])).toEqual([true, false]);
});

it.each([
  { name: "unsupported", type: "image/gif", bytes: new Uint8Array(1), message: "Only JPEG, PNG, and WebP" },
  { name: "oversize", type: "image/png", bytes: new Uint8Array(10 * 1024 * 1024 + 1), message: "10 MB" },
])("rejects $name files before starting a server action", async ({ type, bytes, message }) => {
  const result = setup();
  await act(async () => { fireEvent.change(screen.getByLabelText("Listing photos"), { target: { files: [new File([bytes], "photo.png", { type })] } }); });
  expect(calls.upload).not.toHaveBeenCalled();
  expect(result.pending).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain(message);
});
