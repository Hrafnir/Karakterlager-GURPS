/* =========================================================
   GURPS Character Forge
   File: js/app.js

   Purpose:
   Main app controller.
   Depends on:
   - js/storage.js     -> window.GURPSStorage
   - js/calculations.js -> window.GURPSCalc
   ========================================================= */

(function () {
  "use strict";

  const Calc = window.GURPSCalc;
  const Storage = window.GURPSStorage;

  if (!Calc || !Storage) {
    console.error("GURPSCalc or GURPSStorage is missing. Check script order in index.html.");
    return;
  }

  const TRAIT_TYPES = [
    "Advantage",
    "Disadvantage",
    "Perk",
    "Quirk",
    "Language",
    "Culture",
    "Contact",
    "Meta-trait",
    "Other",
  ];

  const SKILL_STATS = ["ST", "DX", "IQ", "HT", "Will", "Per"];

  const DIFFICULTIES = [
    "Easy",
    "Average",
    "Hard",
    "Very Hard",
    "Wildcard",
    "Technique",
    "Other",
  ];

  const DEFAULT_CHARACTER = {
    meta: {
      name: "",
      player: "",
      campaign: "",
      concept: "",
      species: "Human",
      template: "",
      profession: "",
      TL: 3,
      pointBudget: 150,
      disadLimit: -75,
      handedness: "Right",
      age: "",
      height: "",
      weight: "",
      SM: 0,
      appearance: "",
      status: 0,
      wealthLevel: "Average",
      reputation: "",
      startingWealthOverride: "",
      campaignPremise: "",
      houseRules: "",
    },

    portrait: "",

    stats: {
      ST: 10,
      DX: 10,
      IQ: 10,
      HT: 10,
    },

    secondary: {
      HP: 10,
      currentHP: 10,
      Will: 10,
      Per: 10,
      FP: 10,
      currentFP: 10,
      speedAdj: 0,
      moveAdj: 0,
      shieldDB: 0,
      dodgeBonus: 0,
      parry: "",
      block: "",
      DR: "",
      thrOverride: "",
      swOverride: "",
    },

    traits: [],
    skills: [],
    techniques: [],
    spells: [],
    attacks: [],
    armor: [],
    equipment: [],

    notes: {
      background: "",
      personality: "",
      goals: "",
      gm: "",
      development: "",
    },
  };

  const state = {
    character: Storage.loadSavedCharacter(DEFAULT_CHARACTER),
    library: Storage.normalizeLibrary({}),
    activeTab: "builder",
    sheetEdit: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function html(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function number(value, fallback = 0) {
    return Calc.toNumber(value, fallback);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function setHTML(id, value) {
    const el = $(id);
    if (el) el.innerHTML = value ?? "";
  }

  function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;

    if (document.activeElement === el) return;

    el.value = value ?? "";
  }

  function getCharacterFilename() {
    const name = state.character.meta.name || "gurps-character";
    return Storage.sanitizeFilename(name, "gurps-character");
  }

  function persistCharacter() {
    Storage.saveCharacter(state.character);
  }

  function persistLibrary() {
    Storage.saveLibrary(state.library);
  }

  function setCharacter(mutator) {
    const next =
      typeof mutator === "function"
        ? mutator(Storage.clone(state.character))
        : mutator;

    state.character = next;
    persistCharacter();
    render();
  }

  function setLibrary(mutator) {
    const next =
      typeof mutator === "function"
        ? mutator(Storage.clone(state.library))
        : mutator;

    state.library = Storage.normalizeLibrary(next);
    persistLibrary();
    renderLibrary();
    renderLibrarySelects();
  }

  function makeId(prefix) {
    return Storage.createId(prefix);
  }

  function blankTrait(type = "Advantage") {
    const defaultPoints = {
      Advantage: 10,
      Disadvantage: -10,
      Perk: 1,
      Quirk: -1,
      Language: 0,
      Culture: 1,
      Contact: 0,
      "Meta-trait": 0,
      Other: 0,
    };

    return {
      id: makeId("trait"),
      name: "",
      type,
      levels: 1,
      baseCost: defaultPoints[type] ?? 0,
      modifierPct: 0,
      points: defaultPoints[type] ?? 0,
      autoCost: false,
      page: "",
      notes: "",
    };
  }

  function blankSkill(overrides = {}) {
    return {
      id: makeId("skill"),
      name: "",
      specialty: "",
      stat: "DX",
      difficulty: "Average",
      points: 1,
      manualLevel: "",
      default: "",
      prereq: "",
      page: "",
      notes: "",
      ...overrides,
    };
  }

  function blankTechnique() {
    return {
      id: makeId("technique"),
      name: "",
      baseSkill: "",
      points: 1,
      manualLevel: "",
      page: "",
      notes: "",
    };
  }

  function blankSpell() {
    return blankSkill({
      id: makeId("spell"),
      stat: "IQ",
      difficulty: "Hard",
      college: "",
    });
  }

  function blankAttack() {
    return {
      id: makeId("attack"),
      name: "",
      skill: "",
      level: "",
      damage: "",
      damageType: "",
      reach: "",
      range: "",
      parry: "",
      acc: "",
      bulk: "",
      minST: "",
      notes: "",
    };
  }

  function blankArmor() {
    return {
      id: makeId("armor"),
      name: "",
      location: "Torso",
      DR: "",
      qty: 1,
      weight: 0,
      cost: 0,
      LC: "",
      TL: "",
      notes: "",
    };
  }

  function blankGear() {
    return {
      id: makeId("gear"),
      name: "",
      qty: 1,
      weight: 0,
      cost: 0,
      location: "Carried",
      LC: "",
      TL: "",
      notes: "",
    };
  }

  function optionList(values, selectedValue) {
    return values
      .map((value) => {
        const selected = String(value) === String(selectedValue) ? "selected" : "";
        return `<option value="${html(value)}" ${selected}>${html(value)}</option>`;
      })
      .join("");
  }

  function setMetaField(key, value) {
    setCharacter((character) => {
      character.meta[key] = value;
      return character;
    });
  }

  function setStatField(key, value) {
    setCharacter((character) => {
      const oldValue = number(character.stats[key], 10);
      const nextValue = number(value, 10);

      character.stats[key] = nextValue;

      if (key === "ST" && number(character.secondary.HP, oldValue) === oldValue) {
        character.secondary.HP = nextValue;
        character.secondary.currentHP = nextValue;
      }

      if (key === "IQ" && number(character.secondary.Will, oldValue) === oldValue) {
        character.secondary.Will = nextValue;
      }

      if (key === "IQ" && number(character.secondary.Per, oldValue) === oldValue) {
        character.secondary.Per = nextValue;
      }

      if (key === "HT" && number(character.secondary.FP, oldValue) === oldValue) {
        character.secondary.FP = nextValue;
        character.secondary.currentFP = nextValue;
      }

      return character;
    });
  }

  function setSecondaryField(key, value) {
    setCharacter((character) => {
      character.secondary[key] = value;
      return character;
    });
  }

  function setNoteField(key, value) {
    setCharacter((character) => {
      character.notes[key] = value;
      return character;
    });
  }

  function getListByName(name) {
    if (name === "traits") return state.character.traits;
    if (name === "skills") return state.character.skills;
    if (name === "techniques") return state.character.techniques;
    if (name === "spells") return state.character.spells;
    if (name === "attacks") return state.character.attacks;
    if (name === "armor") return state.character.armor;
    if (name === "equipment") return state.character.equipment;
    return [];
  }

  function setListByName(character, name, list) {
    if (name === "traits") character.traits = list;
    if (name === "skills") character.skills = list;
    if (name === "techniques") character.techniques = list;
    if (name === "spells") character.spells = list;
    if (name === "attacks") character.attacks = list;
    if (name === "armor") character.armor = list;
    if (name === "equipment") character.equipment = list;
  }

  function updateListItem(listName, rowId, field, value, type = "text") {
    setCharacter((character) => {
      const list = getListByNameFromCharacter(character, listName);

      const next = list.map((item) => {
        if (item.id !== rowId) return item;

        let parsedValue = value;

        if (type === "number") parsedValue = number(value, 0);
        if (type === "checkbox") parsedValue = Boolean(value);

        return {
          ...item,
          [field]: parsedValue,
        };
      });

      setListByName(character, listName, next);
      return character;
    });
  }

  function getListByNameFromCharacter(character, name) {
    if (name === "traits") return character.traits;
    if (name === "skills") return character.skills;
    if (name === "techniques") return character.techniques;
    if (name === "spells") return character.spells;
    if (name === "attacks") return character.attacks;
    if (name === "armor") return character.armor;
    if (name === "equipment") return character.equipment;
    return [];
  }

  function addRow(listName, row) {
    setCharacter((character) => {
      const list = getListByNameFromCharacter(character, listName);
      setListByName(character, listName, [...list, row]);
      return character;
    });
  }

  function removeRow(listName, rowId) {
    setCharacter((character) => {
      const list = getListByNameFromCharacter(character, listName);
      setListByName(
        character,
        listName,
        list.filter((item) => item.id !== rowId)
      );
      return character;
    });
  }

  function duplicateRow(listName, rowId) {
    setCharacter((character) => {
      const list = getListByNameFromCharacter(character, listName);
      const item = list.find((entry) => entry.id === rowId);

      if (!item) return character;

      setListByName(character, listName, [
        ...list,
        {
          ...item,
          id: makeId(listName),
          name: `${item.name || "Entry"} copy`,
        },
      ]);

      return character;
    });
  }

  function addFromLibrary(category, itemId) {
    const item = state.library[category]?.find((entry) => entry.id === itemId);
    if (!item) return;

    if (category === "traits") {
      addRow("traits", {
        ...blankTrait(item.type || "Advantage"),
        ...item,
        id: makeId("trait"),
      });
    }

    if (category === "skills") {
      addRow("skills", {
        ...blankSkill(),
        ...item,
        id: makeId("skill"),
      });
    }

    if (category === "techniques") {
      addRow("techniques", {
        ...blankTechnique(),
        ...item,
        id: makeId("technique"),
      });
    }

    if (category === "spells") {
      addRow("spells", {
        ...blankSpell(),
        ...item,
        id: makeId("spell"),
      });
    }

    if (category === "weapons") {
      addRow("attacks", {
        ...blankAttack(),
        ...item,
        id: makeId("attack"),
      });
    }

    if (category === "armor") {
      addRow("armor", {
        ...blankArmor(),
        ...item,
        id: makeId("armor"),
      });
    }

    if (category === "gear") {
      addRow("equipment", {
        ...blankGear(),
        ...item,
        id: makeId("gear"),
      });
    }
  }

  function rowActions(listName, rowId) {
    return `
      <div class="row-actions">
        <button
          class="btn btn-secondary"
          type="button"
          data-action="duplicate-row"
          data-list="${html(listName)}"
          data-id="${html(rowId)}"
        >
          Kopier
        </button>

        <button
          class="btn btn-danger"
          type="button"
          data-action="remove-row"
          data-list="${html(listName)}"
          data-id="${html(rowId)}"
        >
          Slett
        </button>
      </div>
    `;
  }

  function inputCell(listName, row, field, type = "text", extra = "") {
    const value = row[field] ?? "";

    return `
      <input
        type="${html(type)}"
        value="${html(value)}"
        data-list="${html(listName)}"
        data-id="${html(row.id)}"
        data-field="${html(field)}"
        data-value-type="${type === "number" ? "number" : "text"}"
        ${extra}
      />
    `;
  }

  function checkboxCell(listName, row, field) {
    return `
      <input
        type="checkbox"
        ${row[field] ? "checked" : ""}
        data-list="${html(listName)}"
        data-id="${html(row.id)}"
        data-field="${html(field)}"
        data-value-type="checkbox"
      />
    `;
  }

  function selectCell(listName, row, field, values) {
    return `
      <select
        data-list="${html(listName)}"
        data-id="${html(row.id)}"
        data-field="${html(field)}"
        data-value-type="text"
      >
        ${optionList(values, row[field])}
      </select>
    `;
  }

  function textareaCell(listName, row, field) {
    return `
      <textarea
        data-list="${html(listName)}"
        data-id="${html(row.id)}"
        data-field="${html(field)}"
        data-value-type="text"
      >${html(row[field] ?? "")}</textarea>
    `;
  }

  function renderTraitsTable() {
    const body = $("traitsBody");
    if (!body) return;

    if (state.character.traits.length === 0) {
      body.innerHTML = `<tr><td colspan="10" class="empty-row">Ingen traits ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.traits
      .map((trait) => {
        const points = Calc.calculateTraitPoints(trait);

        return `
          <tr>
            <td>${inputCell("traits", trait, "name")}</td>
            <td>${selectCell("traits", trait, "type", TRAIT_TYPES)}</td>
            <td>${inputCell("traits", trait, "levels", "number")}</td>
            <td>${inputCell("traits", trait, "baseCost", "number")}</td>
            <td>${inputCell("traits", trait, "modifierPct", "number")}</td>
            <td>
              <input
                type="number"
                value="${html(points)}"
                ${trait.autoCost ? "readonly" : ""}
                data-list="traits"
                data-id="${html(trait.id)}"
                data-field="points"
                data-value-type="number"
              />
            </td>
            <td>${checkboxCell("traits", trait, "autoCost")}</td>
            <td>${inputCell("traits", trait, "page")}</td>
            <td>${textareaCell("traits", trait, "notes")}</td>
            <td>${rowActions("traits", trait.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSkillsTable() {
    const body = $("skillsBody");
    if (!body) return;

    if (state.character.skills.length === 0) {
      body.innerHTML = `<tr><td colspan="12" class="empty-row">Ingen skills ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.skills
      .map((skill) => {
        const level = Calc.calculateSkillLevel(state.character, skill);
        const relative = Calc.calculateSkillRelativeText(state.character, skill);

        return `
          <tr>
            <td>${inputCell("skills", skill, "name")}</td>
            <td>${inputCell("skills", skill, "specialty")}</td>
            <td>${selectCell("skills", skill, "stat", SKILL_STATS)}</td>
            <td>${selectCell("skills", skill, "difficulty", DIFFICULTIES)}</td>
            <td>${inputCell("skills", skill, "points", "number")}</td>
            <td>${inputCell("skills", skill, "manualLevel", "number")}</td>
            <td><strong>${html(level)}</strong></td>
            <td><strong>${html(relative)}</strong></td>
            <td>${inputCell("skills", skill, "default")}</td>
            <td>${inputCell("skills", skill, "page")}</td>
            <td>${textareaCell("skills", skill, "notes")}</td>
            <td>${rowActions("skills", skill.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderTechniquesTable() {
    const body = $("techniquesBody");
    if (!body) return;

    if (state.character.techniques.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="empty-row">Ingen techniques ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.techniques
      .map((technique) => {
        return `
          <tr>
            <td>${inputCell("techniques", technique, "name")}</td>
            <td>${inputCell("techniques", technique, "baseSkill")}</td>
            <td>${inputCell("techniques", technique, "points", "number")}</td>
            <td>${inputCell("techniques", technique, "manualLevel", "number")}</td>
            <td>${inputCell("techniques", technique, "page")}</td>
            <td>${rowActions("techniques", technique.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSpellsTable() {
    const body = $("spellsBody");
    if (!body) return;

    if (state.character.spells.length === 0) {
      body.innerHTML = `<tr><td colspan="8" class="empty-row">Ingen spells/powers ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.spells
      .map((spell) => {
        const level = Calc.calculateSkillLevel(state.character, spell);

        return `
          <tr>
            <td>${inputCell("spells", spell, "name")}</td>
            <td>${inputCell("spells", spell, "college")}</td>
            <td>${selectCell("spells", spell, "stat", SKILL_STATS)}</td>
            <td>${selectCell("spells", spell, "difficulty", DIFFICULTIES)}</td>
            <td>${inputCell("spells", spell, "points", "number")}</td>
            <td><strong>${html(level)}</strong></td>
            <td>${inputCell("spells", spell, "page")}</td>
            <td>${rowActions("spells", spell.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderWeaponsTable() {
    const body = $("weaponsBody");
    if (!body) return;

    if (state.character.attacks.length === 0) {
      body.innerHTML = `<tr><td colspan="12" class="empty-row">Ingen våpen/angrep ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.attacks
      .map((attack) => {
        return `
          <tr>
            <td>${inputCell("attacks", attack, "name")}</td>
            <td>${inputCell("attacks", attack, "skill")}</td>
            <td>${inputCell("attacks", attack, "level")}</td>
            <td>${inputCell("attacks", attack, "damage")}</td>
            <td>${inputCell("attacks", attack, "damageType")}</td>
            <td>${inputCell("attacks", attack, "reach")}</td>
            <td>${inputCell("attacks", attack, "parry")}</td>
            <td>${inputCell("attacks", attack, "acc")}</td>
            <td>${inputCell("attacks", attack, "bulk")}</td>
            <td>${inputCell("attacks", attack, "minST")}</td>
            <td>${textareaCell("attacks", attack, "notes")}</td>
            <td>${rowActions("attacks", attack.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderArmorTable() {
    const body = $("armorBody");
    if (!body) return;

    if (state.character.armor.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="empty-row">Ingen armor ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.armor
      .map((armor) => {
        return `
          <tr>
            <td>${inputCell("armor", armor, "name")}</td>
            <td>${inputCell("armor", armor, "location")}</td>
            <td>${inputCell("armor", armor, "DR")}</td>
            <td>${inputCell("armor", armor, "weight", "number")}</td>
            <td>${inputCell("armor", armor, "cost", "number")}</td>
            <td>${textareaCell("armor", armor, "notes")}</td>
            <td>${rowActions("armor", armor.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderGearTable() {
    const body = $("gearBody");
    if (!body) return;

    if (state.character.equipment.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="empty-row">Ingen gear ennå.</td></tr>`;
      return;
    }

    body.innerHTML = state.character.equipment
      .map((gear) => {
        return `
          <tr>
            <td>${inputCell("equipment", gear, "name")}</td>
            <td>${inputCell("equipment", gear, "qty", "number")}</td>
            <td>${inputCell("equipment", gear, "weight", "number")}</td>
            <td>${inputCell("equipment", gear, "cost", "number")}</td>
            <td>${inputCell("equipment", gear, "location")}</td>
            <td>
              <div class="field-stack">
                ${inputCell("equipment", gear, "LC")}
                ${inputCell("equipment", gear, "TL")}
              </div>
            </td>
            <td>${rowActions("equipment", gear.id)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderTables() {
    renderTraitsTable();
    renderSkillsTable();
    renderTechniquesTable();
    renderSpellsTable();
    renderWeaponsTable();
    renderArmorTable();
    renderGearTable();
  }

  function renderLibrarySelect(selectId, category) {
    const select = $(selectId);
    if (!select) return;

    const items = state.library[category] || [];

    const label = select.querySelector("option")?.textContent || "Fra bibliotek";

    select.innerHTML = `
      <option value="">${html(label)}</option>
      ${items
        .map((item) => {
          const extra = item.type ? ` (${item.type})` : item.difficulty ? ` (${item.difficulty})` : "";
          return `<option value="${html(item.id)}">${html(item.name)}${html(extra)}</option>`;
        })
        .join("")}
    `;
  }

  function renderLibrarySelects() {
    renderLibrarySelect("traitLibrarySelect", "traits");
    renderLibrarySelect("skillLibrarySelect", "skills");
    renderLibrarySelect("weaponLibrarySelect", "weapons");
    renderLibrarySelect("armorLibrarySelect", "armor");
    renderLibrarySelect("gearLibrarySelect", "gear");
  }

  function renderSummary() {
    const calc = Calc.calculateCharacter(state.character);

    setText("summaryPointBudget", calc.pointBudget);
    setText("summaryTotalPoints", calc.totalPoints);
    setText("summaryRemainingPoints", calc.remainingPoints);
    setText("summaryDisadvantagePoints", calc.disadvantagePoints);
    setText("summaryEncumbrance", calc.encumbrance.name);

    setText("costST", `${Calc.signed(calc.statCosts.ST)} CP`);
    setText("costDX", `${Calc.signed(calc.statCosts.DX)} CP`);
    setText("costIQ", `${Calc.signed(calc.statCosts.IQ)} CP`);
    setText("costHT", `${Calc.signed(calc.statCosts.HT)} CP`);

    setText("derivedDamage", `${calc.damage.thrust} / ${calc.damage.swing}`);
    setText("derivedBasicLift", `${calc.basicLift} lb`);
    setText("derivedBasicSpeed", calc.basicSpeed.toFixed(2));
    setText("derivedMove", `${calc.basicMove} / ${calc.loadedMove}`);
    setText("derivedDodge", calc.dodge);
    setText("derivedCarriedWeight", `${calc.carriedWeight} lb`);
    setText("derivedStartingWealth", `$${calc.startingWealth.toLocaleString()}`);
  }

  function syncFormFields() {
    const c = state.character;

    setInputValue("charName", c.meta.name);
    setInputValue("charPlayer", c.meta.player);
    setInputValue("charCampaign", c.meta.campaign);
    setInputValue("charPointBudget", c.meta.pointBudget);
    setInputValue("charConcept", c.meta.concept);
    setInputValue("charSpecies", c.meta.species);
    setInputValue("charTemplate", c.meta.template);
    setInputValue("charProfession", c.meta.profession);
    setInputValue("charTL", c.meta.TL);
    setInputValue("charDisadLimit", c.meta.disadLimit);
    setInputValue("charSM", c.meta.SM);
    setInputValue("charHandedness", c.meta.handedness);
    setInputValue("charAge", c.meta.age);
    setInputValue("charHeight", c.meta.height);
    setInputValue("charWeight", c.meta.weight);
    setInputValue("charAppearance", c.meta.appearance);
    setInputValue("charStatus", c.meta.status);
    setInputValue("charWealthLevel", c.meta.wealthLevel);
    setInputValue("charStartingWealthOverride", c.meta.startingWealthOverride);
    setInputValue("charReputation", c.meta.reputation);
    setInputValue("charCampaignPremise", c.meta.campaignPremise);
    setInputValue("charHouseRules", c.meta.houseRules);

    setInputValue("statST", c.stats.ST);
    setInputValue("statDX", c.stats.DX);
    setInputValue("statIQ", c.stats.IQ);
    setInputValue("statHT", c.stats.HT);

    setInputValue("secHP", c.secondary.HP);
    setInputValue("secCurrentHP", c.secondary.currentHP);
    setInputValue("secWill", c.secondary.Will);
    setInputValue("secPer", c.secondary.Per);
    setInputValue("secFP", c.secondary.FP);
    setInputValue("secCurrentFP", c.secondary.currentFP);
    setInputValue("secSpeedAdj", c.secondary.speedAdj);
    setInputValue("secMoveAdj", c.secondary.moveAdj);
    setInputValue("secShieldDB", c.secondary.shieldDB);
    setInputValue("secDodgeBonus", c.secondary.dodgeBonus);
    setInputValue("secParry", c.secondary.parry);
    setInputValue("secBlock", c.secondary.block);
    setInputValue("secDR", c.secondary.DR);
    setInputValue("secThrOverride", c.secondary.thrOverride);
    setInputValue("secSwOverride", c.secondary.swOverride);

    setInputValue("noteBackground", c.notes.background);
    setInputValue("notePersonality", c.notes.personality);
    setInputValue("noteGoals", c.notes.goals);
    setInputValue("noteGM", c.notes.gm);
    setInputValue("noteDevelopment", c.notes.development);

    renderPortrait();
  }

  function renderPortrait() {
    const preview = $("portraitPreview");
    if (!preview) return;

    if (state.character.portrait) {
      preview.innerHTML = `<img src="${state.character.portrait}" alt="Character portrait">`;
    } else {
      preview.innerHTML = `<span>Karakterbilde</span>`;
    }
  }

  function sheetRows(items, cols, emptyColspan) {
    if (!items.length) {
      return `<tr><td colspan="${emptyColspan}" class="empty-row">—</td></tr>`;
    }

    return items
      .map((item) => {
        return `
          <tr>
            ${cols
              .map((col) => {
                const value = typeof col === "function" ? col(item) : item[col];
                return `<td>${html(value ?? "")}</td>`;
              })
              .join("")}
          </tr>
        `;
      })
      .join("");
  }

  function renderSheet() {
    const c = state.character;
    const calc = Calc.calculateCharacter(c);

    const sheet = $("characterSheet");
    if (sheet) sheet.contentEditable = state.sheetEdit ? "true" : "false";

    setText("sheetName", c.meta.name || "Unnamed Character");
    setText("sheetPlayer", c.meta.player || "—");
    setText("sheetCampaign", c.meta.campaign || "—");
    setText("sheetConcept", c.meta.concept || "—");
    setText("sheetSpeciesTemplate", `${c.meta.species || "Human"} / ${c.meta.template || "—"}`);
    setText("sheetTL", c.meta.TL);
    setText("sheetSM", c.meta.SM);

    setText("sheetPointBudget", calc.pointBudget);
    setText("sheetTotalPoints", calc.totalPoints);
    setText("sheetRemainingPoints", calc.remainingPoints);
    setText("sheetDisadLimit", c.meta.disadLimit);

    setText("sheetST", c.stats.ST);
    setText("sheetDX", c.stats.DX);
    setText("sheetIQ", c.stats.IQ);
    setText("sheetHT", c.stats.HT);

    setText("sheetHP", c.secondary.HP);
    setText("sheetWill", c.secondary.Will);
    setText("sheetPer", c.secondary.Per);
    setText("sheetFP", c.secondary.FP);
    setText("sheetSpeed", calc.basicSpeed.toFixed(2));
    setText("sheetMove", calc.basicMove);
    setText("sheetDodge", calc.dodge);
    setText("sheetDR", c.secondary.DR || "—");

    setText("sheetDamage", `${calc.damage.thrust} / ${calc.damage.swing}`);
    setText("sheetBasicLift", `${calc.basicLift} lb`);
    setText("sheetEncumbrance", calc.encumbrance.name);
    setText("sheetLoadedMove", calc.loadedMove);
    setText("sheetParryBlock", `${c.secondary.parry || "—"} / ${c.secondary.block || "—"}`);

    const sheetPortrait = $("sheetPortrait");
    if (sheetPortrait) {
      sheetPortrait.innerHTML = c.portrait
        ? `<img src="${c.portrait}" alt="Character portrait">`
        : `<span>Portrait</span>`;
    }

    setHTML(
      "sheetTraitsBody",
      sheetRows(
        c.traits,
        [
          "name",
          "type",
          (item) => Calc.calculateTraitPoints(item),
          "notes",
        ],
        4
      )
    );

    const allSkills = [
      ...c.skills.map((item) => ({ ...item, sheetKind: "Skill" })),
      ...c.techniques.map((item) => ({
        ...item,
        sheetKind: "Technique",
        stat: item.baseSkill || "",
        difficulty: "Technique",
      })),
      ...c.spells.map((item) => ({ ...item, sheetKind: "Spell" })),
    ];

    setHTML(
      "sheetSkillsBody",
      sheetRows(
        allSkills,
        [
          "name",
          "stat",
          "difficulty",
          (item) =>
            item.sheetKind === "Technique"
              ? item.manualLevel || "—"
              : Calc.calculateSkillLevel(c, item),
          (item) =>
            item.sheetKind === "Technique"
              ? "—"
              : Calc.calculateSkillRelativeText(c, item),
          "points",
          (item) => item.notes || item.default || item.prereq || "",
        ],
        7
      )
    );

    setHTML(
      "sheetWeaponsBody",
      sheetRows(
        c.attacks,
        [
          "name",
          "skill",
          "damage",
          (item) => item.reach || item.range || "",
          "parry",
          "notes",
        ],
        6
      )
    );

    setHTML(
      "sheetGearBody",
      sheetRows(
        [...c.armor, ...c.equipment],
        [
          "name",
          "location",
          (item) => item.DR || "",
          "weight",
          "cost",
        ],
        5
      )
    );

    setText("sheetBackground", c.notes.background || "");
    setText(
      "sheetNotes",
      [c.notes.personality, c.notes.goals, c.notes.gm]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  function renderLibrary() {
    const category = $("libraryCategory")?.value || "traits";
    const search = ($("librarySearch")?.value || "").toLowerCase();
    const list = $("libraryList");

    if (!list) return;

    const items = state.library[category] || [];

    const filtered = items.filter((item) => {
      const searchable = [
        item.name,
        item.type,
        item.stat,
        item.difficulty,
        item.page,
        item.notes,
        item.source,
        ...(Array.isArray(item.tags) ? item.tags : []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });

    if (filtered.length === 0) {
      list.innerHTML = `<p class="empty-row">Ingen treff i valgt bibliotek.</p>`;
      return;
    }

    list.innerHTML = filtered
      .map((item) => {
        const meta = [
          item.type,
          item.stat,
          item.difficulty,
          item.points !== undefined ? `${item.points} CP` : "",
          item.page,
          item.TL ? `TL ${item.TL}` : "",
          item.LC ? `LC ${item.LC}` : "",
        ].filter(Boolean);

        return `
          <article class="library-item">
            <div>
              <h3>${html(item.name || "Unnamed")}</h3>
              <p>${html(item.notes || item.prereq || item.default || "")}</p>
              <div class="library-item__meta">
                ${meta.map((value) => `<span class="badge">${html(value)}</span>`).join("")}
              </div>
            </div>

            <button
              class="btn btn-secondary"
              type="button"
              data-action="add-library-item"
              data-category="${html(category)}"
              data-id="${html(item.id)}"
            >
              Bruk
            </button>
          </article>
        `;
      })
      .join("");
  }

  function renderTabs() {
    all("[data-tab-target]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabTarget === state.activeTab);
    });

    all("[data-tab-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === state.activeTab);
    });
  }

  function render() {
    renderTabs();
    syncFormFields();
    renderSummary();
    renderLibrarySelects();
    renderTables();
    renderSheet();
    renderLibrary();
  }

  function bindField(id, callback, eventName = "input") {
    const el = $(id);
    if (!el) return;

    el.addEventListener(eventName, (event) => {
      callback(event.target.value);
    });
  }

  function bindStaticFields() {
    bindField("charName", (value) => setMetaField("name", value));
    bindField("charPlayer", (value) => setMetaField("player", value));
    bindField("charCampaign", (value) => setMetaField("campaign", value));
    bindField("charPointBudget", (value) => setMetaField("pointBudget", number(value, 0)));
    bindField("charConcept", (value) => setMetaField("concept", value));
    bindField("charSpecies", (value) => setMetaField("species", value));
    bindField("charTemplate", (value) => setMetaField("template", value));
    bindField("charProfession", (value) => setMetaField("profession", value));
    bindField("charTL", (value) => setMetaField("TL", number(value, 0)));
    bindField("charDisadLimit", (value) => setMetaField("disadLimit", number(value, 0)));
    bindField("charSM", (value) => setMetaField("SM", number(value, 0)));
    bindField("charHandedness", (value) => setMetaField("handedness", value), "change");
    bindField("charAge", (value) => setMetaField("age", value));
    bindField("charHeight", (value) => setMetaField("height", value));
    bindField("charWeight", (value) => setMetaField("weight", value));
    bindField("charAppearance", (value) => setMetaField("appearance", value));
    bindField("charStatus", (value) => setMetaField("status", number(value, 0)));
    bindField("charWealthLevel", (value) => setMetaField("wealthLevel", value));
    bindField("charStartingWealthOverride", (value) => setMetaField("startingWealthOverride", value));
    bindField("charReputation", (value) => setMetaField("reputation", value));
    bindField("charCampaignPremise", (value) => setMetaField("campaignPremise", value));
    bindField("charHouseRules", (value) => setMetaField("houseRules", value));

    bindField("statST", (value) => setStatField("ST", value));
    bindField("statDX", (value) => setStatField("DX", value));
    bindField("statIQ", (value) => setStatField("IQ", value));
    bindField("statHT", (value) => setStatField("HT", value));

    bindField("secHP", (value) => setSecondaryField("HP", number(value, 0)));
    bindField("secCurrentHP", (value) => setSecondaryField("currentHP", number(value, 0)));
    bindField("secWill", (value) => setSecondaryField("Will", number(value, 0)));
    bindField("secPer", (value) => setSecondaryField("Per", number(value, 0)));
    bindField("secFP", (value) => setSecondaryField("FP", number(value, 0)));
    bindField("secCurrentFP", (value) => setSecondaryField("currentFP", number(value, 0)));
    bindField("secSpeedAdj", (value) => setSecondaryField("speedAdj", number(value, 0)));
    bindField("secMoveAdj", (value) => setSecondaryField("moveAdj", number(value, 0)));
    bindField("secShieldDB", (value) => setSecondaryField("shieldDB", number(value, 0)));
    bindField("secDodgeBonus", (value) => setSecondaryField("dodgeBonus", number(value, 0)));
    bindField("secParry", (value) => setSecondaryField("parry", value));
    bindField("secBlock", (value) => setSecondaryField("block", value));
    bindField("secDR", (value) => setSecondaryField("DR", value));
    bindField("secThrOverride", (value) => setSecondaryField("thrOverride", value));
    bindField("secSwOverride", (value) => setSecondaryField("swOverride", value));

    bindField("noteBackground", (value) => setNoteField("background", value));
    bindField("notePersonality", (value) => setNoteField("personality", value));
    bindField("noteGoals", (value) => setNoteField("goals", value));
    bindField("noteGM", (value) => setNoteField("gm", value));
    bindField("noteDevelopment", (value) => setNoteField("development", value));

    bindField("libraryCategory", () => renderLibrary(), "change");
    bindField("librarySearch", () => renderLibrary(), "input");
  }

  function bindLibrarySelects() {
    const selectors = [
      ["traitLibrarySelect", "traits"],
      ["skillLibrarySelect", "skills"],
      ["weaponLibrarySelect", "weapons"],
      ["armorLibrarySelect", "armor"],
      ["gearLibrarySelect", "gear"],
    ];

    selectors.forEach(([id, category]) => {
      const select = $(id);
      if (!select) return;

      select.addEventListener("change", (event) => {
        const itemId = event.target.value;
        if (!itemId) return;

        addFromLibrary(category, itemId);
        event.target.value = "";
      });
    });
  }

  function bindPortrait() {
    const portraitInput = $("portraitInput");

    if (portraitInput) {
      portraitInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
          setCharacter((character) => {
            character.portrait = String(reader.result || "");
            return character;
          });
        };

        reader.readAsDataURL(file);
      });
    }
  }

  function bindCharacterImport() {
    const input = $("characterImportInput");

    if (!input) return;

    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        state.character = await Storage.importCharacterFile(file, DEFAULT_CHARACTER);
        persistCharacter();
        render();
      } catch (error) {
        alert(error.message || "Kunne ikke importere karakter.");
      } finally {
        input.value = "";
      }
    });
  }

  function bindTableEditing() {
    document.addEventListener("input", (event) => {
      const target = event.target;

      if (!target.matches("[data-list][data-id][data-field]")) return;
      if (target.type === "checkbox") return;

      updateListItem(
        target.dataset.list,
        target.dataset.id,
        target.dataset.field,
        target.value,
        target.dataset.valueType || "text"
      );
    });

    document.addEventListener("change", (event) => {
      const target = event.target;

      if (!target.matches("[data-list][data-id][data-field]")) return;

      const value = target.type === "checkbox" ? target.checked : target.value;

      updateListItem(
        target.dataset.list,
        target.dataset.id,
        target.dataset.field,
        value,
        target.dataset.valueType || "text"
      );
    });
  }

  function bindTabs() {
    document.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-tab-target]");
      if (!tabButton) return;

      state.activeTab = tabButton.dataset.tabTarget;
      renderTabs();

      if (state.activeTab === "sheet") {
        renderSheet();
      }

      if (state.activeTab === "library") {
        renderLibrary();
      }
    });
  }

  async function handleAction(action, button) {
    if (action === "new-character") {
      const confirmed = confirm("Vil du lage en ny blank karakter? Dette overskriver nåværende karakter i nettleseren.");
      if (!confirmed) return;

      state.character = Storage.clone(DEFAULT_CHARACTER);
      persistCharacter();
      render();
      return;
    }

    if (action === "save-character") {
      persistCharacter();
      alert("Karakteren er lagret lokalt i nettleseren.");
      return;
    }

    if (action === "export-character") {
      Storage.exportCharacter(state.character);
      return;
    }

    if (action === "import-character") {
      $("characterImportInput")?.click();
      return;
    }

    if (action === "print-sheet") {
      state.activeTab = "sheet";
      render();
      window.print();
      return;
    }

    if (action === "upload-portrait") {
      $("portraitInput")?.click();
      return;
    }

    if (action === "remove-portrait") {
      setCharacter((character) => {
        character.portrait = "";
        return character;
      });
      return;
    }

    if (action === "add-trait") {
      addRow("traits", blankTrait("Advantage"));
      return;
    }

    if (action === "add-skill") {
      addRow("skills", blankSkill());
      return;
    }

    if (action === "add-technique") {
      addRow("techniques", blankTechnique());
      return;
    }

    if (action === "add-spell") {
      addRow("spells", blankSpell());
      return;
    }

    if (action === "add-weapon") {
      addRow("attacks", blankAttack());
      return;
    }

    if (action === "add-armor") {
      addRow("armor", blankArmor());
      return;
    }

    if (action === "add-gear") {
      addRow("equipment", blankGear());
      return;
    }

    if (action === "remove-row") {
      removeRow(button.dataset.list, button.dataset.id);
      return;
    }

    if (action === "duplicate-row") {
      duplicateRow(button.dataset.list, button.dataset.id);
      return;
    }

    if (action === "reload-library") {
      state.library = await Storage.loadCompleteLibrary();
      persistLibrary();
      render();
      return;
    }

    if (action === "export-library") {
      Storage.exportLibrary(state.library);
      return;
    }

    if (action === "import-library-json") {
      const text = $("libraryImportText")?.value || "";
      const selectedCategory = $("libraryCategory")?.value || "traits";

      try {
        state.library = Storage.importLibraryText(
          text,
          state.library,
          selectedCategory
        );

        persistLibrary();
        $("libraryImportText").value = "";
        render();
      } catch (error) {
        alert(error.message || "Kunne ikke importere JSON.");
      }

      return;
    }

    if (action === "clear-library-import") {
      if ($("libraryImportText")) $("libraryImportText").value = "";
      return;
    }

    if (action === "toggle-sheet-edit") {
      state.sheetEdit = !state.sheetEdit;
      renderSheet();
      return;
    }

    if (action === "add-library-item") {
      addFromLibrary(button.dataset.category, button.dataset.id);
      return;
    }
  }

  function bindActions() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      event.preventDefault();

      await handleAction(button.dataset.action, button);
    });
  }

  async function init() {
    state.library = await Storage.loadCompleteLibrary();

    bindTabs();
    bindStaticFields();
    bindLibrarySelects();
    bindPortrait();
    bindCharacterImport();
    bindTableEditing();
    bindActions();

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
