"""일본 이름에 쓰는 한자(상용·인명용)의 한국 한자음 표를 만든다.

출처: Unicode Unihan Database (Unicode License v3). kJoyoKanji, kJinmeiyoKanji로 한자를 고르고,
kHangul의 첫 읽기를 쓴다. 읽기가 없는 일본 신자체는 이체자의 읽기를 이 순서로 찾는다.
kTraditionalVariant, kSemanticVariant, kZVariant, kSpecializedSemanticVariant, 그리고
kJapaneseNewVariant를 거꾸로 (구자체 櫻의 신자체가 桜이면 桜 → 櫻).
사용법: python3 -I scripts/build_hanja_korean.py <Unihan 폴더> src/data/hanjaKorean.json
"""
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
def rows(name):
    with open(f"{src}/{name}", encoding="utf8") as f:
        for line in f:
            if line.startswith("U+"):
                cp, field, value = line.rstrip("\n").split("\t", 2)
                yield chr(int(cp[2:], 16)), field, value
FOLLOW = ["kTraditionalVariant", "kSemanticVariant", "kZVariant", "kSpecializedSemanticVariant"]
names = set(); hangul = {}; variants = {}
for ch, field, value in rows("Unihan_OtherMappings.txt"):
    if field in ("kJoyoKanji", "kJinmeiyoKanji"):
        names.add(ch)
for ch, field, value in rows("Unihan_Readings.txt"):
    if field == "kHangul":
        hangul[ch] = value.split()[0].split(":")[0]
for ch, field, value in rows("Unihan_Variants.txt"):
    if field in FOLLOW:
        for v in re.findall(r"U\+([0-9A-F]+)", value):
            variants.setdefault(ch, []).append((FOLLOW.index(field), chr(int(v, 16))))
    elif field == "kJapaneseNewVariant":
        for v in re.findall(r"U\+([0-9A-F]+)", value):
            variants.setdefault(chr(int(v, 16)), []).append((len(FOLLOW), ch))
table = {}
for ch in sorted(names):
    r = hangul.get(ch) or next((hangul[v] for _, v in sorted(variants.get(ch, []), key=lambda x: x[0]) if v in hangul), None)
    if r:
        table[ch] = r
json.dump(table, open(out, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
missing = "".join(ch for ch in sorted(names) if ch not in table)
print(len(names), "kanji,", len(table), "with Korean reading,", len(missing), "without:", missing)
