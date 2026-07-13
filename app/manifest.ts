import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "방학한칸",
    short_name: "방학한칸",
    description: "가족이 함께 만드는 여름방학 생활계획표",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8e8",
    theme_color: "#ff6b51",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
