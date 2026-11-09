package com.ifarmer.survey.controller;

import com.ifarmer.survey.model.dto.*;
import com.ifarmer.survey.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ResponseEntity<List<ProjectDto>> findAll() {
        return ResponseEntity.ok(projectService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectDto> findOne(@PathVariable String id) {
        return ResponseEntity.ok(projectService.findOne(id));
    }

    @PostMapping
    public ResponseEntity<ProjectDto> create(@RequestBody CreateProjectRequest req) {
        return ResponseEntity.ok(projectService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectDto> update(
            @PathVariable String id,
            @RequestBody UpdateProjectRequest req
    ) {
        return ResponseEntity.ok(projectService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        return ResponseEntity.ok(projectService.delete(id));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ProjectDto> duplicate(@PathVariable String id) {
        return ResponseEntity.ok(projectService.duplicate(id));
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<Map<String, Object>> createVersion(
            @PathVariable String id,
            @RequestBody CreateVersionRequest req
    ) {
        return ResponseEntity.ok(projectService.createVersion(id, req));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ResponseEntity<ProjectDto> restoreVersion(
            @PathVariable String id,
            @PathVariable String versionId
    ) {
        return ResponseEntity.ok(projectService.restoreVersion(id, versionId));
    }
}

