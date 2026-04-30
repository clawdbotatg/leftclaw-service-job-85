import type { Metadata } from "next";

const rawBaseUrl = process.env.NEXT_PUBLIC_PRODUCTION_URL
  ? process.env.NEXT_PUBLIC_PRODUCTION_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;
// Strip trailing slash so concatenating `${baseUrl}${imageRelativePath}` (the
// imageRelativePath always has a leading slash) doesn't yield a `//` in the
// final URL — observed in QA output where NEXT_PUBLIC_PRODUCTION_URL=".../"
// and imageRelativePath="/thumbnail.jpg" produced ".../thumbnail.jpg".
const baseUrl = rawBaseUrl.replace(/\/+$/, "");
const titleTemplate = "%s";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/thumbnail.jpg",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  // Defense in depth: ensure imageRelativePath starts with exactly one slash.
  const normalizedPath = imageRelativePath.startsWith("/") ? imageRelativePath : `/${imageRelativePath}`;
  const imageUrl = `${baseUrl}${normalizedPath}`;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [
        {
          url: imageUrl,
        },
      ],
    },
    twitter: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: "/favicon.png",
          sizes: "32x32",
          type: "image/png",
        },
      ],
    },
  };
};
