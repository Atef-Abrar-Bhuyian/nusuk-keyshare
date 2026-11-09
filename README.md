# Keyshare

A mobile-first website where you can share a lot of keys like `NG-8M3b2cDs` so others can copy and paste them, with a done icon button for when you've used one. Anyone can also upload keys so others can see them. The UI is kept simple and easy to use.

If a key is marked as done, only that user will see that it's done for them (personal to their device), not for others, so other users can still use that key.

## Development

You need Node.js and npm, or [Bun](https://bun.sh) - [install Node with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

Environment variables (see `.env`):

- `VITE_VITE_SUPABASE_URL` / `VITE_VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase project URL and publishable key for the browser.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` - the same values for server-side rendering and server functions.
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - optional, only for trusted server-side admin operations.

## Scripts

- `bun run dev` - start the dev server.
- `bun run build` - production build. Without `NITRO_PRESET`, the server bundle targets Cloudflare (`cloudflare-module`); set `NITRO_PRESET` to deploy elsewhere.
- `bun run preview` - preview a production build.
- `bun run test` - run the Vitest suite.
- `bun run lint` / `bun run format` - ESLint / Prettier.
