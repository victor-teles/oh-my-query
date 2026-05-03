import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsland } from "@/contexts/island-context";

import type { SettingsSectionId } from "./-components/settings-sidebar";

import { EditorFontSection } from "./-components/editor-font-section";
import { ExportSettingsSection } from "./-components/export-settings-section";
import { GeneralThemeSection } from "./-components/general-theme-section";
import { SavedIndicator } from "./-components/saved-indicator";
import { SettingsFeedbackProvider } from "./-components/settings-feedback-context";
import { SettingsSidebar } from "./-components/settings-sidebar";
import { SettingsTitlebar } from "./-components/settings-titlebar";
import { SyntaxThemeSection } from "./-components/syntax-theme-section";
import { UpdateChannelSection } from "./-components/update-channel-section";
import { useSettingsHotkeys } from "./-hooks/use-settings-hotkeys";

const SectionPanel = ({ section }: { section: SettingsSectionId }) => {
  if (section === "appearance") {
    return <GeneralThemeSection />;
  }
  if (section === "syntax-theme") {
    return <SyntaxThemeSection />;
  }
  if (section === "code-font") {
    return <EditorFontSection />;
  }
  if (section === "updates") {
    return <UpdateChannelSection />;
  }
  return <ExportSettingsSection />;
};

const SettingsComponent = () => {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("appearance");
  const { setSnapshot } = useIsland();
  const navigate = useNavigate();

  useEffect(() => {
    setSnapshot({ kind: "hidden" });
  }, [setSnapshot]);

  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: "/" });
  }, [navigate]);

  useSettingsHotkeys({
    onClose: handleClose,
    onSelectSection: setActiveSection,
  });

  return (
    <>
      <SettingsTitlebar onClose={handleClose} />

      <SettingsFeedbackProvider>
        <div className="flex flex-1 overflow-hidden">
          <SettingsSidebar active={activeSection} onSelect={setActiveSection} />

          <div className="relative flex flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <div className="max-w-2xl p-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    animate={{ filter: "blur(0px)", opacity: 1 }}
                    exit={{ filter: "blur(4px)", opacity: 0 }}
                    initial={{ filter: "blur(4px)", opacity: 0 }}
                    key={activeSection}
                    transition={{ duration: 0.15 }}
                  >
                    <SectionPanel section={activeSection} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScrollArea>
            <SavedIndicator />
          </div>
        </div>
      </SettingsFeedbackProvider>
    </>
  );
};

export const Route = createFileRoute("/_default/settings")({
  component: SettingsComponent,
});
