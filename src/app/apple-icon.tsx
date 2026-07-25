import { ImageResponse } from "next/og";

/**
 * Apple touch icon — same mark, sized for the iOS home screen.
 *
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <div
          style={{
            fontSize: 108,
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
