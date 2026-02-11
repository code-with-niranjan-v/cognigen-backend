// utils/contentMigration.js

/**
 * Converts legacy content → cells format (one-time or on-read)
 * @param {Object} submodule
 * @returns {Object} updated submodule
 */
function migrateToCells(submodule) {
  if (submodule.contentVersion >= 2 && submodule.cells?.length > 0) {
    return submodule; // already migrated
  }

  const cells = [];

  const old = submodule.content || {};

  if (old.explanation) {
    cells.push({
      type: "explanation",
      content: old.explanation.trim(),
    });
  }

  if (old.codeExamples?.length) {
    old.codeExamples.forEach((code, idx) => {
      cells.push({
        type: "code",
        title: `Example ${idx + 1}`,
        content: code,
        language: "javascript", // ← guess or make configurable later
      });
    });
  }

  if (old.stepByStepGuide?.length) {
    cells.push({
      type: "steps",
      content: old.stepByStepGuide.map((s) => s.trim()).filter(Boolean),
    });
  }

  if (old.realWorldExamples?.length) {
    old.realWorldExamples.forEach((ex) => {
      cells.push({
        type: "explanation",
        content: `**Real-world example:** ${ex.trim()}`,
      });
    });
  }

  // miniQuiz and projectSuggestion are intentionally NOT migrated here
  // miniQuiz comes later via separate generation

  return {
    ...submodule,
    cells,
    contentVersion: 2,
    // optionally: keep old content for some time
    // legacyContent: old,
  };
}

module.exports = { migrateToCells };
