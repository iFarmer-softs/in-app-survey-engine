package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record UpdateProjectRequest(
    String title,
    String titleBn,
    String description,
    String status,
    String currentVersion,
    String publishedVersionId,
    JsonNode nodes,
    JsonNode edges,
    JsonNode groupMeta
) {}

