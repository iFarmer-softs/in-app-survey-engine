package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record ValidateRequest(
    JsonNode nodes,
    JsonNode edges
) {}

