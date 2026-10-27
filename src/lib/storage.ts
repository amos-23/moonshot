import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import { AppError } from "@/lib/services/errors";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_STORAGE_BYTES = 2 * 1024 * 1024;
const MAX_INLINE_BYTES = 300 * 1024;

/**
 * Stores a profile photo. Uses Supabase Storage (public `avatars` bucket) when a service role key
 * is configured; otherwise stores a small image inline as a data URL so local mode still works.
 */
export async function storeAvatar(userId: string, file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new AppError("Upload a JPEG, PNG or WebP image.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    if (bytes.length > MAX_STORAGE_BYTES) throw new AppError("Photos must be 2 MB or smaller.");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const bucket = process.env.SUPABASE_AVATAR_BUCKET ?? "avatars";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) {
      console.error("Avatar upload failed", error.message);
      throw new AppError("We couldn't upload your photo. Please try again.");
    }
    return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  if (bytes.length > MAX_INLINE_BYTES) {
    throw new AppError("Without cloud storage configured, photos must be 300 KB or smaller.");
  }
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}
