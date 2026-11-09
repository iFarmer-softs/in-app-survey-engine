import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { apiClient } from '../services/api';

export function useProjectManager() {
  const [projects, setProjects] = useState<FlowchartProject[]>(() =>
    loadAllProjects()
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    getActiveProjectId(projects)
  );
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Check NestJS Server connectivity & load remote projects on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAndSync() {
      try {
        const isHealthy = await apiClient.checkHealth();
        if (!isMounted) return;
        setIsServerConnected(isHealthy);

        if (isHealthy) {
          try {
            const remoteProjects = await apiClient.getProjects();
            if (isMounted && remoteProjects && remoteProjects.length > 0) {
              setProjects(remoteProjects);
              saveAllProjects(remoteProjects);
            }
          } catch (projErr) {
            console.warn('[ProjectManager] Failed to fetch remote projects:', projErr);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsServerConnected(false);
        }
      }
    }

    checkAndSync();
    const interval = setInterval(checkAndSync, 15000); // Check every 15s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const activeProject = useMemo(() => {
    const found = projects.find((p) => p.id === activeProjectId) || projects[0];
    return found ? ensureProjectVersions(found) : found;
  }, [projects, activeProjectId]);

  const refreshProjects = useCallback(async () => {
    if (isServerConnected) {
      try {
        const remote = await apiClient.getProjects();
        if (remote && remote.length > 0) {
          setProjects(remote);
          saveAllProjects(remote);
          return;
        }
      } catch (err) {
        console.warn('Failed to refresh from NestJS server, falling back to local storage', err);
      }
    }
    setProjects(loadAllProjects());
  }, [isServerConnected]);

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
    async (
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

      if (isServerConnected) {
        try {
          await apiClient.createProject({
            title: newProj.title,
            titleBn: newProj.titleBn,
            description: newProj.description,
            totalGroups: newProj.groupMeta?.totalGroups || 1,
            nodes: newProj.nodes,
            edges: newProj.edges,
            groupMeta: newProj.groupMeta,
          });
        } catch (err) {
          console.error('Failed to create project on NestJS server:', err);
        }
      }
    },
    [projects, isServerConnected]
  );

  const handleDuplicateProject = useCallback(
    async (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return;

      const cloned = duplicateProject(source);
      const updated = [cloned, ...projects];
      setProjects(updated);
      saveAllProjects(updated);

      if (isServerConnected) {
        try {
          await apiClient.duplicateProject(id);
        } catch (err) {
          console.error('Failed to duplicate project on NestJS server:', err);
        }
      }
    },
    [projects, isServerConnected]
  );

  const handleDeleteProject = useCallback(
    async (id: string, onSelectFallback?: (nextId: string) => void) => {
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      saveAllProjects(updated);

      if (activeProjectId === id) {
        const next = updated[0];
        if (next) {
          setActiveProjectIdState(next.id);
          persistActiveProjectId(next.id);
          onSelectFallback?.(next.id);
        } else {
          setActiveProjectIdState('');
          persistActiveProjectId('');
          onSelectFallback?.('');
        }
      }

      if (isServerConnected) {
        try {
          await apiClient.deleteProject(id);
        } catch (err) {
          console.error('Failed to delete project on NestJS server:', err);
        }
      }
    },
    [projects, activeProjectId, isServerConnected]
  );

  const syncActiveProject = useCallback(
    async (nodes: Node[], edges: Edge[], groupMeta: GroupMeta, skipSync?: boolean) => {
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

      // Asynchronously sync to NestJS server in background
      if (isServerConnected && activeProject.id) {
        setIsSyncing(true);
        try {
          await apiClient.updateProject(activeProject.id, {
            nodes,
            edges,
            groupMeta,
          });
        } catch (err) {
          console.warn('Background NestJS project sync warning:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    },
    [activeProject, isServerConnected]
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

      if (isServerConnected) {
        apiClient
          .createVersion(activeProject.id, {
            version: options.version,
            title: options.title,
            description: options.description,
            isPublished: options.isPublished,
            createdBy: options.createdBy,
            nodes: currentNodes || activeProject.nodes,
            edges: currentEdges || activeProject.edges,
            groupMeta: currentMeta || activeProject.groupMeta,
          })
          .catch((err) => {
            console.error('Failed to save version to NestJS server:', err);
          });
      }

      return newVersion;
    },
    [activeProject, projects, isServerConnected]
  );

  const handleRestoreVersion = useCallback(
    async (
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

      if (isServerConnected) {
        try {
          await apiClient.restoreVersion(activeProject.id, versionId);
        } catch (err) {
          console.error('Failed to restore version on NestJS server:', err);
        }
      }
    },
    [activeProject, projects, isServerConnected]
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
    isServerConnected,
    isSyncing,
  };
}
