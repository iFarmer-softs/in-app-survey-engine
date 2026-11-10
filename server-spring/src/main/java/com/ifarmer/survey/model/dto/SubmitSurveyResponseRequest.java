package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SubmitSurveyResponseRequest(
    JsonNode answers,
    JsonNode data, // In case mobile sends `{ "data": ... }` or `{ "kyc_data": ... }`
    String respondentId,
    String farmerId, // Alias for respondentId matching Sofol mobile app convention
    String surveyorId,
    Integer groupNumber,
    Double latitude,
    Double longitude,
    Boolean isGroupJumped,
    JsonNode metadata
) {}

