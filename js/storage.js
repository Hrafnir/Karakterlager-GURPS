/* =========================================================
   GURPS Character Forge
   File: js/storage.js

   Purpose:
   Storage, import/export, file reading and library loading.
   No game calculations here.
   Exposes: window.GURPSStorage
   ========================================================= */

(function () {
  "use strict";

  const CHARACTER_STORAGE_KEY = "gurps-character-forge-character-v1";
  const LIBRARY_STORAGE_KEY = "gurps-character-forge-library-v1";

  const DATA_FILES = {
    advantages: "data/advantages.json",
    disadvantages: "data/disadvantages.json",
    perks: "data/perks.json",
    quirks: "data/quirks.json",
    skills: "data/skills.json",
    techniques: "data/techniques.json",
    spells: "data/spells.json",
    weapons: "data/weapons.json",
    armor: "data/armor.json",
    gear: "data/gear.json",
    templates: "data/templates.json",
  };

  const EMPTY_LIBRARY = {
    traits: [],
    skills: [],
    techniques: [],
    spells: [],
    weapons: [],
    armor: [],
    gear: [],
    templates: [],
  };

  function createId(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParseJSON(text, fallback = null) {
    try {
      if (typeof text !== "string") return fallback;
      if (!text.trim()) return fallback;
      return JSON.parse(text);
    } catch (error) {
      console.warn("Could not parse JSON:", error);
      return fallback;
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function ensureId(item, prefix = "item") {
    return {
      id: item.id || createId(prefix),
      ...item,
    };
  }

  function normalizeTrait(item, defaultType) {
    return ensureId(
      {
        name: item.name || "",
        type: item.type || defaultType || "Advantage",
        levels: item.levels ?? 1,
        baseCost: item.baseCost ?? item.points ?? 0,
        modifierPct: item.modifierPct ?? 0,
        points: item.points ?? item.baseCost ?? 0,
        autoCost: item.autoCost ?? false,
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "trait"
    );
  }

  function normalizeSkill(item) {
    return ensureId(
      {
        name: item.name || "",
        specialty: item.specialty || "",
        stat: item.stat || "DX",
        difficulty: item.difficulty || "Average",
        points: item.points ?? 1,
        manualLevel: item.manualLevel ?? "",
        default: item.default || "",
        prereq: item.prereq || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "skill"
    );
  }

  function normalizeTechnique(item) {
    return ensureId(
      {
        name: item.name || "",
        baseSkill: item.baseSkill || item.skill || "",
        stat: item.stat || "DX",
        difficulty: item.difficulty || "Technique",
        points: item.points ?? 1,
        manualLevel: item.manualLevel ?? "",
        default: item.default || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "technique"
    );
  }

  function normalizeSpell(item) {
    return ensureId(
      {
        name: item.name || "",
        college: item.college || item.type || "",
        stat: item.stat || "IQ",
        difficulty: item.difficulty || "Hard",
        points: item.points ?? 1,
        manualLevel: item.manualLevel ?? "",
        prereq: item.prereq || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "spell"
    );
  }

  function normalizeWeapon(item) {
    return ensureId(
      {
        name: item.name || "",
        skill: item.skill || "",
        level: item.level || "",
        damage: item.damage || "",
        damageType: item.damageType || item.type || "",
        reach: item.reach || "",
        range: item.range || "",
        parry: item.parry || "",
        acc: item.acc || "",
        bulk: item.bulk || "",
        rof: item.rof || "",
        shots: item.shots || "",
        rcl: item.rcl || "",
        minST: item.minST || item.ST || "",
        weight: item.weight ?? 0,
        cost: item.cost ?? 0,
        LC: item.LC || "",
        TL: item.TL || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "weapon"
    );
  }

  function normalizeArmor(item) {
    return ensureId(
      {
        name: item.name || "",
        location: item.location || "Torso",
        DR: item.DR || item.dr || "",
        qty: item.qty ?? 1,
        weight: item.weight ?? 0,
        cost: item.cost ?? 0,
        LC: item.LC || "",
        TL: item.TL || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "armor"
    );
  }

  function normalizeGear(item) {
    return ensureId(
      {
        name: item.name || "",
        qty: item.qty ?? 1,
        weight: item.weight ?? 0,
        cost: item.cost ?? 0,
        location: item.location || "Carried",
        LC: item.LC || "",
        TL: item.TL || "",
        page: item.page || "",
        notes: item.notes || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "gear"
    );
  }

  function normalizeTemplate(item) {
    return ensureId(
      {
        name: item.name || "",
        points: item.points ?? 0,
        traits: item.traits || [],
        skills: item.skills || [],
        notes: item.notes || "",
        page: item.page || "",
        source: item.source || "",
        tags: item.tags || [],
        ...item,
      },
      "template"
    );
  }

  function normalizeLibrary(rawLibrary) {
    const raw = rawLibrary || {};

    const traits = [
      ...toArray(raw.traits).map((item) => normalizeTrait(item, item.type)),
      ...toArray(raw.advantages).map((item) => normalizeTrait(item, "Advantage")),
      ...toArray(raw.disadvantages).map((item) =>
        normalizeTrait(item, "Disadvantage")
      ),
      ...toArray(raw.perks).map((item) => normalizeTrait(item, "Perk")),
      ...toArray(raw.quirks).map((item) => normalizeTrait(item, "Quirk")),
    ];

    return {
      traits,
      skills: toArray(raw.skills).map(normalizeSkill),
      techniques: toArray(raw.techniques).map(normalizeTechnique),
      spells: toArray(raw.spells).map(normalizeSpell),
      weapons: toArray(raw.weapons).map(normalizeWeapon),
      armor: toArray(raw.armor).map(normalizeArmor),
      gear: toArray(raw.gear || raw.equipment).map(normalizeGear),
      templates: toArray(raw.templates).map(normalizeTemplate),
    };
  }

  function mergeLibraries(...libraries) {
    const merged = clone(EMPTY_LIBRARY);

    for (const library of libraries) {
      const normalized = normalizeLibrary(library);

      for (const key of Object.keys(EMPTY_LIBRARY)) {
        merged[key] = [...merged[key], ...toArray(normalized[key])];
      }
    }

    return dedupeLibrary(merged);
  }

  function dedupeLibrary(library) {
    const normalized = normalizeLibrary(library);
    const result = clone(EMPTY_LIBRARY);

    for (const key of Object.keys(result)) {
      const seen = new Set();

      result[key] = normalized[key].filter((item) => {
        const signature = [
          item.name || "",
          item.type || "",
          item.stat || "",
          item.difficulty || "",
          item.page || "",
        ]
          .join("|")
          .toLowerCase();

        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    }

    return result;
  }

  function loadFromLocalStorage(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return safeParseJSON(raw, fallback);
    } catch (error) {
      console.warn(`Could not load ${key} from localStorage:`, error);
      return fallback;
    }
  }

  function saveToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Could not save ${key} to localStorage:`, error);
      return false;
    }
  }

  function removeFromLocalStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Could not remove ${key} from localStorage:`, error);
      return false;
    }
  }

  function loadSavedCharacter(fallbackCharacter) {
    const saved = loadFromLocalStorage(CHARACTER_STORAGE_KEY, null);

    if (!saved) return clone(fallbackCharacter);

    return {
      ...clone(fallbackCharacter),
      ...saved,
      meta: {
        ...clone(fallbackCharacter.meta || {}),
        ...(saved.meta || {}),
      },
      stats: {
        ...clone(fallbackCharacter.stats || {}),
        ...(saved.stats || {}),
      },
      secondary: {
        ...clone(fallbackCharacter.secondary || {}),
        ...(saved.secondary || {}),
      },
      notes: {
        ...clone(fallbackCharacter.notes || {}),
        ...(saved.notes || {}),
      },
    };
  }

  function saveCharacter(character) {
    return saveToLocalStorage(CHARACTER_STORAGE_KEY, character);
  }

  function clearSavedCharacter() {
    return removeFromLocalStorage(CHARACTER_STORAGE_KEY);
  }

  function loadSavedLibrary(fallbackLibrary = EMPTY_LIBRARY) {
    const saved = loadFromLocalStorage(LIBRARY_STORAGE_KEY, null);
    if (!saved) return normalizeLibrary(fallbackLibrary);
    return mergeLibraries(fallbackLibrary, saved);
  }

  function saveLibrary(library) {
    return saveToLocalStorage(LIBRARY_STORAGE_KEY, normalizeLibrary(library));
  }

  function clearSavedLibrary() {
    return removeFromLocalStorage(LIBRARY_STORAGE_KEY);
  }

  async function fetchJSON(path, fallback = []) {
    try {
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        console.warn(`Could not load ${path}: ${response.status}`);
        return fallback;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`Could not fetch ${path}:`, error);
      return fallback;
    }
  }

  async function loadLibraryFromDataFiles() {
    const [
      advantages,
      disadvantages,
      perks,
      quirks,
      skills,
      techniques,
      spells,
      weapons,
      armor,
      gear,
      templates,
    ] = await Promise.all([
      fetchJSON(DATA_FILES.advantages, []),
      fetchJSON(DATA_FILES.disadvantages, []),
      fetchJSON(DATA_FILES.perks, []),
      fetchJSON(DATA_FILES.quirks, []),
      fetchJSON(DATA_FILES.skills, []),
      fetchJSON(DATA_FILES.techniques, []),
      fetchJSON(DATA_FILES.spells, []),
      fetchJSON(DATA_FILES.weapons, []),
      fetchJSON(DATA_FILES.armor, []),
      fetchJSON(DATA_FILES.gear, []),
      fetchJSON(DATA_FILES.templates, []),
    ]);

    return normalizeLibrary({
      advantages,
      disadvantages,
      perks,
      quirks,
      skills,
      techniques,
      spells,
      weapons,
      armor,
      gear,
      templates,
    });
  }

  async function loadCompleteLibrary(fallbackLibrary = EMPTY_LIBRARY) {
    const fileLibrary = await loadLibraryFromDataFiles();
    const savedLibrary = loadSavedLibrary(fallbackLibrary);

    return mergeLibraries(fileLibrary, savedLibrary);
  }

  function downloadText(filename, content, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function downloadJSON(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), "application/json");
  }

  function sanitizeFilename(value, fallback = "download") {
    const raw = String(value || fallback).trim();

    return raw
      .toLowerCase()
      .replaceAll("æ", "ae")
      .replaceAll("ø", "o")
      .replaceAll("å", "a")
      .replaceAll(/[^a-z0-9-_]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      || fallback;
  }

  function exportCharacter(character) {
    const filename = `${sanitizeFilename(character?.meta?.name, "gurps-character")}.json`;
    downloadJSON(filename, character);
  }

  function exportLibrary(library) {
    downloadJSON("gurps-library.json", normalizeLibrary(library));
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read file."));

      reader.readAsText(file);
    });
  }

  async function readJSONFile(file) {
    const text = await readTextFile(file);
    const parsed = safeParseJSON(text, null);

    if (!parsed) {
      throw new Error("The selected file is not valid JSON.");
    }

    return parsed;
  }

  async function importCharacterFile(file, fallbackCharacter) {
    const imported = await readJSONFile(file);

    return {
      ...clone(fallbackCharacter),
      ...imported,
      meta: {
        ...clone(fallbackCharacter.meta || {}),
        ...(imported.meta || {}),
      },
      stats: {
        ...clone(fallbackCharacter.stats || {}),
        ...(imported.stats || {}),
      },
      secondary: {
        ...clone(fallbackCharacter.secondary || {}),
        ...(imported.secondary || {}),
      },
      notes: {
        ...clone(fallbackCharacter.notes || {}),
        ...(imported.notes || {}),
      },
    };
  }

  async function importLibraryFile(file, existingLibrary = EMPTY_LIBRARY) {
    const imported = await readJSONFile(file);
    return mergeLibraries(existingLibrary, imported);
  }

  function importLibraryText(text, existingLibrary = EMPTY_LIBRARY, selectedCategory = null) {
    const parsed = safeParseJSON(text, null);

    if (!parsed) {
      throw new Error("The pasted text is not valid JSON.");
    }

    if (Array.isArray(parsed) && selectedCategory) {
      return mergeLibraries(existingLibrary, {
        [selectedCategory]: parsed,
      });
    }

    return mergeLibraries(existingLibrary, parsed);
  }

  function csvToObjects(csvText, separator = ";") {
    const lines = String(csvText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const headers = lines[0]
      .split(separator)
      .map((header) => header.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(separator).map((value) => value.trim());
      const item = {};

      headers.forEach((header, index) => {
        item[header] = values[index] ?? "";
      });

      return item;
    });
  }

  function importLibraryCSVText(
    csvText,
    existingLibrary = EMPTY_LIBRARY,
    selectedCategory,
    separator = ";"
  ) {
    if (!selectedCategory) {
      throw new Error("No selected category for CSV import.");
    }

    const items = csvToObjects(csvText, separator);

    return mergeLibraries(existingLibrary, {
      [selectedCategory]: items,
    });
  }

  window.GURPSStorage = {
    CHARACTER_STORAGE_KEY,
    LIBRARY_STORAGE_KEY,
    DATA_FILES,
    EMPTY_LIBRARY,

    createId,
    clone,
    safeParseJSON,
    toArray,

    normalizeTrait,
    normalizeSkill,
    normalizeTechnique,
    normalizeSpell,
    normalizeWeapon,
    normalizeArmor,
    normalizeGear,
    normalizeTemplate,
    normalizeLibrary,
    mergeLibraries,
    dedupeLibrary,

    loadFromLocalStorage,
    saveToLocalStorage,
    removeFromLocalStorage,

    loadSavedCharacter,
    saveCharacter,
    clearSavedCharacter,

    loadSavedLibrary,
    saveLibrary,
    clearSavedLibrary,

    fetchJSON,
    loadLibraryFromDataFiles,
    loadCompleteLibrary,

    downloadText,
    downloadJSON,
    sanitizeFilename,
    exportCharacter,
    exportLibrary,

    readTextFile,
    readJSONFile,
    importCharacterFile,
    importLibraryFile,
    importLibraryText,
    importLibraryCSVText,
    csvToObjects,
  };
})();
