// src/domains/rulebook/contracts.ts
var RULEBOOK_SCHEMA_VERSION = 1;
var SAGATREE_CORE_RULESET_ID = "sagatree-core";
var SAGATREE_CORE_SOURCE_PATH = "docs/sagatree core rules.md";
var RULEBOOK_NORMATIVITIES = [
  "binding-playtest",
  "validation",
  "release-criteria",
  "informational"
];
function isRulebookNormativity(value) {
  return RULEBOOK_NORMATIVITIES.includes(value);
}
function assertRulebookIndex(value) {
  if (value === null || typeof value !== "object") {
    throw new Error("Rulebook index must be an object");
  }
  const record = value;
  const manifest = record.manifest;
  const sections = record.sections;
  if (manifest === null || typeof manifest !== "object") {
    throw new Error("Rulebook manifest missing");
  }
  const m = manifest;
  if (m.rulesetId !== SAGATREE_CORE_RULESET_ID) {
    throw new Error(`Unexpected rulesetId: ${String(m.rulesetId)}`);
  }
  if (m.schemaVersion !== RULEBOOK_SCHEMA_VERSION) {
    throw new Error(`Unexpected schemaVersion: ${String(m.schemaVersion)}`);
  }
  if (typeof m.revisionHash !== "string" || m.revisionHash.length < 16) {
    throw new Error("revisionHash missing or too short");
  }
  if (m.sourcePath !== SAGATREE_CORE_SOURCE_PATH) {
    throw new Error(`Unexpected sourcePath: ${String(m.sourcePath)}`);
  }
  if (!Array.isArray(sections)) {
    throw new Error("sections must be an array");
  }
  if (typeof m.sectionCount !== "number" || m.sectionCount !== sections.length) {
    throw new Error("sectionCount does not match sections.length");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const section of sections) {
    if (section === null || typeof section !== "object") {
      throw new Error("Invalid section entry");
    }
    const s = section;
    if (typeof s.id !== "string" || s.id.length === 0) {
      throw new Error("Section id missing");
    }
    if (seen.has(s.id)) {
      throw new Error(`Duplicate section id: ${s.id}`);
    }
    seen.add(s.id);
    if (typeof s.title !== "string") {
      throw new Error(`Section ${s.id} title missing`);
    }
    if (typeof s.normativity !== "string" || !isRulebookNormativity(s.normativity)) {
      throw new Error(`Section ${s.id} has invalid normativity`);
    }
    if (typeof s.bodyMarkdown !== "string") {
      throw new Error(`Section ${s.id} bodyMarkdown missing`);
    }
    if (s.source === null || typeof s.source !== "object") {
      throw new Error(`Section ${s.id} source missing`);
    }
  }
}

// src/domains/rulebook/parse-source.ts
var HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/;
var NUMBERED_TITLE_RE = /^(\d+(?:\.\d+)*)\.\s+(.+)$/;
var NUMBER_ONLY_TITLE_RE = /^(\d+(?:\.\d+)*)\s+(.+)$/;
function parseHeadingTitle(raw) {
  const dotted = NUMBERED_TITLE_RE.exec(raw);
  if (dotted) {
    return { number: dotted[1], title: `${dotted[1]}. ${dotted[2]}`.trim() };
  }
  const spaced = NUMBER_ONLY_TITLE_RE.exec(raw);
  if (spaced) {
    return { number: spaced[1], title: `${spaced[1]} ${spaced[2]}`.trim() };
  }
  return { number: null, title: raw.trim() };
}
function topLevelSectionNumber(number, ancestors) {
  if (number) {
    const top = number.split(".")[0];
    const parsed = Number(top);
    return Number.isFinite(parsed) ? parsed : null;
  }
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i];
    if (!ancestor) continue;
    const top = ancestor.split(".")[0];
    const parsed = Number(top);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
function resolveNormativity(number, ancestorNumbers) {
  const top = topLevelSectionNumber(number, ancestorNumbers);
  if (top === null) return "informational";
  if (top >= 1 && top <= 18) return "binding-playtest";
  if (top === 19) return "validation";
  if (top === 20) return "release-criteria";
  return "informational";
}
function sectionIdFromHeading(number, title, ordinal) {
  if (number) {
    return `stc-${number.replace(/\./g, "-")}`;
  }
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `stc-meta-${slug || "section"}-${ordinal}`;
}
function collectHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = HEADING_RE.exec(lines[i]);
    if (!match) continue;
    const hashes = match[1];
    if (hashes.length < 2 || hashes.length > 4) continue;
    const level = hashes.length;
    const parsed = parseHeadingTitle(match[2]);
    headings.push({
      level,
      title: parsed.title,
      number: parsed.number,
      lineIndex: i
    });
  }
  return headings;
}
function canonicalIndexPayload(sections) {
  const normalized = sections.map((section) => ({
    id: section.id,
    number: section.number,
    title: section.title,
    headingLevel: section.headingLevel,
    parentId: section.parentId,
    normativity: section.normativity,
    bodyMarkdown: section.bodyMarkdown,
    source: section.source
  }));
  return `${JSON.stringify({
    rulesetId: SAGATREE_CORE_RULESET_ID,
    schemaVersion: RULEBOOK_SCHEMA_VERSION,
    sourcePath: SAGATREE_CORE_SOURCE_PATH,
    sections: normalized
  })}
`;
}
function computeRevisionHash(sections, hashFn) {
  return hashFn(canonicalIndexPayload(sections));
}
function buildRulebookIndexFromMarkdown(markdown, hashFn) {
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const headings = collectHeadings(lines);
  if (headings.length === 0) {
    throw new Error("No rulebook headings found in source markdown");
  }
  const sections = [];
  const stack = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (let h = 0; h < headings.length; h += 1) {
    const heading = headings[h];
    const startLine = heading.lineIndex + 1;
    const endExclusive = h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;
    const endLine = endExclusive;
    const bodyLines = lines.slice(heading.lineIndex + 1, endExclusive);
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
      bodyLines.pop();
    }
    const bodyMarkdown = bodyLines.join("\n");
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const ancestorNumbers = stack.map((entry) => entry.number);
    const id = sectionIdFromHeading(heading.number, heading.title, h + 1);
    if (seenIds.has(id)) {
      throw new Error(`Rulebook section id collision: ${id}`);
    }
    seenIds.add(id);
    const section = {
      id,
      number: heading.number,
      title: heading.title,
      headingLevel: heading.level,
      parentId: parent ? parent.id : null,
      normativity: resolveNormativity(heading.number, ancestorNumbers),
      bodyMarkdown,
      source: {
        path: SAGATREE_CORE_SOURCE_PATH,
        startLine,
        endLine
      }
    };
    sections.push(section);
    stack.push({ id, level: heading.level, number: heading.number });
  }
  const revisionHash = computeRevisionHash(sections, hashFn);
  return {
    manifest: {
      rulesetId: SAGATREE_CORE_RULESET_ID,
      schemaVersion: RULEBOOK_SCHEMA_VERSION,
      revisionHash,
      sourcePath: SAGATREE_CORE_SOURCE_PATH,
      sectionCount: sections.length
    },
    sections
  };
}

// src/domains/rulebook/search.ts
var DEFAULT_LIMIT = 20;
function normalizeText(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function tokenizeQuery(query) {
  const normalized = normalizeText(query.trim());
  if (!normalized) return [];
  return normalized.split(/[^a-z0-9äöüß]+/i).map((token) => token.trim()).filter((token) => token.length >= 2);
}
function snippetAround(haystack, needle, radius = 80) {
  const lower = haystack.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx < 0) {
    const compact = haystack.replace(/\s+/g, " ").trim();
    return compact.length <= radius * 2 ? compact : `${compact.slice(0, radius * 2)}\u2026`;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(haystack.length, idx + needle.length + radius);
  const prefix = start > 0 ? "\u2026" : "";
  const suffix = end < haystack.length ? "\u2026" : "";
  return `${prefix}${haystack.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}
function scoreSection(section, query, tokens) {
  const titleNorm = normalizeText(section.title);
  const bodyNorm = normalizeText(section.bodyMarkdown);
  const numberNorm = section.number ? normalizeText(section.number) : "";
  const queryNorm = normalizeText(query);
  let score = 0;
  if (queryNorm.length >= 2) {
    if (titleNorm === queryNorm) score += 120;
    else if (titleNorm.includes(queryNorm)) score += 80;
    if (bodyNorm.includes(queryNorm)) score += 40;
    if (numberNorm && (numberNorm === queryNorm || `\xA7${numberNorm}` === queryNorm || numberNorm === queryNorm.replace(/^§/, ""))) {
      score += 100;
    }
  }
  for (const token of tokens) {
    if (titleNorm.includes(token)) score += 18;
    if (numberNorm.includes(token)) score += 22;
    const bodyHits = bodyNorm.split(token).length - 1;
    if (bodyHits > 0) score += Math.min(24, bodyHits * 4);
  }
  if (score > 0 && section.normativity === "binding-playtest") score += 2;
  return score;
}
function searchRulebook(index, query, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const trimmed = query.trim();
  if (!trimmed) return [];
  const tokens = tokenizeQuery(trimmed);
  const hits = [];
  for (const section of index.sections) {
    const score = scoreSection(section, trimmed, tokens);
    if (score <= 0) continue;
    const needle = tokens[0] ?? trimmed;
    hits.push({
      sectionId: section.id,
      title: section.title,
      number: section.number,
      normativity: section.normativity,
      score,
      snippet: snippetAround(section.bodyMarkdown || section.title, needle),
      source: section.source
    });
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sectionId.localeCompare(b.sectionId);
  });
  return hits.slice(0, Math.max(1, limit));
}
function getRulebookSection(index, sectionId) {
  return index.sections.find((section) => section.id === sectionId) ?? null;
}
function getRulebookSectionByNumber(index, number) {
  const normalized = number.replace(/^§/, "").trim();
  return index.sections.find((section) => section.number === normalized) ?? null;
}

// src/domains/rulebook/generated/sagatree-core.json
var sagatree_core_default = {
  manifest: {
    rulesetId: "sagatree-core",
    schemaVersion: 1,
    revisionHash: "4d5fdf653de24ef56a2f33ddff5c22357bbe65c6c2460bc9c24e5a9bfbfd86ec",
    sourcePath: "docs/sagatree core rules.md",
    sectionCount: 204
  },
  sections: [
    {
      id: "stc-meta-lizenz-und-orc-hinweise-1",
      number: null,
      title: "Lizenz und ORC-Hinweise",
      headingLevel: 2,
      parentId: null,
      normativity: "informational",
      bodyMarkdown: "\nDas funktionale Spielregelmaterial dieses Dokuments wird unter der [Open RPG Creative License (ORC)](https://paizo.com/orclicense) ver\xF6ffentlicht. Der Quellcode der Software, die die Regeln implementiert, ist separat unter AGPL-3.0-only lizenziert (siehe [LICENSES.md](../LICENSES.md)).",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 10,
        endLine: 13
      }
    },
    {
      id: "stc-meta-orc-notice-2",
      number: null,
      title: "ORC Notice",
      headingLevel: 3,
      parentId: "stc-meta-lizenz-und-orc-hinweise-1",
      normativity: "informational",
      bodyMarkdown: "\nThis product is licensed under the ORC License located at the Library of Congress at TX 9-307-067 and available online at various locations including https://paizo.com/orclicense. All warranties are disclaimed as set forth therein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 14,
        endLine: 17
      }
    },
    {
      id: "stc-meta-attribution-notice-3",
      number: null,
      title: "Attribution Notice",
      headingLevel: 3,
      parentId: "stc-meta-lizenz-und-orc-hinweise-1",
      normativity: "informational",
      bodyMarkdown: "\nThis product is based on the following upstream ORC Licensed Material: none identified in this edition.\n\nIf you use our Licensed Material in your own published works, please credit us as follows:\n\nSagaTree Core Rules, \xA9 2026 SagaTree contributors. Credits and version history: https://github.com/iamthamanic/SagaTree.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 18,
        endLine: 25
      }
    },
    {
      id: "stc-meta-reserved-material-notice-4",
      number: null,
      title: "Reserved Material Notice",
      headingLevel: 3,
      parentId: "stc-meta-lizenz-und-orc-hinweise-1",
      normativity: "informational",
      bodyMarkdown: "\nReserved Material includes the SagaTree name, logos and visual branding; distinctive fictional characters, stories, settings, worlds, maps, illustrations, music and audiovisual material; and other material qualifying as Reserved Material under the ORC License. Game mechanics and expressions reasonably necessary to explain them cannot be reserved where they qualify as ORC Licensed Material.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 26,
        endLine: 29
      }
    },
    {
      id: "stc-meta-expressly-designated-licensed-material-5",
      number: null,
      title: "Expressly Designated Licensed Material",
      headingLevel: 3,
      parentId: "stc-meta-lizenz-und-orc-hinweise-1",
      normativity: "informational",
      bodyMarkdown: "\nNo otherwise-Reserved Material is expressly designated as additional Licensed Material in this edition.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 30,
        endLine: 35
      }
    },
    {
      id: "stc-meta-verwendung-dieses-dokuments-6",
      number: null,
      title: "Verwendung dieses Dokuments",
      headingLevel: 2,
      parentId: null,
      normativity: "informational",
      bodyMarkdown: "\nDieses Dokument ist die zentrale Arbeitsgrundlage f\xFCr die SagaTree Core Rules.\n\n- Regeln in den Abschnitten 1 bis 18 gelten als **verbindlicher aktueller Core-Regelstand**.\n- Zahlenwerte in diesen Abschnitten gelten als **verbindliche Playtestwerte**. Sie werden nur ge\xE4ndert, wenn Validierung oder Spieltests einen konkreten \xC4nderungsbedarf zeigen.\n- Abschnitt 19 dokumentiert die noch offene mathematische und praktische Validierung.\n- Abschnitt 20 definiert die Kriterien f\xFCr die endg\xFCltige Freigabe.\n- Regeln aus Weltprofilen oder Abenteuermodulen d\xFCrfen den Kern erweitern oder ausdr\xFCcklich deaktivieren, aber nicht stillschweigend ver\xE4ndern.\n- \xC4nderungen am Core werden nach der Validierungsphase begr\xFCndet und im \xC4nderungsverlauf dokumentiert.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 36,
        endLine: 48
      }
    },
    {
      id: "stc-1",
      number: "1",
      title: "1. Grundausrichtung",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 49,
        endLine: 50
      }
    },
    {
      id: "stc-1-1",
      number: "1.1",
      title: "1.1 Regelkomplexit\xE4t",
      headingLevel: 3,
      parentId: "stc-1",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet eine mittlere Regelkomplexit\xE4t. Die Regeln sollen taktisch belastbar sein, ohne f\xFCr gew\xF6hnliche Handlungen unn\xF6tige Untermechaniken einzuf\xFChren.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 51,
        endLine: 54
      }
    },
    {
      id: "stc-1-2",
      number: "1.2",
      title: "1.2 Spielstil",
      headingLevel: 3,
      parentId: "stc-1",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verbindet erz\xE4hlerisches Spiel mit taktischen Entscheidungen.\n\n- Au\xDFerhalb direkter Konflikte f\xF6rdern die Regeln Konsequenzen, Fortschritt und Fail Forward.\n- Im direkten Kampf gelten pr\xE4zise, vorhersehbare Regeln.\n- Figuren beginnen kompetent, bleiben aber verwundbar.\n- Entscheidungen sollen wichtiger sein als das Sammeln kleiner situativer Zahlenboni.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 55,
        endLine: 63
      }
    },
    {
      id: "stc-1-3",
      number: "1.3",
      title: "1.3 Universeller Kern",
      headingLevel: 3,
      parentId: "stc-1",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDas Kernsystem ist nicht an Fantasy, Gegenwart, Science-Fiction oder ein bestimmtes Machtmodell gebunden.\n\nDie Regeln bestehen aus:\n\n1. dem stabilen SagaTree-Kern,\n2. Weltprofilen f\xFCr Genre und Setting,\n3. optionalen Abenteuermodulen,\n4. optionalen digitalen Erweiterungen.\n\nDer Kern muss vollst\xE4ndig mit W\xFCrfeln, Papier und Charakterbogen spielbar bleiben. Digitale Werkzeuge d\xFCrfen komplexere Module erleichtern, aber keine Voraussetzung f\xFCr die Grundregeln sein.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 64,
        endLine: 78
      }
    },
    {
      id: "stc-2",
      number: "2",
      title: "2. Checks und Aufl\xF6sung",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 79,
        endLine: 80
      }
    },
    {
      id: "stc-2-1",
      number: "2.1",
      title: "2.1 Basischeck",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nWenn der Ausgang einer Handlung unsicher ist und sowohl Erfolg als auch Fehlschlag relevante Folgen besitzen, wird ein Check verlangt.\n\n```text\nd20 + Attribut + Fertigkeit + anwendbarer Erfahrungsbonus + Spezialisierung + ausdr\xFCckliche Modifikatoren\n```\n\nDabei gelten nur die Bestandteile, die auf den konkreten Check anwendbar sind.\n\n- Der **globale Erfahrungsbonus** ist der stufenabh\xE4ngige Levelwert aus Abschnitt 4.1 bzw. 5.3.\n- Der **anwendbare Erfahrungsbonus** bei Fertigkeitschecks folgt Abschnitt 5.3: bei Fertigkeitsrang 0 ist er 0; sonst `min(globaler EB, Fertigkeitsrang + 1)`. Globaler und anwendbarer EB sind niemals gleichzusetzen.\n- Der Spezialisierungsbonus (+2) gilt nur, wenn die Spezialisierung eindeutig anwendbar ist; er ist weder Fertigkeitsrang noch Erfahrungsbonus.\n- Numerische Modifikatoren existieren nur, wenn eine F\xE4higkeit, Ausr\xFCstung, Bedingung oder Regel sie ausdr\xFCcklich vergibt.\n- Der Gesamtwert wird mit einer Schwierigkeit oder einem Widerstand verglichen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 81,
        endLine: 96
      }
    },
    {
      id: "stc-2-2",
      number: "2.2",
      title: "2.2 Erfolgsgrade und nat\xFCrliche W\xFCrfe",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Ergebnis | Bedingung |\n|---|---|\n| Kritischer Erfolg | Gesamtergebnis mindestens 10 \xFCber dem Zielwert |\n| Erfolg | Gesamtergebnis erreicht oder \xFCbertrifft den Zielwert |\n| Fehlschlag | Gesamtergebnis liegt unter dem Zielwert |\n| Kritischer Fehlschlag | Gesamtergebnis liegt mindestens 10 unter dem Zielwert |\n\nEine nat\xFCrliche 20 verbessert den erreichten Erfolgsgrad um eine Stufe. Eine nat\xFCrliche 1 verschlechtert ihn um eine Stufe. Ein Ergebnis kann nicht \xFCber einen kritischen Erfolg hinaus verbessert oder unter einen kritischen Fehlschlag verschlechtert werden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 97,
        endLine: 107
      }
    },
    {
      id: "stc-2-3",
      number: "2.3",
      title: "2.3 Fehlschlag und Erfolg gegen Preis",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin Fehlschlag l\xE4sst die Situation niemals unver\xE4ndert.\n\nDer GM kann statt eines vollst\xE4ndigen Fehlschlags einen Erfolg gegen einen klar benannten Preis anbieten. Die spielende Person entscheidet, ob sie diesen Preis akzeptiert.\n\nIm direkten Kampf ist Erfolg gegen Preis nur bei ausdr\xFCcklich daf\xFCr vorgesehenen F\xE4higkeiten erlaubt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 108,
        endLine: 115
      }
    },
    {
      id: "stc-2-4",
      number: "2.4",
      title: "2.4 Sicheres Arbeiten",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine trainierte Figur kann unter kontrollierten Bedingungen sorgf\xE4ltig arbeiten und statt eines d20-Wurfs einen Sicherheitswert verwenden.\n\n```text\nSicherheitswert = 10 + Attribut + Fertigkeit + anwendbarer Erfahrungsbonus\n                + Spezialisierung + ausdr\xFCckliche Modifikatoren\n```\n\nEs gelten dieselben Bestandteile wie beim Basischeck (Abschnitt 2.1), inklusive des anwendbaren Erfahrungsbonus nach Abschnitt 5.3. Sicheres Arbeiten ben\xF6tigt zus\xE4tzliche Zeit oder einen anderen vor dem Check festgelegten Aufwand. Es ist im direkten Kampf oder unter unmittelbarer Bedrohung nicht m\xF6glich, sofern keine F\xE4higkeit ausdr\xFCcklich etwas anderes erlaubt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 116,
        endLine: 126
      }
    },
    {
      id: "stc-2-5",
      number: "2.5",
      title: "2.5 Vorteil und Nachteil",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nVorteil: W\xFCrfle 2d20 und verwende den h\xF6heren d20.\nNachteil: W\xFCrfle 2d20 und verwende den niedrigeren d20.\n```\n\nJede eigenst\xE4ndige Vorteilsquelle hebt genau eine Nachteilsquelle auf und umgekehrt. Nach der Aufhebung aller Gegenquellen gilt entweder Vorteil, Nachteil oder ein normaler Wurf. Mehrere verbleibende Quellen erh\xF6hen die Anzahl der W\xFCrfel nicht weiter.\n\nNumerische Boni und Abz\xFCge existieren nur, wenn eine ausdr\xFCcklich definierte F\xE4higkeit, Ausr\xFCstung, Bedingung oder Regel sie vergibt. Der GM ersetzt gew\xF6hnliche situative Bewertungen nicht spontan durch zus\xE4tzliche Zahlenwerte.\n\nDieselbe benannte Quelle kann denselben Wurf nicht mehrfach ver\xE4ndern.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 127,
        endLine: 139
      }
    },
    {
      id: "stc-2-6",
      number: "2.6",
      title: "2.6 Widerst\xE4nde, vergleichende Checks und Gleichstand",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBei einer gerichteten Handlung gegen ein Ziel wird grunds\xE4tzlich gegen einen statischen Widerstand gew\xFCrfelt.\n\n```text\nWiderstand = 10 + passendes Attribut + passende Fertigkeit\n             + anwendbarer Erfahrungsbonus (Abschnitt 5.3)\n             + anwendbare Spezialisierung\n             + ausdr\xFCckliche Modifikatoren\n```\n\nEnth\xE4lt der Widerstand eine konkrete Fertigkeit, gilt der anwendbare Erfahrungsbonus dieser Fertigkeit. Widerst\xE4nde ohne Fertigkeitsbindung (Abschnitt 6.5) verwenden den globalen Erfahrungsbonus.\n\nNur wenn beide Seiten gleichzeitig und aktiv dasselbe Ergebnis anstreben, wird ein vergleichender Check verwendet. Dabei werden zuerst die Erfolgsgrade und danach die Gesamtergebnisse verglichen.\n\nBei vollst\xE4ndigem Gleichstand bleibt der Status quo bestehen.\n\n- Angreifer gegen Verteidiger: Die verteidigende Seite h\xE4lt ihre Position.\n- Verfolgungsjagd: Die Distanz ver\xE4ndert sich nicht.\n- Tauziehen oder vergleichbare Konkurrenz: Keine Seite erzielt Fortschritt.\n- Es wird nicht automatisch erneut gew\xFCrfelt.\n\nEin normaler Check, dessen Ergebnis exakt den Zielwert erreicht, ist ein Erfolg.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 140,
        endLine: 163
      }
    },
    {
      id: "stc-2-7",
      number: "2.7",
      title: "2.7 Schwierigkeiten",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nAufgaben besitzen feste, aus der Spielwelt abgeleitete Schwierigkeiten. Sie skalieren nicht automatisch mit der Charakterstufe.\n\n| Schwierigkeit | Zielwert | Bedeutung |\n|---|---:|---|\n| Trivial unter Druck | 5 | F\xFCr kompetente Figuren normalerweise sicher |\n| Einfach | 10 | Gew\xF6hnliche Herausforderung |\n| Anspruchsvoll | 15 | Erfordert verl\xE4ssliche Kompetenz |\n| Schwer | 20 | Deutlich \xFCber Alltagsniveau |\n| Extrem | 25 | Nur sehr kompetent zuverl\xE4ssig erreichbar |\n| Legend\xE4r | 30 | Herausragende Spitzenleistung |\n| \xDCbermenschlich | 35 | Normalerweise jenseits menschlicher M\xF6glichkeiten |\n| Weltver\xE4ndernd | 40+ | Nur mit au\xDFergew\xF6hnlichen Mitteln erreichbar |\n\nStufenabh\xE4ngige Werte dienen ausschlie\xDFlich dem Abenteuerdesign:\n\n| Stufe | Normale Herausforderungen | Schwere Herausforderungen | Au\xDFergew\xF6hnliche Herausforderungen |\n|---|---:|---:|---:|\n| 1\u20134 | 10\u201315 | 20 | 25 |\n| 5\u20138 | 15 | 20 | 25 |\n| 9\u201312 | 15\u201320 | 25 | 30 |\n| 13\u201316 | 20 | 25 | 30 |\n| 17\u201320 | 20\u201325 | 30 | 35 |\n\nEin bereits existierendes Hindernis ver\xE4ndert seinen Zielwert nicht, nur weil eine h\xF6herstufige Figur es versucht.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 164,
        endLine: 190
      }
    },
    {
      id: "stc-2-8",
      number: "2.8",
      title: "2.8 Zusammenarbeit",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree unterscheidet unterst\xFCtzte Einzelchecks, Gruppenchecks und Gemeinschaftsprojekte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 191,
        endLine: 194
      }
    },
    {
      id: "stc-meta-unterstutzter-einzelcheck-20",
      number: null,
      title: "Unterst\xFCtzter Einzelcheck",
      headingLevel: 4,
      parentId: "stc-2-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nKann eine Person das Ziel stellvertretend f\xFCr alle erreichen, f\xFChrt sie den Check aus.\n\n- Bis zu zwei qualifizierte Helfende k\xF6nnen unterst\xFCtzen.\n- Jede qualifizierte Hilfe z\xE4hlt als eigenst\xE4ndige Vorteilsquelle.\n- F\xFCr trainierte Handlungen muss auch die unterst\xFCtzende Figur die erforderliche Fertigkeit trainiert haben.\n- F\xFCr Fachhandlungen muss eine unterst\xFCtzende Figur die relevante Spezialisierung besitzen, sofern ihre Hilfe fachlich denselben Teil der Aufgabe betrifft.\n- Mehrere verbleibende Vorteilsquellen erzeugen weiterhin nur den normalen Vorteil nach Abschnitt 2.5.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 195,
        endLine: 204
      }
    },
    {
      id: "stc-meta-gruppencheck-21",
      number: null,
      title: "Gruppencheck",
      headingLevel: 4,
      parentId: "stc-2-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nMuss jedes Gruppenmitglied selbst handeln, f\xFChrt jede Figur einen eigenen Check aus.\n\n| Ergebnis | Gruppenwert |\n|---|---:|\n| Kritischer Erfolg | +2 |\n| Erfolg | +1 |\n| Fehlschlag | -1 |\n| Kritischer Fehlschlag | -2 |\n\n- Gruppenwert \xFCber 0: Die Gruppe erreicht das gemeinsame Ziel.\n- Gruppenwert unter 0: Die Gruppe scheitert und die angek\xFCndigte Konsequenz tritt ein.\n- Gruppenwert 0: Status quo; individuelle Konsequenzen k\xF6nnen trotzdem gelten.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 205,
        endLine: 219
      }
    },
    {
      id: "stc-meta-gemeinschaftsprojekt-22",
      number: null,
      title: "Gemeinschaftsprojekt",
      headingLevel: 4,
      parentId: "stc-2-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nMehrstufige oder l\xE4nger dauernde Vorhaben verwenden Fortschrittspunkte.\n\n| Projektgr\xF6\xDFe | Ben\xF6tigter Fortschritt |\n|---|---:|\n| Klein | 4 |\n| Komplex | 8 |\n| Gro\xDF | 12 |\n| Episch | 16 |\n\nPro Arbeitsintervall werden h\xF6chstens drei Projektchecks ausgef\xFChrt. Weitere Beteiligte unterst\xFCtzen diese Checks oder \xFCbernehmen erz\xE4hlerische Aufgaben.\n\n| Ergebnis | Fortschritt |\n|---|---:|\n| Kritischer Erfolg | +2 |\n| Erfolg | +1 |\n| Fehlschlag | +0 und eine passende Zeit-, Ressourcen- oder Komplikationsfolge |\n| Kritischer Fehlschlag | -1, mindestens 0 Gesamtfortschritt, plus deutliche Komplikation |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 220,
        endLine: 239
      }
    },
    {
      id: "stc-2-9",
      number: "2.9",
      title: "2.9 Verdeckte Informationen",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nChecks werden grunds\xE4tzlich offen ausgef\xFChrt. Der GM darf einen Check verdeckt ausf\xFChren, wenn bereits die Kenntnis des W\xFCrfelergebnisses verborgene Informationen offenlegen w\xFCrde.\n\nVerdeckte Checks ver\xE4ndern weder Berechnung noch Erfolgsgrade. Der GM ver\xE4ndert ein verdecktes Ergebnis nicht nachtr\xE4glich.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 240,
        endLine: 245
      }
    },
    {
      id: "stc-2-10",
      number: "2.10",
      title: "2.10 Drive",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDrive ist eine pers\xF6nliche Ressource mit einem normalen Startwert von 3 und einem Maximum von 5.\n\nDrive kann ausgegeben werden f\xFCr:\n\n- Wiederholung eines eigenen Wurfs,\n- Einf\xFChrung eines plausiblen charakterbezogenen Details,\n- Aktivierung einer ausdr\xFCcklich markierten Drive-F\xE4higkeit.\n\nF\xFCr einen eigenen Check kann h\xF6chstens 1 Drive ausgegeben werden.\n\nBei einer Wiederholung wird der gesamte Check einschlie\xDFlich Vorteil oder Nachteil unter denselben Bedingungen erneut gew\xFCrfelt. Die spielende Person darf anschlie\xDFend das alte oder das neue Ergebnis w\xE4hlen.\n\nDrive wird durch das freiwillige Akzeptieren einer klar benannten, charakterbezogenen Komplikation zur\xFCckgewonnen.\n\nDrive kann Konsequenzen nicht allgemein nachtr\xE4glich negieren.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 246,
        endLine: 263
      }
    },
    {
      id: "stc-2-11",
      number: "2.11",
      title: "2.11 Momentum",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nMomentum ist eine gemeinsame, verg\xE4ngliche Gruppenressource mit einem Startwert von 0 und einem Maximum von 3. Am Ende jeder Szene verf\xE4llt 1 ungenutztes Momentum.\n\nMomentum entsteht durch:\n\n- kritische Zusammenarbeit,\n- gemeinsame Zielerreichung,\n- ausdr\xFCcklich definierte Teamf\xE4higkeiten.\n\nMomentum kann ausgegeben werden f\xFCr:\n\n- Koordination,\n- passende Nebeneffekte erfolgreicher Teamhandlungen,\n- ausdr\xFCcklich definierte Teamman\xF6ver.\n\nMomentum ersetzt weder pers\xF6nlichen Drive noch individuelle Ressourcen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 264,
        endLine: 281
      }
    },
    {
      id: "stc-2-12",
      number: "2.12",
      title: "2.12 Optionale Ressourcen",
      headingLevel: 3,
      parentId: "stc-2",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDrive und Momentum sind im Standardspiel aktiv. Ein Abenteuer kann beide Systeme unabh\xE4ngig voneinander deaktivieren.\n\nEine davon abh\xE4ngige F\xE4higkeit muss f\xFCr den Fall einer deaktivierten Ressource ausdr\xFCcklich eine Ersatzbegrenzung definieren oder gilt als nicht verf\xFCgbar. Es gibt keine stillschweigenden Ersatzkosten.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 282,
        endLine: 289
      }
    },
    {
      id: "stc-3",
      number: "3",
      title: "3. Attribute",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 290,
        endLine: 291
      }
    },
    {
      id: "stc-3-1",
      number: "3.1",
      title: "3.1 Attributsliste",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet sechs universelle Attribute.\n\n| Attribut | Grundbedeutung |\n|---|---|\n| St\xE4rke | K\xF6rperkraft, unmittelbare physische Leistung und Kraft\xFCbertragung |\n| Geschicklichkeit | Koordination, Pr\xE4zision, Beweglichkeit und Reaktionskontrolle |\n| Ausdauer | k\xF6rperliche Widerstandsf\xE4higkeit, Belastbarkeit und Durchhalteverm\xF6gen |\n| Verstand | Analyse, Wissen, Planung und methodische Probleml\xF6sung |\n| Wahrnehmung | Aufmerksamkeit, Intuition, Orientierung und Erkennen relevanter Details |\n| Charisma | Pr\xE4senz, Ausdruck, Einfluss und soziale Durchsetzung |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 292,
        endLine: 304
      }
    },
    {
      id: "stc-3-2",
      number: "3.2",
      title: "3.2 Wertebereich",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nAttribute sind direkte Boni. Es gibt keine aus Attributswerten abgeleiteten separaten Modifikatoren. Bei einem reinen Attributscheck gilt:\n\n```text\nd20 + Attributbonus + ausdr\xFCckliche Modifikatoren\n```\n\n| Wert | Einordnung |\n|---:|---|\n| +0 | Regul\xE4rer Startwert ohne positiven Grundbonus; bedeutet keine Handlungsunf\xE4higkeit |\n| +1\u2013+4 | Regul\xE4rer Bereich der Basisverteilung bei der Charaktererschaffung |\n| +5 | Regul\xE4res Maximum nach sp\xE4terer Entwicklung (Stufe 8/16) |\n| +6+ | \xDCbermenschlich und nur durch ausdr\xFCcklich vorgesehene Regeln |\n\nNegative Grundattribute sind kein Bestandteil der regul\xE4ren Charaktererschaffung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 305,
        endLine: 321
      }
    },
    {
      id: "stc-3-3",
      number: "3.3",
      title: "3.3 Startattribute",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine Startfigur verf\xFCgt \xFCber **15 Attribut-Bonuspunkte**.\n\n- Die sechs Grundattribute starten regeltechnisch bei +0.\n- Die 15 Punkte werden frei auf die sechs Attribute verteilt.\n- Ein Grundattribut darf bei der regul\xE4ren Charaktererschaffung zwischen **+0 und +4** liegen.\n- Nicht ausgegebene Punkte verfallen.\n- Archetypen, Hintergr\xFCnde, Spezies und Essenzen vergeben weiterhin keine allgemeinen Attributsboni.\n\nEmpfohlene ausgewogene Verteilung (keine Pflicht):\n\n```text\n+4, +3, +3, +2, +2, +1\n```\n\nDas fr\xFChere nichtlineare 10-Punkte-Point-Buy und das regul\xE4re Minimum 1 gelten nicht mehr.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 322,
        endLine: 339
      }
    },
    {
      id: "stc-3-4",
      number: "3.4",
      title: "3.4 Quellen von Attributswerten",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nArchetypen, Hintergr\xFCnde, Spezies und Essenzen vergeben bei der regul\xE4ren Charaktererschaffung keine allgemeinen Attributsboni.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 340,
        endLine: 343
      }
    },
    {
      id: "stc-3-5",
      number: "3.5",
      title: "3.5 Attribute und Fertigkeiten",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nJede Fertigkeit besitzt ein Standardattribut.\n\nAu\xDFerhalb des direkten Kampfes kann ein anderes Attribut verwendet werden, wenn die beschriebene Vorgehensweise tats\xE4chlich eine andere Art der Handlung darstellt. Das alternative Attribut muss vor dem Check feststehen.\n\nIm direkten Kampf gilt das f\xFCr die Handlung definierte Attribut, sofern keine ausdr\xFCckliche Regel etwas anderes erlaubt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 344,
        endLine: 351
      }
    },
    {
      id: "stc-3-6",
      number: "3.6",
      title: "3.6 Reine Attributschecks",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nExistiert keine relevante Fertigkeit:\n\n```text\nd20 + Attribut + ausdr\xFCckliche Modifikatoren\n```\n\nEine Fertigkeit mit Wert 0 gilt dagegen als untrainierter Fertigkeitscheck. Sicheres Arbeiten steht bei reinen Attributschecks nicht zur Verf\xFCgung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 352,
        endLine: 361
      }
    },
    {
      id: "stc-3-7",
      number: "3.7",
      title: "3.7 Attributsentwicklung",
      headingLevel: 3,
      parentId: "stc-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Auf **Stufe 8** erh\xE4lt die Figur genau **+1** auf ein bestehendes Attribut.\n- Auf **Stufe 16** erh\xE4lt die Figur ein zweites Mal genau **+1** auf ein bestehendes Attribut.\n- Diese Steigerungen kommen zus\xE4tzlich zur bei der Erschaffung festgelegten Basisverteilung hinzu.\n- Ein Levelaufstieg erlaubt **kein kostenloses Respec** der bereits festgelegten Basiswerte.\n- Das regul\xE4re Maximum eines finalen Attributbonus betr\xE4gt **+5**.\n- Werte von +6 oder h\xF6her ben\xF6tigen weiterhin eine ausdr\xFCcklich \xFCbermenschliche Sonderregel.\n- Eine Attributssteigerung darf nicht gegen andere Entwicklungsoptionen eingetauscht werden, sofern ein Modul dies nicht ausdr\xFCcklich erlaubt.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 362,
        endLine: 373
      }
    },
    {
      id: "stc-4",
      number: "4",
      title: "4. Charakterstruktur",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 374,
        endLine: 375
      }
    },
    {
      id: "stc-4-1",
      number: "4.1",
      title: "4.1 Stufen und R\xE4nge",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet 20 Charakterstufen. Eine Stufe gibt den allgemeinen Erfahrungsrahmen einer Figur an, erh\xF6ht aber nicht automatisch s\xE4mtliche Werte.\n\nDie 20 Stufen sind in f\xFCnf benannte R\xE4nge zu je vier Stufen gegliedert. Der Rang b\xFCndelt die gro\xDFen Progressionsspr\xFCnge des Systems: **globalen Erfahrungsbonus**, maximalen Fertigkeitswert, maximal verf\xFCgbaren F\xE4higkeitsrang und den zugeh\xF6rigen Begegnungsrang.\n\n| Rang | Charakterstufen | Globaler Erfahrungsbonus | Fertigkeitslimit | Maximaler F\xE4higkeitsrang |\n|---|---:|---:|---:|---|\n| Novize | 1\u20134 | +1 | 3 | Novize |\n| Spezialist | 5\u20138 | +2 | 4 | Spezialist |\n| Experte | 9\u201312 | +3 | 4 | Experte |\n| Meister | 13\u201316 | +4 | 5 | Meister |\n| Legende | 17\u201320 | +5 | 5 | Legende |\n\nDer **globale Erfahrungsbonus** ist der verf\xFCgbare Levelwert der Figur. Er \xE4ndert sich nur mit den Rang-/Stufenb\xE4ndern oben und wird durch Fertigkeitsrang **nicht** erh\xF6ht oder verringert. Ob und wie viel davon in einen Fertigkeitscheck einflie\xDFt, bestimmt der **anwendbare Erfahrungsbonus** nach Abschnitt 5.3.\n\nDer Rang ist keine eigene Klasse und besitzt keine getrennten Rangstufen. Ein Rangwechsel schaltet die entsprechenden Grenzen und M\xF6glichkeiten frei, vergibt aber nur die Entwicklungen, die f\xFCr die konkrete Charakterstufe in Abschnitt 13 vorgesehen sind.\n\n**Novize** bezeichnet ausschlie\xDFlich den ersten SagaTree-Progressionsrang. Eine Figur des Rangs Novize ist deshalb nicht automatisch unerfahren oder untrainiert; SagaTree-Figuren beginnen bereits kompetent.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 376,
        endLine: 395
      }
    },
    {
      id: "stc-4-2",
      number: "4.2",
      title: "4.2 Archetypen",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet f\xFCnf universelle Archetypen.\n\n| Archetyp | Kernfunktion | Typische Fertigkeiten |\n|---|---|---|\n| K\xE4mpfer | Direkter Konflikt, Schutz, Druck | Athletik, Nahkampf, Fernkampf, Einsch\xFCchtern |\n| Denker | Analyse, Planung, Systeme | Ermitteln, Wissen, Technik, Aufmerksamkeit |\n| Heiler | Stabilisierung, Versorgung, F\xFCrsorge | Medizin, Menschenkenntnis, Wissen, \xDCberleben |\n| Rebell | Infiltration, Beweglichkeit, Improvisation | Akrobatik, Fingerfertigkeit, Heimlichkeit, T\xE4uschen |\n| Diplomat | Einfluss, F\xFChrung, Koordination | \xDCberzeugen, Menschenkenntnis, Auftreten, Einsch\xFCchtern |\n\nJede Figur beginnt mit einem Prim\xE4rarchetyp. Weitere Archetypen werden \xFCber freie F\xE4higkeitswahlen erschlossen und besitzen keine eigenen Klassenstufen.\n\n- Zweiter Archetyp: fr\xFChestens Stufe 6; mindestens drei F\xE4higkeiten aus dem Prim\xE4rarchetyp.\n- Dritter Archetyp: fr\xFChestens Stufe 12; mindestens drei F\xE4higkeiten in jedem bereits erschlossenen Archetyp.\n- Vierter Archetyp: fr\xFChestens Stufe 18; mindestens drei F\xE4higkeiten in jedem bereits erschlossenen Archetyp.\n\nDas Erschlie\xDFen eines neuen Archetyps verbraucht eine freie F\xE4higkeitswahl und enth\xE4lt dessen Kernf\xE4higkeit des Rangs Novize.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 396,
        endLine: 415
      }
    },
    {
      id: "stc-4-3",
      number: "4.3",
      title: "4.3 Kombinationen",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDie f\xFCnf Archetypen und f\xFCnf Essenzen erzeugen 25 gef\xFChrte Kombinationsprofile. Diese sind Orientierungshilfen und keine eigenen Klassen oder Subsysteme.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 416,
        endLine: 419
      }
    },
    {
      id: "stc-4-4",
      number: "4.4",
      title: "4.4 Hintergrund",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin Hintergrund enth\xE4lt:\n\n- eine Liste aus genau **vier** passenden Fertigkeiten (Hintergrund-Framework-Pool),\n- **2 Hintergrund-Fertigkeitspunkte**, die frei auf diesen Viererpool verteilt werden,\n- eine Spezialisierung,\n- einen Milieuzugang,\n- eine Verbindung oder Kontaktperson,\n- eine charakterbezogene Komplikation.\n\nDie zwei Hintergrundpunkte bilden einen kleinen Punktepool:\n\n- Beide Punkte d\xFCrfen auf denselben Skill gelegt werden (`+2` auf einen Framework-Skill).\n- Alternativ d\xFCrfen sie auf zwei unterschiedliche Skills des Pools verteilt werden (`+1/+1`).\n- Es gibt **keine** Pflicht, zwei verschiedene Skills zu trainieren.\n- Jeder Fertigkeitspunkt bedeutet unabh\xE4ngig von der Quelle `+1 Fertigkeitsrang`.\n\nHintergr\xFCnde vergeben keine Attributsboni und keine allgemeinen Kr\xE4fte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 420,
        endLine: 439
      }
    },
    {
      id: "stc-4-5",
      number: "4.5",
      title: "4.5 Spezies",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSpezies beschreibt den angeborenen, biologischen oder strukturellen K\xF6rper einer Figur. Sie bestimmt nicht den Archetyp, die Essenz, den Hintergrund oder die erlernten Fertigkeiten. Ein Mensch, Elf, Ork, Cyborg oder Alien kann deshalb grunds\xE4tzlich dieselben Archetypen und Essenzen w\xE4hlen, sofern Weltprofil oder andere ausdr\xFCckliche Regeln nichts anderes festlegen.\n\nEine regul\xE4re Spezies verwendet ein **Merkmalsbudget von genau 3 Punkten**. Bei der Charaktererschaffung m\xFCssen alle 3 Punkte ausgegeben werden.\n\n- Keine allgemeinen Attributs- oder Fertigkeitsboni.\n- Keine kulturellen Sprachen.\n- Keine zus\xE4tzlichen vollst\xE4ndigen Aktionen.\n- Nachteile erzeugen keine zus\xE4tzlichen freien Merkmalspunkte.\n- Hybride Spezies verwenden dasselbe Gesamtbudget.\n- Nicht jedes Speziesmerkmal ist f\xFCr jede regul\xE4re Spezies verf\xFCgbar.\n- Ein Weltprofil darf weitere Spezies oder ausdr\xFCcklich abweichende Merkmalslisten definieren, muss diese Abweichung aber offen benennen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 440,
        endLine: 453
      }
    },
    {
      id: "stc-meta-speziesmerkmale-41",
      number: null,
      title: "Speziesmerkmale",
      headingLevel: 4,
      parentId: "stc-4-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Merkmal | Kosten | Regelwirkung |\n|---|---:|---|\n| Gesch\xE4rfter Sinn | 1 | Einen Sinn festlegen. Vorteil auf Wahrnehmungschecks, bei denen genau dieser Sinn entscheidend ist. Der Sinn muss bei der Charaktererschaffung benannt werden. |\n| Nat\xFCrliche Waffe | 1 | Unbewaffneter Schaden steigt von d4+1 auf d6+1. Die k\xF6rperliche Form, etwa Klauen, Z\xE4hne oder H\xF6rner, wird beschrieben. |\n| Enge Resistenz | 1 | Eine klar eingegrenzte Gefahrenart festlegen. Vorteil auf passende Checks und Widerst\xE4nde gegen genau diese Gefahr. Die Gefahrenart muss benannt werden. |\n| Umweltanpassung | 1 | Eine gew\xF6hnliche Umgebung festlegen. Normale Nachteile, die ausschlie\xDFlich aus dieser Umgebung entstehen, entfallen. Die Umgebung muss benannt werden. |\n| Ausdauernder Organismus | 1 | Vorteil auf Checks gegen langandauernde k\xF6rperliche Ersch\xF6pfung. |\n| Geringer Ruhebedarf | 1 | Ben\xF6tigt nur die H\xE4lfte der f\xFCr die Spezies \xFCblichen Schlaf- oder Ruhezeit. Heilung und Erholung werden dadurch nicht beschleunigt. |\n| Nat\xFCrlicher Schutz | 2 | Nat\xFCrliche Schutzwirkung 1 nach den normalen Schutzregeln. |\n| Erweitertes Klettern | 2 | Beim Klettern kostet 1 Meter Bewegung 1 Meter statt der normalen 2 Meter. Schwierige Oberfl\xE4chen, Gefahr oder Zeitdruck k\xF6nnen weiterhin einen Athletikcheck verlangen. |\n| Erweitertes Schwimmen | 2 | Beim Schwimmen kostet 1 Meter Bewegung 1 Meter statt der normalen 2 Meter. Str\xF6mung, Gefahr oder andere schwierige Bedingungen k\xF6nnen weiterhin einen Athletikcheck verlangen. |\n| Amphibisch | 2 | Kann an Land und unter Wasser normal atmen und leben. Normale Atemeinschr\xE4nkungen durch Wasser entfallen. |\n| Erweiterte Sicht | 2 | Eine klar definierte besondere Sichtform festlegen, etwa Dunkelsicht, W\xE4rmesicht oder Fernsicht. Die Sichtform gilt nur in ihrem festgelegten Anwendungsbereich und muss benannt werden. |\n| Flugf\xE4hig | 3 | Besitzt eine nat\xFCrliche Flugbewegung in H\xF6he der normalen Bewegungsrate. |\n| Extremumwelt | 3 | Eine Extremumwelt festlegen. Kann dort ohne die normalerweise erforderlichen Schutzmittel \xFCberleben. Die Extremumwelt muss benannt werden. |\n| Au\xDFergew\xF6hnlicher K\xF6rperbau | 3 | Reserviertes definierendes Merkmal f\xFCr stark abweichende Anatomie. **Noch nicht verf\xFCgbar**, bis zul\xE4ssige mechanische Varianten verbindlich definiert sind. |\n\nSpeziesmerkmale d\xFCrfen keine vollen Zusatzaktionen, allgemeinen Attributsboni, allgemeinen Fertigkeitsboni, zus\xE4tzlichen Drive, zus\xE4tzliches Momentum oder einen Archetyp ersetzen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 454,
        endLine: 474
      }
    },
    {
      id: "stc-meta-zulassige-merkmale-der-core-spezies-42",
      number: null,
      title: "Zul\xE4ssige Merkmale der Core-Spezies",
      headingLevel: 4,
      parentId: "stc-4-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Spezies | Zul\xE4ssige Speziesmerkmale |\n|---|---|\n| Mensch | Gesch\xE4rfter Sinn; Enge Resistenz; Umweltanpassung; Ausdauernder Organismus; Geringer Ruhebedarf |\n| Elf | Gesch\xE4rfter Sinn; Enge Resistenz; Umweltanpassung; Ausdauernder Organismus; Geringer Ruhebedarf; Erweitertes Klettern; Erweiterte Sicht |\n| Zwerg | Gesch\xE4rfter Sinn; Enge Resistenz; Umweltanpassung; Ausdauernder Organismus; Geringer Ruhebedarf; Nat\xFCrlicher Schutz; Erweiterte Sicht |\n| Halbling | Gesch\xE4rfter Sinn; Enge Resistenz; Umweltanpassung; Ausdauernder Organismus; Erweitertes Klettern |\n| Ork | Gesch\xE4rfter Sinn; Nat\xFCrliche Waffe; Enge Resistenz; Umweltanpassung; Ausdauernder Organismus; Nat\xFCrlicher Schutz; Au\xDFergew\xF6hnlicher K\xF6rperbau* |\n| Cyborg | Gesch\xE4rfter Sinn; Nat\xFCrliche Waffe; Enge Resistenz; Umweltanpassung; Geringer Ruhebedarf; Nat\xFCrlicher Schutz; Erweitertes Klettern; Erweitertes Schwimmen; Erweiterte Sicht; Extremumwelt; Au\xDFergew\xF6hnlicher K\xF6rperbau* |\n| Alien | Alle Core-Speziesmerkmale* |\n\n`*` **Au\xDFergew\xF6hnlicher K\xF6rperbau** bleibt bis zur Definition seiner Varianten nicht w\xE4hlbar.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 475,
        endLine: 488
      }
    },
    {
      id: "stc-meta-alien-speziesprofil-43",
      number: null,
      title: "Alien-Speziesprofil",
      headingLevel: 4,
      parentId: "stc-4-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Alien** ist der freie Core-Spezies-Builder f\xFCr eigene nicht-menschliche, hybride oder ungew\xF6hnliche K\xF6rperformen.\n\n- Die Figur wird regeltechnisch als Spezies `Alien` gef\xFChrt.\n- Das Speziesprofil erh\xE4lt einen frei gew\xE4hlten verpflichtenden Namen, zum Beispiel `Schneggl`.\n- Die K\xF6rperbeschreibung ist frei und hat ohne ein gew\xE4hltes Speziesmerkmal keine zus\xE4tzliche Regelwirkung.\n- Das Alien-Profil darf aus dem vollst\xE4ndigen verf\xFCgbaren Core-Merkmalskatalog w\xE4hlen.\n- Auch ein Alien muss genau 3 Speziespunkte ausgeben.\n- Ein Alien-Profil ist keine Klasse, kein Archetyp und keine Essenz.\n\nDamit k\xF6nnen Weltprofile oder Spieler eigene Spezies darstellen, ohne f\xFCr jede denkbare K\xF6rperform einen neuen Core-Regelblock zu ben\xF6tigen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 489,
        endLine: 501
      }
    },
    {
      id: "stc-4-6",
      number: "4.6",
      title: "4.6 Essenzen",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet f\xFCnf universelle Essenzen.\n\n| Essenz | Wirkprinzip |\n|---|---|\n| K\xF6rperlich | K\xF6rper, Biologie, Training oder k\xF6rperliche Ver\xE4nderung |\n| Mental | Geist, Fokus, Wahrnehmung oder mentale Projektion |\n| Spirituell | Seele, Glauben, Geister oder metaphysische Verbindung |\n| Gebunden | Bindung an Spezies, Artefakte, Pakte, Begleiter oder externe Quellen |\n| Technologisch | Ger\xE4te, Systeme, Konstruktionen oder technische Ver\xE4nderung |\n\nJede Figur besitzt eine prim\xE4re Essenz. Eine sekund\xE4re Essenz kann sp\xE4ter erschlossen werden. Essenzen vergeben keine automatischen Attributs- oder Fertigkeitsboni.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 502,
        endLine: 515
      }
    },
    {
      id: "stc-4-7",
      number: "4.7",
      title: "4.7 Weltprofile",
      headingLevel: 3,
      parentId: "stc-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin Weltprofil muss mindestens festlegen:\n\n1. Name und Genre,\n2. Tonalit\xE4t,\n3. Standard-H\xE4rtegrad,\n4. verf\xFCgbare Spezies,\n5. Milieus und Hintergr\xFCnde,\n6. Erscheinungsformen der Archetypen,\n7. verf\xFCgbare Essenzen und ihre Manifestationen,\n8. Magiestufe,\n9. Technologiestufe,\n10. Sprachen und Kommunikationsformen,\n11. verf\xFCgbare Ausr\xFCstung,\n12. Ressourcen- oder W\xE4hrungsmodell,\n13. Reisen und Fahrzeuge,\n14. typische Gefahren,\n15. aktive Module,\n16. deaktivierte Core-Regeln,\n17. Ersatzregeln f\xFCr deaktivierte Core-Regeln,\n18. relevante Wirkungskennzeichnungen und Gegenma\xDFnahmen,\n19. Richtwerte f\xFCr Begegnungen und Gegner,\n20. jede ausdr\xFCckliche Abweichung vom Core.\n\nEin Weltprofil darf Core-Regeln niemals stillschweigend ver\xE4ndern.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 516,
        endLine: 544
      }
    },
    {
      id: "stc-5",
      number: "5",
      title: "5. Fertigkeiten und Spezialisierungen",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 545,
        endLine: 546
      }
    },
    {
      id: "stc-5-1",
      number: "5.1",
      title: "5.1 Universelle Fertigkeitsliste",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Nr. | Fertigkeit | Standardattribut |\n|---:|---|---|\n| 1 | Athletik | St\xE4rke |\n| 2 | Akrobatik | Geschicklichkeit |\n| 3 | Fingerfertigkeit | Geschicklichkeit |\n| 4 | Heimlichkeit | Geschicklichkeit |\n| 5 | Nahkampf | St\xE4rke |\n| 6 | Fernkampf | Geschicklichkeit |\n| 7 | Aufmerksamkeit | Wahrnehmung |\n| 8 | Menschenkenntnis | Wahrnehmung |\n| 9 | \xDCberleben | Wahrnehmung |\n| 10 | Ermitteln | Verstand |\n| 11 | Wissen | Verstand |\n| 12 | Technik | Verstand |\n| 13 | Medizin | Verstand |\n| 14 | Fortbewegungsmittel | Geschicklichkeit |\n| 15 | \xDCberzeugen | Charisma |\n| 16 | T\xE4uschen | Charisma |\n| 17 | Einsch\xFCchtern | Charisma |\n| 18 | Auftreten | Charisma |\n\nEs gibt keine zus\xE4tzliche Fertigkeit Belastbarkeit. Reines k\xF6rperliches Aushalten verwendet Ausdauer. Athletik wird verwendet, wenn sportliche Technik oder aktive k\xF6rperliche Leistung entscheidend ist.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 547,
        endLine: 571
      }
    },
    {
      id: "stc-5-2",
      number: "5.2",
      title: "5.2 Spezialisierungen",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine passende Spezialisierung gibt:\n\n```text\n+2 auf den Check\n```\n\nDieser Bonus ist situationsgebunden und **getrennt** von Fertigkeitsrang und Erfahrungsbonus. In vollst\xE4ndigen Check-Beispielen wird er als eigener Formelterm ausgewiesen.\n\n- H\xF6chstens eine Spezialisierung pro Check.\n- Fachhandlungen k\xF6nnen eine passende Spezialisierung voraussetzen.\n- Fachhandlungen m\xFCssen vor dem Wurf als solche erkennbar sein.\n\n| Spezialisierung in derselben Fertigkeit | Voraussetzung |\n|---:|---:|\n| Erste | Fertigkeitswert 1 |\n| Zweite | Fertigkeitswert 3 |\n| Dritte | Fertigkeitswert 5 |\n\nMaximal drei Spezialisierungen pro Fertigkeit.\n\nBeispiel (passende Spezialisierung anwendbar):\n\n```text\nCHECK\nd20\n+2 Charisma          (Attribut)\n+2 \xDCberzeugen        (Fertigkeitsrang)\n+2 anwendbarer EB    (global +2, Rang 2 \u2192 min(2, 2+1) = 2)\n+2 Spezialisierung   (z. B. Verhandlung)\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nd20 +8\n```",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 572,
        endLine: 606
      }
    },
    {
      id: "stc-5-3",
      number: "5.3",
      title: "5.3 Fertigkeitswerte und Erfahrungsbonus",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Wert | Kompetenzstufe |\n|---:|---|\n| 0 | Untrainiert |\n| 1 | Trainiert |\n| 2 | Ge\xFCbt |\n| 3 | Fachkundig |\n| 4 | Meisterlich |\n| 5 | Weltklasse |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 607,
        endLine: 617
      }
    },
    {
      id: "stc-meta-globaler-erfahrungsbonus-50",
      number: null,
      title: "Globaler Erfahrungsbonus",
      headingLevel: 4,
      parentId: "stc-5-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDer globale Erfahrungsbonus ist der stufenabh\xE4ngige Levelwert (identisch mit der Tabelle in Abschnitt 4.1):\n\n| Stufe | Rang | Globaler Erfahrungsbonus |\n|---:|---|---:|\n| 1\u20134 | Novize | +1 |\n| 5\u20138 | Spezialist | +2 |\n| 9\u201312 | Experte | +3 |\n| 13\u201316 | Meister | +4 |\n| 17\u201320 | Legende | +5 |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 618,
        endLine: 629
      }
    },
    {
      id: "stc-meta-anwendbarer-erfahrungsbonus-fertigkeitschecks-51",
      number: null,
      title: "Anwendbarer Erfahrungsbonus (Fertigkeitschecks)",
      headingLevel: 4,
      parentId: "stc-5-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin Skill nutzt nicht automatisch den vollst\xE4ndigen globalen EB, sobald er Rang 1 erreicht.\n\nNormative Formel:\n\n```text\nbei Fertigkeitsrang 0:\nanwendbarer EB = 0\n\nbei Fertigkeitsrang 1+:\nanwendbarer EB = min(globaler EB, Fertigkeitsrang + 1)\n```\n\nDaraus folgt f\xFCr die Ranggrenzen:\n\n| Fertigkeitsrang | Maximal anwendbarer EB |\n|---:|---:|\n| 0 | +0 |\n| 1 | +2 |\n| 2 | +3 |\n| 3 | +4 |\n| 4 | +5 |\n| 5 | +5 |\n\nEs gibt **keinen** automatischen Erfahrungsbonus f\xFCr Skill 0. Globaler und anwendbarer EB d\xFCrfen niemals gleichgesetzt werden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 630,
        endLine: 656
      }
    },
    {
      id: "stc-meta-abgrenzung-nicht-skillgebundene-formeln-52",
      number: null,
      title: "Abgrenzung: nicht skillgebundene Formeln",
      headingLevel: 4,
      parentId: "stc-5-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nFormeln, deren Erfahrungsbonus **nicht** an einen konkreten Fertigkeitsrang gebunden ist (z. B. Gesundheit, K\xF6rper-/Reflex-/Geistwiderstand, Erholung), verwenden weiterhin den **vollen globalen EB**.\n\nFormeln, deren EB ausdr\xFCcklich von einem konkreten Skilltraining abh\xE4ngt (z. B. Fertigkeitschecks, Initiative \xFCber Aufmerksamkeit, Man\xF6verwiderstand \xFCber Athletik/Akrobatik-Anteil), verwenden den **anwendbaren EB** des betreffenden Skills.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 657,
        endLine: 662
      }
    },
    {
      id: "stc-meta-fertigkeitslimit-nach-stufe-53",
      number: null,
      title: "Fertigkeitslimit nach Stufe",
      headingLevel: 4,
      parentId: "stc-5-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Charakterstufe | Rang | Maximaler Fertigkeitswert |\n|---:|---|---:|\n| 1\u20134 | Novize | 3 |\n| 5\u20138 | Spezialist | 4 |\n| 9\u201312 | Experte | 4 |\n| 13\u201316 | Meister | 5 |\n| 17\u201320 | Legende | 5 |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 663,
        endLine: 672
      }
    },
    {
      id: "stc-meta-vollstandige-beispiele-stufe-17-charisma-2-globa-54",
      number: null,
      title: "Vollst\xE4ndige Beispiele (Stufe 17, Charisma +2, globaler EB +5)",
      headingLevel: 4,
      parentId: "stc-5-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nUntrainiert:\n\n```text\n\xDCBERZEUGEN 0\n\nCHECK\nd20\n+2 Charisma          (Attribut)\n+0 \xDCberzeugen        (Fertigkeitsrang)\n+0 anwendbarer EB    (Rang 0 \u2192 0; globaler EB +5 bleibt ungenutzt)\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nd20 +2\n```\n\nNach `\xDCberzeugen 0\u21921`:\n\n```text\nGlobaler EB             +5\nDurch Rang 1 nutzbar    +2   (= min(5, 1+1))\n\nCHECK\nd20\n+2 Charisma          (Attribut)\n+1 \xDCberzeugen        (Fertigkeitsrang)\n+2 anwendbarer EB\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nd20 +5\n```\n\nNicht:\n\n```text\nd20 +2 +1 +5 = d20 +8\n```\n\nWeiterentwickelter Skill bei Stufe 17, Attribut +2:\n\n```text\nSkill 1:  d20 +2 Attribut +1 Skill +2 anwendbarer EB = d20 +5\nSkill 2:  d20 +2 Attribut +2 Skill +3 anwendbarer EB = d20 +7\nSkill 3:  d20 +2 Attribut +3 Skill +4 anwendbarer EB = d20 +9\nSkill 4:  d20 +2 Attribut +4 Skill +5 anwendbarer EB = d20 +11\nSkill 5:  d20 +2 Attribut +5 Skill +5 anwendbarer EB = d20 +12\n```",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 673,
        endLine: 719
      }
    },
    {
      id: "stc-5-4",
      number: "5.4",
      title: "5.4 Fertigkeiten bei der Charaktererschaffung",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\nStart-Fertigkeiten kommen aus **drei getrennten Quellen**. Mathematisch sind es zehn Punkte; die Regel und UX-Semantik sind die drei Quellen:\n\n```text\n7 freie Fertigkeitspunkte\n\u2192 frei auf alle 18 Core-Skills\n\n2 Hintergrund-Fertigkeitspunkte\n\u2192 frei auf die 4 Skills des gew\xE4hlten Hintergrund-Frameworks\n\u2192 +2 auf denselben Skill erlaubt\n\n1 Archetyp-Fertigkeitspunkt\n\u2192 auf einen der 4 typischen Skills des Prim\xE4rarchetyps\n```\n\nUnabh\xE4ngig von der Quelle gilt:\n\n```text\n1 Fertigkeitspunkt = +1 Fertigkeitsrang\n```\n\n| Quelle | Punkte | Zielraum |\n|---|---:|---|\n| Freie Verteilung | 7 | alle 18 Core-Skills |\n| Hintergrund | 2 | nur der Viererpool des Frameworks; Stapeln `+2` erlaubt |\n| Prim\xE4rarchetyp | 1 | ein typischer Skill des Prim\xE4rarchetyps |\n| Summe (intern) | 10 | \u2014 |\n\nQuellen d\xFCrfen sich addieren. Das **Startmaximum** pro Fertigkeit bleibt **3**. Beispiel:\n\n```text\nMedizin\nHintergrund +2\nArchetyp     +1\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nMedizin       3\n```\n\nEin weiterer freier Punkt auf Medizin ist bei der Charaktererschaffung nicht erlaubt (Startcap 3).\n\n**Keine Mindestanzahl** trainierter Startskills. Spezialisierte Builds mit wenigen hohen Skills sind legal, solange Quellenregeln und Startcap eingehalten werden. Schw\xE4chen sollen im Abenteuer echte Konsequenzen haben; es gibt keine versteckte Ersatz-Mindestbreite.\n\nEmpfohlene ausgewogene Verteilung (keine Pflicht):\n\n```text\n3, 2, 2, 1, 1, 1\n```\n\nGrenzen:\n\n- maximaler Startwert 3,\n- nicht ausgegebene Punkte verfallen,\n- keine Pflicht zu mindestens sechs trainierten Fertigkeiten.\n\nBeispiel Spezialisten-Start (legal):\n\n```text\nNahkampf       3\nAthletik       3\nEinsch\xFCchtern  3\n\xDCberleben      1\n```\n\nDerselbe k\xF6rperlich maximierte Charakter kann vor Gericht schwach sein:\n\n```text\nCharisma    +0\n\xDCberzeugen   0\n\nCHECK\nd20\n+0 Charisma\n+0 \xDCberzeugen\n+0 anwendbarer EB\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nd20 +0\n```",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 720,
        endLine: 798
      }
    },
    {
      id: "stc-5-5",
      number: "5.5",
      title: "5.5 Fertigkeitsentwicklung",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\nFertigkeitsentwicklung auf den Stufen:\n\n```text\n3, 5, 7, 9, 11, 13, 15, 17, 19\n```\n\nJe Entwicklung:\n\n- Fertigkeit um 1 erh\xF6hen,\n- neue Fertigkeit von 0 auf 1,\n- neue Spezialisierung erwerben.\n\nNicht verwendete Fertigkeitsentwicklungen d\xFCrfen zur\xFCckgestellt werden.\n\nEin sp\xE4ter gelerntes `0\u21921` erh\xF6ht den Fertigkeitsrang um 1 und nutzt danach nur den durch Rang 1 erlaubten anwendbaren EB (`min(globaler EB, 2)`), nicht automatisch den vollen globalen EB. Siehe Stufe-17-Beispiel in Abschnitt 5.3.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 799,
        endLine: 816
      }
    },
    {
      id: "stc-5-6",
      number: "5.6",
      title: "5.6 Handlungskategorien und passive Werte",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Kategorie | Regel |\n|---|---|\n| Automatische Handlung | Kein Check |\n| Gew\xF6hnliche Handlung | Darf mit Fertigkeitswert 0 versucht werden |\n| Trainierte Handlung | Fertigkeitswert 1+ erforderlich |\n| Fachhandlung | Training und passende Spezialisierung erforderlich |\n\nSagaTree verwendet keine allgemeine Liste passiver Fertigkeitswerte.\n\nAufmerksamkeitswiderstand:\n\n```text\n10 + Wahrnehmung + Aufmerksamkeit\n   + anwendbarer Erfahrungsbonus der Fertigkeit Aufmerksamkeit\n   + anwendbare Spezialisierung\n   + ausdr\xFCckliche Modifikatoren\n```",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 817,
        endLine: 836
      }
    },
    {
      id: "stc-5-7",
      number: "5.7",
      title: "5.7 Sprachen, Werkzeuge und Berechtigungen",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSprachen sind keine Fertigkeiten. Das Weltprofil bestimmt die gemeinsame Standardsprache. Jede Figur beherrscht normalerweise zus\xE4tzlich eine zum Hintergrund passende Kommunikationsform.\n\nWerkzeuge sind Ausr\xFCstung:\n\n- geeignete Werkzeuge: normaler Check,\n- unvollst\xE4ndige oder improvisierte Werkzeuge: Nachteil,\n- passender zus\xE4tzlicher Zeitaufwand kann diesen Nachteil ersetzen,\n- fehlt ein unverzichtbares Werkzeug, ist die Handlung unm\xF6glich,\n- hochwertige Werkzeuge haben nur ausdr\xFCcklich definierte Vorteile.\n\nDie **36 Core-Gegenstandsarchetypen** (\xA710.0) bleiben der mechanische Kern f\xFCr Werkzeuge und Ausr\xFCstung. Standard-Packs, Weltkatalog (`item-catalog`) und Personal-Items erweitern den Content, ohne neue Regelwirkung oder stillschweigende Zahlenboni zu erfinden \u2014 konkrete Effekte bleiben Fertigkeit, F\xE4higkeit oder ausdr\xFCckliches Weltprofil.\n\nBerechtigungen, Lizenzen, Dienstgrad oder sozialer Status, Kontakte und Sicherheitsfreigaben sind von fachlicher Kompetenz getrennt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 837,
        endLine: 852
      }
    },
    {
      id: "stc-5-8",
      number: "5.8",
      title: "5.8 Vollst\xE4ndige Fertigkeitsbeschreibungen",
      headingLevel: 3,
      parentId: "stc-5",
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 853,
        endLine: 854
      }
    },
    {
      id: "stc-5-8-1",
      number: "5.8.1",
      title: "5.8.1 Athletik",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** St\xE4rke\n\nAthletik beschreibt trainierte k\xF6rperliche Bewegung und kontrollierte Kraftanwendung gegen Entfernungen, H\xF6hen, Str\xF6mungen, Lasten und unbelebte Hindernisse.\n\nTypische Anwendungen: Klettern, Schwimmen, Springen, Sprinten, Tauchen, Heben, Ziehen, Festhalten, gewaltsames \xD6ffnen und kraftvolles L\xF6sen aus k\xF6rperlichen Behinderungen.\n\nNormale Bewegung ben\xF6tigt keinen Check. Ausdauer + Athletik kann au\xDFerhalb des direkten Kampfes f\xFCr langfristige sportliche Leistung verwendet werden. Reines Aushalten verwendet Ausdauer. Kampfman\xF6ver werden mit Nahkampf eingeleitet.\n\nGeeignete Spezialisierungen: Klettern, Schwimmen, Tauchen, Springen, Sprinten, Kraftakt, Rettung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 855,
        endLine: 866
      }
    },
    {
      id: "stc-5-8-2",
      number: "5.8.2",
      title: "5.8.2 Akrobatik",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Geschicklichkeit\n\nAkrobatik beschreibt Balance, pr\xE4zise K\xF6rperkontrolle, kontrollierte Landungen, Rollen, Ausweichen durch Bewegung und das bewegliche L\xF6sen aus k\xF6rperlichen Behinderungen.\n\nTypische Anwendungen: Balance auf schmalem Untergrund, kontrollierte St\xFCrze, Parkour, schwierige Landungen, Durchqueren beweglicher Hindernisse und akrobatisches Entkommen.\n\nAkrobatik ersetzt weder Athletik f\xFCr Kraft und Klettern noch Nahkampf f\xFCr das Einleiten eines Kampfman\xF6vers.\n\nGeeignete Spezialisierungen: Balance, Parkour, Fallen, Entkommen, Luftakrobatik.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 867,
        endLine: 878
      }
    },
    {
      id: "stc-5-8-3",
      number: "5.8.3",
      title: "5.8.3 Fingerfertigkeit",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Geschicklichkeit\n\nFingerfertigkeit beschreibt unauff\xE4llige oder besonders pr\xE4zise manuelle Handlungen mit kleinen Gegenst\xE4nden.\n\nTypische Anwendungen: Taschendiebstahl, Fingertricks, kleine Gegenst\xE4nde verbergen, manuelle Pr\xE4zisionsarbeit und mechanische Schl\xF6sser bedienen.\n\nTechnische Analyse, Konstruktion und Reparatur verwenden Technik. Eine Fachhandlung kann beide Kompetenzen voraussetzen.\n\nGeeignete Spezialisierungen: Taschendiebstahl, Schl\xF6sser, Tricks, Feinmechanik, Verbergen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 879,
        endLine: 890
      }
    },
    {
      id: "stc-5-8-4",
      number: "5.8.4",
      title: "5.8.4 Heimlichkeit",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Geschicklichkeit\n\nHeimlichkeit beschreibt das Verbergen der eigenen Anwesenheit und unbemerkte Bewegung.\n\nTypische Anwendungen: Schleichen, Verstecken, Beschattung, unbemerkter Zugang und Ausnutzen von Deckung.\n\nHeimlichkeit wird normalerweise gegen den Aufmerksamkeitswiderstand relevanter Beobachter gew\xFCrfelt. Ein erfolgreicher Angriff aus dem Verborgenen erh\xE4lt Vorteil und offenbart die angreifende Figur danach normalerweise.\n\nGeeignete Spezialisierungen: Schleichen, Verstecken, Beschattung, Infiltration, urbane Tarnung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 891,
        endLine: 902
      }
    },
    {
      id: "stc-5-8-5",
      number: "5.8.5",
      title: "5.8.5 Nahkampf",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** St\xE4rke\n\nNahkampf beschreibt Angriffe und aktive Kampfman\xF6ver innerhalb unmittelbarer Reichweite.\n\nTypische Anwendungen: unbewaffnete Angriffe, Nahkampfwaffen, Greifen, Schubsen, Zu-Fall-Bringen und Entwaffnen.\n\nGeschicklichkeit ersetzt St\xE4rke nur bei einer Waffe oder F\xE4higkeit mit ausdr\xFCcklichem Finesse-Effekt.\n\nGeeignete Spezialisierungen k\xF6nnen einzelne Waffenfamilien, unbewaffneter Kampf oder definierte Man\xF6ver sein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 903,
        endLine: 914
      }
    },
    {
      id: "stc-5-8-6",
      number: "5.8.6",
      title: "5.8.6 Fernkampf",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Geschicklichkeit\n\nFernkampf beschreibt gezielte Angriffe mit Projektilen, Wurfwaffen und anderen direkt bedienten Distanzwaffen.\n\nReichweite, Sicht und Deckung ver\xE4ndern den Check nur nach den ausdr\xFCcklichen Kampfregeln.\n\nGeeignete Spezialisierungen k\xF6nnen B\xF6gen, Schusswaffen, Wurfwaffen oder settingbezogene Waffengruppen sein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 915,
        endLine: 924
      }
    },
    {
      id: "stc-5-8-7",
      number: "5.8.7",
      title: "5.8.7 Aufmerksamkeit",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Wahrnehmung\n\nAufmerksamkeit beschreibt unmittelbares Wahrnehmen relevanter Ver\xE4nderungen.\n\nTypische Anwendungen: Hinterhalte bemerken, Ger\xE4usche lokalisieren, Bewegung erkennen, Ver\xE4nderungen in einer Szene wahrnehmen und versteckte Gefahren entdecken.\n\nSystematische Rekonstruktion und gezielte Spurenauswertung verwenden Ermitteln.\n\nGeeignete Spezialisierungen: Hinterhalte, Ger\xE4usche, visuelle Suche, Wachsamkeit, \xDCberwachung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 925,
        endLine: 936
      }
    },
    {
      id: "stc-5-8-8",
      number: "5.8.8",
      title: "5.8.8 Menschenkenntnis",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Wahrnehmung\n\nMenschenkenntnis beschreibt das Einsch\xE4tzen von Stimmung, Absicht, Motivation und sozialer Dynamik.\n\nSie erlaubt keine Gedankenleserei. Gegen T\xE4uschungsversuche wird sie normalerweise als Widerstand oder aktiven Gegencheck verwendet.\n\nGeeignete Spezialisierungen: L\xFCgen erkennen, Verhandlungspartner, Gruppendynamik, Motivation, Stressreaktionen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 937,
        endLine: 946
      }
    },
    {
      id: "stc-5-8-9",
      number: "5.8.9",
      title: "5.8.9 \xDCberleben",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Wahrnehmung\n\n\xDCberleben beschreibt Orientierung und praktische Handlungsf\xE4higkeit in schwierigen Umgebungen.\n\nTypische Anwendungen: Navigation, Spuren verfolgen, Nahrung und Wasser finden, Wetter einsch\xE4tzen, Lager w\xE4hlen und sichere Routen erkennen.\n\nGeeignete Spezialisierungen: Navigation, Spuren, Wildnis, urbane Survival-Situationen, Wetter, bestimmte Umgebungen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 947,
        endLine: 956
      }
    },
    {
      id: "stc-5-8-10",
      number: "5.8.10",
      title: "5.8.10 Ermitteln",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Verstand\n\nErmitteln beschreibt systematische Suche, Rekonstruktion und methodische Informationsgewinnung.\n\nTypische Anwendungen: Tatorte auswerten, Quellen vergleichen, Archive durchsuchen, Zusammenh\xE4nge rekonstruieren und gezielte Recherche.\n\nEine f\xFCr den Fortgang zwingend notwendige Information wird niemals ausschlie\xDFlich hinter einem einzelnen erfolgreichen Check verborgen. Der Check entscheidet \xFCber Tiefe, Geschwindigkeit, Kosten, Sicherheit oder Zusatzinformationen.\n\nGeeignete Spezialisierungen: Tatorte, Archive, digitale Recherche, Forensik, Befragungsanalyse.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 957,
        endLine: 968
      }
    },
    {
      id: "stc-5-8-11",
      number: "5.8.11",
      title: "5.8.11 Wissen",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Verstand\n\nWissen beschreibt erlerntes Fachwissen, Einordnung und Anwendung bekannter theoretischer Zusammenh\xE4nge.\n\nSpezialisierungen definieren Wissensgebiete wie Geschichte, Recht, Naturwissenschaften, Okkultes, Medizinwissen, bestimmte Kulturen oder settingbezogene Fachgebiete.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 969,
        endLine: 976
      }
    },
    {
      id: "stc-5-8-12",
      number: "5.8.12",
      title: "5.8.12 Technik",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Verstand\n\nTechnik beschreibt Bedienen, Analysieren, Reparieren, Konstruieren und Umgehen technischer oder mechanischer Systeme.\n\nAu\xDFerhalb des direkten Kampfes kann Geschicklichkeit + Technik verwendet werden, wenn die technische Kompetenz feststeht und ausschlie\xDFlich manuelle Pr\xE4zision entscheidend ist.\n\nGeeignete Spezialisierungen: Elektronik, Mechanik, Computer, Fahrzeuge, Robotik, Sicherheitssysteme.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 977,
        endLine: 986
      }
    },
    {
      id: "stc-5-8-13",
      number: "5.8.13",
      title: "5.8.13 Medizin",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Verstand\n\nMedizin beschreibt Diagnose, Stabilisierung, Behandlung, Chirurgie und biologische Gesundheitsversorgung.\n\nReparaturen rein technische Spezies oder Maschinen verwenden normalerweise Technik. Hybride Systeme k\xF6nnen eine passende Spezialisierung oder beide Fertigkeiten voraussetzen.\n\nGeeignete Spezialisierungen: Notfallmedizin, Chirurgie, Diagnose, Toxikologie, Psychiatrie, bestimmte Spezies.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 987,
        endLine: 996
      }
    },
    {
      id: "stc-5-8-14",
      number: "5.8.14",
      title: "5.8.14 Fortbewegungsmittel",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Geschicklichkeit\n\nFortbewegungsmittel beschreibt die aktive Kontrolle von Fahrzeugen, Reittieren oder vergleichbaren Bewegungssystemen unter schwierigen Bedingungen.\n\nRoutinefahrt ben\xF6tigt keinen Check. Navigation verwendet andere passende Fertigkeiten.\n\nGeeignete Spezialisierungen: Bodenfahrzeuge, Motorr\xE4der, Flugger\xE4te, Wasserfahrzeuge, Raumfahrzeuge, Reittiere.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 997,
        endLine: 1006
      }
    },
    {
      id: "stc-5-8-15",
      number: "5.8.15",
      title: "5.8.15 \xDCberzeugen",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Charisma\n\n\xDCberzeugen beschreibt ehrlichen sozialen Einfluss, Verhandlung, F\xFChrung und glaubw\xFCrdige Argumentation.\n\n\xDCberzeugen ist keine Gedankenkontrolle und kann keine Handlung erzwingen, die dem Ziel fundamental unvereinbar erscheint.\n\nGeeignete Spezialisierungen: Verhandeln, Diplomatie, F\xFChrung, Verkauf, Vermittlung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1007,
        endLine: 1016
      }
    },
    {
      id: "stc-5-8-16",
      number: "5.8.16",
      title: "5.8.16 T\xE4uschen",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Charisma\n\nT\xE4uschen beschreibt L\xFCgen, Ablenkungen, falsche Darstellung und bewusste Irref\xFChrung.\n\nT\xE4uschen wird typischerweise gegen Menschenkenntnis aufgel\xF6st. Eine physische F\xE4lschung ben\xF6tigt zus\xE4tzlich die passende praktische Fertigkeit.\n\nGeeignete Spezialisierungen: L\xFCgen, Verkleidung, Ablenkung, falsche Identit\xE4t, Betrug.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1017,
        endLine: 1026
      }
    },
    {
      id: "stc-5-8-17",
      number: "5.8.17",
      title: "5.8.17 Einsch\xFCchtern",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Charisma\n\nEinsch\xFCchtern beschreibt Einfluss durch Drohung, Dominanz und glaubw\xFCrdig vermittelte Gefahr.\n\nAu\xDFerhalb des direkten Kampfes kann St\xE4rke verwendet werden, wenn tats\xE4chlich eine k\xF6rperliche Machtdemonstration die Handlung tr\xE4gt.\n\nEinsch\xFCchtern kann kein Ziel zu offensichtlich selbstzerst\xF6rerischen Handlungen zwingen.\n\nGeeignete Spezialisierungen: Verh\xF6r, Drohung, k\xF6rperliche Pr\xE4senz, Autorit\xE4t, psychologischer Druck.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1027,
        endLine: 1038
      }
    },
    {
      id: "stc-5-8-18",
      number: "5.8.18",
      title: "5.8.18 Auftreten",
      headingLevel: 4,
      parentId: "stc-5-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Standardattribut:** Charisma\n\nAuftreten beschreibt bewusste Darbietung vor anderen.\n\nTypische Anwendungen: Musik, Schauspiel, Rede, Tanz, Unterhaltung und \xF6ffentliche Inszenierung.\n\nAu\xDFerhalb direkter Konflikte kann ein alternatives Attribut verwendet werden, wenn die technische Ausf\xFChrung statt Pr\xE4senz den Schwerpunkt bildet.\n\nGeeignete Spezialisierungen: Musik, Schauspiel, Rede, Tanz, Comedy oder andere klar definierte Darbietungsformen.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1039,
        endLine: 1052
      }
    },
    {
      id: "stc-6",
      number: "6",
      title: "6. Abgeleitete Charakterwerte",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1053,
        endLine: 1054
      }
    },
    {
      id: "stc-6-1",
      number: "6.1",
      title: "6.1 Gesundheit",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nGesundheit = 12 + (2 \xD7 Ausdauer) + (2 \xD7 globaler Erfahrungsbonus)\n```\n\nGesundheit nutzt den **globalen** Erfahrungsbonus (nicht skillgebunden). Gesundheit w\xE4chst bewusst langsam. Stufen allein sollen Figuren widerstandsf\xE4higer, aber nicht zu unverwundbaren Schadenspuffern machen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1055,
        endLine: 1062
      }
    },
    {
      id: "stc-6-2",
      number: "6.2",
      title: "6.2 Verteidigung",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nVerteidigung = 10 + Geschicklichkeit + globaler Erfahrungsbonus + max(Nahkampf, Akrobatik)\n```\n\nVerteidigung verwendet den globalen Erfahrungsbonus als Levelkomponente; die Fertigkeitswerte Nahkampf/Akrobatik gehen nur als Rangwert ein, ohne zus\xE4tzlichen anwendbaren EB. Spezialisierungen werden nicht auf Verteidigung angerechnet.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1063,
        endLine: 1070
      }
    },
    {
      id: "stc-6-3",
      number: "6.3",
      title: "6.3 Initiative",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nd20 + Wahrnehmung + Aufmerksamkeit\n     + anwendbarer Erfahrungsbonus der Fertigkeit Aufmerksamkeit\n```\n\nInitiative ist skillgebunden \xFCber Aufmerksamkeit und nutzt daher den anwendbaren EB (bei Aufmerksamkeit 0: +0 EB).\n\nBei Gleichstand entscheidet:\n\n1. h\xF6herer Initiativmodifikator,\n2. h\xF6here Wahrnehmung,\n3. Spielerfigur vor NSC,\n4. bei gleicher Seite entscheidet diese Seite die Reihenfolge.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1071,
        endLine: 1086
      }
    },
    {
      id: "stc-6-4",
      number: "6.4",
      title: "6.4 Bewegung",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nStandardbewegung: **9 Meter pro Zug**.\n\nOptionales Raster: 1 Feld = 1,5 Meter; Standardbewegung = 6 Felder.\n\nKlettern und Schwimmen sind normale Bewegungsarten und grunds\xE4tzlich ohne Speziesmerkmal m\xF6glich.\n\n- Ohne ausdr\xFCckliche Sonderbewegung kostet **1 Meter Klettern oder Schwimmen 2 Meter Bewegung**.\n- **Erweitertes Klettern** reduziert diesen Bewegungsaufwand beim Klettern auf 1 Meter Bewegung pro 1 Meter Strecke.\n- **Erweitertes Schwimmen** reduziert diesen Bewegungsaufwand beim Schwimmen auf 1 Meter Bewegung pro 1 Meter Strecke.\n- Schwierige Oberfl\xE4chen, starke Str\xF6mung, Gefahr, Zeitdruck oder vergleichbare Unsicherheit k\xF6nnen weiterhin einen Athletikcheck verlangen. Erweiterte Bewegung ersetzt einen solchen Check nicht automatisch.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1087,
        endLine: 1099
      }
    },
    {
      id: "stc-6-5",
      number: "6.5",
      title: "6.5 Widerst\xE4nde",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nK\xF6rperwiderstand = 10 + Ausdauer + globaler Erfahrungsbonus\nReflexwiderstand = 10 + Geschicklichkeit + globaler Erfahrungsbonus\nGeistwiderstand = 10 + Verstand + globaler Erfahrungsbonus\nMan\xF6verwiderstand = 10 + globaler Erfahrungsbonus\n                    + max(St\xE4rke + Athletik, Geschicklichkeit + Akrobatik)\n```\n\nK\xF6rper-, Reflex- und Geistwiderstand sind nicht skillgebunden und verwenden den globalen EB. Man\xF6verwiderstand verwendet den globalen EB als Levelkomponente; Athletik bzw. Akrobatik gehen nur als Rangwert ein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1100,
        endLine: 1111
      }
    },
    {
      id: "stc-6-6",
      number: "6.6",
      title: "6.6 Erholung",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nErholung = Ausdauer + globaler Erfahrungsbonus\n```\n\nErholung ist nicht skillgebunden und verwendet den globalen Erfahrungsbonus.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1112,
        endLine: 1119
      }
    },
    {
      id: "stc-6-7",
      number: "6.7",
      title: "6.7 Traglast",
      headingLevel: 3,
      parentId: "stc-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\n```text\nTraglast = 5 + (2 \xD7 St\xE4rke) Lastpunkte\n```\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1120,
        endLine: 1127
      }
    },
    {
      id: "stc-7",
      number: "7",
      title: "7. Konflikt- und Kampfsystem",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1128,
        endLine: 1129
      }
    },
    {
      id: "stc-7-1",
      number: "7.1",
      title: "7.1 Zeitstruktur",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine Kampfrunde entspricht ungef\xE4hr 6 Sekunden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1130,
        endLine: 1133
      }
    },
    {
      id: "stc-7-2",
      number: "7.2",
      title: "7.2 \xDCberraschung",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine \xFCberraschte Figur:\n\n- hat Nachteil auf Initiative,\n- besitzt bis zum Beginn ihres ersten Zuges keine Reaktion.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1134,
        endLine: 1140
      }
    },
    {
      id: "stc-7-3",
      number: "7.3",
      title: "7.3 Zugstruktur",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\nJede Figur besitzt pro Zug:\n\n- 1 Hauptaktion,\n- 1 Bewegung,\n- 1 einfache freie Interaktion,\n- 1 Reaktion pro Runde.\n\nEs gibt keine allgemeine Bonusaktion.\n\nEine Hauptaktion kann f\xFCr eine zweite normale Bewegung verwendet werden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1141,
        endLine: 1153
      }
    },
    {
      id: "stc-7-4",
      number: "7.4",
      title: "7.4 Kernaktionen",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Angreifen:** Einen normalen Angriff oder ein Kampfman\xF6ver ausf\xFChren.\n\n**Sprinten:** Hauptaktion; zus\xE4tzliche volle Bewegung.\n\n**L\xF6sen:** Hauptaktion; eigene Bewegung l\xF6st f\xFCr den Rest des Zuges keine Gelegenheitsangriffe aus.\n\n**Verteidigen:** Hauptaktion; Angriffe gegen die Figur haben bis zum Beginn ihres n\xE4chsten Zuges Nachteil. Eigene aktive Reflexchecks erhalten in diesem Zeitraum Vorteil.\n\n**Helfen:** Qualifizierte Hilfe nach Abschnitt 2.8.\n\n**Bereithalten:** Hauptaktion; Ausl\xF6ser und Handlung festlegen. Die Handlung wird sp\xE4ter als Reaktion ausgef\xFChrt.\n\n**Verstecken:** Hauptaktion; Heimlichkeit nach den normalen Regeln.\n\n**Gelegenheit schaffen:** Hauptaktion f\xFCr eine kreative taktische Handlung im direkten Kampf, die nicht bereits durch eine bestehende Kernaktion oder ein Kampfman\xF6ver abgedeckt ist. Bestehende Aktionen und Man\xF6ver haben immer Vorrang; \u201EGelegenheit schaffen\u201C darf sie nicht umgehen oder mit leichterem Widerstand ersetzen.\n\nVor dem Wurf benennt der GM den Check bzw. Widerstand und welche klar umrissene Folgehandlung bzw. welche Folgechecks von einer geschaffenen Gelegenheit profitieren k\xF6nnen. Fehlt eine plausible taktische Wirkung, findet kein Check statt; reine Flavor-Handlungen erzeugen keinen Bonus.\n\n- Erfolg: Der n\xE4chste passende Folgecheck erh\xE4lt Vorteil.\n- Kritischer Erfolg: Zwei passende Folgechecks erhalten Vorteil.\n- Fehlschlag: Es entsteht keine Gelegenheit.\n- Kritischer Fehlschlag: Die n\xE4chste passende Handlung gegen die handelnde Figur erh\xE4lt Vorteil.\n\nDie Aktion verursacht selbst keinen Schaden, keine erzwungene Bewegung, keinen Aktionsverlust und keinen Zustand. Sie vergibt keine spontanen numerischen Boni oder Abz\xFCge. Im direkten Kampf bleibt Erfolg gegen Preis nach Abschnitt 2.3 untersagt, sofern keine F\xE4higkeit ausdr\xFCcklich etwas anderes erlaubt. Vorteil aus derselben geschaffenen Gelegenheit stapelt nicht mit sich selbst und folgt vollst\xE4ndig den Regeln zu Vorteil und Nachteil (Abschnitt 2.5). F\xE4higkeiten oder Weltmodule d\xFCrfen die Aktion ausdr\xFCcklich erweitern, m\xFCssen ihre Abweichung aber benennen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1154,
        endLine: 1180
      }
    },
    {
      id: "stc-7-5",
      number: "7.5",
      title: "7.5 Gelegenheitsangriffe",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\nVerl\xE4sst eine Figur freiwillig die Nahkampfreichweite eines Gegners, kann dieser seine Reaktion f\xFCr einen Gelegenheitsangriff verwenden.\n\nKein Gelegenheitsangriff durch:\n\n- L\xF6sen,\n- erzwungene Bewegung,\n- Teleportation oder vergleichbare Versetzung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1181,
        endLine: 1190
      }
    },
    {
      id: "stc-7-6",
      number: "7.6",
      title: "7.6 Kampfman\xF6ver",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1191,
        endLine: 1192
      }
    },
    {
      id: "stc-meta-greifen-93",
      number: null,
      title: "Greifen",
      headingLevel: 4,
      parentId: "stc-7-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nNahkampf gegen Man\xF6verwiderstand.\n\n- Erfolg: Ziel ist Gegriffen.\n- Kritischer Erfolg: zus\xE4tzlich darf das Ziel bis zu 1,5 Meter verschoben werden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1193,
        endLine: 1199
      }
    },
    {
      id: "stc-meta-entkommen-94",
      number: null,
      title: "Entkommen",
      headingLevel: 4,
      parentId: "stc-7-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nHauptaktion; Athletik oder Akrobatik gegen den Man\xF6verwiderstand des greifenden Gegners.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1200,
        endLine: 1203
      }
    },
    {
      id: "stc-meta-schubsen-95",
      number: null,
      title: "Schubsen",
      headingLevel: 4,
      parentId: "stc-7-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nNahkampf gegen K\xF6rperwiderstand.\n\n- Erfolg: 1,5 Meter verschieben.\n- Kritischer Erfolg: bis zu 3 Meter verschieben.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1204,
        endLine: 1210
      }
    },
    {
      id: "stc-meta-zu-fall-bringen-96",
      number: null,
      title: "Zu-Fall-Bringen",
      headingLevel: 4,
      parentId: "stc-7-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nNahkampf gegen Reflexwiderstand.\n\nErfolg: Ziel wird Liegend.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1211,
        endLine: 1216
      }
    },
    {
      id: "stc-meta-entwaffnen-97",
      number: null,
      title: "Entwaffnen",
      headingLevel: 4,
      parentId: "stc-7-6",
      normativity: "binding-playtest",
      bodyMarkdown: "\nNahkampf gegen Verteidigung.\n\n- Erfolg: gehaltener Gegenstand f\xE4llt zu Boden.\n- Kritischer Erfolg: angreifende Figur bestimmt eine erreichbare Fallrichtung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1217,
        endLine: 1223
      }
    },
    {
      id: "stc-7-7",
      number: "7.7",
      title: "7.7 Deckung und Sicht",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Teildeckung: Fernkampfangriffe gegen das Ziel haben Nachteil.\n- Volldeckung: Ziel kann nicht direkt anvisiert werden.\n- Unklare Sicht: relevante Angriffe und Sichtchecks haben Nachteil.\n- Angriff aus dem Verborgenen: Vorteil; die angreifende Figur wird danach normalerweise sichtbar.\n- H\xF6henunterschiede geben keinen allgemeinen Zahlenbonus.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1224,
        endLine: 1231
      }
    },
    {
      id: "stc-7-8",
      number: "7.8",
      title: "7.8 Reichweite",
      headingLevel: 3,
      parentId: "stc-7",
      normativity: "binding-playtest",
      bodyMarkdown: "\nWaffen besitzen eine normale und gegebenenfalls eine maximale Reichweite.\n\n- bis normale Reichweite: normaler Check,\n- \xFCber normale bis maximale Reichweite: Nachteil,\n- \xFCber maximale Reichweite: Angriff unm\xF6glich.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1232,
        endLine: 1241
      }
    },
    {
      id: "stc-8",
      number: "8",
      title: "8. Schaden, Heilung und Tod",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1242,
        endLine: 1243
      }
    },
    {
      id: "stc-8-1",
      number: "8.1",
      title: "8.1 Schadensklassen",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nWaffenschaden ist standardm\xE4\xDFig unabh\xE4ngig vom Attribut.\n\n| Klasse | Schaden |\n|---|---:|\n| Unbewaffnet | d4+1 |\n| Leicht | d6+1 |\n| Standard | d8+2 |\n| Schwer | d10+3 |\n| Extrem | d12+4 |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1244,
        endLine: 1255
      }
    },
    {
      id: "stc-8-2",
      number: "8.2",
      title: "8.2 Kritischer Schaden",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBei einem kritischen Treffer werden nur die Schadensw\xFCrfel verdoppelt, nicht feste Boni.\n\nBeispiel:\n\n```text\nd8+2 -> 2d8+2\n```",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1256,
        endLine: 1265
      }
    },
    {
      id: "stc-8-3",
      number: "8.3",
      title: "8.3 Schutz und R\xFCstung",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nR\xFCstung erh\xF6ht nicht die Verteidigung, sondern reduziert erlittenen Schaden.\n\n| Schutz | Mindestst\xE4rke | Typische Kategorie |\n|---:|---:|---|\n| 1 | 1 | leicht |\n| 2 | 2 | mittel |\n| 3 | 4 | schwer |\n\nUnterhalb der Mindestst\xE4rke:\n\n- Bewegung -3 Meter,\n- Nachteil auf Akrobatik,\n- Nachteil auf Heimlichkeit.\n\nEin Schild gibt +1 Verteidigung und belegt eine Hand.\n\nNormale pers\xF6nliche Ausr\xFCstung besitzt h\xF6chstens Schutz 3. Durch F\xE4higkeiten kann gew\xF6hnlicher Gesamtschutz bis 5 steigen. Fahrzeuge und Strukturen k\xF6nnen dar\xFCber liegen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1266,
        endLine: 1285
      }
    },
    {
      id: "stc-8-4",
      number: "8.4",
      title: "8.4 Schadenskennzeichnungen",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nUniverselle Schadenskennzeichnungen:\n\n- Kinetisch\n- Thermisch\n- Elektrisch\n- Chemisch\n- Biologisch\n- Mental\n- Spirituell\n- System\n\nEine Resistenz oder Schw\xE4che muss immer auf klar definierte Kennzeichnungen verweisen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1286,
        endLine: 1300
      }
    },
    {
      id: "stc-8-5",
      number: "8.5",
      title: "8.5 Kampfunf\xE4higkeit und Sterben",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBei 0 Gesundheit ist eine Figur kampfunf\xE4hig.\n\n- Absichtlich nicht t\xF6dlicher Abschluss: stabil bei 0.\n- Sonst: Sterbend 1.\n\nAm Ende jedes eigenen Zuges:\n\n```text\nd20 + Ausdauer + globaler Erfahrungsbonus gegen Zielwert 15\n```\n\nDieser Stabilisierungscheck ist nicht skillgebunden und verwendet den globalen Erfahrungsbonus.\n\n\n| Ergebnis | Wirkung |\n|---|---|\n| Kritischer Erfolg | stabil |\n| Erfolg | Sterbend -1 |\n| Fehlschlag | Sterbend +1 |\n| Kritischer Fehlschlag | Sterbend +2 |\n\n- Sterbend 0: stabil.\n- Sterbend 3: Tod.\n- Schaden bei 0 Gesundheit: Sterbend +1.\n- Kritischer Schaden bei 0: Sterbend +2.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1301,
        endLine: 1328
      }
    },
    {
      id: "stc-8-6",
      number: "8.6",
      title: "8.6 Massiver Schaden",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nErreicht ein einzelner Schadenseffekt mindestens:\n\n```text\naktuelle Gesundheit + maximale Gesundheit\n```\n\ntritt sofortiger Tod ein, sofern eine Weltregel dies nicht ausdr\xFCcklich ersetzt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1329,
        endLine: 1338
      }
    },
    {
      id: "stc-8-7",
      number: "8.7",
      title: "8.7 Erste Hilfe",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\nTrainierte Medizin, Hauptaktion, medizinisches Set, Zielwert 15.\n\n| Ergebnis | Wirkung |\n|---|---|\n| Kritischer Erfolg | stabil und 1 Gesundheit |\n| Erfolg | stabil |\n| Fehlschlag | keine Ver\xE4nderung |\n| Kritischer Fehlschlag | Sterbend +1 |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1339,
        endLine: 1349
      }
    },
    {
      id: "stc-8-8",
      number: "8.8",
      title: "8.8 Erholung",
      headingLevel: 3,
      parentId: "stc-8",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Verschnaufpause:** 10 sichere Minuten; stellt einmal zwischen bedeutenden Konflikten Erholung Gesundheit wieder her.\n\n**Medizinische Versorgung w\xE4hrend der Verschnaufpause:** Medizin Zielwert 15; bei Erfolg werden statt Erholung insgesamt 2 \xD7 Erholung Gesundheit wiederhergestellt. Nicht zus\xE4tzlich.\n\n**Stabile Figur bei 0:** Nach 10 sicheren Minuten erh\xE4lt sie 1 Gesundheit.\n\n**Volle Ruhe:** ungef\xE4hr 8 sichere Stunden; stellt im Standard-H\xE4rtegrad die volle Gesundheit wieder her.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1350,
        endLine: 1361
      }
    },
    {
      id: "stc-9",
      number: "9",
      title: "9. Zust\xE4nde",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1362,
        endLine: 1363
      }
    },
    {
      id: "stc-9-1",
      number: "9.1",
      title: "9.1 Allgemeine Regel",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDerselbe Zustand stapelt normalerweise nicht. Eine erneute Anwendung aktualisiert seine Dauer, sofern die Quelle nichts anderes sagt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1364,
        endLine: 1367
      }
    },
    {
      id: "stc-9-2",
      number: "9.2",
      title: "9.2 Liegend",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Eigene Angriffe haben Nachteil.\n- Nahkampfangriffe aus unmittelbarer N\xE4he gegen die Figur haben Vorteil.\n- Fernere Angriffe gegen die Figur haben Nachteil.\n- Aufstehen kostet die H\xE4lfte der normalen Bewegung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1368,
        endLine: 1374
      }
    },
    {
      id: "stc-9-3",
      number: "9.3",
      title: "9.3 Gegriffen",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Bewegung 0.\n- Entkommen ben\xF6tigt eine Hauptaktion nach Abschnitt 7.6.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1375,
        endLine: 1379
      }
    },
    {
      id: "stc-9-4",
      number: "9.4",
      title: "9.4 Blind",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Sichtabh\xE4ngige Handlungen haben Nachteil.\n- Angriffe gegen die Figur haben Vorteil.\n- Rein sichtabh\xE4ngige Ziele k\xF6nnen unm\xF6glich wahrnehmbar sein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1380,
        endLine: 1385
      }
    },
    {
      id: "stc-9-5",
      number: "9.5",
      title: "9.5 Benommen",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Keine Reaktion.\n- N\xE4chster d20-Wurf vor Ende des n\xE4chsten eigenen Zuges hat Nachteil.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1386,
        endLine: 1390
      }
    },
    {
      id: "stc-9-6",
      number: "9.6",
      title: "9.6 Ver\xE4ngstigt",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Figur kann sich der Quelle nicht freiwillig n\xE4hern.\n- Direkte Handlungen gegen die Quelle haben Nachteil.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1391,
        endLine: 1395
      }
    },
    {
      id: "stc-9-7",
      number: "9.7",
      title: "9.7 Kampfunf\xE4hig",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\nKeine Hauptaktion, Bewegung oder Reaktion.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1396,
        endLine: 1399
      }
    },
    {
      id: "stc-9-8",
      number: "9.8",
      title: "9.8 Bewusstlos",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\nKampfunf\xE4hig, liegend und nimmt die Umgebung nicht bewusst wahr.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1400,
        endLine: 1403
      }
    },
    {
      id: "stc-9-9",
      number: "9.9",
      title: "9.9 Ersch\xF6pfung",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Stufe | Wirkung |\n|---:|---|\n| 1 | Bewegung -3 Meter |\n| 2 | zus\xE4tzlich Nachteil auf k\xF6rperliche Fertigkeitschecks |\n| 3 | zus\xE4tzlich keine Reaktionen und Erholung halbiert |\n\nJede weitere Ersch\xF6pfungsstufe verursacht Schaden in H\xF6he der Erholung, statt eine zus\xE4tzliche Stufe zu erzeugen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1404,
        endLine: 1413
      }
    },
    {
      id: "stc-9-10",
      number: "9.10",
      title: "9.10 Verborgener Zustand",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\nVerborgen ist kein globaler Zustand, sondern gilt immer relativ zu bestimmten Beobachtenden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1414,
        endLine: 1417
      }
    },
    {
      id: "stc-9-11",
      number: "9.11",
      title: "9.11 Technische Zust\xE4nde",
      headingLevel: 3,
      parentId: "stc-9",
      normativity: "binding-playtest",
      bodyMarkdown: "\n**Gest\xF6rt:** Nutzung des betroffenen Ger\xE4ts oder Systems hat Nachteil.\n\n**Deaktiviert:** Das System ist bis zur Behebung nicht nutzbar.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1418,
        endLine: 1425
      }
    },
    {
      id: "stc-10",
      number: "10",
      title: "10. Ausr\xFCstung und Inventar",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1426,
        endLine: 1427
      }
    },
    {
      id: "stc-10-0",
      number: "10.0",
      title: "10.0 Core-Gegenstandskatalog (Inventory v2)",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDer Core-Katalog liefert **36 setting-neutrale mechanische Archetypen** (Waffen, R\xFCstung/Schild, Werkzeuge, Verbrauchsg\xFCter, Container, Misc/Wearables). Sie sind versioniert, read-only und ohne Weltprofil spielbar. Diese 36 bleiben der **mechanische Core**; konkrete Standarditems, World- und Personal-Content erweitern den Katalog **ohne neue Regelwirkung** (keine stillschweigenden Zahlenboni, keine neuen Kernsysteme).\n\n- Ids sind stabile Vertr\xE4ge (`core.weapon.*`, `core.armor.*`, \u2026).\n- Werkzeuge und Verbrauchsg\xFCter verleihen **keine** stillschweigenden Zahlenboni; konkrete Effekte kommen aus Fertigkeit, F\xE4higkeit oder Weltprofil.\n- Container belegen einen Basisslot; Inhalt z\xE4hlt zur Last; Container-in-Container ist in V1 verboten.\n- Quelle: `src/domains/character/inventory-v2/core-catalog.ts` (Inventory v2); erweiterte Definitionen und Taxonomie: `src/domains/items/**` \u2014 siehe `docs/items.md`.\n- Produktvertrag (13 Regeln): `docs/inventory-v2.md`.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1428,
        endLine: 1437
      }
    },
    {
      id: "stc-10-0-1",
      number: "10.0.1",
      title: "10.0.1 Inventory v2 \u2014 Slot-, Stapel-, Last- und Katalogregeln (V1/Core-Playtest)",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\nVerbindlicher V1-/Core-Playtest-Vertrag f\xFCr Inventory v2 (Epic #105 / #114). Ersetzt \xE4ltere Formulierungen, die \u201Ekeine festen Slots\u201C nahelegten. Ausf\xFChrliche Fassung auch in `docs/inventory-v2.md`.\n\n1. **20 Basis-Inventarpl\xE4tze** sind der V1/Core-Playtestwert.\n2. **1 Stapel = 1 Platz.** `stackLimit` steuert die Menge pro Stapel, nicht die Platzanzahl.\n3. **St\xE4rke \xE4ndert nur die Traglast:** `Traglast = 5 + 2 \xD7 St\xE4rke`. St\xE4rke vergibt **keine zus\xE4tzlichen Inventarpl\xE4tze**.\n4. **Ausger\xFCstete Gegenst\xE4nde** belegen Ausr\xFCstungsslots, **keine** Basis-Inventarpl\xE4tze.\n5. **Ausr\xFCstungsslots:** Kopf, K\xF6rper, 2\xD7 Accessoire, Haupt-/Nebenhand, Spezial, F\xFC\xDFe.\n6. **Zweih\xE4ndig** belegt Haupt- und Nebenhand gleichzeitig (eine Instanz, zwei Handreferenzen).\n7. **Vier Schnellzugriffe (Quickslots)** sind Referenzen auf vorhandene Instanzen \u2014 kein Extra-Speicher.\n8. **Container:** Der Container selbst belegt **einen Basisplatz**; Inhalt nutzt die Container-Kapazit\xE4t und tr\xE4gt weiter zur Last bei. **Keine verschachtelten Container** in V1.\n9. **Definitionsscopes:** Core \xB7 Standard (Builtin-Packs) \xB7 World (effektives Weltprofil + `item-catalog`) \xB7 Personal (Eigen). Definitionen stammen aus Item-Domain / World Catalog; Instanzen bleiben Character-owned. Der effektive Add-Katalog folgt der effektiven Welt des Charakters.\n10. Der **Charakter-Editor** vergibt/entfernt besessene Inventarinstanzen; er ist **kein Shop** und verbraucht **nicht** den abstrakten Ressourcenwert 0\u20135 (\xA710.3).\n11. **\u201EAus Inventar entfernen\u201C** entfernt Besitz vom Charakter und erzeugt **kein** Boden-Loot / World-Drop.\n12. Der **volle Core-Katalog** (#108) mit **36 Definitionen** ist der universelle V1-Katalog (siehe \xA710.0); Standard/World/Personal erweitern Content ohne neue Regelwirkung.\n13. **Legacy-Migration / Overflow** aus alten `ItemDto[]`-Daten ist **Kompatibilit\xE4tsverhalten**, keine normale Core-Erschaffungsregel.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1438,
        endLine: 1455
      }
    },
    {
      id: "stc-10-1",
      number: "10.1",
      title: "10.1 Waffenmerkmale",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\nUniverselle Merkmale:\n\n- Finesse\n- Reichweite\n- Wurf\n- Zweih\xE4ndig\n- Durchdringung X\n- Laden\n- Nichtt\xF6dlich\n- Verbergbar\n- Fl\xE4che\n- Laut\n- Schwer\n\n**Finesse:** Geschicklichkeit darf St\xE4rke bei Nahkampfangriffen ersetzen.\n\n**Durchdringung X:** Ignoriert X Punkte Schutz.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1456,
        endLine: 1475
      }
    },
    {
      id: "stc-10-2",
      number: "10.2",
      title: "10.2 Lastpunkte",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\nGegenst\xE4nde besitzen normalerweise 0 bis 3 Lastpunkte.\n\n```text\nTraglast = 5 + (2 \xD7 St\xE4rke)\n```\n\n\xDCber Traglast:\n\n- Bewegung -3 Meter,\n- Nachteil auf Athletik und Akrobatik.\n\n\xDCber dem Doppelten der Traglast ist normale l\xE4ngere Bewegung nicht m\xF6glich.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1476,
        endLine: 1490
      }
    },
    {
      id: "stc-10-3",
      number: "10.3",
      title: "10.3 Ressourcenmodell",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\nStandardm\xE4\xDFig verwendet SagaTree einen abstrakten Ressourcenwert von 0 bis 5.\n\n| Wert | Bedeutung |\n|---:|---|\n| 0 | mittellos |\n| 1 | knapp |\n| 2 | stabil |\n| 3 | komfortabel |\n| 4 | wohlhabend |\n| 5 | institutionelle Ressourcen |\n\nGegenst\xE4nde besitzen ebenfalls Kostenwerte 0 bis 5.\n\n- Kosten mindestens 2 unter Ressourcenwert: routinem\xE4\xDFig verf\xFCgbar.\n- Kosten 1 unter Ressourcenwert: normalerweise bezahlbar.\n- Kosten gleich Ressourcenwert: bezahlbar, danach Ressourcenwert vor\xFCbergehend -1.\n- Kosten \xFCber Ressourcenwert: ben\xF6tigt Kontakt, Kredit, Beute, Projekt oder andere ausdr\xFCckliche Quelle.\n\nEin Weltprofil darf das abstrakte Modell vollst\xE4ndig durch konkrete W\xE4hrung ersetzen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1491,
        endLine: 1512
      }
    },
    {
      id: "stc-10-4",
      number: "10.4",
      title: "10.4 Fahrzeuge und Gr\xF6\xDFenma\xDFstab",
      headingLevel: 3,
      parentId: "stc-10",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Ma\xDFstab | Beispiel |\n|---:|---|\n| 0 | Person |\n| 1 | Fahrzeug oder schwere Maschine |\n| 2 | Struktur |\n| 3 | kolossales Objekt |\n\nGegen ein Ziel eine Ma\xDFstabsstufe gr\xF6\xDFer wird Schaden nach Schutz halbiert, wenn keine Durchdringung, Anti-Fahrzeug-Wirkung oder definierte Schwachstelle verwendet wird.\n\nBei zwei oder mehr Ma\xDFstabsstufen Unterschied ist regul\xE4rer struktureller Schaden normalerweise unm\xF6glich.\n\nFahrzeuge besitzen mindestens:\n\n- Struktur,\n- Verteidigung,\n- Schutz,\n- Geschwindigkeit,\n- Handling,\n- Crew,\n- Ma\xDFstab,\n- Merkmale.\n\nGef\xE4hrliche Fahrman\xF6ver verwenden Fortbewegungsmittel.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1513,
        endLine: 1540
      }
    },
    {
      id: "stc-11",
      number: "11",
      title: "11. F\xE4higkeiten und Archetypen",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1541,
        endLine: 1542
      }
    },
    {
      id: "stc-11-1",
      number: "11.1",
      title: "11.1 F\xE4higkeitsformat",
      headingLevel: 3,
      parentId: "stc-11",
      normativity: "binding-playtest",
      bodyMarkdown: "\nJede F\xE4higkeit definiert:\n\n- Name,\n- Quelle,\n- Rang von Novize bis Legende,\n- Voraussetzungen,\n- Aktivierungsart,\n- Ausl\xF6ser,\n- Ziel,\n- Reichweite,\n- Effekt,\n- Dauer,\n- Ressource oder Nutzungsbegrenzung,\n- Wirkungskennzeichnungen,\n- Skalierung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1543,
        endLine: 1560
      }
    },
    {
      id: "stc-11-2",
      number: "11.2",
      title: "11.2 F\xE4higkeitsr\xE4nge",
      headingLevel: 3,
      parentId: "stc-11",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDie F\xE4higkeitsr\xE4nge verwenden dieselben Namen und Stufengrenzen wie die Charakterr\xE4nge.\n\n| Rang | Fr\xFCheste Stufe |\n|---|---:|\n| Novize | 1 |\n| Spezialist | 5 |\n| Experte | 9 |\n| Meister | 13 |\n| Legende | 17 |\n\nEine Figur kann keine F\xE4higkeit w\xE4hlen, deren Rang \xFCber ihrem aktuellen Charakterrang liegt. Der Wechsel in einen h\xF6heren Charakterrang schaltet den entsprechenden F\xE4higkeitsrang frei, vergibt aber nicht automatisch eine F\xE4higkeit dieses Rangs.\n\nZus\xE4tzliche Investitionsanforderungen:\n\n- Experte: mindestens 2 niedrigere F\xE4higkeiten derselben Quelle.\n- Meister: mindestens 3 niedrigere F\xE4higkeiten derselben Quelle.\n- Legende: mindestens 4 niedrigere F\xE4higkeiten derselben Quelle.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1561,
        endLine: 1580
      }
    },
    {
      id: "stc-11-3",
      number: "11.3",
      title: "11.3 Kernf\xE4higkeiten der Archetypen",
      headingLevel: 3,
      parentId: "stc-11",
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1581,
        endLine: 1582
      }
    },
    {
      id: "stc-meta-kampfer-kampfroutine-132",
      number: null,
      title: "K\xE4mpfer \u2013 Kampfroutine",
      headingLevel: 4,
      parentId: "stc-11-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEinmal pro Zug nach einem erfolgreichen Angriff oder Kampfman\xF6ver:\n\n- +2 Schaden oder\n- 1,5 Meter Bewegung ohne Gelegenheitsangriff.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1583,
        endLine: 1589
      }
    },
    {
      id: "stc-meta-denker-analyse-133",
      number: null,
      title: "Denker \u2013 Analyse",
      headingLevel: 4,
      parentId: "stc-11-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nHauptaktion; Ermitteln gegen passenden Zielwert oder Widerstand.\n\n- Erfolg: Eine relevante mechanische Eigenschaft des Ziels oder Problems wird aufgedeckt; der n\xE4chste passende Check eines Verb\xFCndeten erh\xE4lt Vorteil.\n- Kritischer Erfolg: zus\xE4tzlich +1 Momentum, h\xF6chstens einmal pro Runde durch diese F\xE4higkeit.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1590,
        endLine: 1596
      }
    },
    {
      id: "stc-meta-heiler-feldversorgung-134",
      number: null,
      title: "Heiler \u2013 Feldversorgung",
      headingLevel: 4,
      parentId: "stc-11-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nMedizinisches Set, Hauptaktion, Medizin Zielwert 15.\n\n- Erfolg: Ziel heilt Erholung.\n- Kritischer Erfolg: Ziel heilt 2 \xD7 Erholung.\n- Dasselbe Ziel kann diese F\xE4higkeit h\xF6chstens einmal pro Szene erhalten.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1597,
        endLine: 1604
      }
    },
    {
      id: "stc-meta-rebell-improvisation-135",
      number: null,
      title: "Rebell \u2013 Improvisation",
      headingLevel: 4,
      parentId: "stc-11-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEinmal pro Zug darf eine Nachteilsquelle ignoriert werden, wenn sie ausschlie\xDFlich aus improvisierter Ausr\xFCstung, ung\xFCnstiger k\xF6rperlicher Position oder unvollst\xE4ndigem Werkzeug stammt.\n\nNicht anwendbar auf Verletzungen, gegnerische Kr\xE4fte, Magie oder vergleichbare externe Effekte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1605,
        endLine: 1610
      }
    },
    {
      id: "stc-meta-diplomat-koordination-136",
      number: null,
      title: "Diplomat \u2013 Koordination",
      headingLevel: 4,
      parentId: "stc-11-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDie Figur kann Helfen innerhalb sinnvoller Kommunikationsreichweite einsetzen. F\xFChrt eine unterst\xFCtzte Handlung zu einem kritischen Erfolg, entsteht +1 Momentum, h\xF6chstens einmal pro Runde durch diese F\xE4higkeit.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1611,
        endLine: 1614
      }
    },
    {
      id: "stc-11-4",
      number: "11.4",
      title: "11.4 Gef\xFChrte Archetyp-Essenz-Kombinationen",
      headingLevel: 3,
      parentId: "stc-11",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Archetyp | K\xF6rperlich | Mental | Spirituell | Gebunden | Technologisch |\n|---|---|---|---|---|---|\n| K\xE4mpfer | \xFCbermenschlicher Krieger | psionischer Duellant | heiliger W\xE4chter | Paktchampion | Kampfanzug-/Waffenspezialist |\n| Denker | biologischer Taktiker | Psion/Analyst | Seher | okkulter Forscher | Ingenieur/Hacker |\n| Heiler | Feldmediziner/Biomant | mentaler Heiler | Priester/Schamane | Lebensbinder | Cybermediziner |\n| Rebell | Akrobat/Mutant | Illusionist/Infiltrator | Trickster | gebundener Au\xDFenseiter | Saboteur/Hacker |\n| Diplomat | charismatischer Feldf\xFChrer | Telepath | spiritueller Sprecher | Gesandter | Netzwerk-/Informationsf\xFChrer |\n\nDiese Profile geben keine zus\xE4tzlichen Regeln. Sie zeigen nur m\xF6gliche Interpretationen bestehender F\xE4higkeiten.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1615,
        endLine: 1628
      }
    },
    {
      id: "stc-12",
      number: "12",
      title: "12. Kr\xE4fte, Magie und Technologie",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1629,
        endLine: 1630
      }
    },
    {
      id: "stc-12-1",
      number: "12.1",
      title: "12.1 Einheitliches Kraftmodell",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nSagaTree verwendet kein universelles Mana- oder Zauberslot-System.\n\nEine besondere Kraft ist eine F\xE4higkeit mit mindestens:\n\n- Essenz,\n- Rang,\n- Effekt,\n- Reichweite,\n- Dauer,\n- Widerstand,\n- Begrenzung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1631,
        endLine: 1644
      }
    },
    {
      id: "stc-12-2",
      number: "12.2",
      title: "12.2 Aktivierungscheck",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nWenn eine Kraft einen Aktivierungscheck verlangt:\n\n```text\nd20 + festgelegtes Attribut + globaler Erfahrungsbonus + ausdr\xFCckliche Modifikatoren\n```\n\nEine erschlossene Essenz z\xE4hlt f\xFCr diesen Aktivierungscheck als Training und berechtigt zur Nutzung des **globalen** Erfahrungsbonus (keine Fertigkeitsbindung). Es gibt keine eigene Essenz-Fertigkeit.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1645,
        endLine: 1654
      }
    },
    {
      id: "stc-12-3",
      number: "12.3",
      title: "12.3 Begrenzungsmodelle",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nM\xF6gliche Begrenzungen:\n\n- einmal pro Szene,\n- Ladungen,\n- Munition,\n- Komponenten,\n- Ersch\xF6pfung,\n- Vorbereitung,\n- Aufrechterhaltung,\n- externe Quelle,\n- Ritual.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1655,
        endLine: 1668
      }
    },
    {
      id: "stc-12-4",
      number: "12.4",
      title: "12.4 Aufrechterhaltung",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine Figur kann standardm\xE4\xDFig nur einen besonderen aufrechterhaltenen Effekt gleichzeitig halten. Beginnt sie einen zweiten, endet der erste, sofern eine F\xE4higkeit nichts anderes erlaubt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1669,
        endLine: 1672
      }
    },
    {
      id: "stc-12-5",
      number: "12.5",
      title: "12.5 Gegenwirkung",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine direkte Gegenwirkung verwendet einen vergleichenden Kraftcheck. Bei vollst\xE4ndigem Gleichstand bleibt der bestehende Effekt bestehen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1673,
        endLine: 1676
      }
    },
    {
      id: "stc-12-6",
      number: "12.6",
      title: "12.6 Wirkungsbudget nach Rang",
      headingLevel: 3,
      parentId: "stc-12",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDie folgenden Werte sind Designrichtlinien, keine automatische Schadensformel.\n\n| Rang | Richtwert |\n|---|---|\n| Novize | ein Ziel, kurze Wirkung, ungef\xE4hr d6+2 Schaden oder vergleichbarer Effekt |\n| Spezialist | mehrere Ziele oder ungef\xE4hr 2d6+2 |\n| Experte | kleine Fl\xE4che, starke Kontrolle oder ungef\xE4hr 3d6+3 |\n| Meister | gro\xDFer taktischer Effekt oder ungef\xE4hr 4d6+4 |\n| Legende | szenenpr\xE4gender Effekt oder ungef\xE4hr 5d6+5 |\n\nMehr Ziele, Fl\xE4che, Reichweite, Dauer und Kontrolle verbrauchen dasselbe Wirkungsbudget. Eine Kraft soll nicht alle Dimensionen gleichzeitig maximieren.\n\nDauerhaft weltver\xE4ndernde Effekte werden als Projekt, Ritual oder Abenteuerziel behandelt.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1677,
        endLine: 1694
      }
    },
    {
      id: "stc-13",
      number: "13",
      title: "13. Vollst\xE4ndiger Stufenaufstieg",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Stufe | Entwicklung |\n|---:|---|\n| 1 | Rang Novize, EB +1, Fertigkeitslimit 3, Prim\xE4rarchetyp + Kernf\xE4higkeit, prim\xE4re Essenz + erste Manifestation |\n| 2 | freie F\xE4higkeit |\n| 3 | Fertigkeitsentwicklung |\n| 4 | freie F\xE4higkeit |\n| 5 | Rang Spezialist, EB +2, Fertigkeitslimit 4, Fertigkeitsentwicklung, F\xE4higkeiten des Rangs Spezialist verf\xFCgbar |\n| 6 | freie F\xE4higkeit, zweiter Archetyp m\xF6glich |\n| 7 | Fertigkeitsentwicklung |\n| 8 | Attribut +1, freie F\xE4higkeit |\n| 9 | Rang Experte, EB +3, Fertigkeitsentwicklung, F\xE4higkeiten des Rangs Experte verf\xFCgbar |\n| 10 | freie F\xE4higkeit, sekund\xE4re Essenz m\xF6glich |\n| 11 | Fertigkeitsentwicklung |\n| 12 | freie F\xE4higkeit, dritter Archetyp m\xF6glich |\n| 13 | Rang Meister, EB +4, Fertigkeitslimit 5, Fertigkeitsentwicklung, F\xE4higkeiten des Rangs Meister verf\xFCgbar |\n| 14 | freie F\xE4higkeit |\n| 15 | Fertigkeitsentwicklung |\n| 16 | Attribut +1, freie F\xE4higkeit |\n| 17 | Rang Legende, EB +5, Fertigkeitsentwicklung, F\xE4higkeiten des Rangs Legende verf\xFCgbar |\n| 18 | freie F\xE4higkeit, vierter Archetyp m\xF6glich |\n| 19 | Fertigkeitsentwicklung |\n| 20 | freie F\xE4higkeit oder legend\xE4re Abschlussf\xE4higkeit |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1695,
        endLine: 1719
      }
    },
    {
      id: "stc-13-1",
      number: "13.1",
      title: "13.1 Sekund\xE4re Essenz",
      headingLevel: 3,
      parentId: "stc-13",
      normativity: "binding-playtest",
      bodyMarkdown: "\nFr\xFChestens Stufe 10.\n\nVoraussetzungen:\n\n- erz\xE4hlerischer oder weltbezogener Zugang,\n- mindestens eine F\xE4higkeit des Rangs Spezialist, die die prim\xE4re Essenz tats\xE4chlich verwendet.\n\nDas Erschlie\xDFen verbraucht eine freie F\xE4higkeitswahl und enth\xE4lt eine Manifestation des Rangs Novize der neuen Essenz.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1720,
        endLine: 1730
      }
    },
    {
      id: "stc-13-2",
      number: "13.2",
      title: "13.2 Aufstiegsmodell",
      headingLevel: 3,
      parentId: "stc-13",
      normativity: "binding-playtest",
      bodyMarkdown: "\nStandard: Meilensteinaufstieg.\n\nOptionales Entwicklungsmodell:\n\n```text\n4 Entwicklungspunkte = 1 Stufe\n```\n\nRichtwerte:\n\n- Teilziel: 1 Punkt,\n- bedeutendes Ziel: 2 Punkte,\n- au\xDFergew\xF6hnlicher Kampagnenmeilenstein: bis 4 Punkte.\n\nEntwicklungspunkte werden nicht nach get\xF6teten Gegnern vergeben.\n\nNeue Figuren steigen auf der aktuellen Gruppenstufe ein und erhalten alle regul\xE4ren Entwicklungen bis einschlie\xDFlich dieser Stufe. Es gibt keine Aufholstrafe.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1731,
        endLine: 1750
      }
    },
    {
      id: "stc-13-3",
      number: "13.3",
      title: "13.3 H\xF6herstufige Charaktererschaffung",
      headingLevel: 3,
      parentId: "stc-13",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin neuer Charakter darf direkt auf jeder regul\xE4ren Charakterstufe von 1 bis 20 erstellt werden. Stufe 1 ist der Standard, aber keine Pflicht.\n\nEin h\xF6herstufiger Charakter wird regeltechnisch immer aus der vollst\xE4ndigen Stufe-1-Basis plus allen Entwicklungen der Stufen 2 bis zur gew\xE4hlten Zielstufe aufgebaut. Er erh\xE4lt deshalb nicht nur den Bonus seiner Zielstufe, sondern s\xE4mtliche bis dahin vorgesehenen Fertigkeitsentwicklungen, freien F\xE4higkeiten und Attributssteigerungen.\n\nAutomatisch aus der Zielstufe folgen:\n\n- Charakterrang,\n- Erfahrungsbonus,\n- Fertigkeitslimit,\n- maximal verf\xFCgbarer F\xE4higkeitsrang,\n- alle davon abh\xE4ngigen abgeleiteten Werte.\n\nDie spielende Person entscheidet weiterhin selbst:\n\n- welche Fertigkeiten mit erhaltenen Fertigkeitsentwicklungen ver\xE4ndert werden,\n- welche F\xE4higkeiten gew\xE4hlt werden,\n- welches Attribut auf Stufe 8 oder 16 erh\xF6ht wird,\n- ob und wann ein weiterer Archetyp erschlossen wird,\n- ob und wann eine sekund\xE4re Essenz erschlossen wird.\n\nAlle Voraussetzungen m\xFCssen so erf\xFCllbar sein, dass eine legale chronologische Entwicklung von Stufe 1 bis zur Zielstufe existiert. Ein direkt erstellter Stufe-14-Charakter darf beispielsweise keine Meister-F\xE4higkeit besitzen, wenn die daf\xFCr n\xF6tigen niedrigeren Investitionen bis dahin nicht legal erreicht werden konnten.\n\nF\xFCr die Nachvollziehbarkeit wird die Herkunft jeder Entwicklung dokumentiert. Analog gen\xFCgt eine kurze Zuordnung zu Stufe und Quelle; digital kann SagaTree daraus ein Progressionsprotokoll f\xFChren. Ein digitaler Editor darf die noch offenen Entwicklungen eines h\xF6herstufigen Charakters geb\xFCndelt anzeigen, muss die chronologischen Voraussetzungen aber weiterhin vollst\xE4ndig pr\xFCfen.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1751,
        endLine: 1778
      }
    },
    {
      id: "stc-14",
      number: "14",
      title: "14. Nicht k\xE4mpferische Spielsituationen",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1779,
        endLine: 1780
      }
    },
    {
      id: "stc-14-1",
      number: "14.1",
      title: "14.1 Erkundung",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin bedeutender Erkundungsabschnitt entspricht ungef\xE4hr 10 Minuten.\n\nM\xF6gliche Rollen:\n\n- Sp\xE4her,\n- Navigator,\n- Suchender,\n- Sicherung,\n- Unterst\xFCtzung.\n\nEs wird nur gew\xFCrfelt, wenn tats\xE4chliche Unsicherheit und relevante Konsequenzen bestehen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1781,
        endLine: 1794
      }
    },
    {
      id: "stc-14-2",
      number: "14.2",
      title: "14.2 Reisen",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nReisen werden in sinnvolle Abschnitte von Stunden, halben Tagen oder Tagen unterteilt.\n\nFehlschl\xE4ge ver\xE4ndern die Situation durch beispielsweise:\n\n- Zeitverlust,\n- Ressourcenverbrauch,\n- ung\xFCnstige Position,\n- Entdeckung,\n- Umweltfolge.\n\nEin Fehlschlag erzeugt nicht blo\xDF denselben Wurf erneut.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1795,
        endLine: 1808
      }
    },
    {
      id: "stc-14-3",
      number: "14.3",
      title: "14.3 Recherche",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nL\xE4ngere Recherche verwendet Gemeinschaftsprojekte.\n\nEine zwingend notwendige Information wird nicht hinter einem einzelnen Wurf verborgen. Checks bestimmen Geschwindigkeit, Tiefe, Risiko, Kosten und zus\xE4tzliche Erkenntnisse.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1809,
        endLine: 1814
      }
    },
    {
      id: "stc-14-4",
      number: "14.4",
      title: "14.4 Soziale Haltung",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| Haltung | Bedeutung |\n|---|---|\n| Feindselig | aktiv gegen die Figur |\n| Reserviert | misstrauisch oder abweisend |\n| Neutral | keine klare Tendenz |\n| Offen | grunds\xE4tzlich zug\xE4nglich |\n| Unterst\xFCtzend | aktiv hilfsbereit |\n\nGrundschwierigkeiten f\xFCr Bitten:\n\n| Bitte | Zielwert |\n|---|---:|\n| gering | 10 |\n| bedeutend | 15 |\n| riskant | 20 |\n| sehr belastend | 25 |\n| fundamentaler Widerspruch zum Eigeninteresse | unm\xF6glich ohne ver\xE4nderte Umst\xE4nde |\n\nEine Haltungsstufe verschiebt die Schwierigkeit um eine Kategorie der Tabelle, nicht durch einen freien Zahlenmodifikator.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1815,
        endLine: 1836
      }
    },
    {
      id: "stc-14-5",
      number: "14.5",
      title: "14.5 L\xE4ngerer sozialer Konflikt",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nFortschrittsziel:\n\n- normal: 3,\n- gro\xDF: 5.\n\n| Ergebnis | Fortschritt |\n|---|---:|\n| Kritischer Erfolg | +2 |\n| Erfolg | +1 |\n| Fehlschlag | +0 und Konsequenz |\n| Kritischer Fehlschlag | -1, mindestens 0, plus Komplikation |\n\nSagaTree verwendet keine sozialen Trefferpunkte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1837,
        endLine: 1852
      }
    },
    {
      id: "stc-14-6",
      number: "14.6",
      title: "14.6 Gefahren",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nGefahren verwenden einen passenden Widerstand oder eine passende Fertigkeit gegen einen Zielwert.\n\n| Ergebnis | Standardwirkung |\n|---|---|\n| Kritischer Erfolg | kein Schaden |\n| Erfolg | halber Schaden |\n| Fehlschlag | voller Schaden |\n| Kritischer Fehlschlag | doppelter Schaden oder voller Schaden plus ausdr\xFCcklich definierte schwere Folge |\n\nRichtwerte:\n\n| Gefahr | Schaden |\n|---|---:|\n| gering | d6+1 |\n| gef\xE4hrlich | 2d6+2 |\n| schwer | 3d6+3 |\n| katastrophal | 4d6+4 oder mehr |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1853,
        endLine: 1872
      }
    },
    {
      id: "stc-14-7",
      number: "14.7",
      title: "14.7 Ausfallzeit",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine Ausfallzeitperiode kann verwendet werden f\xFCr:\n\n- Herstellung,\n- Reparatur,\n- Recherche,\n- Training,\n- Einkommen,\n- Kontaktpflege,\n- Behandlung,\n- soziale Projekte.\n\nGr\xF6\xDFere Herstellung und Reparatur verwenden Gemeinschaftsprojekte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1873,
        endLine: 1887
      }
    },
    {
      id: "stc-14-8",
      number: "14.8",
      title: "14.8 Kontakte",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nEin Kontakt besitzt:\n\n- Fachgebiet,\n- Reichweite,\n- Zuverl\xE4ssigkeit 1 bis 3.\n\nKontakte geben Zugang, Information oder Ressourcen, aber keinen allgemeinen W\xFCrfelbonus.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1888,
        endLine: 1897
      }
    },
    {
      id: "stc-14-9",
      number: "14.9",
      title: "14.9 Ruf",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nRuf wird je Fraktion gef\xFChrt.\n\n| Wert | Bedeutung |\n|---:|---|\n| -2 | feindselig |\n| -1 | misstrauisch |\n| 0 | neutral |\n| +1 | bekannt |\n| +2 | vertraut |\n\nRuf ver\xE4ndert Zugang und Haltung, nicht automatisch W\xFCrfelwerte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1898,
        endLine: 1911
      }
    },
    {
      id: "stc-14-10",
      number: "14.10",
      title: "14.10 Verfolgungsjagden",
      headingLevel: 3,
      parentId: "stc-14",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDistanzleiste:\n\n```text\n0 = eingeholt\n5 = entkommen\nStart = 2\n```\n\nJede Runde w\xE4hlen beide Seiten eine plausible Fertigkeit oder Fahrhandlung und f\xFChren einen vergleichenden Check aus.\n\n- Sieg: Distanz 1 in Richtung der siegenden Seite.\n- Kritischer Erfolg gegen Fehlschlag oder schlechter: Distanz 2.\n- Gleichstand: keine Ver\xE4nderung.\n\nDie Struktur gilt f\xFCr Verfolgungen zu Fu\xDF, mit Tieren, Fahrzeugen, Schiffen oder vergleichbaren Mitteln.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1912,
        endLine: 1931
      }
    },
    {
      id: "stc-15",
      number: "15",
      title: "15. Gegner- und Spielleitungsregeln",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "\nKompakte NPC-/Kreaturen-Statblocks nutzen dieselben Kernregeln wie Charaktere (Attribute, Skills, Proben, Verteidigung, Widerst\xE4nde, Zust\xE4nde, Schadensklassen, Kampfaktionen). Es gibt kein zweites Kampfsystem. Vollst\xE4ndige Charaktere erhalten keine intrinsischen Standard-/Elite-/Boss-Modifikatoren.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1932,
        endLine: 1935
      }
    },
    {
      id: "stc-15-1",
      number: "15.1",
      title: "15.1 Stufe und Machtgrad",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nStufe bleibt 1\u201320 und ist der mechanische Leistungsanker. F\xFCr NPCs und Kreaturen wird daraus der **Machtgrad** nur zur Anzeige abgeleitet:\n\n| Machtgrad | Stufen |\n|---|---:|\n| Gering | 1\u20134 |\n| Mittel | 5\u20138 |\n| Hoch | 9\u201312 |\n| Extrem | 13\u201316 |\n| Legend\xE4r | 17\u201320 |\n\nDie \xE4lteren Begegnungsrang-Namen Novize/Spezialist/Experte/Meister/Legende bleiben als synonyme Bandbezeichnung f\xFCr dieselben Stufenbereiche zul\xE4ssig.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1936,
        endLine: 1949
      }
    },
    {
      id: "stc-15-2",
      number: "15.2",
      title: "15.2 Standard-Benchmarks (Ausgewogen)",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nVerbindliche Playtestwerte f\xFCr **Standard + Ausgewogen**. Formeln:\n\n- Prim\xE4rmodifikator = `6 + floor((Stufe \u2212 1) / 2)`\n- Verteidigung = `14 + floor((Stufe \u2212 1) / 2)`\n- Gesundheit = `18 + 2 \xD7 floor((Stufe \u2212 1) / 4)`\n\n| Stufe | Machtgrad | EB | Prim\xE4rskill | Prim\xE4rmod. | DEF | Widerst\xE4nde H/N/T | HP | Basis-Schaden |\n|---:|---|---:|---:|---:|---:|---|---:|---|\n| 1\u20132 | Gering | +1 | 2 | +6 | 14 | 14/13/11 | 18 | d6+1 |\n| 3\u20134 | Gering | +1 | 3 | +7 | 15 | 14/13/11 | 18 | d6+1 |\n| 5\u20136 | Mittel | +2 | 3 | +8 | 16 | 15/14/12 | 20 | d8+1 |\n| 7\u20138 | Mittel | +2 | 4 | +9 | 17 | 15/14/12 | 20 | d8+1 |\n| 9\u201310 | Hoch | +3 | 3 | +10 | 18 | 17/16/13 | 22 | d8+2 |\n| 11\u201312 | Hoch | +3 | 4 | +11 | 19 | 17/16/13 | 22 | d8+2 |\n| 13\u201314 | Extrem | +4 | 4 | +12 | 20 | 18/17/14 | 24 | d10+2 |\n| 15\u201316 | Extrem | +4 | 5 | +13 | 21 | 18/17/14 | 24 | d10+2 |\n| 17\u201318 | Legend\xE4r | +5 | 4 | +14 | 22 | 20/19/15 | 26 | d10+3 |\n| 19\u201320 | Legend\xE4r | +5 | 5 | +15 | 23 | 20/19/15 | 26 | d10+3 |\n\nH/N/T = Hoch / Normal / Tief (K\xF6rper / Reflex / Geist nach Konzept zuweisen).\n\nAttribut-Defaults nach Machtgrad (nur Generator, kein zweites Point-Buy):\n\n| Machtgrad | Defaults |\n|---|---|\n| Gering | +3,+2,+2,+1,+1,+0 |\n| Mittel | +3,+3,+2,+2,+1,+0 |\n| Hoch | +4,+3,+3,+2,+1,+0 |\n| Extrem | +4,+4,+3,+2,+1,+0 |\n| Legend\xE4r | +5,+4,+3,+2,+1,+0 |\n\nSchadensleiter (Schritte \xB11 clampen an den Enden): `d4+1`, `d6+1`, `d8+1`, `d8+2`, `d10+2`, `d10+3`, `d12+3`, `d12+4`.\n\nDiese Werte m\xFCssen in Abschnitt 19 empirisch validiert werden.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1950,
        endLine: 1986
      }
    },
    {
      id: "stc-15-3",
      number: "15.3",
      title: "15.3 Kampfprofile",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBerechnungsreihenfolge: Stufen-Benchmark \u2192 Konzept \u2192 Profil \u2192 Kampfrolle \u2192 explizite Ausr\xFCstung/F\xE4higkeiten.\n\nProfile d\xFCrfen keine versteckten Modifikatoren jenseits der Skill-/Attributcaps erzeugen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1987,
        endLine: 1992
      }
    },
    {
      id: "stc-meta-nichtkampferisch-164",
      number: null,
      title: "Nichtk\xE4mpferisch",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Prim\xE4rbenchmark geh\xF6rt zur gew\xE4hlten Nichtkampf-Spezialit\xE4t.\n- Kampfangriffe nutzen einen sekund\xE4ren / untrainierten Skill.\n- Direkter Schaden standardm\xE4\xDFig `d4+1` oder Ausr\xFCstung.\n- Verteidigung \u22121.\n- Keine Kampf-Signaturf\xE4higkeit erforderlich.\n- Erh\xE4lt keinen Stufe-gleichen automatischen Kampfprim\xE4rwert.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 1993,
        endLine: 2001
      }
    },
    {
      id: "stc-meta-ausgewogen-165",
      number: null,
      title: "Ausgewogen",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\nKeine Verschiebungen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2002,
        endLine: 2005
      }
    },
    {
      id: "stc-meta-zah-166",
      number: null,
      title: "Z\xE4h",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- HP \xD71,20 vor Rollenmultiplikator.\n- K\xF6rper oder ein Haltbarkeitswiderstand +1.\n- Bewegung \u22123 m.\n- Prim\xE4rschaden \u22121 Schritt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2006,
        endLine: 2012
      }
    },
    {
      id: "stc-meta-offensiv-167",
      number: null,
      title: "Offensiv",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Prim\xE4rer Kampfangriff/Effekt +1.\n- Prim\xE4rschaden +1 Schritt.\n- Verteidigung \u22121.\n- Schw\xE4chster Widerstand \u22121.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2013,
        endLine: 2019
      }
    },
    {
      id: "stc-meta-mobil-168",
      number: null,
      title: "Mobil",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Verteidigung +1.\n- Reflex +1.\n- Bewegung +3 m.\n- HP \xD70,80 vor Rollenmultiplikator.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2020,
        endLine: 2026
      }
    },
    {
      id: "stc-meta-fernkampf-169",
      number: null,
      title: "Fernkampf",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Prim\xE4rer Fernkampfangriff +1.\n- Bewegung +3 m.\n- Nahkampfangriff \u22121.\n- HP \xD70,80 vor Rollenmultiplikator.\n- Mindestens eine Fernkampf-Prim\xE4raktion erforderlich.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2027,
        endLine: 2034
      }
    },
    {
      id: "stc-meta-kontrolle-support-170",
      number: null,
      title: "Kontrolle & Support",
      headingLevel: 4,
      parentId: "stc-15-3",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Gew\xE4hlter Kontroll-/Support-Effekt +1.\n- Geist oder ein Kontrollwiderstand +1.\n- Direktschaden-Angriff \u22121.\n- Prim\xE4rer Direktschaden \u22121 Schritt.\n- Signatur-Budget f\xFCr Kontrolle, Positionierung, Schutz, Hilfe oder Utility.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2035,
        endLine: 2042
      }
    },
    {
      id: "stc-15-4",
      number: "15.4",
      title: "15.4 Kampfrollen (Standard / Elite / Boss)",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nKampfrolle gilt f\xFCr kompakte Statblocks und beschreibt **Kampf\xF6konomie und Haltbarkeit**, nicht erz\xE4hlerische Wichtigkeit, Kreaturtyp, Ownership oder Controller.\n\nKampfrolle \xE4ndert **nicht** Angriffsbonus, Verteidigung, Widerst\xE4nde, Skillmodifikatoren oder Basis-Schaden. Diese kommen aus Stufe + Profil + expliziten F\xE4higkeiten/Ausr\xFCstung.\n\nHP-Multiplikatoren (Profil- und Rollenmultiplikatoren kombinieren, **einmal** am Ende aufrunden):\n\n| Rolle | HP | Bedrohungseinheiten (gleiche Stufe) |\n|---|---:|---:|\n| Standard | \xD71,00 | 1 |\n| Elite | \xD71,50 | 2 |\n| Boss | \xD72,50 | 4 |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2043,
        endLine: 2056
      }
    },
    {
      id: "stc-meta-standard-172",
      number: null,
      title: "Standard",
      headingLevel: 4,
      parentId: "stc-15-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Normaler Zug: 1 Hauptaktion, Bewegung, Interaktion, 1 Reaktion.\n- Kein zus\xE4tzlicher Interleaved-Impuls.\n- Inhalt: 1\u20132 Prim\xE4raktionen, 0\u20132 Signaturf\xE4higkeiten, optionale normale Reaktion.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2057,
        endLine: 2062
      }
    },
    {
      id: "stc-meta-elite-173",
      number: null,
      title: "Elite",
      headingLevel: 4,
      parentId: "stc-15-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- HP \xD71,50.\n- **Elite-Impuls: 1/Runde**, nach dem Zug einer anderen Figur; nie w\xE4hrend des eigenen Zugs.\n- Ein Elite-Impuls erlaubt entweder Bewegung bis zur H\xE4lfte der normalen Bewegung (alle Restriktionen gelten) oder eine explizit als `Elite-Impuls` getaggte Statblock-F\xE4higkeit.\n- Offensive Impulse sind schw\xE4cher: mindestens ein Schadensschritt unter dem Prim\xE4rangriff, sofern keine explizite Ausgleichskosten/-bedingung.\n- H\xF6chstens ein Interleaved-Impuls nach einem einzelnen anderen Zug.\n- Inhalt: 1\u20132 Prim\xE4raktionen, 2\u20134 Signaturen, mindestens eine n\xFCtzliche Elite-Impuls-Option.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2063,
        endLine: 2071
      }
    },
    {
      id: "stc-meta-boss-174",
      number: null,
      title: "Boss",
      headingLevel: 4,
      parentId: "stc-15-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- HP \xD72,50.\n- **Boss-Impuls: 2/Runde**, jeweils nach dem Zug einer anderen Figur; h\xF6chstens einer nach demselben anderen Zug.\n- Jeder Boss-Impuls: halbe Bewegung oder `Boss-Impuls`-getaggte F\xE4higkeit (bewusst schw\xE4cher als volle Signaturaktionen am eigenen Zug).\n- **Wendepunkt: 1/Kampf**. Jeder Boss definiert einen expliziten Phasen-/Ver\xE4nderungstrigger, normalerweise beim ersten Erreichen von 50 % max. HP. Kein generisches Condition-Cleanse und keine automatische Immunit\xE4t.\n- Inhalt: 1\u20132 Prim\xE4rangriffe, 3\u20135 Signaturen, mindestens zwei Boss-Impuls-Optionen, genau ein Wendepunkt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2072,
        endLine: 2079
      }
    },
    {
      id: "stc-meta-bedingungen-175",
      number: null,
      title: "Bedingungen",
      headingLevel: 4,
      parentId: "stc-15-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Kampfrolle vergibt keine Blanket-Immunit\xE4ten und keinen \u201ELegendary Resistance\u201C-Ersatz.\n- Bestehende Zust\xE4nde wirken normal.\n- **Kampfunf\xE4hig** verhindert Elite-/Boss-Impulse.\n- Impulse sind **keine** Reaktionen und verbrauchen die normale Reaktion nicht.\n- Kompakte Statblocks haben standardm\xE4\xDFig kein Drive/Momentum.\n- Bei 0 HP ist der kompakte Statblock besiegt/au\xDFerhalb des Konflikts; der GM narrativiert tot, bewusstlos, zerst\xF6rt, geflohen usw. Vollst\xE4ndige Charaktere nutzen die normalen Sterberegeln.\n\nAlte Scherge-/Minion-Regeln sowie Blanket-+1-Angriff/Verteidigung f\xFCr Elite/Boss entfallen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2080,
        endLine: 2090
      }
    },
    {
      id: "stc-15-5",
      number: "15.5",
      title: "15.5 Bedrohungspunkte (gleiche Stufe)",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nInnerhalb derselben Stufe:\n\n| Rolle | Punkte |\n|---|---:|\n| Standard | 1 |\n| Elite | 2 |\n| Boss | 4 |\n\nGruppenbudget (Playtest):\n\n| Begegnung | Budget |\n|---|---|\n| Routine | 1 \xD7 Zahl der Spielerfiguren |\n| Standard | 2 \xD7 Zahl der Spielerfiguren |\n| Schwer | 2,5 \xD7 Zahl der Spielerfiguren |\n| Extrem | 3 \xD7 Zahl der Spielerfiguren |\n\nEin Gegner eine Machtgrad-Bandstufe \xFCber der Gruppe kostet doppelt. Ein Gegner eine Bandstufe darunter kostet halbiert. Encounter-Budget \xFCber stark unterschiedliche Einzelstufen bleibt ein sp\xE4terer Playtest-/Encounter-Slice.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2091,
        endLine: 2111
      }
    },
    {
      id: "stc-15-6",
      number: "15.6",
      title: "15.6 GM-Vorbereitung",
      headingLevel: 3,
      parentId: "stc-15",
      normativity: "binding-playtest",
      bodyMarkdown: "\nJede bedeutende Szene definiert mindestens:\n\n- Ziel,\n- Einsatz,\n- m\xF6gliche Konsequenzen,\n- relevante NSC,\n- Zielwerte und Widerst\xE4nde,\n- verf\xFCgbare Informationen,\n- mindestens einen alternativen Weg f\xFCr ein zentrales Hindernis.\n\nDer GM ver\xE4ndert W\xFCrfelergebnisse nicht nachtr\xE4glich.\n\nFehlschl\xE4ge erzeugen konkrete Ver\xE4nderungen wie Preis, Zeitverlust, Position, Aufmerksamkeit, Verbrauch oder neue Gefahr.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2112,
        endLine: 2129
      }
    },
    {
      id: "stc-16",
      number: "16",
      title: "16. Abenteuermodule und Weltprofile",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2130,
        endLine: 2131
      }
    },
    {
      id: "stc-16-1",
      number: "16.1",
      title: "16.1 Modulvertrag",
      headingLevel: 3,
      parentId: "stc-16",
      normativity: "binding-playtest",
      bodyMarkdown: "\nJedes Regelmodul deklariert:\n\n- ID,\n- Version,\n- Zweck,\n- ver\xE4nderte Core-Abschnitte,\n- Voraussetzungen,\n- Abh\xE4ngigkeiten,\n- Konflikte,\n- Aktivierung,\n- Ersatzregeln,\n- analoge Durchf\xFChrung,\n- optionale digitale Unterst\xFCtzung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2132,
        endLine: 2147
      }
    },
    {
      id: "stc-16-2",
      number: "16.2",
      title: "16.2 Regelpriorit\xE4t",
      headingLevel: 3,
      parentId: "stc-16",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBei Konflikten gilt:\n\n1. ausdr\xFCcklich spezifische F\xE4higkeit, Gegenstand oder Gefahr,\n2. ausdr\xFCcklich aktives Spezialmodul,\n3. Weltprofil,\n4. SagaTree Core.\n\nEine spezifischere Regel darf eine allgemeinere nur dort \xFCberschreiben, wo sie dies tats\xE4chlich beschreibt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2148,
        endLine: 2158
      }
    },
    {
      id: "stc-16-3",
      number: "16.3",
      title: "16.3 Deaktivierte Drive- oder Momentum-Regeln",
      headingLevel: 3,
      parentId: "stc-16",
      normativity: "binding-playtest",
      bodyMarkdown: "\nWird Drive oder Momentum deaktiviert, muss jede zwingend davon abh\xE4ngige F\xE4higkeit:\n\n- eine explizite Ersatzbegrenzung erhalten oder\n- als nicht verf\xFCgbar markiert sein.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2159,
        endLine: 2165
      }
    },
    {
      id: "stc-16-4",
      number: "16.4",
      title: "16.4 H\xE4rtegrade",
      headingLevel: 3,
      parentId: "stc-16",
      normativity: "binding-playtest",
      bodyMarkdown: "",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2166,
        endLine: 2167
      }
    },
    {
      id: "stc-meta-heroisch-183",
      number: null,
      title: "Heroisch",
      headingLevel: 4,
      parentId: "stc-16-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nBei 0 Gesundheit wird eine normale Figur nur durch einen kritischen Treffer oder ausdr\xFCcklich t\xF6dliche Gefahr Sterbend. Andernfalls ist sie stabil bei 0.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2168,
        endLine: 2171
      }
    },
    {
      id: "stc-meta-standard-184",
      number: null,
      title: "Standard",
      headingLevel: 4,
      parentId: "stc-16-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\nRegeln aus Abschnitt 8 gelten unver\xE4ndert.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2172,
        endLine: 2175
      }
    },
    {
      id: "stc-meta-hart-185",
      number: null,
      title: "Hart",
      headingLevel: 4,
      parentId: "stc-16-4",
      normativity: "binding-playtest",
      bodyMarkdown: "\n- Bei 0 Gesundheit startet eine Figur auf Sterbend 2.\n- Volle Ruhe heilt nur 2 \xD7 Erholung.\n- Jedes Erreichen von 0 erzeugt zus\xE4tzlich eine Wunde.\n- Jede Wunde reduziert maximale Gesundheit um 2.\n- Wunden werden durch Medizin und Ausfallzeit behandelt.\n- Maximal drei Wunden; jede weitere verursacht stattdessen Sterbend +1.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2176,
        endLine: 2184
      }
    },
    {
      id: "stc-16-5",
      number: "16.5",
      title: "16.5 Magie- und Technologiestufen",
      headingLevel: 3,
      parentId: "stc-16",
      normativity: "binding-playtest",
      bodyMarkdown: "\nMagie und Technologie werden unabh\xE4ngig bewertet.\n\n| Stufe | Bedeutung |\n|---:|---|\n| 0 | nicht vorhanden |\n| 1 | selten |\n| 2 | etabliert, aber begrenzt |\n| 3 | weit verbreitet |\n| 4 | weltpr\xE4gend |\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2185,
        endLine: 2198
      }
    },
    {
      id: "stc-17",
      number: "17",
      title: "17. Charaktererschaffung",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "\nEine Figur wird zun\xE4chst als vollst\xE4ndige Stufe-1-Basis erstellt. Soll sie direkt auf einer h\xF6heren Stufe beginnen, werden anschlie\xDFend alle regul\xE4ren Entwicklungen bis zur gew\xE4hlten Zielstufe nach Abschnitt 13.3 angewendet.\n\nVerbindliche Reihenfolge:\n\n1. Weltprofil und aktive Module bestimmen.\n2. Zielstufe von 1 bis 20 bestimmen; Standard ist Stufe 1.\n3. Figurenkonzept festlegen.\n4. Spezies w\xE4hlen; bei Alien das Speziesprofil benennen; zul\xE4ssige Speziesmerkmale im Wert von genau 3 Punkten w\xE4hlen und alle verpflichtenden Merkmalsdetails festlegen.\n5. Hintergrund w\xE4hlen.\n6. Prim\xE4rarchetyp w\xE4hlen.\n7. Prim\xE4re Essenz w\xE4hlen.\n8. Attribute verteilen (15 Attribut-Bonuspunkte, jeweils +0\u2026+4; empfohlen ausgewogen `+4/+3/+3/+2/+2/+1`).\n9. Hintergrund-Fertigkeitspunkte anwenden (2 Punkte frei auf den Framework-Viererpool; Stapeln erlaubt).\n10. Archetyp-Fertigkeitspunkt anwenden (1 Punkt auf einen typischen Skill des Prim\xE4rarchetyps).\n11. Freie Fertigkeitspunkte verteilen (7 Punkte auf alle 18 Skills; Quellen stapeln; Startcap 3; keine Mindestanzahl trainierter Skills).\n12. Spezialisierung w\xE4hlen.\n13. zus\xE4tzliche Sprache oder Kommunikationsform w\xE4hlen.\n14. Archetyp-Kernf\xE4higkeit und erste Essenzmanifestation w\xE4hlen.\n15. abgeleitete Werte berechnen.\n16. Startausr\xFCstung und Ressourcen bestimmen.\n17. Kontakt und charakterbezogene Komplikation festhalten.\n18. Drive auf 3 setzen.\n19. Gruppen-Momentum auf 0 setzen.\n20. Fertigkeitsgrenzen, Voraussetzungen und Merkmalsbudget der Stufe-1-Basis pr\xFCfen.\n21. Bei Zielstufe \xFCber 1 alle Entwicklungen der Stufen 2 bis Zielstufe anwenden und deren Voraussetzungen chronologisch pr\xFCfen.\n22. Rang, Erfahrungsbonus, Fertigkeitslimit und alle abgeleiteten Werte f\xFCr die Zielstufe abschlie\xDFend berechnen.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2199,
        endLine: 2229
      }
    },
    {
      id: "stc-18",
      number: "18",
      title: "18. Referenzen und Systementsprechungen",
      headingLevel: 2,
      parentId: null,
      normativity: "binding-playtest",
      bodyMarkdown: "\nDie folgenden Systeme dienen nur als Orientierung f\xFCr bekannte Spielkonzepte. SagaTree \xFCbernimmt deren Regeln nicht automatisch.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2230,
        endLine: 2233
      }
    },
    {
      id: "stc-18-1",
      number: "18.1",
      title: "18.1 Dungeons & Dragons",
      headingLevel: 3,
      parentId: "stc-18",
      normativity: "binding-playtest",
      bodyMarkdown: "\n\xC4hnliche Orientierungspunkte:\n\n- sechs breite Attribute,\n- Training/Kompetenzbonus,\n- 20 Charakterstufen,\n- Aktions- und Reaktionsrhythmus.\n\nWesentliche Unterschiede:\n\n- keine getrennten Klassenstufen,\n- keine allgemeine Bonusaktion,\n- kleinerer Erfahrungsbonus,\n- vier Erfolgsgrade,\n- R\xFCstung prim\xE4r als Schadensminderung statt reine Treffervermeidung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2234,
        endLine: 2250
      }
    },
    {
      id: "stc-18-2",
      number: "18.2",
      title: "18.2 Pathfinder 2e",
      headingLevel: 3,
      parentId: "stc-18",
      normativity: "binding-playtest",
      bodyMarkdown: "\n\xC4hnliche Orientierungspunkte:\n\n- d20 + Werte gegen Zielwert,\n- vier Erfolgsgrade,\n- \xB110 f\xFCr kritische Ergebnisse,\n- nat\xFCrliche 20 und 1 verschieben den Erfolgsgrad,\n- statische Widerst\xE4nde.\n\nSagaTree verwendet bewusst weniger Bonusarten und eine einfachere Aktions\xF6konomie.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2251,
        endLine: 2262
      }
    },
    {
      id: "stc-18-3",
      number: "18.3",
      title: "18.3 Das Schwarze Auge",
      headingLevel: 3,
      parentId: "stc-18",
      normativity: "binding-playtest",
      bodyMarkdown: "\nDSA dient vor allem als Kontrast f\xFCr detaillierte Fertigkeitsmodelle. SagaTree verwendet keine dreifache Attributscheck und keine vergleichbar kleinteilige allgemeine Kompetenzverwaltung.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2263,
        endLine: 2266
      }
    },
    {
      id: "stc-18-4",
      number: "18.4",
      title: "18.4 Savage Worlds",
      headingLevel: 3,
      parentId: "stc-18",
      normativity: "binding-playtest",
      bodyMarkdown: "\nRelevant ist die Idee eines universellen Kernsystems mit Weltanpassungen, benannten Erfahrungsr\xE4ngen und Metaressourcen. SagaTree verwendet jedoch seine eigene d20-Aufl\xF6sung, seine eigenen Ranggrenzen, Erfolgsgrade, Progression und Konfliktstruktur.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2267,
        endLine: 2270
      }
    },
    {
      id: "stc-18-5",
      number: "18.5",
      title: "18.5 Begriffsentsprechungen",
      headingLevel: 3,
      parentId: "stc-18",
      normativity: "binding-playtest",
      bodyMarkdown: "\n| SagaTree | Allgemeine Entsprechung |\n|---|---|\n| Attribut | grundlegende Eigenschaft |\n| Fertigkeit | erlernte Kompetenz |\n| Spezialisierung | enges Fachgebiet |\n| Archetyp | funktionale Charakterausrichtung |\n| Hintergrund | Herkunft und soziale Einbindung |\n| Spezies | k\xF6rperliche/strukturelle Speziesmerkmale |\n| Essenz | Wirkprinzip besonderer F\xE4higkeiten |\n| Rang | vier Stufen umfassender Progressionsbereich: Novize, Spezialist, Experte, Meister oder Legende |\n| Drive | pers\xF6nliche Metaressource |\n| Momentum | gemeinsame Gruppenressource |\n| Erfahrungsbonus (global) | stufenabh\xE4ngiger verf\xFCgbarer Levelwert (+1\u2026+5 nach Rang) |\n| Anwendbarer Erfahrungsbonus | bei Fertigkeitschecks: 0 bei Rang 0, sonst min(globaler EB, Rang+1) |\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2271,
        endLine: 2289
      }
    },
    {
      id: "stc-19",
      number: "19",
      title: "19. Mathematische Pr\xFCfung und Spieltests",
      headingLevel: 2,
      parentId: null,
      normativity: "validation",
      bodyMarkdown: "\n**Status: laufende Validierungsphase**\n\nDie Regelarchitektur der Abschnitte 1 bis 18 ist beschlossen. Die dort enthaltenen Zahlen gelten bis zum Nachweis eines Problems als aktuelle Playtestwerte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2290,
        endLine: 2295
      }
    },
    {
      id: "stc-19-1",
      number: "19.1",
      title: "19.1 Bereits rechnerisch plausibilisierte Grundwerte",
      headingLevel: 3,
      parentId: "stc-19",
      normativity: "validation",
      bodyMarkdown: "\nF\xFCr typische Gesamtboni wurden die Erfolgswahrscheinlichkeiten des Kernchecks gepr\xFCft.\n\nBeispiele ohne Vorteil/Nachteil:\n\n| Gesamtbonus | ZW 15 | ZW 20 | ZW 25 | ZW 30 |\n|---:|---:|---:|---:|---:|\n| +5 | 55 % | 30 % | 5 % | 5 % |\n| +10 | 80 % | 55 % | 30 % | 5 % |\n| +15 | 95 % | 80 % | 55 % | 30 % |\n\nEine Grundchance von 55 % wird durch Vorteil auf ungef\xE4hr 79,75 % erh\xF6ht und durch Nachteil auf ungef\xE4hr 30,25 % reduziert.\n\nDaraus folgt f\xFCr die Validierungsfassung:\n\n- keine zus\xE4tzlichen spontanen situativen Zahlenboni,\n- Vorteil/Nachteil bleibt das prim\xE4re situative Werkzeug,\n- Spezialisierung +2 bleibt ein klar begrenzter, ausdr\xFCcklicher Bonus.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2296,
        endLine: 2315
      }
    },
    {
      id: "stc-19-2",
      number: "19.2",
      title: "19.2 Bereits durch Designreview gepr\xFCft",
      headingLevel: 3,
      parentId: "stc-19",
      normativity: "validation",
      bodyMarkdown: "\nDrei interne Reviewzyklen wurden vor Eintritt in die Validierungsphase durchgef\xFChrt.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2316,
        endLine: 2319
      }
    },
    {
      id: "stc-meta-review-1-konsistenz-197",
      number: null,
      title: "Review 1 \u2013 Konsistenz",
      headingLevel: 4,
      parentId: "stc-19-2",
      normativity: "validation",
      bodyMarkdown: "\nGepr\xFCft und vermieden wurden unter anderem:\n\n- zus\xE4tzliche Attribute,\n- eigene Essenz-Fertigkeit,\n- allgemeine Spezies-Attributsboni,\n- Klassenstufen,\n- dynamische Schwierigkeitsanpassung,\n- freie situative Zahlenmodifikatoren,\n- versteckte Abh\xE4ngigkeit von Drive oder Momentum.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2320,
        endLine: 2331
      }
    },
    {
      id: "stc-meta-review-2-grundmathematik-198",
      number: null,
      title: "Review 2 \u2013 Grundmathematik",
      headingLevel: 4,
      parentId: "stc-19-2",
      normativity: "validation",
      bodyMarkdown: "\nVorl\xE4ufig plausibel:\n\n- Zielwertkurve in 5er-Schritten,\n- Verteidigung mit Erfahrungsbonus,\n- R\xFCstung als Schadensminderung,\n- bewusst langsames Gesundheitswachstum,\n- reduzierte Begegnungsbudgets gegen\xFCber aggressiveren Erstentw\xFCrfen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2332,
        endLine: 2341
      }
    },
    {
      id: "stc-meta-review-3-spielbarkeit-und-einfachheit-199",
      number: null,
      title: "Review 3 \u2013 Spielbarkeit und Einfachheit",
      headingLevel: 4,
      parentId: "stc-19-2",
      normativity: "validation",
      bodyMarkdown: "\nBewusst nicht Bestandteil des Core:\n\n- allgemeine Bonusaktionen,\n- universelles Mana oder Zauberslots,\n- soziale Trefferpunkte,\n- getrennte Recherche-, Herstellungs- und Ritualgrundsysteme,\n- allgemeine Flanken- oder H\xF6henboni,\n- Tabellen freier situativer Zahlenmodifikatoren,\n- dynamische Stufenskalierung der Welt,\n- Punkteerstattung durch Speziesnachteile,\n- weltabh\xE4ngige Aufsplittung der 18 Kernfertigkeiten,\n- getrennte Magie- und Technologie-Aufl\xF6sung,\n- negative Gesundheit,\n- zus\xE4tzliche Belastbarkeitsfertigkeit,\n- zahlreiche passive Fertigkeitswerte.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2342,
        endLine: 2359
      }
    },
    {
      id: "stc-19-3",
      number: "19.3",
      title: "19.3 Verpflichtende Validierung",
      headingLevel: 3,
      parentId: "stc-19",
      normativity: "validation",
      bodyMarkdown: "\nVor endg\xFCltiger Freigabe m\xFCssen mindestens praktisch oder mathematisch gepr\xFCft werden:\n\n- Erfolgswahrscheinlichkeiten aller typischen Attribut- und Fertigkeitskombinationen,\n- Erfahrungsbonus \xFCber alle Stufenbereiche,\n- Spezialisierungsbonus +2,\n- Vorteil und Nachteil \xFCber relevante Zielwerte,\n- Sicherheitswert 10,\n- Widerst\xE4nde,\n- Kompetenzunterschiede zwischen Stufenbereichen,\n- Speziesmerkmal-Budget, Merkmalskosten und speziesgebundene Allowlists,\n- Erweitertes Klettern und Erweitertes Schwimmen gegen\xFCber der normalen Bewegungsregel,\n- Kampfwerte und erwartete Kampfdauer,\n- Begegnungsbudgets f\xFCr unterschiedliche Gruppengr\xF6\xDFen,\n- Schergen-, Elite- und Bossregeln (Standard/Elite/Boss inkl. Impulse),\n- Boss-Aktions\xF6konomie,\n- Schadens- und Heilungskurven \xFCber mehrere Konflikte,\n- R\xFCstung und Durchdringung,\n- Sterben und Stabilisierung,\n- Drive und Momentum,\n- Spielbarkeit ohne Drive,\n- Spielbarkeit ohne Momentum,\n- Prim\xE4r- und Sekund\xE4rarchetypen,\n- sekund\xE4re Essenzen,\n- Kr\xE4fte der R\xE4nge Novize bis Legende, insbesondere Experte bis Legende,\n- direkte Erstellung h\xF6herstufiger Figuren und chronologische Voraussetzungen,\n- Gemeinschaftsprojekte,\n- soziale Konflikte,\n- Verfolgungsjagden,\n- analoge Spielbarkeit ohne digitale Berechnungen.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2360,
        endLine: 2391
      }
    },
    {
      id: "stc-19-4",
      number: "19.4",
      title: "19.4 Vorl\xE4ufige Gegner-Simulation",
      headingLevel: 3,
      parentId: "stc-19",
      normativity: "validation",
      bodyMarkdown: "\nEine vereinfachte Vorpr\xFCfung f\xFCr den Begegnungsrang Novize ohne Kr\xE4fte, Gel\xE4nde, Zust\xE4nde und Momentum ergab als groben Proxy f\xFCr vier Spielerfiguren:\n\n- 4 Standardgegner: ungef\xE4hr 5 Runden Median, sehr geringe Niederlagenquote,\n- 5 Standardgegner: sp\xFCrbar gef\xE4hrlicher,\n- 6 Standardgegner: bereits deutlich hohe Niederlagengefahr,\n- 7 bis 8 Standardgegner: f\xFCr eine normale Begegnung zu t\xF6dlich.\n\nDiese vereinfachte Simulation war der Grund, das Extreme-Budget auf 3 \xD7 Spielerzahl zu begrenzen. Sie ersetzt keinen vollst\xE4ndigen Spieltest.",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2392,
        endLine: 2402
      }
    },
    {
      id: "stc-19-5",
      number: "19.5",
      title: "19.5 \xC4nderungsregel w\xE4hrend der Validierung",
      headingLevel: 3,
      parentId: "stc-19",
      normativity: "validation",
      bodyMarkdown: "\nEin Core-Wert wird nur ge\xE4ndert, wenn mindestens einer der folgenden Gr\xFCnde dokumentiert werden kann:\n\n1. mathematischer Grenzfall oder systematischer Wahrscheinlichkeitsfehler,\n2. reproduzierbares Problem in Spieltests,\n3. Regelwiderspruch zwischen zwei Core-Abschnitten,\n4. unn\xF6tige Komplexit\xE4t ohne spielerischen Mehrwert,\n5. fehlende analoge Durchf\xFChrbarkeit.\n\n\xC4nderungen werden mit vorherigem Wert, neuem Wert, Begr\xFCndung und betroffenen Abschnitten im \xC4nderungsverlauf festgehalten.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2403,
        endLine: 2416
      }
    },
    {
      id: "stc-20",
      number: "20",
      title: "20. Abschlusskriterien",
      headingLevel: 2,
      parentId: null,
      normativity: "release-criteria",
      bodyMarkdown: "\nDie SagaTree Core Rules gelten als final validiert, wenn:\n\n- alle Regeln der Abschnitte 1 bis 18 ohne bekannte interne L\xFCcke funktionieren,\n- alle 18 Fertigkeiten praktisch eingesetzt wurden,\n- Charaktererschaffung und Stufenaufstieg einschlie\xDFlich direkt h\xF6herstufig erstellter Figuren l\xFCckenlos funktionieren,\n- Konflikt, Schaden, Heilung und Tod getestet wurden,\n- Ausr\xFCstung und besondere Kr\xE4fte in mehreren Weltarten funktionieren,\n- Gegner und Herausforderungen konsistent erstellt werden k\xF6nnen,\n- Standardgegner, Eliten und Bosse getestet wurden,\n- Kr\xE4fte mindestens der R\xE4nge Novize, Experte und Legende praktisch getestet wurden,\n- optionale Module ihre Abh\xE4ngigkeiten deklarieren,\n- mathematische Grenzf\xE4lle gepr\xFCft wurden,\n- mehrere vollst\xE4ndige Testspiele dokumentiert wurden,\n- mindestens ein Test ohne Drive oder Momentum durchgef\xFChrt wurde,\n- Begriffslexikon, Referenztabellen und Schnellreferenz vorhanden sind,\n- die Regeln analog ohne SagaTree-Anwendung spielbar sind.\n\n---",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2417,
        endLine: 2437
      }
    },
    {
      id: "stc-meta-anderungsverlauf-204",
      number: null,
      title: "\xC4nderungsverlauf",
      headingLevel: 2,
      parentId: null,
      normativity: "informational",
      bodyMarkdown: "\n| Datum | Stand |\n|---|---|\n| 20.09.2026 | \xA77.4: Universelle Hauptaktion \u201EGelegenheit schaffen\u201C erg\xE4nzt \u2014 kreative taktische L\xFCckenhandlung mit Vorrang bestehender Aktionen/Man\xF6ver; Output begrenzt auf benannten Vorteil f\xFCr Folgechecks (kein Schaden, kein freier Zustand, keine erzwungene Bewegung, kein Aktionsverlust, keine spontanen Zahlen, kein allgemeiner Erfolg gegen Preis). |\n| 27.08.2026 | Speziesmechanik konkretisiert: exakt 3 Speziespunkte verpflichtend, Core-Spezies mit festen Merkmals-Allowlists, Alien als frei benennbares Speziesprofil mit vollst\xE4ndigem verf\xFCgbarem Merkmalskatalog, Pflichtdetails f\xFCr offene Merkmale, `Kletter- oder Schwimmbewegung` in `Erweitertes Klettern` und `Erweitertes Schwimmen` getrennt. Normales Klettern/Schwimmen kostet 2 Meter Bewegung pro Meter; die erweiterten Merkmale reduzieren dies auf 1:1. `Au\xDFergew\xF6hnlicher K\xF6rperbau` bleibt sichtbar, aber bis zur Definition zul\xE4ssiger Varianten nicht verf\xFCgbar. |\n| 26.08.2026 | Das 20-Stufen-Modell ausdr\xFCcklich best\xE4tigt und in f\xFCnf benannte R\xE4nge gegliedert: Novize (1\u20134), Spezialist (5\u20138), Experte (9\u201312), Meister (13\u201316), Legende (17\u201320). R\xF6mische Rangbezeichnungen entfernt, F\xE4higkeits- und Begegnungsr\xE4nge angeglichen und direkte Erstellung h\xF6herstufiger Figuren mit vollst\xE4ndiger, chronologisch legaler Progression definiert. |\n| 26.08.2026 | Regelentwurf der zuvor offenen Abschnitte 2 bis 18 nach drei Reviewzyklen vollst\xE4ndig als verbindliche Validierungsfassung \xFCbernommen. Abschnitt 19 ist jetzt der aktive Arbeitsblock. Zahlenwerte sind verbindliche Playtestwerte, aber noch nicht endg\xFCltig empirisch validiert. |\n| 26.08.2026 | Athletik als umweltbezogene Bewegungs- und Kraftfertigkeit festgelegt; Kampfman\xF6ver bleiben bei Nahkampf. Fortsetzungspunkt auf Akrobatik gesetzt. |\n| 26.08.2026 | Erster konsolidierter Entwurf. Verbindliche Entscheidungen aus den Bl\xF6cken 1 bis 5.7 \xFCbernommen. Offene Regelbereiche und Fortsetzungspunkt erg\xE4nzt. |",
      source: {
        path: "docs/sagatree core rules.md",
        startLine: 2438,
        endLine: 2448
      }
    }
  ]
};

// src/domains/rulebook/load-index.ts
var cached = null;
function getSagaTreeCoreRulebookIndex() {
  if (cached) return cached;
  assertRulebookIndex(sagatree_core_default);
  cached = sagatree_core_default;
  return cached;
}

// src/domains/rules/sagatree/character-creation/index.ts
var sagaTreeSpeciesTraitDefinitions = [
  { key: "sharpened-sense", label: "Gesch\xE4rfter Sinn", cost: 1, description: "W\xE4hle einen Sinn. Du erh\xE4ltst Vorteil auf Wahrnehmungschecks, bei denen dieser Sinn entscheidend ist.", detailLabel: "Gesch\xE4rfter Sinn", detailPlaceholder: "z. B. Geh\xF6r, Geruch, Tastsinn", detailRequired: true },
  { key: "natural-weapon", label: "Nat\xFCrliche Waffe", cost: 1, description: "Unbewaffneter Schaden steigt von d4+1 auf d6+1. Die Form kann z. B. Klauen, Z\xE4hne oder H\xF6rner sein." },
  { key: "narrow-resistance", label: "Enge Resistenz", cost: 1, description: "W\xE4hle eine klar eingegrenzte Gefahrenart. Du erh\xE4ltst Vorteil auf passende Checks und Widerst\xE4nde gegen diese Gefahr.", detailLabel: "Gefahrenart", detailPlaceholder: "z. B. Gift, Krankheit, Strahlung", detailRequired: true },
  { key: "environment-adaptation", label: "Umweltanpassung", cost: 1, description: "W\xE4hle eine gew\xF6hnliche Umgebung. Normale Nachteile, die ausschlie\xDFlich aus dieser Umgebung entstehen, entfallen.", detailLabel: "Umgebung", detailPlaceholder: "z. B. Hochgebirge, W\xFCste, arktisches Klima", detailRequired: true },
  { key: "enduring-organism", label: "Ausdauernder Organismus", cost: 1, description: "Du erh\xE4ltst Vorteil auf Checks gegen langandauernde k\xF6rperliche Ersch\xF6pfung." },
  { key: "low-rest-need", label: "Geringer Ruhebedarf", cost: 1, description: "Du ben\xF6tigst nur die H\xE4lfte der f\xFCr deine Spezies \xFCblichen Schlaf- oder Ruhezeit. Heilung und Erholung werden dadurch nicht beschleunigt." },
  { key: "natural-protection", label: "Nat\xFCrlicher Schutz", cost: 2, description: "Du besitzt nat\xFCrliche Schutzwirkung 1 nach den normalen Schutzregeln." },
  { key: "enhanced-climbing", label: "Erweitertes Klettern", cost: 2, description: "Beim Klettern kostet 1 Meter Bewegung nur 1 Meter statt 2 Meter. Schwierige Oberfl\xE4chen, Gefahr oder Zeitdruck k\xF6nnen weiterhin einen Athletikcheck verlangen." },
  { key: "enhanced-swimming", label: "Erweitertes Schwimmen", cost: 2, description: "Beim Schwimmen kostet 1 Meter Bewegung nur 1 Meter statt 2 Meter. Str\xF6mung, Gefahr oder andere schwierige Bedingungen k\xF6nnen weiterhin einen Athletikcheck verlangen." },
  { key: "amphibious", label: "Amphibisch", cost: 2, description: "Du kannst an Land und unter Wasser normal atmen und leben. Normale Atemeinschr\xE4nkungen durch Wasser entfallen." },
  { key: "enhanced-sight", label: "Erweiterte Sicht", cost: 2, description: "W\xE4hle eine klar definierte besondere Sichtform. Sie gilt nur in ihrem festgelegten Anwendungsbereich.", detailLabel: "Sichtform", detailPlaceholder: "z. B. Dunkelsicht, W\xE4rmesicht, Fernsicht", detailRequired: true },
  { key: "flight", label: "Flugf\xE4hig", cost: 3, description: "Du besitzt eine nat\xFCrliche Flugbewegung in H\xF6he deiner normalen Bewegungsrate." },
  { key: "extreme-environment", label: "Extremumwelt", cost: 3, description: "W\xE4hle eine Extremumwelt. Du kannst dort ohne die normalerweise erforderlichen Schutzmittel \xFCberleben.", detailLabel: "Extremumwelt", detailPlaceholder: "z. B. Vakuum, extreme K\xE4lte, toxische Atmosph\xE4re", detailRequired: true },
  { key: "exceptional-body", label: "Au\xDFergew\xF6hnlicher K\xF6rperbau", cost: 3, description: "Stark abweichende Anatomie mit einer fest definierten mechanischen Wirkung. Die zul\xE4ssigen Varianten werden noch festgelegt.", available: false, unavailableReason: "Noch nicht verf\xFCgbar" }
];
var HUMAN_TRAITS = [
  "sharpened-sense",
  "narrow-resistance",
  "environment-adaptation",
  "enduring-organism",
  "low-rest-need"
];
var sagaTreeSpeciesTraitKeysByRace = {
  human: HUMAN_TRAITS,
  elf: [...HUMAN_TRAITS, "enhanced-climbing", "enhanced-sight"],
  dwarf: [...HUMAN_TRAITS, "natural-protection", "enhanced-sight"],
  halfling: ["sharpened-sense", "narrow-resistance", "environment-adaptation", "enduring-organism", "enhanced-climbing"],
  orc: ["sharpened-sense", "natural-weapon", "narrow-resistance", "environment-adaptation", "enduring-organism", "natural-protection", "exceptional-body"],
  cyborg: ["sharpened-sense", "natural-weapon", "narrow-resistance", "environment-adaptation", "low-rest-need", "natural-protection", "enhanced-climbing", "enhanced-swimming", "enhanced-sight", "extreme-environment", "exceptional-body"],
  alien: sagaTreeSpeciesTraitDefinitions.map((trait) => trait.key)
};

// src/domains/rules/sagatree/skill-progression/index.ts
function clampLevel(level) {
  return Math.min(20, Math.max(1, Math.round(level)));
}
function getSagaTreeExperienceBonus(level) {
  const normalized = clampLevel(level);
  if (normalized <= 4) return 1;
  if (normalized <= 8) return 2;
  if (normalized <= 12) return 3;
  if (normalized <= 16) return 4;
  return 5;
}
function getSagaTreeAppliedExperienceBonus(skillRank, level) {
  const rank = Math.max(0, Math.round(skillRank));
  if (rank <= 0) return 0;
  return Math.min(getSagaTreeExperienceBonus(level), rank + 1);
}

// src/domains/rulebook/eb-pilot.ts
var APPLIED_EB_PILOT_CASES = [
  { skillRank: 0, level: 17, expected: 0 },
  { skillRank: 1, level: 17, expected: 2 },
  { skillRank: 2, level: 17, expected: 3 },
  { skillRank: 4, level: 17, expected: 5 },
  { skillRank: 5, level: 17, expected: 5 },
  { skillRank: 3, level: 4, expected: 1 }
];
function assertAppliedExperienceBonusPilot(index) {
  const section = getRulebookSectionByNumber(index, "5.3");
  if (!section) {
    throw new Error("EB pilot: missing rulebook section 5.3");
  }
  if (section.normativity !== "binding-playtest") {
    throw new Error("EB pilot: \xA75.3 must be binding-playtest");
  }
  const subtree = index.sections.filter(
    (candidate) => candidate.id === section.id || candidate.parentId === section.id
  );
  const combined = subtree.map((entry) => `${entry.title}
${entry.bodyMarkdown}`).join("\n").toLowerCase();
  if (!combined.includes("anwendbarer erfahrungsbonus") || !combined.includes("min(globaler")) {
    throw new Error("EB pilot: \xA75.3 subtree missing applicable-EB formula markers");
  }
  for (const testCase of APPLIED_EB_PILOT_CASES) {
    const actual = getSagaTreeAppliedExperienceBonus(testCase.skillRank, testCase.level);
    if (actual !== testCase.expected) {
      throw new Error(
        `EB pilot mismatch: rank ${testCase.skillRank} level ${testCase.level} \u2192 ${actual}, expected ${testCase.expected}`
      );
    }
  }
}

// src/domains/rulebook/citations.ts
var CITATION_ID_RE = /\b(stc-[a-z0-9-]+)\b/gi;
var CITATION_MARK_RE = /\[(?:cite|section|id):\s*(stc-[a-z0-9-]+)\]/gi;
function evidenceGate(hits) {
  const usable = hits.filter((h) => typeof h.sectionId === "string" && h.sectionId.length > 0 && h.score > 0);
  if (usable.length === 0) return { ok: false, reason: "no-evidence" };
  return { ok: true, hits: usable };
}
function extractClaimedCitationIds(answerText) {
  const found = /* @__PURE__ */ new Set();
  const text = typeof answerText === "string" ? answerText : "";
  for (const re of [CITATION_MARK_RE, CITATION_ID_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const id = match[1]?.toLowerCase();
      if (id) found.add(id);
    }
  }
  return [...found];
}
function validateCitations(input) {
  const pinned = (input.pinnedIndexRevision || "").trim().toLowerCase();
  const reported = (input.responseIndexRevision ?? pinned).trim().toLowerCase();
  const indexRevisionMatch = pinned.length > 0 && pinned === reported;
  if (!indexRevisionMatch) {
    return { accepted: [], dropped: [...input.claimedSectionIds], indexRevisionMatch: false };
  }
  const allowed = new Set(
    input.retrievedSectionIds.map((id) => id.trim().toLowerCase()).filter(Boolean)
  );
  const accepted = [];
  const dropped = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of input.claimedSectionIds) {
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!allowed.has(id)) {
      dropped.push(id);
      continue;
    }
    const meta = input.hitMeta?.get(id);
    accepted.push({
      sectionId: id,
      title: meta?.title,
      number: meta?.number ?? null
    });
  }
  return { accepted, dropped, indexRevisionMatch: true };
}
function formatEvidenceForPrompt(hits, indexRevision, limit = 8) {
  const lines = hits.slice(0, limit).map((hit, i) => {
    const num = hit.number ? `\xA7${hit.number} ` : "";
    const snip = hit.snippet.replace(/\s+/g, " ").trim().slice(0, 400);
    return `[${i + 1}] id=${hit.sectionId} ${num}${hit.title}
${snip}`;
  });
  return `indexRevision=${indexRevision}
Evidence (cite only these section ids with [cite:stc-\u2026]):
` + lines.join("\n\n");
}
export {
  APPLIED_EB_PILOT_CASES,
  RULEBOOK_NORMATIVITIES,
  RULEBOOK_SCHEMA_VERSION,
  SAGATREE_CORE_RULESET_ID,
  SAGATREE_CORE_SOURCE_PATH,
  assertAppliedExperienceBonusPilot,
  assertRulebookIndex,
  buildRulebookIndexFromMarkdown,
  canonicalIndexPayload,
  computeRevisionHash,
  evidenceGate,
  extractClaimedCitationIds,
  formatEvidenceForPrompt,
  getRulebookSection,
  getRulebookSectionByNumber,
  getSagaTreeCoreRulebookIndex,
  isRulebookNormativity,
  resolveNormativity,
  searchRulebook,
  sectionIdFromHeading,
  tokenizeQuery,
  validateCitations
};
