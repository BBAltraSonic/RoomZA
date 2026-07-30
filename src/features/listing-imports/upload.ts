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
      if (previousUploads[0]) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
  return configuration.objectPath;
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
      if (previousUploads[0]) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
  return configuration.objectPath;
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
      if (previousUploads[0]) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
  return configuration.objectPath;
}
