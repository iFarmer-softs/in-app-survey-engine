import { useState, useMemo, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowchartProject, FlowchartVersion } from '../types/project';
import type { GroupMeta } from '../utils/schemaCompiler';
import {
  loadAllProjects,
  saveAllProjects,
  getActiveProjectId,
  setActiveProjectId as persistActiveProjectId,
  createBlankProject,
  duplicateProject,
  addVersionSnapshot,
  restoreProjectVersion,
  ensureProjectVersions,
} from '../utils/projectStorage';

export function useProjectManager() {
  const [projects, setProjects] = useState<FlowchartProject[]>(() =>
    loadAllProjects()
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    getActiveProjectId(projects)
  );

  const activeProject = useMemo(() => {
    const found = projects.find((p) => p.id === activeProjectId) || projects[0];
    return found ? ensureProjectVersions(found) : found;
  }, [projects, activeProjectId]);

  const refreshProjects = useCallback(() => {
    setProjects(loadAllProjects());
  }, []);

  const handleSelectProject = useCallback(
    (id: string, onLoaded?: (target: FlowchartProject) => void) => {
      const target = projects.find((p) => p.id === id);
      if (target) {
        const normalized = ensureProjectVersions(target);
        setActiveProjectIdState(id);
        persistActiveProjectId(id);
        onLoaded?.(normalized);
      }
    },
    [projects]
  );

  const handleCreateNewProject = useCallback(
    (
      title: string,
      titleBn: string,
      description: string,
      totalGroups: number,
      onLoaded?: (newProj: FlowchartProject) => void
    ) => {
      const newProj = createBlankProject(title, titleBn, description, totalGroups);
      const updated = [newProj, ...projects];
      setProjects(updated);
      saveAllProjects(updated);

      setActiveProjectIdState(newProj.id);
      persistActiveProjectId(newProj.id);
      onLoaded?.(newProj);
    },
    [projects]
  );

  const handleDuplicateProject = useCallback(
    (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return;

      const cloned = duplicateProject(source);
      const updated = [cloned, ...projects];
      setProjects(updated);
      saveAllProjects(updated);
    },
    [projects]
  );

  const handleDeleteProject = useCallback(
    (id: string, onSelectFallback?: (nextId: string) => void) => {
      if (projects.length <= 1) {
        alert('You must keep at least one flowchart in your workspace.');
        return;
      }

      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      saveAllProjects(updated);

      if (activeProjectId === id) {
        const next = updated[0];
        if (next) {
          onSelectFallback?.(next.id);
        }
      }
    },
    [projects, activeProjectId]
  );

  const syncActiveProject = useCallback(
    (nodes: Node[], edges: Edge[], groupMeta: GroupMeta, skipSync: boolean) => {
      if (!activeProject || skipSync) return;

      const currentList = loadAllProjects();
      const updated = currentList.map((p) => {
        if (p.id === activeProject.id) {
          return {
            ...p,
            nodes,
            edges,
            groupMeta,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      saveAllProjects(updated);
    },
    [activeProject]
  );

  const handleCreateVersionSnapshot = useCallback(
    (
      options: {
        version: string;
        title: string;
        description?: string;
        isPublished?: boolean;
        createdBy?: string;
      },
      currentNodes?: Node[],
      currentEdges?: Edge[],
      currentMeta?: GroupMeta
    ): FlowchartVersion | null => {
      if (!activeProject) return null;

      const { updatedProject, newVersion } = addVersionSnapshot(activeProject, {
        ...options,
        nodes: currentNodes || activeProject.nodes,
        edges: currentEdges || activeProject.edges,
        groupMeta: currentMeta || activeProject.groupMeta,
      });

      const updatedList = projects.map((p) =>
        p.id === activeProject.id ? updatedProject : p
      );

      setProjects(updatedList);
      saveAllProjects(updatedList);
      return newVersion;
    },
    [activeProject, projects]
  );

  const handleRestoreVersion = useCallback(
    (
      versionId: string,
      onRestored?: (restoredProject: FlowchartProject) => void
    ) => {
      if (!activeProject) return;

      const restored = restoreProjectVersion(activeProject, versionId);
      const updatedList = projects.map((p) =>
        p.id === activeProject.id ? restored : p
      );

      setProjects(updatedList);
      saveAllProjects(updatedList);
      onRestored?.(restored);
    },
    [activeProject, projects]
  );

  return {
    projects,
    setProjects,
    activeProjectId,
    activeProject,
    refreshProjects,
    handleSelectProject,
    handleCreateNewProject,
    handleDuplicateProject,
    handleDeleteProject,
    syncActiveProject,
    handleCreateVersionSnapshot,
    handleRestoreVersion,
  };
}
