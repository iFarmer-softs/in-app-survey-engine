package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record QuestionGroupDto(
    String id,
    Integer groupId,
    String name,
    String nameBn,
    String description,
    String category,
    String color,
    String createdAt,
    String updatedAt,
    JsonNode questions,
    JsonNode flowNodes,
    JsonNode flowEdges
) {}

