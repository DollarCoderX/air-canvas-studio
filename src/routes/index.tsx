import { createFileRoute } from "@tanstack/react-router";
import { AirNanoBoard } from "@/components/air-nano-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Air Nano Board — Think, teach, and build together" },
      { name: "description", content: "A tactile AI-powered canvas for schools, businesses, and company teams." },
      { property: "og:title", content: "Air Nano Board — Think, teach, and build together" },
      { property: "og:description", content: "A tactile AI-powered canvas for schools, businesses, and company teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AirNanoBoard />,
});
