import type { MetadataRoute } from "next";

// Enables "Add to Home Screen" so the game opens full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ألعاب الكلمات",
    short_name: "ألعاب",
    description: "منصة ألعاب كلمات عربية للعب بين شخصين عن بُعد",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f1e6",
    theme_color: "#f7f1e6",
  };
}
