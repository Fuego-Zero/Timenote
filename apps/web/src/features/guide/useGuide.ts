import { useContext } from "react";

import { GuideContext } from "./guideContext.js";

export function useGuide() {
  const value = useContext(GuideContext);
  if (!value) {
    throw new Error("useGuide 必须在 GuideProvider 内使用");
  }

  return value;
}
