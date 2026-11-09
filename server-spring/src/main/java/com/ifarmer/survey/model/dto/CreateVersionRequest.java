package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record CreateVersionRequest(
    String version,
    String title,
    String description,
    Boolean isPublished,
    String createdBy,
    JsonNode nodes,
    JsonNode edges,
    JsonNode groupMeta
) {}

