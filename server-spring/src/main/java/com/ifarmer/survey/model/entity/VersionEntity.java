package com.ifarmer.survey.model.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "\"flowchart_versions\"")
public class VersionEntity {

    @Id
    @Column(name = "\"id\"", length = 128, nullable = false)
    private String id;

    @Column(name = "\"projectId\"", length = 128, nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"projectId\"", insertable = false, updatable = false)
    private ProjectEntity project;

    @Column(name = "\"version\"", length = 32, nullable = false)
    private String version = "1.0.0";

    @Column(name = "\"title\"", length = 255, nullable = false)
    private String title;

    @Column(name = "\"description\"", columnDefinition = "TEXT")
    private String description;

    @Column(name = "\"status\"", length = 32, nullable = false)
    private String status = "draft";

    @CreationTimestamp
    @Column(name = "\"createdAt\"", updatable = false)
    private Instant createdAt;

    @Column(name = "\"createdBy\"", length = 128)
    private String createdBy;

    @Column(name = "\"nodeCount\"", nullable = false)
    private int nodeCount = 0;

    @Column(name = "\"edgeCount\"", nullable = false)
    private int edgeCount = 0;

    @Column(name = "\"questionCount\"", nullable = false)
    private int questionCount = 0;

    @Column(name = "\"groupCount\"", nullable = false)
    private int groupCount = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"groupMeta\"", columnDefinition = "jsonb")
    private JsonNode groupMeta;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"nodes\"", columnDefinition = "jsonb")
    private JsonNode nodes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"edges\"", columnDefinition = "jsonb")
    private JsonNode edges;

    public VersionEntity() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public ProjectEntity getProject() {
        return project;
    }

    public void setProject(ProjectEntity project) {
        this.project = project;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public int getNodeCount() {
        return nodeCount;
    }

    public void setNodeCount(int nodeCount) {
        this.nodeCount = nodeCount;
    }

    public int getEdgeCount() {
        return edgeCount;
    }

    public void setEdgeCount(int edgeCount) {
        this.edgeCount = edgeCount;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public void setQuestionCount(int questionCount) {
        this.questionCount = questionCount;
    }

    public int getGroupCount() {
        return groupCount;
    }

    public void setGroupCount(int groupCount) {
        this.groupCount = groupCount;
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
}
