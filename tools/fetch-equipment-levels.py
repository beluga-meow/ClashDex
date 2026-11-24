#!/usr/bin/env python3
"""Fetch real per-level Hero Equipment tables from the Clash of Clans Wiki.

The game itself shows per-level DPS/HP boosts and ore costs on each piece's
upgrade screen; the wiki publishes the same tables. This script reads them and
writes assets/data/equipment-levels.json so heroes.js never has to invent a
number.

Usage:  python3 tools/fetch-equipment-levels.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://clashofclans.fandom.com/api.php"
UA = "Mozilla/5.0 (PekkaDex equipment indexer)"

# Names exactly as they appear in assets/js/heroes.js
EQUIPMENT = [
    "Barbarian Puppet", "Rage Vial", "Earthquake Boots", "Vampstache",
    "Giant Gauntlet", "Spiky Ball",
    "Archer Puppet", "Invisibility Vial", "Giant Arrow", "Healer Puppet",
    "Frozen Arrow", "Magic Mirror",
    "Eternal Tome", "Life Gem", "Rage Gem", "Healing Tome", "Fireball",
    "Lavaloon Puppet",
    "Seeking Shield", "Royal Gem", "Hog Rider Puppet", "Haste Vial",
    "Rocket Spear", "Electro Boots",
    "Henchmen Puppet", "Dark Orb", "Metal Pants", "Fire Fork",
    "Rocket Backpack", "Flame Blower", "Electro Fangs", "Heart of Fire",
    "Shock Blast",
]

CACHE = {}


def wikitext(title):
    if title in CACHE:
        return CACHE[title]
    query = urllib.parse.urlencode({
        "action": "parse", "page": title, "prop": "wikitext",
        "format": "json", "formatversion": "2",
    })
    req = urllib.request.Request(API + "?" + query, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as res:
        data = json.load(res)
    text = (data.get("parse") or {}).get("wikitext")
    CACHE[title] = text
    return text


def clean(cell):
    cell = re.sub(r"<ref[^>]*>.*?</ref>", "", cell, flags=re.S)
    cell = re.sub(r"<[^>]+>", "", cell)
    # {{Res|Shiny Ore}} renders an icon plus that label; the label is already
    # in the header text, so drop the whole template instead of repeating it.
    cell = re.sub(r"\{\{Res\|[^}]*\}\}", "", cell)
    cell = re.sub(r"\{\{H\|([^}|]+)[^}]*\}\}", r"\1", cell)
    cell = re.sub(r"\[\[([^|\]]*\|)?([^\]]+)\]\]", r"\2", cell)
    cell = re.sub(r"'''?", "", cell)
    cell = cell.replace("&nbsp;", " ").replace("N/A", "—")
    cell = re.sub(r"\s+", " ", cell).strip()
    return "—" if cell in ("-", "") else cell


def split_row(line):
    """Split a wikitable row body into cells, respecting [[..|..]] and {{..|..}}."""
    cells, depth, buf, i = [], 0, "", 0
    while i < len(line):
        if line.startswith("[[", i) or line.startswith("{{", i):
            depth += 1
            buf += line[i:i + 2]
            i += 2
            continue
        if (line.startswith("]]", i) or line.startswith("}}", i)) and depth:
            depth -= 1
            buf += line[i:i + 2]
            i += 2
            continue
        if depth == 0 and line.startswith("||", i):
            cells.append(buf)
            buf = ""
            i += 2
            continue
        buf += line[i]
        i += 1
    cells.append(buf)
    return cells


def strip_attrs(cell):
    """Drop class="x"| / style="x"| prefixes that MediaWiki allows in cells."""
    if "|" in cell:
        head, rest = cell.split("|", 1)
        if "=" in head and not head.strip().startswith("+"):
            return rest
    return cell


def cell_rows(block):
    """Group the wikitable into rows; each row is a list of raw cell strings."""
    rows, current = [], []
    for raw in block.split("\n"):
        line = raw.strip()
        if not line or line.startswith("{|") or line.startswith("|}"):
            continue
        if line == "|-":
            if current:
                rows.append(current)
                current = []
            continue
        if line.startswith("!") or line.startswith("|"):
            # One cell per line; || (data) and !! (header) also split cells.
            body = line[1:]
            sep = "!!" if line.startswith("!") else "||"
            for cell in split_row(body.replace(sep, "||")):
                current.append((line[0], cell))
    if current:
        rows.append(current)
    return rows


def span_of(cell, kind):
    m = re.search(kind + r'\s*=\s*"?(\d+)', cell)
    return int(m.group(1)) if m else 1


def expand_headers(rows):
    """Expand the two-row header (with colspans and rowspans) to column names."""
    header_rows = []
    for row in rows:
        if row and all(marker == "!" for marker, _ in row):
            header_rows.append(row)
        elif header_rows:
            break
    if not header_rows:
        return []

    slots = []  # [label, remaining_rowspans]
    for _, cell in header_rows[0]:
        colspan = span_of(cell, "colspan")
        rowspan = span_of(cell, "rowspan")
        name = clean(strip_attrs(cell))
        for _ in range(colspan):
            slots.append([name, rowspan])

    for row in header_rows[1:]:
        index = 0
        for _, cell in row:
            colspan = span_of(cell, "colspan")
            name = clean(strip_attrs(cell))
            for _ in range(colspan):
                while index < len(slots) and slots[index][1] > 1:
                    index += 1
                if index >= len(slots):
                    break
                slots[index][0] = name
                slots[index][1] = 0
                index += 1
    return [slot[0] for slot in slots]


def equipment_table(title):
    text = wikitext(title)
    if not text:
        return None
    blocks = re.findall(r"\{\|.*?\|\}", text, flags=re.S)
    for block in blocks:
        if "Upgrade Cost" not in block or "Level" not in block:
            continue
        rows = cell_rows(block)
        cols = expand_headers(rows)
        data_rows = []
        for row in rows:
            if not row or any(marker == "!" for marker, _ in row):
                continue
            values = [clean(strip_attrs(cell)) for _, cell in row]
            if values and re.fullmatch(r"\d+", values[0] or ""):
                data_rows.append(values)
        if not data_rows or len(cols) < 2:
            continue
        width = len(cols)
        fixed = []
        for r in data_rows:
            if len(r) < width:
                r = r + [""] * (width - len(r))
            fixed.append(r[:width])
        return {"columns": cols, "rows": fixed}
    return None


def main():
    out = {}
    missing = []
    for name in EQUIPMENT:
        try:
            data = equipment_table(name)
        except Exception as exc:  # noqa: BLE001
            print("!", name, exc, file=sys.stderr)
            data = None
        if data:
            out[name] = data
            print("ok", name, len(data["rows"]), "levels")
        else:
            missing.append(name)
            print("-- no level table:", name)
        time.sleep(0.4)
    payload = {
        "source": "Clash of Clans Wiki (clashofclans.fandom.com), Hero Equipment statistics tables",
        "fetched": time.strftime("%Y-%m-%d"),
        "items": out,
    }
    path = "assets/data/equipment-levels.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    # The site reads this plain script instead of fetching JSON at runtime.
    js_path = "assets/js/equipment-levels.js"
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.write("/* Generated by tools/fetch-equipment-levels.py — do not edit.\n")
        fh.write("   Source: " + payload["source"] + " */\n")
        fh.write("window.PDX_EQ_LEVELS=")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    print("\nwrote", path, "and", js_path, "items:", len(out), "missing:", len(missing))
    if missing:
        print("missing:", ", ".join(missing))


if __name__ == "__main__":
    main()
