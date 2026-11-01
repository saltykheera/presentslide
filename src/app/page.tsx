"use client";

import dynamic from "next/dynamic";

const ExcalidrawEditor = dynamic(
  () =>
    import("@/components/ExcalidrawEditor").then((mod) => mod.ExcalidrawEditor),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden">
      <ExcalidrawEditor />
    </main>
  );
}
