/**
 * Left-dock MODE visibility — both panels stay mounted; only one slot visible.
 * @param {'ARITHMETIC'|'COMPARE'} mode
 * @returns {{ arithmeticHidden: boolean, compareHidden: boolean }}
 */
export function leftPanelVisibility(mode) {
  const isCompare = mode === 'COMPARE';
  return {
    arithmeticHidden: isCompare,
    compareHidden: !isCompare,
  };
}

/**
 * Prefer NAVIGATION framing for Compare (many threads); ANALYSIS for Arithmetic.
 * @param {'ARITHMETIC'|'COMPARE'} workspaceMode
 * @returns {'ANALYSIS'|'NAVIGATION'}
 */
export function preferredViewForWorkspace(workspaceMode) {
  return workspaceMode === 'COMPARE' ? 'NAVIGATION' : 'ANALYSIS';
}
