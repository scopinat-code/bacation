import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "방학한칸",
    short_name: "방학한칸",
    description: "초등학생부터 고등학생까지 학교급에 맞춰 만드는 균형 잡힌 방학 시간표",
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
