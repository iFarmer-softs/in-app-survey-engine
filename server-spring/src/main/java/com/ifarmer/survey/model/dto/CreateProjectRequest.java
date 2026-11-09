package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record CreateProjectRequest(
    String title,
    String titleBn,
    String description,
    Integer totalGroups,
    JsonNode nodes,
    JsonNode edges,
    JsonNode groupMeta
) {}

