package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record ProjectDto(
    String id,
    String title,
    String titleBn,
    String description,
    String status,
    String currentVersion,
    String publishedVersionId,
    String createdAt,
    String updatedAt,
    JsonNode groupMeta,
    JsonNode nodes,
    JsonNode edges,
    List<VersionDto> versions
) {}

