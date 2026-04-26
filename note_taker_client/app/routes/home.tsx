import type { Route } from "./+types/home";
import CreationPanel from "~/creation_panel/creation_panel";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Note Taker" },
    { name: "description", content: "Note Taker App" },
  ];
}


export default function Home() {
  return (
    <CreationPanel />
  )
}
