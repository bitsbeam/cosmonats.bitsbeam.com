# Cosmonats

Marketing site + blog for [Cosmonats](https://github.com/bitsbeam/cosmonats) by bitsbeam.
Plain static HTML / CSS / JS — no build step, no dependencies.

## Structure

```
/
├── index.html                      # home: hero, blog teaser, journey, code, about
├── about.html                      # about bitsbeam
├── blog/
│   ├── cron-without-a-cron-box.html    # #002 (hidden: unlisted, noindex)
│   └── why-we-beamed-off-redis.html    # #001 (latest)
└── assets/
    ├── application.css   # all styles: tokens, base, components, home, post
    ├── application.js    # all behaviour: starfield, beam, journey, copy, reading progress
    └── img/
        └── logo.svg
```

One stylesheet, one script. Each JS module is a self-contained IIFE loaded with `defer` and wired up through
`data-*` attributes, so pages work straight from the filesystem (`file://`) and on any static host.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
bundle install
bundle exec rake        # http://localhost:8000, override with PORT=3000
```

## Deploy

Upload the folder as-is to GitHub Pages, Netlify, Cloudflare Pages, S3, etc.

## Customise

- **Colors / fonts / radii** — edit the variables in `:root` at the top of `assets/application.css`.
- **Journey vehicle** — on `<section class="journey">` set `data-vehicle="rocket"` or `"ufo"`;
  `data-trail="false"` hides the glowing trail.
- **Waypoints** — add or remove `<li class="journey__stop" data-stop>` items; the path re-draws automatically.
- **Stars** — `data-density` and `data-parallax` on the `<canvas data-starfield>`.

## Syntax highlighting

Code samples use hand-tagged spans so there's no runtime highlighter:

| class   | used for                     |
|---------|------------------------------|
| `tok-k` | keywords (`class`, `def`, `end`, `true`) |
| `tok-c` | constants / class names      |
| `tok-s` | symbols, hash keys           |
| `tok-l` | strings, numbers             |
| `tok-m` | method names                 |

## Adding a blog post

1. Copy the newest file in `blog/` to `blog/<slug>.html` and replace title, meta, date and body.
2. **Pager links**
   - New post: left card → previous post (“← Older”), right card → `../index.html#journey`.
   - Previous post: change its right card to point at the new post (“Newer →”).
3. **Home page** (`index.html`, `#blog`):
   - Replace the `.post-feature` card with the new post (keep the `Latest` badge).
   - Move the previous featured post to the top of `.post-list` as a `.post-row`.
   - Bump the “N transmissions received” counter.

## License

MIT © bitsbeam
