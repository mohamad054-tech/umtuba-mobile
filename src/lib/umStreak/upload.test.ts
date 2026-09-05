import { beforeEach, describe, expect, it, vi } from "vitest";

const readAsStringAsync = vi.fn();
const copyAsync = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  cacheDirectory: "file:///cache/",
  readAsStringAsync: (...args: unknown[]) => readAsStringAsync(...args),
  copyAsync: (...args: unknown[]) => copyAsync(...args),
}));

import { readUriAsUploadBody, uploadPrivateVisualMedia } from "./upload";

const USER = "11111111-1111-1111-1111-111111111111";
const CONV = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function mockSupabase(uploadImpl: (...args: unknown[]) => Promise<{ error: unknown }>) {
  const upload = vi.fn(uploadImpl);
  return {
    client: {
      storage: {
        from: vi.fn(() => ({ upload })),
      },
    } as never,
    upload,
  };
}

describe("readUriAsUploadBody", () => {
  beforeEach(() => {
    readAsStringAsync.mockReset();
    copyAsync.mockReset();
    copyAsync.mockResolvedValue(undefined);
  });

  it("reads file URIs through FileSystem base64, not Blob", async () => {
    readAsStringAsync.mockResolvedValue("aGVsbG8=");
    const body = await readUriAsUploadBody("file:///data/user/0/com.umtuba.app/cache/ImagePicker/a.jpg");
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(body.byteLength).toBe(5);
    expect(copyAsync).not.toHaveBeenCalled();
  });

  it("copies content:// URIs into cache before reading", async () => {
    readAsStringAsync.mockResolvedValue("aGVsbG8=");
    await readUriAsUploadBody("content://media/external/video/media/9");
    expect(copyAsync).toHaveBeenCalled();
    const dest = (copyAsync.mock.calls[0]![0] as { to: string }).to;
    expect(dest.startsWith("file:///cache/um-streak-")).toBe(true);
    expect(readAsStringAsync).toHaveBeenCalledWith(
      dest,
      expect.objectContaining({ encoding: "base64" })
    );
  });
});

describe("uploadPrivateVisualMedia", () => {
  beforeEach(() => {
    readAsStringAsync.mockReset();
    copyAsync.mockReset();
    readAsStringAsync.mockResolvedValue("aGVsbG8=");
  });

  it("uploads ArrayBuffer on the owned conversation path", async () => {
    const { client, upload } = mockSupabase(async () => ({ error: null }));
    const result = await uploadPrivateVisualMedia({
      supabase: client,
      userId: USER,
      conversationId: CONV,
      uri: "file:///cache/visual.jpg",
      mimeType: "image/jpg",
      fileName: "visual.jpg",
      mediaType: "image",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.path.startsWith(`${USER}/${CONV}/`)).toBe(true);
    expect(result.path.endsWith(".jpg")).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    const [path, body, options] = upload.mock.calls[0]!;
    expect(path).toBe(result.path);
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(body instanceof Blob).toBe(false);
    expect(options).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
  });

  it("maps Storage errors to localized uploadFailed", async () => {
    const { client } = mockSupabase(async () => ({
      error: { message: "new row violates row-level security", statusCode: "403" },
    }));
    const result = await uploadPrivateVisualMedia({
      supabase: client,
      userId: USER,
      conversationId: CONV,
      uri: "file:///cache/visual.jpg",
      mimeType: "image/jpeg",
      mediaType: "image",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/upload visual message|تعذّر رفع الرسالة البصرية/);
  });
});
