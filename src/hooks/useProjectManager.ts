import { useState, useMemo, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowchartProject } from '../types/project';
import type { GroupMeta } from '../utils/schemaCompiler';
import {
  loadAllProjects,
  saveAllProjects,
  getActiveProjectId,
  setActiveProjectId as persistActiveProjectId,
  createBlankProject,
  duplicateProject,
} from '../utils/projectStorage';

export function useProjectManager() {
  const [projects, setProjects] = useState<FlowchartProject[]>(() =>
    loadAllProjects()
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    getActiveProjectId(projects)
  );

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  const refreshProjects = useCallback(() => {
    setProjects(loadAllProjects());
  }, []);

  const handleSelectProject = useCallback(
    (id: string, onLoaded?: (target: FlowchartProject) => void) => {
      const target = projects.find((p) => p.id === id);
      if (target) {
        setActiveProjectIdState(id);
        persistActiveProjectId(id);
        onLoaded?.(target);
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
  };
}

