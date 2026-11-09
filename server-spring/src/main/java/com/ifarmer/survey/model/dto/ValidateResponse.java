package com.ifarmer.survey.model.dto;

import java.util.List;
import java.util.Map;

public record ValidateResponse(
    boolean isValid,
    List<String> errors,
    List<String> warnings,
    Map<String, Integer> summary
) {}

