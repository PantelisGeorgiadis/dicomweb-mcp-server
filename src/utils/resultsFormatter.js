/**
 * Formats an array of plain objects into a human-readable multi-line string.
 *
 * Each object is rendered as a labelled block. camelCase property keys are
 * converted to space-separated capitalised labels and right-padded for
 * alignment. Missing or empty values are displayed as an empty string.
 * Array values (e.g. mapped DICOM `SQ` sequences) are rendered as indented
 * sub-blocks: the property name is printed as a section header (suffixed with
 * `:`), then each element is introduced by an `Item N:` line and its own
 * properties are indented by a further two spaces.
 * @method
 * @param {Object[]} items    - Array of plain objects to format.
 * @param {string}  [itemName=Item] - Singular label used in each block header (e.g. `'Study'`).
 * @returns {string} Human-readable string with one block per item separated by blank lines.
 */
export function formatResults(items, itemName = 'Item') {
  const na = (v) => (v != null && v !== '' ? v : '');
  const camelToLabel = (key) =>
    key.replace(/(?<![A-Z])([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

  const renderEntries = (obj, indent) => {
    const allEntries = Object.entries(obj).map(([key, value]) => [camelToLabel(key), value]);
    const lines = [];
    let run = [];

    const flushRun = () => {
      if (run.length === 0) return;
      const maxLen = Math.max(0, ...run.map(([label]) => label.length));
      for (const [label, value] of run) {
        lines.push(`${indent}  ${label.padEnd(maxLen)}  ${na(value)}`);
      }
      run = [];
    };

    for (const [label, value] of allEntries) {
      if (Array.isArray(value)) {
        flushRun();
        lines.push(`${indent}  ${label}:`);
        value.forEach((subItem, j) => {
          lines.push(`${indent}    Item ${j + 1}:`);
          lines.push(...renderEntries(subItem, `${indent}    `));
        });
      } else {
        run.push([label, value]);
      }
    }
    flushRun();

    return lines;
  };

  return items
    .map((r, i) => {
      return [`${itemName} ${i + 1} of ${items.length}`, ...renderEntries(r, '')].join('\n');
    })
    .join('\n\n');
}
