import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChatPanelToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatPanelToggle = ({ isOpen, onToggle }: ChatPanelToggleProps) => (
  <Button
    variant={isOpen ? "secondary" : "ghost"}
    size="icon-xs"
    onClick={onToggle}
    aria-label={isOpen ? "Close AI Chat" : "Open AI Chat"}
    title={isOpen ? "Close AI Chat" : "Open AI Chat"}
  >
    <MessageSquare className="size-3.5" />
  </Button>
);
