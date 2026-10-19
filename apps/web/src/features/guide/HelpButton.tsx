import { Button } from "antd";
import { useTranslation } from "react-i18next";

import { useGuide } from "./useGuide.js";

export function HelpButton() {
  const { t } = useTranslation("guide");
  const guide = useGuide();
  return (
    <Button aria-haspopup="dialog" onClick={() => guide.openHelp()}>
      {t("helpButton")}
    </Button>
  );
}
