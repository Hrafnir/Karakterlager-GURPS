/* =========================================================
   GURPS Character Forge
   File: js/calculations.js

   Purpose:
   Pure calculation functions.
   No DOM manipulation here.
   Exposes: window.GURPSCalc
   ========================================================= */

(function () {
  "use strict";

  const STAT_COSTS = {
    ST: 10,
    DX: 20,
    IQ: 20,
    HT: 10,
  };

  const SECONDARY_COSTS = {
    HP: 2,
    Will: 5,
    Per: 5,
    FP: 3,
  };

  const STARTING_WEALTH_BY_TL = {
    0: 250,
    1: 500,
    2: 750,
    3: 1000,
    4: 2000,
    5: 5000,
    6: 10000,
    7: 15000,
    8: 20000,
    9: 30000,
    10: 50000,
    11: 75000,
    12: 100000,
  };

  const DAMAGE_BY_ST = {
    1: ["1d-6", "1d-5"],
    2: ["1d-6", "1d-5"],
    3: ["1d-5", "1d-4"],
    4: ["1d-5", "1d-4"],
    5: ["1d-4", "1d-3"],
    6: ["1d-4", "1d-3"],
    7: ["1d-3", "1d-2"],
    8: ["1d-3", "1d-2"],
    9: ["1d-2", "1d-1"],
    10: ["1d-2", "1d"],
    11: ["1d-1", "1d+1"],
    12: ["1d-1", "1d+2"],
    13: ["1d", "2d-1"],
    14: ["1d", "2d"],
    15: ["1d+1", "2d+1"],
    16: ["1d+1", "2d+2"],
    17: ["1d+2", "3d-1"],
    18: ["1d+2", "3d"],
    19: ["2d-1", "3d+1"],
    20: ["2d-1", "3d+2"],
    21: ["2d", "4d-1"],
    22: ["2d", "4d"],
    23: ["2d+1", "4d+1"],
    24: ["2d+1", "4d+2"],
    25: ["2d+2", "5d-1"],
    26: ["2d+2", "5d"],
    27: ["3d-1", "5d+1"],
    28: ["3d-1", "5d+1"],
    29: ["3d", "5d+2"],
    30: ["3d", "5d+2"],
    31: ["3d+1", "6d-1"],
    32: ["3d+1", "6d-1"],
    33: ["3d+2", "6d"],
    34: ["3d+2", "6d"],
    35: ["4d-1", "6d+1"],
    36: ["4d-1", "6d+1"],
    37: ["4d", "6d+2"],
    38: ["4d", "6d+2"],
    39: ["4d+1", "7d-1"],
    40: ["4d+1", "7d-1"],
  };

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(toNumber(value) * factor) / factor;
  }

  function signed(value) {
    const number = toNumber(value);
    return number > 0 ? `+${number}` : `${number}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getPrimaryAttribute(character, attribute) {
    if (!character || !character.stats) return 10;

    if (attribute === "ST") return toNumber(character.stats.ST, 10);
    if (attribute === "DX") return toNumber(character.stats.DX, 10);
    if (attribute === "IQ") return toNumber(character.stats.IQ, 10);
    if (attribute === "HT") return toNumber(character.stats.HT, 10);

    if (attribute === "Will") {
      return toNumber(character.secondary?.Will, toNumber(character.stats.IQ, 10));
    }

    if (attribute === "Per") {
      return toNumber(character.secondary?.Per, toNumber(character.stats.IQ, 10));
    }

    return 10;
  }

  function calculateStatCost(attribute, value) {
    const base = 10;
    const costPerLevel = STAT_COSTS[attribute] || 0;
    return (toNumber(value, base) - base) * costPerLevel;
  }

  function calculateAllStatCosts(character) {
    const stats = character.stats || {};
    return {
      ST: calculateStatCost("ST", stats.ST),
      DX: calculateStatCost("DX", stats.DX),
      IQ: calculateStatCost("IQ", stats.IQ),
      HT: calculateStatCost("HT", stats.HT),
    };
  }

  function calculateStatPointTotal(character) {
    const costs = calculateAllStatCosts(character);
    return costs.ST + costs.DX + costs.IQ + costs.HT;
  }

  function calculateSecondaryPointTotal(character) {
    const stats = character.stats || {};
    const secondary = character.secondary || {};

    const ST = toNumber(stats.ST, 10);
    const IQ = toNumber(stats.IQ, 10);
    const HT = toNumber(stats.HT, 10);

    const HP = toNumber(secondary.HP, ST);
    const Will = toNumber(secondary.Will, IQ);
    const Per = toNumber(secondary.Per, IQ);
    const FP = toNumber(secondary.FP, HT);

    const hpCost = (HP - ST) * SECONDARY_COSTS.HP;
    const willCost = (Will - IQ) * SECONDARY_COSTS.Will;
    const perCost = (Per - IQ) * SECONDARY_COSTS.Per;
    const fpCost = (FP - HT) * SECONDARY_COSTS.FP;

    const speedCost = (toNumber(secondary.speedAdj, 0) / 0.25) * 5;
    const moveCost = toNumber(secondary.moveAdj, 0) * 5;

    return hpCost + willCost + perCost + fpCost + speedCost + moveCost;
  }

  function calculateTraitPoints(trait) {
    if (!trait) return 0;

    if (!trait.autoCost) {
      return toNumber(trait.points, 0);
    }

    const baseCost = toNumber(trait.baseCost, 0);
    const levels = toNumber(trait.levels, 1);
    const modifierPct = toNumber(trait.modifierPct, 0);

    return Math.round(baseCost * levels * (1 + modifierPct / 100));
  }

  function calculateTraitPointTotal(character) {
    return normalizeArray(character.traits).reduce(
      (sum, trait) => sum + calculateTraitPoints(trait),
      0
    );
  }

  function calculateTraitPointTotalByType(character, type) {
    return normalizeArray(character.traits)
      .filter((trait) => trait.type === type)
      .reduce((sum, trait) => sum + calculateTraitPoints(trait), 0);
  }

  function calculateListPointTotal(list) {
    return normalizeArray(list).reduce(
      (sum, item) => sum + toNumber(item.points, 0),
      0
    );
  }

  function calculateBasicLift(ST) {
    const value = (toNumber(ST, 10) * toNumber(ST, 10)) / 5;

    if (value >= 10) {
      return Math.round(value);
    }

    return round(value, 1);
  }

  function calculateDamage(ST, secondary = {}) {
    const roundedST = Math.round(toNumber(ST, 10));
    const row = DAMAGE_BY_ST[roundedST];

    return {
      thrust: secondary.thrOverride || row?.[0] || "manual",
      swing: secondary.swOverride || row?.[1] || "manual",
    };
  }

  function calculateBasicSpeed(character) {
    const DX = toNumber(character.stats?.DX, 10);
    const HT = toNumber(character.stats?.HT, 10);
    const adjustment = toNumber(character.secondary?.speedAdj, 0);

    return round((DX + HT) / 4 + adjustment, 2);
  }

  function calculateBasicMove(character) {
    const basicSpeed = calculateBasicSpeed(character);
    const moveAdj = toNumber(character.secondary?.moveAdj, 0);

    return Math.max(0, Math.floor(basicSpeed) + moveAdj);
  }

  function calculateTotalWeight(items) {
    return normalizeArray(items).reduce((sum, item) => {
      const quantity = toNumber(item.qty, 1);
      const weight = toNumber(item.weight, 0);
      return sum + quantity * weight;
    }, 0);
  }

  function calculateCarriedWeight(character) {
    const gearWeight = calculateTotalWeight(character.equipment);
    const armorWeight = calculateTotalWeight(character.armor);

    return round(gearWeight + armorWeight, 2);
  }

  function calculateEncumbrance(weight, basicLift) {
    const carried = toNumber(weight, 0);
    const BL = Math.max(toNumber(basicLift, 0), 0.1);

    if (carried <= BL) {
      return {
        name: "None",
        level: 0,
        moveMultiplier: 1,
        maxWeight: BL,
      };
    }

    if (carried <= 2 * BL) {
      return {
        name: "Light",
        level: 1,
        moveMultiplier: 0.8,
        maxWeight: 2 * BL,
      };
    }

    if (carried <= 3 * BL) {
      return {
        name: "Medium",
        level: 2,
        moveMultiplier: 0.6,
        maxWeight: 3 * BL,
      };
    }

    if (carried <= 6 * BL) {
      return {
        name: "Heavy",
        level: 3,
        moveMultiplier: 0.4,
        maxWeight: 6 * BL,
      };
    }

    if (carried <= 10 * BL) {
      return {
        name: "Extra-Heavy",
        level: 4,
        moveMultiplier: 0.2,
        maxWeight: 10 * BL,
      };
    }

    return {
      name: "Overloaded",
      level: 5,
      moveMultiplier: 0,
      maxWeight: 10 * BL,
    };
  }

  function calculateLoadedMove(character) {
    const basicMove = calculateBasicMove(character);
    const basicLift = calculateBasicLift(character.stats?.ST);
    const carriedWeight = calculateCarriedWeight(character);
    const encumbrance = calculateEncumbrance(carriedWeight, basicLift);

    return Math.max(0, Math.floor(basicMove * encumbrance.moveMultiplier));
  }

  function calculateDodge(character) {
    const basicSpeed = calculateBasicSpeed(character);
    const shieldDB = toNumber(character.secondary?.shieldDB, 0);
    const dodgeBonus = toNumber(character.secondary?.dodgeBonus, 0);
    const basicLift = calculateBasicLift(character.stats?.ST);
    const carriedWeight = calculateCarriedWeight(character);
    const encumbrance = calculateEncumbrance(carriedWeight, basicLift);

    return Math.floor(basicSpeed) + 3 + shieldDB + dodgeBonus - encumbrance.level;
  }

  function calculateStartingWealth(character) {
    const override = character.meta?.startingWealthOverride;

    if (override !== "" && override !== null && override !== undefined) {
      return toNumber(override, 0);
    }

    const TL = toNumber(character.meta?.TL, 3);
    return STARTING_WEALTH_BY_TL[TL] || 0;
  }

  function calculateSkillRelativeFromPoints(points, difficulty) {
    const pointValue = toNumber(points, 0);

    if (pointValue <= 0) return null;
    if (difficulty === "Technique") return null;
    if (difficulty === "Other") return null;

    const isWildcard = difficulty === "Wildcard";
    const adjustedPoints = isWildcard ? pointValue / 3 : pointValue;
    const normalizedDifficulty = isWildcard ? "Very Hard" : difficulty;

    const difficultyOffset = {
      Easy: 0,
      Average: -1,
      Hard: -2,
      "Very Hard": -3,
    }[normalizedDifficulty];

    if (difficultyOffset === undefined) return null;

    let rank;

    if (adjustedPoints < 2) {
      rank = 0;
    } else if (adjustedPoints < 4) {
      rank = 1;
    } else if (adjustedPoints < 8) {
      rank = 2;
    } else {
      rank = 3 + Math.floor((adjustedPoints - 8) / 4);
    }

    return difficultyOffset + rank;
  }

  function calculateSkillPointsForRelative(relativeLevel, difficulty) {
    if (difficulty === "Technique") return 0;
    if (difficulty === "Other") return 0;

    const isWildcard = difficulty === "Wildcard";
    const normalizedDifficulty = isWildcard ? "Very Hard" : difficulty;

    const difficultyOffset = {
      Easy: 0,
      Average: -1,
      Hard: -2,
      "Very Hard": -3,
    }[normalizedDifficulty];

    if (difficultyOffset === undefined) return 0;

    const rank = toNumber(relativeLevel, 0) - difficultyOffset;

    let cost;

    if (rank < 0) {
      cost = 0;
    } else if (rank === 0) {
      cost = 1;
    } else if (rank === 1) {
      cost = 2;
    } else if (rank === 2) {
      cost = 4;
    } else {
      cost = 8 + (rank - 3) * 4;
    }

    return isWildcard ? cost * 3 : cost;
  }

  function calculateSkillLevel(character, skill) {
    if (!skill) return "—";

    if (
      skill.manualLevel !== "" &&
      skill.manualLevel !== null &&
      skill.manualLevel !== undefined
    ) {
      return toNumber(skill.manualLevel, 0);
    }

    const relative = calculateSkillRelativeFromPoints(
      skill.points,
      skill.difficulty
    );

    if (relative === null) return "—";

    const base = getPrimaryAttribute(character, skill.stat);
    return base + relative;
  }

  function calculateSkillRelativeText(character, skill) {
    const level = calculateSkillLevel(character, skill);

    if (level === "—") return "—";

    const base = getPrimaryAttribute(character, skill.stat);
    const relative = level - base;

    return `${skill.stat}${relative === 0 ? "" : signed(relative)}`;
  }

  function calculateCharacter(character) {
    const statCosts = calculateAllStatCosts(character);
    const statPointTotal = calculateStatPointTotal(character);
    const secondaryPointTotal = calculateSecondaryPointTotal(character);
    const traitPointTotal = calculateTraitPointTotal(character);

    const skillPointTotal = calculateListPointTotal(character.skills);
    const techniquePointTotal = calculateListPointTotal(character.techniques);
    const spellPointTotal = calculateListPointTotal(character.spells);

    const totalPoints =
      statPointTotal +
      secondaryPointTotal +
      traitPointTotal +
      skillPointTotal +
      techniquePointTotal +
      spellPointTotal;

    const pointBudget = toNumber(character.meta?.pointBudget, 0);
    const remainingPoints = pointBudget - totalPoints;

    const ST = toNumber(character.stats?.ST, 10);
    const basicLift = calculateBasicLift(ST);
    const carriedWeight = calculateCarriedWeight(character);
    const encumbrance = calculateEncumbrance(carriedWeight, basicLift);
    const basicSpeed = calculateBasicSpeed(character);
    const basicMove = calculateBasicMove(character);
    const loadedMove = calculateLoadedMove(character);
    const dodge = calculateDodge(character);
    const damage = calculateDamage(ST, character.secondary || {});
    const startingWealth = calculateStartingWealth(character);

    return {
      pointBudget,
      totalPoints,
      remainingPoints,

      statCosts,
      statPointTotal,
      secondaryPointTotal,
      traitPointTotal,
      skillPointTotal,
      techniquePointTotal,
      spellPointTotal,

      advantagePoints: calculateTraitPointTotalByType(character, "Advantage"),
      disadvantagePoints: calculateTraitPointTotalByType(character, "Disadvantage"),
      perkPoints: calculateTraitPointTotalByType(character, "Perk"),
      quirkPoints: calculateTraitPointTotalByType(character, "Quirk"),

      basicLift,
      carriedWeight,
      encumbrance,
      basicSpeed,
      basicMove,
      loadedMove,
      dodge,
      damage,
      startingWealth,
    };
  }

  window.GURPSCalc = {
    STAT_COSTS,
    SECONDARY_COSTS,
    STARTING_WEALTH_BY_TL,
    DAMAGE_BY_ST,

    toNumber,
    round,
    signed,
    clamp,

    getPrimaryAttribute,
    calculateStatCost,
    calculateAllStatCosts,
    calculateStatPointTotal,
    calculateSecondaryPointTotal,

    calculateTraitPoints,
    calculateTraitPointTotal,
    calculateTraitPointTotalByType,

    calculateListPointTotal,
    calculateBasicLift,
    calculateDamage,
    calculateBasicSpeed,
    calculateBasicMove,
    calculateTotalWeight,
    calculateCarriedWeight,
    calculateEncumbrance,
    calculateLoadedMove,
    calculateDodge,
    calculateStartingWealth,

    calculateSkillRelativeFromPoints,
    calculateSkillPointsForRelative,
    calculateSkillLevel,
    calculateSkillRelativeText,

    calculateCharacter,
  };
})();
