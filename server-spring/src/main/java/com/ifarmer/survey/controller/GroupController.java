package com.ifarmer.survey.controller;

import com.ifarmer.survey.model.dto.CreateGroupRequest;
import com.ifarmer.survey.model.dto.QuestionGroupDto;
import com.ifarmer.survey.model.dto.UpdateGroupRequest;
import com.ifarmer.survey.service.GroupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping
    public ResponseEntity<List<QuestionGroupDto>> findAll() {
        return ResponseEntity.ok(groupService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuestionGroupDto> findOne(@PathVariable String id) {
        return ResponseEntity.ok(groupService.findOne(id));
    }

    @PostMapping
    public ResponseEntity<QuestionGroupDto> create(@RequestBody CreateGroupRequest req) {
        return ResponseEntity.ok(groupService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuestionGroupDto> update(
            @PathVariable String id,
            @RequestBody UpdateGroupRequest req
    ) {
        return ResponseEntity.ok(groupService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        return ResponseEntity.ok(groupService.delete(id));
    }

    @PostMapping("/reset")
    public ResponseEntity<List<QuestionGroupDto>> reset() {
        return ResponseEntity.ok(groupService.reset());
    }
}

