import { createFileRoute } from "@tanstack/react-router";
import { AirNanoBoard } from "@/components/air-nano-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Air Nano Board — Ideas, in motion" },
      { name: "description", content: "A tactile AI-powered board for sketching, selecting, and reshaping ideas." },
      { property: "og:title", content: "Air Nano Board — Ideas, in motion" },
      { property: "og:description", content: "A tactile AI-powered board for sketching, selecting, and reshaping ideas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AirNanoBoard />,
});
