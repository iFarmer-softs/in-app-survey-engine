package com.ifarmer.survey.seeder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ifarmer.survey.model.entity.ProjectEntity;
import com.ifarmer.survey.model.entity.VersionEntity;
import com.ifarmer.survey.repository.ProjectRepository;
import com.ifarmer.survey.repository.VersionRepository;
import com.ifarmer.survey.service.GroupService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class DatabaseSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSeeder.class);

    private final ProjectRepository projectRepository;
    private final VersionRepository versionRepository;
    private final GroupService groupService;
    private final ObjectMapper objectMapper;

    public DatabaseSeeder(
            ProjectRepository projectRepository,
            VersionRepository versionRepository,
            GroupService groupService,
            ObjectMapper objectMapper
    ) {
        this.projectRepository = projectRepository;
        this.versionRepository = versionRepository;
        this.groupService = groupService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            seedQuestionGroupsIfEmpty();
            seedProjectsIfEmpty();
        } catch (Exception e) {
            log.warn("Auto-seeding encountered a minor issue (database might already be initialized): {}", e.getMessage());
        }
    }

    private void seedQuestionGroupsIfEmpty() {
        groupService.seedDefaultGroups();
    }

    private void seedProjectsIfEmpty() {
        if (projectRepository.count() > 0) {
            return;
        }

        log.info("Seeding initial blank flowchart survey project...");
        Instant now = Instant.now();
        String projId = "proj-blank-survey";

        ObjectNode groupMeta = objectMapper.createObjectNode();
        groupMeta.put("groupNumber", 1);
        groupMeta.put("totalGroups", 1);
        groupMeta.put("hasNextGroup", false);
        groupMeta.put("instruction", "");
        groupMeta.putArray("groupJumps");

        ArrayNode emptyNodes = objectMapper.createArrayNode();
        ArrayNode emptyEdges = objectMapper.createArrayNode();

        VersionEntity initVersion = new VersionEntity();
        initVersion.setId("ver-init-" + projId);
        initVersion.setProjectId(projId);
        initVersion.setVersion("0.1.0");
        initVersion.setTitle("Initial Empty Canvas");
        initVersion.setDescription("Blank starting canvas.");
        initVersion.setStatus("draft");
        initVersion.setCreatedAt(now);
        initVersion.setCreatedBy("Survey Designer");
        initVersion.setNodeCount(0);
        initVersion.setEdgeCount(0);
        initVersion.setQuestionCount(0);
        initVersion.setGroupCount(1);
        initVersion.setNodes(emptyNodes.deepCopy());
        initVersion.setEdges(emptyEdges.deepCopy());
        initVersion.setGroupMeta(groupMeta.deepCopy());

        ProjectEntity project = new ProjectEntity();
        project.setId(projId);
        project.setTitle("New Survey Flowchart");
        project.setTitleBn("নতুন জরিপ ফ্লোচার্ট");
        project.setDescription("Blank flowchart canvas ready for survey creation.");
        project.setStatus("draft");
        project.setCurrentVersion("0.1.0");
        project.setCreatedAt(now);
        project.setUpdatedAt(now);
        project.setGroupMeta(groupMeta);
        project.setNodes(emptyNodes);
        project.setEdges(emptyEdges);
        project.getVersions().add(initVersion);

        initVersion.setProject(project);

        projectRepository.save(project);
        versionRepository.save(initVersion);
        log.info("Blank survey project seeded successfully!");
    }
}

