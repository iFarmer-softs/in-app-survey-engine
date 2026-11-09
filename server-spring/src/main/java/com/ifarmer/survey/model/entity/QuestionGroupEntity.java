package com.ifarmer.survey.model.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "\"reusable_question_groups\"")
public class QuestionGroupEntity {

    @Id
    @Column(name = "\"id\"", length = 128, nullable = false)
    private String id;

    @Column(name = "\"groupId\"")
    private Integer groupId;

    @Column(name = "\"name\"", length = 255, nullable = false)
    private String name;

    @Column(name = "\"nameBn\"", length = 255)
    private String nameBn;

    @Column(name = "\"description\"", columnDefinition = "TEXT")
    private String description = "";

    @Column(name = "\"category\"", length = 64, nullable = false)
    private String category = "custom";

    @Column(name = "\"color\"", length = 32, nullable = false)
    private String color = "#0284c7";

    @CreationTimestamp
    @Column(name = "\"createdAt\"", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "\"updatedAt\"")
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"questions\"", columnDefinition = "jsonb")
    private JsonNode questions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"flowNodes\"", columnDefinition = "jsonb")
    private JsonNode flowNodes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"flowEdges\"", columnDefinition = "jsonb")
    private JsonNode flowEdges;

    public QuestionGroupEntity() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Integer getGroupId() {
        return groupId;
    }

    public void setGroupId(Integer groupId) {
        this.groupId = groupId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNameBn() {
        return nameBn;
    }

    public void setNameBn(String nameBn) {
        this.nameBn = nameBn;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
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

    public JsonNode getQuestions() {
        return questions;
    }

    public void setQuestions(JsonNode questions) {
        this.questions = questions;
    }

    public JsonNode getFlowNodes() {
        return flowNodes;
    }

    public void setFlowNodes(JsonNode flowNodes) {
        this.flowNodes = flowNodes;
    }

    public JsonNode getFlowEdges() {
        return flowEdges;
    }

    public void setFlowEdges(JsonNode flowEdges) {
        this.flowEdges = flowEdges;
    }
}
