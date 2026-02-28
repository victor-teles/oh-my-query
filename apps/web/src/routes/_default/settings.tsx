import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCallback } from "react";

import { Titlebar } from "@/components/titlebar/titlebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorSettings } from "@/hooks/use-editor-settings";

import { EditorFontSection } from "./-components/editor-font-section";
import { GeneralThemeSection } from "./-components/general-theme-section";
import { SyntaxThemeSection } from "./-components/syntax-theme-section";

const SettingsComponent = () => {
  const { settings, updateSettings } = useEditorSettings();

  const handleClose = useCallback(() => {
    window.history.back();
  }, []);

  const handleThemeChange = useCallback(
    (theme: string) => {
      updateSettings({ syntaxTheme: theme });
    },
    [updateSettings]
  );

  const handleFontFamilyChange = useCallback(
    (fontFamily: string) => {
      updateSettings({ fontFamily });
    },
    [updateSettings]
  );

  const handleFontSizeChange = useCallback(
    (fontSize: number) => {
      updateSettings({ fontSize });
    },
    [updateSettings]
  );

  return (
    <>
      <Titlebar>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Close settings"
                onClick={handleClose}
              />
            }
          >
            <X className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </Titlebar>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <h1 className="mb-6 text-lg font-semibold">Settings</h1>

          <GeneralThemeSection />

          <Separator className="my-8" />

          <SyntaxThemeSection
            value={settings.syntaxTheme}
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            onChange={handleThemeChange}
          />

          <Separator className="my-8" />

          <EditorFontSection
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            syntaxTheme={settings.syntaxTheme}
            onFontFamilyChange={handleFontFamilyChange}
            onFontSizeChange={handleFontSizeChange}
          />
        </div>
      </ScrollArea>
    </>
  );
};

export const Route = createFileRoute("/_default/settings")({
  component: SettingsComponent,
});
