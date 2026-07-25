import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Document storage lives behind this interface so the backing store is an env
 * var, not a rewrite. Two drivers ship:
 *
 *   - "s3":    any S3-compatible bucket (Cloudflare R2, AWS S3, B2). Default.
 *   - "local": files on disk. Fine for local dev; on Railway it requires a
 *              mounted volume and does not survive a platform move.
 */
export interface StorageDriver {
  put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /**
   * A time-limited URL the browser can fetch directly, when the driver can
   * produce one. Returns null when it can't (local driver), in which case the
   * download route streams the bytes itself.
   */
  signedUrl(key: string, fileName: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// S3 / R2
// ---------------------------------------------------------------------------

function s3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

class S3Storage implements StorageDriver {
  private client = s3Client();
  private bucket = process.env.S3_BUCKET ?? "";

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object body for key ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedUrl(key: string, fileName: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
      }),
      { expiresIn: 300 },
    );
  }
}

// ---------------------------------------------------------------------------
// Local disk
// ---------------------------------------------------------------------------

class LocalStorage implements StorageDriver {
  private root = path.resolve(process.env.LOCAL_STORAGE_DIR || "./storage");

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error("Refusing to resolve a storage key outside the root");
    }
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }

  async signedUrl(): Promise<null> {
    return null;
  }
}

// ---------------------------------------------------------------------------

let cached: StorageDriver | undefined;

export function storage(): StorageDriver {
  if (!cached) {
    cached =
      (process.env.STORAGE_DRIVER || "s3") === "local"
        ? new LocalStorage()
        : new S3Storage();
  }
  return cached;
}

/** Namespaced, collision-proof key for an uploaded document. */
export function buildStorageKey(homeId: string, fileName: string): string {
  const ext = path.extname(fileName).slice(0, 12);
  return `homes/${homeId}/${randomUUID()}${ext}`;
}
