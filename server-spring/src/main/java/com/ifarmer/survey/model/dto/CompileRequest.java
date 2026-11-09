package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record CompileRequest(
    JsonNode nodes,
    JsonNode edges,
    JsonNode groupMeta
) {}

