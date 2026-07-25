import { ImageResponse } from "next/og";

/**
 * App icon, generated rather than shipped as art: a gold "G" on the app's own
 * ground, matching the gradient wordmark.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            background: "linear-gradient(180deg, #f2dd92 0%, #cba24e 55%, #a87c2e 100%)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          G
        </div>
      </div>
    ),
    size,
  );
}
