import type { MetadataRoute } from "next";

// Enables "Add to Home Screen" so the game opens full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "لعبة المشنقة",
    short_name: "المشنقة",
    description: "لعبة المشنقة العربية للعب بين شخصين عن بُعد",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0a1e",
    theme_color: "#0f0a1e",
  };
}
