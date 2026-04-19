import { define } from "@/utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en" class="[&:has(dialog[open])]:overflow-hidden">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sigil</title>
      </head>
      <body class="min-h-screen">
        <Component />
      </body>
    </html>
  );
});
