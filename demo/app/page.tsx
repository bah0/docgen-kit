import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const entries = [
  {
    href: "/editor",
    title: "Invoice",
    text: "Page-by-page flow with an item table (header row repeats), totals block and a hard page break.",
  },
  {
    href: "/editor/employment-contract",
    title: "Employment contract",
    text: "Flowing document of paragraphs and clauses with optional sections driven by the JSON data.",
  },
  {
    href: "/blocks",
    title: "Block library",
    text: "Reusable Handlebars blocks with their own JSON and preview; insert them into both editors.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">ERP Document Generator</h1>
        <p className="text-sm text-muted-foreground">
          Lexical produces the template with Handlebars placeholders; the JSON data lives separately next to it. The
          preview renders locally in the browser (iframe); the PDF is only generated on demand via Gotenberg.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{entry.title}</CardTitle>
                <CardDescription>{entry.text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Set up the PDF comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm text-muted-foreground">
          <p>
            Start Gotenberg: <code className="rounded bg-muted px-1.5 py-0.5">docker compose up -d</code> (host port
            3011 → container port 3000).
          </p>
          <p>
            The app reads the address from <code className="rounded bg-muted px-1.5 py-0.5">GOTENBERG_URL</code>{" "}
            (default: http://localhost:3011) and runs on port 3010.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
