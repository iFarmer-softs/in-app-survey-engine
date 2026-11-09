package com.ifarmer.survey.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ifarmer.survey.model.dto.*;
import com.ifarmer.survey.model.entity.ProjectEntity;
import com.ifarmer.survey.model.entity.VersionEntity;
import com.ifarmer.survey.repository.ProjectRepository;
import com.ifarmer.survey.repository.VersionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final VersionRepository versionRepository;
    private final ObjectMapper objectMapper;

    public ProjectService(
            ProjectRepository projectRepository,
            VersionRepository versionRepository,
            ObjectMapper objectMapper
    ) {
        this.projectRepository = projectRepository;
        this.versionRepository = versionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> findAll() {
        return projectRepository.findAllWithVersions().stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectDto findOne(String id) {
        return projectRepository.findByIdWithVersions(id)
                .map(this::mapToDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project with ID '" + id + "' not found"));
    }

    @Transactional
    public ProjectDto create(CreateProjectRequest req) {
        Instant now = Instant.now();
        String id = "proj-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 5);
        int totalGroups = (req.totalGroups() != null && req.totalGroups() > 0) ? req.totalGroups() : 1;

        JsonNode initialNodes = (req.nodes() != null && req.nodes().isArray()) ? req.nodes() : objectMapper.createArrayNode();
        JsonNode initialEdges = (req.edges() != null && req.edges().isArray()) ? req.edges() : objectMapper.createArrayNode();

        JsonNode initialMeta = req.groupMeta();
        if (initialMeta == null || initialMeta.isNull()) {
            ObjectNode metaObj = objectMapper.createObjectNode();
            metaObj.put("groupNumber", 1);
            metaObj.put("totalGroups", totalGroups);
            metaObj.put("hasNextGroup", totalGroups > 1);
            metaObj.put("instruction", "Complete the questions in this survey section.");
            metaObj.putArray("groupJumps");
            initialMeta = metaObj;
        }

        String initialVersionId = "ver-init-" + id;
        VersionEntity initialVersion = new VersionEntity();
        initialVersion.setId(initialVersionId);
        initialVersion.setProjectId(id);
        initialVersion.setVersion("0.1.0");
        initialVersion.setTitle("Initial Draft Baseline");
        initialVersion.setDescription(req.description() != null ? req.description() : "Base project setup.");
        initialVersion.setStatus("draft");
        initialVersion.setCreatedAt(now);
        initialVersion.setCreatedBy("System / Author");
        initialVersion.setNodeCount(initialNodes.size());
        initialVersion.setEdgeCount(initialEdges.size());
        initialVersion.setQuestionCount(countQuestions(initialNodes));
        initialVersion.setGroupCount(totalGroups);
        initialVersion.setNodes(initialNodes.deepCopy());
        initialVersion.setEdges(initialEdges.deepCopy());
        initialVersion.setGroupMeta(initialMeta.deepCopy());

        ProjectEntity project = new ProjectEntity();
        project.setId(id);
        project.setTitle(req.title() != null ? req.title() : "Untitled Survey Workflow");
        project.setTitleBn(req.titleBn() != null ? req.titleBn() : "");
        project.setDescription(req.description() != null ? req.description() : "");
        project.setStatus("draft");
        project.setCurrentVersion("0.1.0");
        project.setCreatedAt(now);
        project.setUpdatedAt(now);
        project.setGroupMeta(initialMeta);
        project.setNodes(initialNodes);
        project.setEdges(initialEdges);
        project.getVersions().add(initialVersion);

        initialVersion.setProject(project);

        projectRepository.save(project);
        versionRepository.save(initialVersion);

        return mapToDto(project);
    }

    @Transactional
    public ProjectDto update(String id, UpdateProjectRequest req) {
        ProjectEntity project = projectRepository.findByIdWithVersions(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project with ID '" + id + "' not found"));

        if (req.title() != null) project.setTitle(req.title());
        if (req.titleBn() != null) project.setTitleBn(req.titleBn());
        if (req.description() != null) project.setDescription(req.description());
        if (req.status() != null) project.setStatus(req.status());
        if (req.currentVersion() != null) project.setCurrentVersion(req.currentVersion());
        if (req.publishedVersionId() != null) project.setPublishedVersionId(req.publishedVersionId());
        if (req.nodes() != null) project.setNodes(req.nodes());
        if (req.edges() != null) project.setEdges(req.edges());
        if (req.groupMeta() != null) project.setGroupMeta(req.groupMeta());

        project.setUpdatedAt(Instant.now());
        ProjectEntity saved = projectRepository.save(project);
        return mapToDto(saved);
    }

    @Transactional
    public Map<String, Object> delete(String id) {
        if (!projectRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project with ID '" + id + "' not found");
        }
        projectRepository.deleteById(id);
        return Map.of("success", true, "id", id);
    }

    @Transactional
    public ProjectDto duplicate(String id) {
        ProjectDto source = findOne(id);
        Instant now = Instant.now();
        String newId = "proj-copy-" + System.currentTimeMillis();

        VersionEntity newVersion = new VersionEntity();
        newVersion.setId("ver-init-" + newId);
        newVersion.setProjectId(newId);
        newVersion.setVersion("0.1.0");
        newVersion.setTitle("Cloned from " + source.title() + " (v" + source.currentVersion() + ")");
        newVersion.setDescription("Duplicated on " + now.toString());
        newVersion.setStatus("draft");
        newVersion.setCreatedAt(now);
        newVersion.setCreatedBy("Cloned by User");
        newVersion.setNodeCount(source.nodes() != null ? source.nodes().size() : 0);
        newVersion.setEdgeCount(source.edges() != null ? source.edges().size() : 0);
        newVersion.setQuestionCount(countQuestions(source.nodes()));
        newVersion.setGroupCount(1);
        newVersion.setNodes(source.nodes() != null ? source.nodes().deepCopy() : objectMapper.createArrayNode());
        newVersion.setEdges(source.edges() != null ? source.edges().deepCopy() : objectMapper.createArrayNode());
        newVersion.setGroupMeta(source.groupMeta() != null ? source.groupMeta().deepCopy() : objectMapper.createObjectNode());

        ProjectEntity cloned = new ProjectEntity();
        cloned.setId(newId);
        cloned.setTitle(source.title() + " (Copy)");
        cloned.setTitleBn(source.titleBn() != null && !source.titleBn().isBlank() ? source.titleBn() + " (কপি)" : "");
        cloned.setDescription(source.description() != null ? source.description() : "");
        cloned.setStatus("draft");
        cloned.setCurrentVersion("0.1.0");
        cloned.setCreatedAt(now);
        cloned.setUpdatedAt(now);
        cloned.setGroupMeta(source.groupMeta());
        cloned.setNodes(source.nodes());
        cloned.setEdges(source.edges());
        cloned.getVersions().add(newVersion);

        newVersion.setProject(cloned);

        projectRepository.save(cloned);
        versionRepository.save(newVersion);

        return mapToDto(cloned);
    }

    @Transactional
    public Map<String, Object> createVersion(String id, CreateVersionRequest req) {
        ProjectEntity project = projectRepository.findByIdWithVersions(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project with ID '" + id + "' not found"));

        Instant now = Instant.now();
        String newVersionId = "ver-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4);

        JsonNode currentNodes = req.nodes() != null ? req.nodes() : project.getNodes();
        JsonNode currentEdges = req.edges() != null ? req.edges() : project.getEdges();
        JsonNode currentMeta = req.groupMeta() != null ? req.groupMeta() : project.getGroupMeta();

        boolean isPublished = Boolean.TRUE.equals(req.isPublished());

        VersionEntity version = new VersionEntity();
        version.setId(newVersionId);
        version.setProjectId(id);
        version.setVersion(req.version() != null ? req.version() : "1.0.0");
        version.setTitle(req.title() != null ? req.title() : "Version Snapshot");
        version.setDescription(req.description() != null ? req.description() : "");
        version.setStatus(isPublished ? "published" : "draft");
        version.setCreatedAt(now);
        version.setCreatedBy(req.createdBy() != null ? req.createdBy() : "Flowchart Author");
        version.setNodeCount(currentNodes != null ? currentNodes.size() : 0);
        version.setEdgeCount(currentEdges != null ? currentEdges.size() : 0);
        version.setQuestionCount(countQuestions(currentNodes));
        version.setGroupCount(extractTotalGroups(currentMeta));
        version.setNodes(currentNodes != null ? currentNodes.deepCopy() : objectMapper.createArrayNode());
        version.setEdges(currentEdges != null ? currentEdges.deepCopy() : objectMapper.createArrayNode());
        version.setGroupMeta(currentMeta != null ? currentMeta.deepCopy() : objectMapper.createObjectNode());
        version.setProject(project);

        if (isPublished) {
            versionRepository.archivePublishedVersions(id);
            project.setPublishedVersionId(newVersionId);
            project.setStatus("published");
        }

        project.setCurrentVersion(version.getVersion());
        project.setUpdatedAt(now);
        project.getVersions().add(version);

        versionRepository.save(version);
        projectRepository.save(project);

        ProjectDto updatedProject = findOne(id);
        VersionDto newVersionDto = mapVersionToDto(version);

        Map<String, Object> response = new HashMap<>();
        response.put("updatedProject", updatedProject);
        response.put("newVersion", newVersionDto);
        return response;
    }

    @Transactional
    public ProjectDto restoreVersion(String id, String versionId) {
        ProjectEntity project = projectRepository.findByIdWithVersions(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project with ID '" + id + "' not found"));

        VersionEntity targetVersion = versionRepository.findByIdAndProjectId(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version '" + versionId + "' not found in project '" + id + "'"));

        project.setNodes(targetVersion.getNodes().deepCopy());
        project.setEdges(targetVersion.getEdges().deepCopy());
        project.setGroupMeta(targetVersion.getGroupMeta().deepCopy());
        project.setCurrentVersion(targetVersion.getVersion());
        project.setUpdatedAt(Instant.now());

        projectRepository.save(project);
        return findOne(id);
    }

    private int countQuestions(JsonNode nodes) {
        if (nodes == null || !nodes.isArray()) return 0;
        int count = 0;
        for (JsonNode n : nodes) {
            if ("question".equals(n.path("type").asText())) {
                count++;
            }
        }
        return count;
    }

    private int extractTotalGroups(JsonNode meta) {
        if (meta == null) return 1;
        int tg = meta.path("totalGroups").asInt(1);
        return tg > 0 ? tg : 1;
    }

    private ProjectDto mapToDto(ProjectEntity entity) {
        List<VersionDto> versions = entity.getVersions() != null
                ? entity.getVersions().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::mapVersionToDto)
                .toList()
                : List.of();

        return new ProjectDto(
                entity.getId(),
                entity.getTitle(),
                entity.getTitleBn(),
                entity.getDescription(),
                entity.getStatus(),
                entity.getCurrentVersion(),
                entity.getPublishedVersionId(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString(),
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : Instant.now().toString(),
                entity.getGroupMeta(),
                entity.getNodes(),
                entity.getEdges(),
                versions
        );
    }

    private VersionDto mapVersionToDto(VersionEntity entity) {
        return new VersionDto(
                entity.getId(),
                entity.getVersion(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getStatus(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString(),
                entity.getCreatedBy(),
                entity.getNodeCount(),
                entity.getEdgeCount(),
                entity.getQuestionCount(),
                entity.getGroupCount(),
                entity.getNodes(),
                entity.getEdges(),
                entity.getGroupMeta()
        );
    }
}

