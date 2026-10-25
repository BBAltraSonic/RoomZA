"use client";

import * as tus from "tus-js-client";

import { createClient } from "@/lib/supabase/browser";

type UploadConfiguration = {
  bucket: string;
  objectPath: string;
  tusEndpoint: string;
  chunkSize: number;
  retryDelays: number[];
};

type PreviousImportUpload = Awaited<ReturnType<tus.Upload["findPreviousUploads"]>>[number];

function scopedPreviousUpload(previous: PreviousImportUpload[], configuration: UploadConfiguration, file: File, contentType: string) {
  const prefix = configuration.objectPath.slice(0, configuration.objectPath.lastIndexOf("/") + 1);
  const endpoint = new URL(configuration.tusEndpoint);
  return previous.find((upload) => {
    const object = upload.metadata.objectName;
    if (upload.metadata.bucketName !== configuration.bucket || upload.metadata.contentType !== contentType || upload.size !== file.size || typeof object !== "string" || !object.startsWith(prefix)) return false;
    const name = object.slice(prefix.length);
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === ".." || !upload.uploadUrl) return false;
    try {
      const url = new URL(upload.uploadUrl);
      return url.origin === endpoint.origin && url.pathname.startsWith(endpoint.pathname.replace(/\/$/, "") + "/") && !url.username && !url.password;
    } catch { return false; }
  });
}

export async function uploadImportSource(
  jobId: string,
  file: File,
  onProgress: (percentage: number) => void,
) {
  const configurationResponse = await fetch(`/api/imports/${jobId}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const configurationPayload = await configurationResponse.json() as {
    ok: boolean;
    data?: UploadConfiguration;
    error?: { message: string };
  };
  if (!configurationPayload.ok || !configurationPayload.data) {
    throw new Error(configurationPayload.error?.message ?? "Unable to prepare the upload.");
  }

  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your session expired. Sign in and try again.");
  const configuration = configurationPayload.data;
  let objectPath = configuration.objectPath;

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: configuration.tusEndpoint,
      retryDelays: configuration.retryDelays,
      chunkSize: configuration.chunkSize,
      removeFingerprintOnSuccess: true,
      uploadSize: file.size,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: configuration.bucket,
        objectName: configuration.objectPath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previousUploads) => {
      const previous = scopedPreviousUpload(previousUploads, configuration, file, file.type || "application/octet-stream");
      if (previous) {
        objectPath = previous.metadata.objectName!;
        upload.options.metadata = { ...upload.options.metadata, objectName: objectPath };
        upload.resumeFromPreviousUpload(previous);
      }
      upload.start();
    }).catch(reject);
  });
  return objectPath;
}

export async function uploadImportAsset(
  jobId: string,
  file: File,
  onProgress: (percentage: number) => void,
) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Images are limited to 10 MB.");
  const configurationResponse = await fetch(`/api/imports/${jobId}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, uploadKind: "asset" }),
  });
  const configurationPayload = await configurationResponse.json() as {
    ok: boolean;
    data?: UploadConfiguration;
    error?: { message: string };
  };
  if (!configurationPayload.ok || !configurationPayload.data) {
    throw new Error(configurationPayload.error?.message ?? "Unable to prepare the image upload.");
  }
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your session expired. Sign in and try again.");
  const configuration = configurationPayload.data;
  let objectPath = configuration.objectPath;
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: configuration.tusEndpoint,
      retryDelays: configuration.retryDelays,
      chunkSize: configuration.chunkSize,
      removeFingerprintOnSuccess: true,
      uploadSize: file.size,
      headers: { authorization: `Bearer ${accessToken}`, "x-upsert": "false" },
      metadata: {
        bucketName: configuration.bucket,
        objectName: configuration.objectPath,
        contentType: file.type,
        cacheControl: "3600",
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previousUploads) => {
      const previous = scopedPreviousUpload(previousUploads, configuration, file, file.type);
      if (previous) {
        objectPath = previous.metadata.objectName!;
        upload.options.metadata = { ...upload.options.metadata, objectName: objectPath };
        upload.resumeFromPreviousUpload(previous);
      }
      upload.start();
    }).catch(reject);
  });
  return objectPath;
}

export async function uploadImportArchive(
  jobId: string,
  file: File,
  onProgress: (percentage: number) => void,
) {
  if (file.size > 2 * 1024 * 1024 * 1024) throw new Error("ZIP archives are limited to 2 GB.");
  const configurationResponse = await fetch(`/api/imports/${jobId}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: "application/zip", uploadKind: "archive" }),
  });
  const payload = await configurationResponse.json() as { ok: boolean; data?: UploadConfiguration; error?: { message: string } };
  if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to prepare the ZIP upload.");
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your session expired. Sign in and try again.");
  const configuration = payload.data;
  let objectPath = configuration.objectPath;
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: configuration.tusEndpoint,
      retryDelays: configuration.retryDelays,
      chunkSize: configuration.chunkSize,
      removeFingerprintOnSuccess: true,
      uploadSize: file.size,
      headers: { authorization: `Bearer ${accessToken}`, "x-upsert": "false" },
      metadata: {
        bucketName: configuration.bucket,
        objectName: configuration.objectPath,
        contentType: "application/zip",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previousUploads) => {
      const previous = scopedPreviousUpload(previousUploads, configuration, file, "application/zip");
      if (previous) {
        objectPath = previous.metadata.objectName!;
        upload.options.metadata = { ...upload.options.metadata, objectName: objectPath };
        upload.resumeFromPreviousUpload(previous);
      }
      upload.start();
    }).catch(reject);
  });
  return objectPath;
}
