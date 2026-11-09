package com.ifarmer.survey.model.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "\"flowchart_projects\"")
public class ProjectEntity {

    @Id
    @Column(name = "\"id\"", length = 128, nullable = false)
    private String id;

    @Column(name = "\"title\"", length = 255, nullable = false)
    private String title;

    @Column(name = "\"titleBn\"", length = 255)
    private String titleBn;

    @Column(name = "\"description\"", columnDefinition = "TEXT")
    private String description = "";

    @Column(name = "\"status\"", length = 32, nullable = false)
    private String status = "draft";

    @Column(name = "\"currentVersion\"", length = 32, nullable = false)
    private String currentVersion = "0.1.0";

    @Column(name = "\"publishedVersionId\"", length = 128)
    private String publishedVersionId;

    @CreationTimestamp
    @Column(name = "\"createdAt\"", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "\"updatedAt\"")
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"groupMeta\"", columnDefinition = "jsonb")
    private JsonNode groupMeta;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"nodes\"", columnDefinition = "jsonb")
    private JsonNode nodes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"edges\"", columnDefinition = "jsonb")
    private JsonNode edges;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<VersionEntity> versions = new ArrayList<>();

    public ProjectEntity() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getTitleBn() {
        return titleBn;
    }

    public void setTitleBn(String titleBn) {
        this.titleBn = titleBn;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(String currentVersion) {
        this.currentVersion = currentVersion;
    }

    public String getPublishedVersionId() {
        return publishedVersionId;
    }

    public void setPublishedVersionId(String publishedVersionId) {
        this.publishedVersionId = publishedVersionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public JsonNode getGroupMeta() {
        return groupMeta;
    }

    public void setGroupMeta(JsonNode groupMeta) {
        this.groupMeta = groupMeta;
    }

    public JsonNode getNodes() {
        return nodes;
    }

    public void setNodes(JsonNode nodes) {
        this.nodes = nodes;
    }

    public JsonNode getEdges() {
        return edges;
    }

    public void setEdges(JsonNode edges) {
        this.edges = edges;
    }

    public List<VersionEntity> getVersions() {
        return versions;
    }

    public void setVersions(List<VersionEntity> versions) {
        this.versions = versions;
    }
}
