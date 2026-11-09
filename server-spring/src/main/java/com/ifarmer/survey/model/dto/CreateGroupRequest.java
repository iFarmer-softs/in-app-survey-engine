package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record CreateGroupRequest(
    String name,
    String nameBn,
    String description,
    String category,
    String color,
    Integer groupId,
    JsonNode questions,
    JsonNode flowNodes,
    JsonNode flowEdges
) {}

