import type { MapPoint } from "@/entities/railway-map/model/types";
import { useState } from "react";

export type NodeContextMenuState = {
  nodeIds: string[];
  x: number;
  y: number;
  markerKey: string | null;
  laneId: string | null;
  segmentId: string | null;
};

export type SegmentContextMenuState = {
  segmentId: string;
  x: number;
  y: number;
  point?: MapPoint;
};

export function useRailwayMapContextMenus() {
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);
  const [segmentContextMenu, setSegmentContextMenu] = useState<SegmentContextMenuState | null>(null);
  const [nodeAssignmentQuery, setNodeAssignmentQuery] = useState("");
  const [nodeAssignmentName, setNodeAssignmentName] = useState("");

  function closeNodeContextMenu() {
    setNodeContextMenu(null);
  }

  function closeSegmentContextMenu() {
    setSegmentContextMenu(null);
  }

  function closeAllContextMenus() {
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
  }

  function resetNodeAssignmentDrafts() {
    setNodeAssignmentQuery("");
    setNodeAssignmentName("");
  }

  return {
    nodeContextMenu,
    setNodeContextMenu,
    closeNodeContextMenu,
    segmentContextMenu,
    setSegmentContextMenu,
    closeSegmentContextMenu,
    closeAllContextMenus,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    nodeAssignmentName,
    setNodeAssignmentName,
    resetNodeAssignmentDrafts,
  };
}
