import { useEffect, useMemo, useState } from "react";
import type { Line, RailwayMap, Station, StationKind } from "@/entities/railway-map/model/types";

type UseRailwayMapSelectionArgs = {
  initialMap: RailwayMap;
  currentNodes: RailwayMap["model"]["nodes"];
  currentStations: Array<Station & { nodeId: string }>;
  currentSegments: RailwayMap["model"]["segments"];
  modelStations: RailwayMap["model"]["stations"];
  configLines: Line[];
  configStationKinds: StationKind[];
  nodeExistsById: Map<string, RailwayMap["model"]["nodes"][number]>;
  segmentExistsById: Map<string, RailwayMap["model"]["segments"][number]>;
  markerKeys: Set<string>;
};

export function useRailwayMapSelection(args: UseRailwayMapSelectionArgs) {
  const {
    initialMap,
    currentNodes,
    currentStations,
    currentSegments,
    modelStations,
    configLines,
    configStationKinds,
    nodeExistsById,
    segmentExistsById,
    markerKeys,
  } = args;

  const [selectedNodeId, setSelectedNodeId] = useState(initialMap.model.nodes[0]?.id ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(initialMap.model.nodes[0]?.id ? [initialMap.model.nodes[0].id] : []);
  const [selectedNodeMarkerKey, setSelectedNodeMarkerKey] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState(initialMap.model.stations[0]?.id ?? "");
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialMap.model.segments[0]?.id ?? "");
  const [selectedLineId, setSelectedLineId] = useState(initialMap.config.lines[0]?.id ?? "");
  const [selectedStationKindId, setSelectedStationKindId] = useState(initialMap.config.stationKinds[0]?.id ?? "");

  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  useEffect(() => {
    const currentNodeIdSet = new Set(currentNodes.map((node) => node.id));
    const filteredSelectedIds = selectedNodeIds.filter((nodeId) => currentNodeIdSet.has(nodeId));
    if (filteredSelectedIds.length !== selectedNodeIds.length) {
      setSelectedNodeIds(filteredSelectedIds);
    }

    if (selectedNodeId && !nodeExistsById.has(selectedNodeId)) {
      setSelectedNodeId(filteredSelectedIds[0] ?? "");
    }
  }, [currentNodes, nodeExistsById, selectedNodeId, selectedNodeIds]);

  useEffect(() => {
    if (!selectedNodeMarkerKey) return;
    if (!markerKeys.has(selectedNodeMarkerKey)) {
      setSelectedNodeMarkerKey(null);
    }
  }, [markerKeys, selectedNodeMarkerKey]);

  useEffect(() => {
    if (!configLines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(configLines[0]?.id ?? "");
    }
  }, [configLines, selectedLineId]);

  useEffect(() => {
    if (selectedStationId && !modelStations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId("");
    }
  }, [modelStations, selectedStationId]);

  useEffect(() => {
    if (selectedSegmentId && !segmentExistsById.has(selectedSegmentId)) {
      setSelectedSegmentId("");
    }
  }, [currentSegments, segmentExistsById, selectedSegmentId]);

  useEffect(() => {
    if (!configStationKinds.some((kind) => kind.id === selectedStationKindId)) {
      setSelectedStationKindId(configStationKinds[0]?.id ?? "");
    }
  }, [configStationKinds, selectedStationKindId]);

  function selectSingleNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedNodeMarkerKey(null);
    setSelectedSegmentId("");
    const station = currentStations.find((candidate) => candidate.nodeId === nodeId);
    setSelectedStationId(station?.id ?? "");
  }

  function selectAllNodesOnCurrentSheet() {
    const nextSelectedNodeIds = currentNodes.map((node) => node.id);
    setSelectedNodeIds(nextSelectedNodeIds);
    setSelectedNodeId(nextSelectedNodeIds[0] ?? "");
    setSelectedNodeMarkerKey(null);
    const firstStation = currentStations.find((station) => station.nodeId === nextSelectedNodeIds[0]);
    setSelectedStationId(firstStation?.id ?? "");
  }

  function clearPrimarySelection() {
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedNodeMarkerKey(null);
    setSelectedStationId("");
    setSelectedSegmentId("");
  }

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedNodeIdsSet,
    selectedNodeMarkerKey,
    setSelectedNodeMarkerKey,
    selectedStationId,
    setSelectedStationId,
    selectedSegmentId,
    setSelectedSegmentId,
    selectedLineId,
    setSelectedLineId,
    selectedStationKindId,
    setSelectedStationKindId,
    selectSingleNode,
    selectAllNodesOnCurrentSheet,
    clearPrimarySelection,
  };
}
