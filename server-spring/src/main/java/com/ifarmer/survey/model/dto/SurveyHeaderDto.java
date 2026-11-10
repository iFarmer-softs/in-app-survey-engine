package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SurveyHeaderDto(
    String id,
    String title,
    String titleBn,
    String description,
    String status,
    String currentVersion,
    String publishedVersionId,
    int totalGroups,
    String createdAt,
    String updatedAt
) {}

