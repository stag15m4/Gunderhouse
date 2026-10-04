import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gunderhouse",
    short_name: "Gunderhouse",
    description: "Homes, appliances, maintenance, and documents.",
    start_url: "/homes",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    // These two are generated without the gold border and with the mark held
    // inside the maskable safe zone, so Android's circle crop has nothing to
    // shave. The bordered tile is the iOS touch icon instead.
    // Listed twice rather than as the spec's space-separated "any maskable",
    // which Next's Manifest type doesn't accept.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
