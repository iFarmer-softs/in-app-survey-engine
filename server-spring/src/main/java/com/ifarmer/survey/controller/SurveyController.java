package com.ifarmer.survey.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifarmer.survey.model.dto.*;
import com.ifarmer.survey.service.SurveyService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class SurveyController {

    private final SurveyService surveyService;
    private final ObjectMapper objectMapper;

    public SurveyController(SurveyService surveyService, ObjectMapper objectMapper) {
        this.surveyService = surveyService;
        this.objectMapper = objectMapper;
    }

    /**
     * Lists all surveys available for mobile facilitators.
     */
    @GetMapping("/api/surveys")
    public ResponseEntity<List<SurveyHeaderDto>> listSurveys() {
        return ResponseEntity.ok(surveyService.listSurveys());
    }

    /**
     * Gets survey overview by ID.
     */
    @GetMapping("/api/surveys/{surveyId}")
    public ResponseEntity<SurveyHeaderDto> getSurveyHeader(@PathVariable String surveyId) {
        return ResponseEntity.ok(surveyService.getSurveyHeader(surveyId));
    }

    /**
     * Mobile Runtime Endpoint: Returns compiled Dynamic KYC JSON schema for a specific group.
     * Supports ?respondentId=... (or ?farmerId=...) to pre-fill existing answers for review / modify flow.
     */
    @GetMapping({"/api/surveys/{surveyId}/groups/{groupNumber}", "/api/projects/{surveyId}/groups/{groupNumber}"})
    public ResponseEntity<CompileResponse> getSurveyGroup(
            @PathVariable String surveyId,
            @PathVariable int groupNumber,
            @RequestParam(required = false) String respondentId,
            @RequestParam(required = false) String farmerId
    ) {
        String activeRespondent = respondentId != null ? respondentId : farmerId;
        return ResponseEntity.ok(surveyService.getSurveyGroup(surveyId, groupNumber, activeRespondent));
    }

    /**
     * Response Ingestion: JSON payload.
     */
    @PostMapping(
            value = {"/api/surveys/{surveyId}/responses", "/api/projects/{surveyId}/responses"},
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<SurveyResponseDto> submitJsonResponse(
            @PathVariable String surveyId,
            @RequestBody SubmitSurveyResponseRequest req
    ) {
        return ResponseEntity.ok(surveyService.submitResponse(surveyId, req, null));
    }

    /**
     * Response Ingestion: Multipart form data with photo uploads and GPS coordinates.
     * Matches the exact Android multipart submission shape (data, images[], location).
     */
    @PostMapping(
            value = {"/api/surveys/{surveyId}/responses", "/api/projects/{surveyId}/responses"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<SurveyResponseDto> submitMultipartResponse(
            @PathVariable String surveyId,
            @RequestPart(value = "data", required = false) String dataJson,
            @RequestPart(value = "location", required = false) String locationJson,
            @RequestPart(value = "images[]", required = false) List<MultipartFile> imagesArray,
            @RequestPart(value = "files", required = false) List<MultipartFile> genericFiles,
            @RequestParam(value = "farmerId", required = false) String farmerId,
            @RequestParam(value = "respondentId", required = false) String respondentId,
            @RequestParam(value = "surveyorId", required = false) String surveyorId,
            @RequestParam(value = "group", required = false) Integer groupParam,
            @RequestParam(value = "groupNumber", required = false) Integer groupNumberParam,
            @RequestParam(value = "is_group_jumped", required = false) Boolean isGroupJumpedParam
    ) {
        JsonNode parsedAnswers = null;
        if (dataJson != null && !dataJson.isBlank()) {
            try {
                parsedAnswers = objectMapper.readTree(dataJson);
                // If wrapped in `{ "kyc_data": [...] }`, extract the data array
                if (parsedAnswers.has("kyc_data")) {
                    parsedAnswers = parsedAnswers.get("kyc_data");
                }
            } catch (Exception ignored) {}
        }

        Double lat = null;
        Double lng = null;
        if (locationJson != null && !locationJson.isBlank()) {
            try {
                JsonNode locNode = objectMapper.readTree(locationJson);
                if (locNode.has("lat")) lat = locNode.get("lat").asDouble();
                if (locNode.has("lng")) lng = locNode.get("lng").asDouble();
            } catch (Exception ignored) {}
        }

        List<MultipartFile> allFiles = new ArrayList<>();
        if (imagesArray != null) allFiles.addAll(imagesArray);
        if (genericFiles != null) allFiles.addAll(genericFiles);

        int resolvedGroup = groupNumberParam != null ? groupNumberParam : (groupParam != null ? groupParam : 1);
        String resolvedRespondent = respondentId != null ? respondentId : (farmerId != null ? farmerId : "anonymous");

        SubmitSurveyResponseRequest req = new SubmitSurveyResponseRequest(
                parsedAnswers,
                null,
                resolvedRespondent,
                farmerId,
                surveyorId,
                resolvedGroup,
                lat,
                lng,
                isGroupJumpedParam,
                null
        );

        return ResponseEntity.ok(surveyService.submitResponse(surveyId, req, allFiles));
    }

    /**
     * Lists responses for a survey with optional filtering.
     */
    @GetMapping({"/api/surveys/{surveyId}/responses", "/api/projects/{surveyId}/responses"})
    public ResponseEntity<List<SurveyResponseDto>> getResponses(
            @PathVariable String surveyId,
            @RequestParam(required = false) String respondentId,
            @RequestParam(required = false) String surveyorId
    ) {
        return ResponseEntity.ok(surveyService.getResponses(surveyId, respondentId, surveyorId));
    }

    /**
     * Gets a single response by ID.
     */
    @GetMapping({"/api/surveys/{surveyId}/responses/{responseId}", "/api/projects/{surveyId}/responses/{responseId}"})
    public ResponseEntity<SurveyResponseDto> getResponseById(
            @PathVariable String surveyId,
            @PathVariable String responseId
    ) {
        return ResponseEntity.ok(surveyService.getResponseById(responseId));
    }

    /**
     * Respondent Summary: Aggregates answers, photos, and location history across all groups.
     * Directly powers coordinator review / modify flows.
     */
    @GetMapping({"/api/surveys/{surveyId}/respondents/{respondentId}/summary", "/api/projects/{surveyId}/respondents/{respondentId}/summary"})
    public ResponseEntity<Map<String, Object>> getRespondentSummary(
            @PathVariable String surveyId,
            @PathVariable String respondentId
    ) {
        return ResponseEntity.ok(surveyService.getRespondentSummary(surveyId, respondentId));
    }
}

