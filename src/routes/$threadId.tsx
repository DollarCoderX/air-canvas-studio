import { createFileRoute } from "@tanstack/react-router";
import { AirNanoBoard } from "@/components/air-nano-board";

export const Route = createFileRoute("/$threadId")({
  head: () => ({
    meta: [
      { title: "Air Nano Board — Board thread" },
      { name: "description", content: "A saved Air Nano Board workspace for developing ideas with Nano." },
      { property: "og:title", content: "Air Nano Board — Board thread" },
      { property: "og:description", content: "A saved Air Nano Board workspace for developing ideas with Nano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <AirNanoBoard requestedThreadId={threadId} />;
}