"use client";

// A recipe's photo gallery: existing photos (each removable) plus a
// drag-and-drop / click-to-browse area to add more. Uploads go straight from
// the browser to Vercel Blob storage (see app/api/upload/route.ts for the
// token handshake), this component only ever talks to Blob and to the
// addRecipeImage/deleteRecipeImage Server Actions, never handles file bytes
// itself.

import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "cn";
import { addRecipeImage, deleteRecipeImage } from "@/app/lib/actions";

type RecipeImage = { id: string; url: string };

export function PhotoGallery({
  recipeId,
  images,
}: {
  recipeId: string;
  images: RecipeImage[];
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, startUploading] = useTransition();
  const [, startDeleting] = useTransition();

  function uploadFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    startUploading(async () => {
      // Sequential, not Promise.all: keeps concurrent uploads to Blob storage
      // low for a feature that's realistically a handful of photos at a time.
      for (const file of imageFiles) {
        try {
          const blob = await upload(`recipes/${recipeId}/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
          });
          await addRecipeImage(recipeId, blob.url);
        } catch {
          toast.error(`Couldn't upload ${file.name}. Try again.`);
        }
      }
    });
  }

  function remove(image: RecipeImage) {
    startDeleting(async () => {
      try {
        await deleteRecipeImage(image.id, recipeId, image.url);
      } catch {
        toast.error("Couldn't remove that photo. Try again.");
      }
    });
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="group bg-muted relative aspect-square overflow-hidden rounded-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob-hosted, not worth Next's optimizer */}
              <img src={image.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(image)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-input mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "hover:bg-muted/50",
        )}
      >
        {isUploading ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : (
          <ImagePlus className="text-muted-foreground size-5" />
        )}
        <span className="text-muted-foreground text-xs">
          {isUploading ? "Uploading..." : "Drop photos here, or click to browse"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
