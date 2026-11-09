package com.ifarmer.survey.repository;

import com.ifarmer.survey.model.entity.QuestionGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionGroupRepository extends JpaRepository<QuestionGroupEntity, String> {

    List<QuestionGroupEntity> findAllByOrderByCreatedAtDesc();
}

