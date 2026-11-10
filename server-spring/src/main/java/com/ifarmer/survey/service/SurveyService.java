package com.ifarmer.survey.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ifarmer.survey.model.dto.*;
import com.ifarmer.survey.model.entity.ProjectEntity;
import com.ifarmer.survey.model.entity.SurveyResponseEntity;
import com.ifarmer.survey.model.entity.VersionEntity;
import com.ifarmer.survey.repository.ProjectRepository;
import com.ifarmer.survey.repository.SurveyResponseRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@Service
public class SurveyService {

    private final ProjectRepository projectRepository;
    private final SurveyResponseRepository responseRepository;
    private final CompilerService compilerService;
    private final ObjectMapper objectMapper;

    private static final String UPLOAD_DIR = "uploads";

    public SurveyService(
            ProjectRepository projectRepository,
            SurveyResponseRepository responseRepository,
            CompilerService compilerService,
            ObjectMapper objectMapper
    ) {
        this.projectRepository = projectRepository;
        this.responseRepository = responseRepository;
        this.compilerService = compilerService;
        this.objectMapper = objectMapper;

        // Ensure upload directory exists
        File uploadFolder = new File(UPLOAD_DIR);
        if (!uploadFolder.exists()) {
            uploadFolder.mkdirs();
        }
    }

    @Transactional(readOnly = true)
    public List<SurveyHeaderDto> listSurveys() {
        return projectRepository.findAllWithVersions().stream()
                .map(this::mapToHeaderDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public SurveyHeaderDto getSurveyHeader(String surveyId) {
        ProjectEntity project = projectRepository.findByIdWithVersions(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Survey with ID '" + surveyId + "' not found"));
        return mapToHeaderDto(project);
    }

    @Transactional(readOnly = true)
    public CompileResponse getSurveyGroup(String surveyId, int groupNumber, String respondentId) {
        ProjectEntity project = projectRepository.findByIdWithVersions(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Survey with ID '" + surveyId + "' not found"));

        // Determine nodes and edges to compile (use published version if set, else current canvas)
        JsonNode nodes = project.getNodes();
        JsonNode edges = project.getEdges();
        JsonNode groupMeta = project.getGroupMeta();
        String versionId = null;

        if (project.getPublishedVersionId() != null && !project.getPublishedVersionId().isBlank()) {
            Optional<VersionEntity> publishedVersion = project.getVersions().stream()
                    .filter(v -> v.getId().equals(project.getPublishedVersionId()))
                    .findFirst();
            if (publishedVersion.isPresent()) {
                VersionEntity v = publishedVersion.get();
                nodes = v.getNodes();
                edges = v.getEdges();
                groupMeta = v.getGroupMeta();
                versionId = v.getId();
            }
        }

        // Set requested groupNumber in groupMeta override
        ObjectNode metaOverride;
        if (groupMeta != null && groupMeta.isObject()) {
            metaOverride = ((ObjectNode) groupMeta).deepCopy();
        } else {
            metaOverride = objectMapper.createObjectNode();
        }
        metaOverride.put("groupNumber", groupNumber);

        // Compile full flowchart into Dynamic KYC JSON
        CompileResponse compiled = compilerService.compile(new CompileRequest(nodes, edges, metaOverride));

        // Fetch existing answers if respondentId is provided (resuming or review/coordinator flow)
        Map<String, String> previousAnswers = new HashMap<>();
        if (respondentId != null && !respondentId.isBlank()) {
            List<SurveyResponseEntity> previousResponses =
                    responseRepository.findBySurveyIdAndRespondentIdOrderByGroupNumberAsc(surveyId, respondentId);
            for (SurveyResponseEntity resp : previousResponses) {
                extractAnswersMap(resp.getAnswers(), previousAnswers);
            }
        }

        // Filter questions for the specific group if survey has multi-group structure
        List<Map<String, Object>> filteredQuestions = new ArrayList<>();
        int targetGroup = groupNumber > 0 ? groupNumber : 1;

        if (compiled.data() != null) {
            for (Map<String, Object> q : compiled.data()) {
                Object gObj = q.get("group");
                int qGroup = (gObj instanceof Number) ? ((Number) gObj).intValue() : 1;

                if (compiled.total_groups() <= 1 || qGroup == targetGroup) {
                    Map<String, Object> questionCopy = new LinkedHashMap<>(q);
                    Object qIdObj = questionCopy.get("question_id");
                    if (qIdObj != null) {
                        String qIdStr = String.valueOf(qIdObj);
                        if (previousAnswers.containsKey(qIdStr)) {
                            questionCopy.put("value", previousAnswers.get(qIdStr));
                        }
                    }
                    filteredQuestions.add(questionCopy);
                }
            }
        }

        // Compute navigation flags
        int totalGroups = compiled.total_groups();
        boolean hasSubsequentJump = false;
        if (compiled.groups_to_jump() != null) {
            for (Map<String, Object> j : compiled.groups_to_jump()) {
                Object gObj = j.get("group_id");
                if (gObj != null) {
                    try {
                        int jGroup = Integer.parseInt(String.valueOf(gObj));
                        if (jGroup > targetGroup) {
                            hasSubsequentJump = true;
                            break;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        boolean hasNext = (targetGroup < totalGroups) || hasSubsequentJump;

        return new CompileResponse(
                totalGroups,
                targetGroup,
                hasNext,
                compiled.instruction(),
                filteredQuestions,
                compiled.groups(),
                compiled.groups_to_jump()
        );
    }

    @Transactional
    public SurveyResponseDto submitResponse(
            String surveyId,
            SubmitSurveyResponseRequest req,
            List<MultipartFile> files
    ) {
        ProjectEntity project = projectRepository.findById(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Survey with ID '" + surveyId + "' not found"));

        String responseId = "resp-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
        Instant now = Instant.now();

        // Save uploaded media files if present
        ArrayNode mediaUrls = objectMapper.createArrayNode();
        if (files != null && !files.isEmpty()) {
            Path surveyUploadPath = Paths.get(UPLOAD_DIR, "surveys", surveyId);
            try {
                Files.createDirectories(surveyUploadPath);
                for (MultipartFile file : files) {
                    if (file == null || file.isEmpty()) continue;
                    String origName = file.getOriginalFilename();
                    String ext = "";
                    if (origName != null && origName.contains(".")) {
                        ext = origName.substring(origName.lastIndexOf('.'));
                    }
                    String savedFileName = System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
                    Path destPath = surveyUploadPath.resolve(savedFileName);
                    file.transferTo(destPath.toFile());

                    String publicUrl = "/uploads/surveys/" + surveyId + "/" + savedFileName;
                    mediaUrls.add(publicUrl);
                }
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store uploaded files: " + e.getMessage());
            }
        }

        // Extract answers payload
        JsonNode answers = req.answers() != null ? req.answers() : req.data();
        if (answers == null) {
            answers = objectMapper.createObjectNode();
        }

        String respondentId = req.respondentId() != null && !req.respondentId().isBlank()
                ? req.respondentId()
                : (req.farmerId() != null ? req.farmerId() : "anonymous");

        int groupNum = req.groupNumber() != null ? req.groupNumber() : 1;

        SurveyResponseEntity entity = new SurveyResponseEntity();
        entity.setId(responseId);
        entity.setSurveyId(surveyId);
        entity.setVersionId(project.getPublishedVersionId() != null ? project.getPublishedVersionId() : project.getCurrentVersion());
        entity.setRespondentId(respondentId);
        entity.setSurveyorId(req.surveyorId() != null ? req.surveyorId() : "field-agent");
        entity.setGroupNumber(groupNum);
        entity.setAnswers(answers);
        entity.setMediaUrls(mediaUrls);
        entity.setLatitude(req.latitude());
        entity.setLongitude(req.longitude());
        entity.setIsGroupJumped(req.isGroupJumped() != null ? req.isGroupJumped() : false);
        entity.setMetadata(req.metadata() != null ? req.metadata() : objectMapper.createObjectNode());
        entity.setCreatedAt(now);

        SurveyResponseEntity saved = responseRepository.save(entity);
        return mapToResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public List<SurveyResponseDto> getResponses(String surveyId, String respondentId, String surveyorId) {
        if (!projectRepository.existsById(surveyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Survey with ID '" + surveyId + "' not found");
        }

        List<SurveyResponseEntity> list;
        if (respondentId != null && !respondentId.isBlank()) {
            list = responseRepository.findBySurveyIdAndRespondentIdOrderByGroupNumberAsc(surveyId, respondentId);
        } else if (surveyorId != null && !surveyorId.isBlank()) {
            list = responseRepository.findBySurveyIdAndSurveyorIdOrderByCreatedAtDesc(surveyId, surveyorId);
        } else {
            list = responseRepository.findBySurveyIdOrderByCreatedAtDesc(surveyId);
        }

        return list.stream().map(this::mapToResponseDto).toList();
    }

    @Transactional(readOnly = true)
    public SurveyResponseDto getResponseById(String responseId) {
        SurveyResponseEntity entity = responseRepository.findById(responseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Response with ID '" + responseId + "' not found"));
        return mapToResponseDto(entity);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRespondentSummary(String surveyId, String respondentId) {
        ProjectEntity project = projectRepository.findById(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Survey with ID '" + surveyId + "' not found"));

        List<SurveyResponseEntity> responses =
                responseRepository.findBySurveyIdAndRespondentIdOrderByGroupNumberAsc(surveyId, respondentId);

        Map<String, Object> aggregatedAnswers = new LinkedHashMap<>();
        List<String> allMediaUrls = new ArrayList<>();
        Map<String, Object> lastKnownLocation = new LinkedHashMap<>();
        int completedGroupsCount = responses.size();

        for (SurveyResponseEntity resp : responses) {
            extractAnswersMap(resp.getAnswers(), aggregatedAnswers);
            if (resp.getMediaUrls() != null && resp.getMediaUrls().isArray()) {
                resp.getMediaUrls().forEach(m -> allMediaUrls.add(m.asText()));
            }
            if (resp.getLatitude() != null && resp.getLongitude() != null) {
                lastKnownLocation.put("lat", resp.getLatitude());
                lastKnownLocation.put("lng", resp.getLongitude());
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("surveyId", surveyId);
        summary.put("surveyTitle", project.getTitle());
        summary.put("surveyTitleBn", project.getTitleBn());
        summary.put("respondentId", respondentId);
        summary.put("completedGroupsCount", completedGroupsCount);
        summary.put("totalSurveyGroups", extractTotalGroups(project.getGroupMeta()));
        summary.put("answers", aggregatedAnswers);
        summary.put("mediaUrls", allMediaUrls);
        summary.put("lastLocation", lastKnownLocation);
        summary.put("submissionHistory", responses.stream().map(this::mapToResponseDto).toList());

        return summary;
    }

    private void extractAnswersMap(JsonNode answersNode, Map<String, ?> targetMap) {
        if (answersNode == null) return;
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) targetMap;

        if (answersNode.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = answersNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                map.put(field.getKey(), field.getValue().isTextual() ? field.getValue().asText() : field.getValue().toString());
            }
        } else if (answersNode.isArray()) {
            // Handles [{ "questionId": 101, "answer": "Yes" }]
            for (JsonNode item : answersNode) {
                if (item.has("questionId") && item.has("answer")) {
                    map.put(item.get("questionId").asText(), item.get("answer").asText());
                } else if (item.has("question_id") && item.has("answer")) {
                    map.put(item.get("question_id").asText(), item.get("answer").asText());
                }
            }
        }
    }

    private int extractTotalGroups(JsonNode groupMeta) {
        if (groupMeta != null && groupMeta.has("totalGroups")) {
            return groupMeta.path("totalGroups").asInt(1);
        }
        return 1;
    }

    private SurveyHeaderDto mapToHeaderDto(ProjectEntity entity) {
        int totalGroups = extractTotalGroups(entity.getGroupMeta());
        return new SurveyHeaderDto(
                entity.getId(),
                entity.getTitle(),
                entity.getTitleBn(),
                entity.getDescription(),
                entity.getStatus(),
                entity.getCurrentVersion(),
                entity.getPublishedVersionId(),
                totalGroups,
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString(),
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : Instant.now().toString()
        );
    }

    private SurveyResponseDto mapToResponseDto(SurveyResponseEntity entity) {
        return new SurveyResponseDto(
                entity.getId(),
                entity.getSurveyId(),
                entity.getVersionId(),
                entity.getRespondentId(),
                entity.getSurveyorId(),
                entity.getGroupNumber(),
                entity.getAnswers(),
                entity.getMediaUrls(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getIsGroupJumped(),
                entity.getMetadata(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString()
        );
    }
}
