export const MIN_NAVIGATION_WIDTH = 220;
export const MIN_AI_WIDTH = 300;
const MIN_WRITING_WIDTH = 620;

export function getWorkbenchLayout(width: number, preferredNavigationWidth: number, navigationVisible: boolean) {
  const navigationIsDrawer = width < 880;
  const maxNavigationWidth = Math.max(MIN_NAVIGATION_WIDTH, Math.min(440, width - MIN_WRITING_WIDTH));
  const navigationWidth = Math.min(maxNavigationWidth, Math.max(MIN_NAVIGATION_WIDTH, preferredNavigationWidth));
  const mainWidth = width - (navigationIsDrawer || !navigationVisible ? 0 : navigationWidth);
  const maxAiWidth = Math.min(640, mainWidth - MIN_WRITING_WIDTH);

  return {
    navigationIsDrawer,
    navigationWidth,
    maxNavigationWidth,
    inspectorCanDock: mainWidth >= MIN_WRITING_WIDTH + 280,
    inspectorWidth: Math.min(356, Math.max(280, mainWidth - MIN_WRITING_WIDTH)),
    aiCanDock: maxAiWidth >= MIN_AI_WIDTH,
    maxAiWidth,
  };
}

export function getSplitLayout(width: number, height: number) {
  const stacked = width < 660 && (width < 540 || height >= 380);
  const length = stacked ? height : width;
  const minPaneSize = stacked ? 120 : 240;
  const minimum = length ? Math.min(50, Math.max(20, Math.ceil(minPaneSize / length * 100))) : 20;
  return { stacked, minimum, maximum: 100 - minimum };
}
