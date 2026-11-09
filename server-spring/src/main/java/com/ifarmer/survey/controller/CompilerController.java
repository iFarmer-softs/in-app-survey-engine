package com.ifarmer.survey.controller;

import com.ifarmer.survey.model.dto.CompileRequest;
import com.ifarmer.survey.model.dto.CompileResponse;
import com.ifarmer.survey.model.dto.ValidateRequest;
import com.ifarmer.survey.model.dto.ValidateResponse;
import com.ifarmer.survey.service.CompilerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/compiler")
public class CompilerController {

    private final CompilerService compilerService;

    public CompilerController(CompilerService compilerService) {
        this.compilerService = compilerService;
    }

    @PostMapping("/compile")
    public ResponseEntity<CompileResponse> compile(@RequestBody CompileRequest req) {
        return ResponseEntity.ok(compilerService.compile(req));
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidateResponse> validate(@RequestBody ValidateRequest req) {
        return ResponseEntity.ok(compilerService.validate(req));
    }
}

