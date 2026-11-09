package com.ifarmer.survey.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "ok");
        response.put("service", "in-app-survey-engine-spring-backend");
        response.put("timestamp", Instant.now().toString());
        response.put("uptime", ManagementFactory.getRuntimeMXBean().getUptime() / 1000.0);

        Map<String, Object> dbInfo = new LinkedHashMap<>();
        try (Connection conn = dataSource.getConnection()) {
            dbInfo.put("status", "connected");
            dbInfo.put("databaseProductName", conn.getMetaData().getDatabaseProductName());
        } catch (Exception e) {
            dbInfo.put("status", "disconnected");
            dbInfo.put("error", e.getMessage());
        }
        response.put("database", dbInfo);

        return ResponseEntity.ok(response);
    }
}

