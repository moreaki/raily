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

export type BendPointContextMenuState = {
  segmentId: string;
  pointIndex: number;
  x: number;
  y: number;
};

export function useRailwayMapContextMenus() {
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);
  const [segmentContextMenu, setSegmentContextMenu] = useState<SegmentContextMenuState | null>(null);
  const [bendPointContextMenu, setBendPointContextMenu] = useState<BendPointContextMenuState | null>(null);
  const [nodeAssignmentQuery, setNodeAssignmentQuery] = useState("");
  const [nodeAssignmentName, setNodeAssignmentName] = useState("");

  function closeNodeContextMenu() {
    setNodeContextMenu(null);
  }

  function closeSegmentContextMenu() {
    setSegmentContextMenu(null);
  }

  function closeBendPointContextMenu() {
    setBendPointContextMenu(null);
  }

  function closeAllContextMenus() {
    setNodeContextMenu(null);
    setSegmentContextMenu(null);
    setBendPointContextMenu(null);
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
    bendPointContextMenu,
    setBendPointContextMenu,
    closeBendPointContextMenu,
    closeAllContextMenus,
    nodeAssignmentQuery,
    setNodeAssignmentQuery,
    nodeAssignmentName,
    setNodeAssignmentName,
    resetNodeAssignmentDrafts,
  };
}
