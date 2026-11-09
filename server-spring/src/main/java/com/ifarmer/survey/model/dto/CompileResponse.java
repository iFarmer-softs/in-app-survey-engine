package com.ifarmer.survey.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompileResponse(
    int total_groups,
    Integer current_group,
    boolean next,
    String instruction,
    List<Map<String, Object>> data,
    List<Map<String, String>> groups,
    List<Map<String, String>> groups_to_jump
) {}

