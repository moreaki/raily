import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

type UseRailwayMapKeyboardShortcutsArgs = {
  onUndo: () => void;
  onSelectAllNodes: () => void;
  onDeleteSelection: () => void;
  hasDeletionTarget: boolean;
};

export function useRailwayMapKeyboardShortcuts(args: UseRailwayMapKeyboardShortcutsArgs) {
  const { onUndo, onSelectAllNodes, onDeleteSelection, hasDeletionTarget } = args;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const hasPrimaryModifier = event.metaKey || event.ctrlKey;

      if (hasPrimaryModifier && !event.shiftKey && key === "z") {
        event.preventDefault();
        onUndo();
        return;
      }

      if (hasPrimaryModifier && key === "a") {
        event.preventDefault();
        onSelectAllNodes();
        return;
      }

      if (key === "backspace" || key === "delete") {
        if (!hasDeletionTarget) return;
        event.preventDefault();
        onDeleteSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasDeletionTarget, onDeleteSelection, onSelectAllNodes, onUndo]);
}
