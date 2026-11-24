# Hero skins

Drop skin artwork in this folder and it appears in the Clash Heroes Encyclopedia
automatically — no code change needed.

## File name

Use the hero id plus the skin name, lower-case, words joined by `-`:

```
assets/skins/<hero-id>-<skin-name>.<ext>
```

| Hero id           | Example file                                     |
| ----------------- | ------------------------------------------------ |
| `barbarian-king`  | `barbarian-king-bruiser-king.webp`               |
| `archer-queen`    | `archer-queen-fury-queen.png`                    |
| `grand-warden`    | `grand-warden-grand-mage.jpg`                    |
| `royal-champion`  | `royal-champion-nomad-champion.webp`             |
| `minion-prince`   | `minion-prince-lich-prince.webp`                 |
| `dragon-duke`     | `dragon-duke-drakan-duke.webp`                   |

Accepted extensions, tried in this order: `.webp`, `.png`, `.jpg`, `.jpeg`, `.svg`.
Square or near-square images (about 400×400) look best.

## Without a file

The card keeps the drawn hero portrait with the skin's colour tint, so nothing
ever shows a broken image.

## Skin names as used on the site

Barbarian King: Bruiser King · Gladiator King · King Barbarian · Valhalla King

Archer Queen: Fury Queen · Elven Archer · Valkyrie Queen · Archer Queen of the North

Grand Warden: Shaman Warden · Grand Mage · Party Warden · Frost Warden

Royal Champion: Nomad Champion · Tempest Champion · Champion of the Sea

Minion Prince: Armored Prince · Lich Prince · Anime Fury Prince · Fallen Prince

Dragon Duke: Drakan Duke · Hydra Duke · Kane · Anime Fury Dragon Duke
