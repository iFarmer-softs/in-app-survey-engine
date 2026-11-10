package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SurveyResponseDto(
    String id,
    String surveyId,
    String versionId,
    String respondentId,
    String surveyorId,
    int groupNumber,
    JsonNode answers,
    JsonNode mediaUrls,
    Double latitude,
    Double longitude,
    Boolean isGroupJumped,
    JsonNode metadata,
    String createdAt
) {}

