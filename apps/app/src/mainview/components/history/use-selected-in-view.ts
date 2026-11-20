import { useEffect } from "react";

import { optionId } from "@/components/launcher/launcher-row";

// The list can hold hundreds of asks, so arrow keys must bring the selected
// row into the scrolled panel.
export const useSelectedInView = (selectedId: string | null) => {
  useEffect(() => {
    if (selectedId) {
      document
        .querySelector(`#${CSS.escape(optionId(selectedId))}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);
};
