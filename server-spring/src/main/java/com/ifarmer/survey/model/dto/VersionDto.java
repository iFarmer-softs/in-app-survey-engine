package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record VersionDto(
    String id,
    String version,
    String title,
    String description,
    String status,
    String createdAt,
    String createdBy,
    int nodeCount,
    int edgeCount,
    int questionCount,
    int groupCount,
    JsonNode nodes,
    JsonNode edges,
    JsonNode groupMeta
) {}

