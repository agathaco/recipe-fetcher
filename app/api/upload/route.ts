import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// A Route Handler, not a Server Action: @vercel/blob's client-upload helper
// needs a stable HTTP endpoint it calls directly from the browser (first to
// mint a short-lived upload token, then, after the file lands in Blob storage
// straight from the browser, to notify this route) — a contract a Server
// Action isn't built to serve. Reached only by PhotoGallery's `upload()` call.
// Auth is unchanged: proxy.ts gates every route except /login, this one included.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*"],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
        addRandomSuffix: true,
      }),
      // No onUploadCompleted: that's a webhook Vercel calls back on a public
      // URL, which can't reach localhost during dev. PhotoGallery instead
      // calls addRecipeImage directly once the browser's upload() promise
      // resolves, which is enough for a single-user app with no need to
      // handle "the browser tab closed mid-upload."
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
